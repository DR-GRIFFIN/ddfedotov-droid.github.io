"""Покупки: чеки из папки (например, Google Drive) → база → ответы на вопросы.

Как это работает:
* Чеки (PDF или фото) лежат в папке, которую Google Drive для компьютера
  синхронизирует на Mac. Новые файлы сервер проверяет раз в полчаса.
* Каждый новый файл Claude разбирает в строки: товар, количество, цена.
  Сокращения из чеков («KS MINI CUCUMBR») переводятся в понятные названия
  на английском и русском, чтобы можно было спросить «огурцы».
* Повторно выгруженный тот же чек (тот же магазин, дата и сумма) не
  дублируется.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import time
from pathlib import Path

import anthropic

from ..config import PurchasesConfig
from ..db import DB
from . import NotConfigured, Tool, TurnContext

log = logging.getLogger(__name__)

FILE_TYPES = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MAX_FILE_BYTES = 25 * 1024 * 1024
SETTLE_S = 60  # файл должен «успокоиться» (докачаться из облака)

SCHEMA = """
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sha256 TEXT UNIQUE NOT NULL,
    file TEXT NOT NULL,
    store TEXT,
    date TEXT,
    total REAL,
    tax REAL,
    status TEXT NOT NULL,      -- ok | duplicate | not_receipt | error
    error TEXT,
    imported REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS receipt_items (
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    raw_name TEXT,
    name_en TEXT,
    name_ru TEXT,
    item_number TEXT,
    quantity REAL,
    price REAL,
    is_discount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS receipt_items_receipt ON receipt_items(receipt_id);
"""

PARSE_PROMPT = """\
Это чек из магазина (PDF или фото). Разбери его.
- store: название магазина как на чеке, например «Costco».
- date: дата покупки в формате ГГГГ-ММ-ДД (пустая строка, если не видно).
- total: итоговая сумма к оплате; tax: сумма налогов (0, если нет).
- items: каждая строка товара по порядку.
  - raw_name — как напечатано в чеке;
  - name_en — понятное английское название без сокращений (KS = Kirkland Signature), например «Kirkland mini cucumbers»;
  - name_ru — то же по-русски, например «мини-огурцы Kirkland»;
  - item_number — номер товара, если есть, иначе пустая строка;
  - quantity — количество (1, если не указано);
  - price — сумма по строке;
  - is_discount — true для строк скидки (у Costco они обычно с минусом или пометкой TPD / INSTANT SAVINGS), их price отрицательный.
Если это не чек, верни is_receipt=false и пустые поля."""

RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_receipt": {"type": "boolean"},
        "store": {"type": "string"},
        "date": {"type": "string"},
        "total": {"type": "number"},
        "tax": {"type": "number"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "raw_name": {"type": "string"},
                    "name_en": {"type": "string"},
                    "name_ru": {"type": "string"},
                    "item_number": {"type": "string"},
                    "quantity": {"type": "number"},
                    "price": {"type": "number"},
                    "is_discount": {"type": "boolean"},
                },
                "required": ["raw_name", "name_en", "name_ru", "item_number", "quantity", "price", "is_discount"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["is_receipt", "store", "date", "total", "tax", "items"],
    "additionalProperties": False,
}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class Purchases:
    def __init__(self, cfg: PurchasesConfig, db: DB, client: anthropic.AsyncAnthropic | None, model: str):
        self.cfg = cfg
        self.db = db
        self.client = client
        self.model = model
        self.folder = Path(cfg.folder).expanduser() if cfg.folder else None
        self.task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        db.conn.executescript(SCHEMA)
        db.conn.execute("PRAGMA foreign_keys=ON")

    # ---------- фоновый импорт ----------
    def start(self):
        if self.cfg.enabled and self.folder:
            self.task = asyncio.create_task(self._loop(), name="purchases-import")

    async def stop(self):
        if self.task:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)

    async def _loop(self):
        await asyncio.sleep(20)
        while True:
            try:
                n = await self.import_new()
                if n:
                    log.info("Импортировано чеков: %d", n)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Ошибка импорта чеков")
            await asyncio.sleep(self.cfg.scan_every_min * 60)

    def candidates(self) -> list[Path]:
        if not self.folder or not self.folder.is_dir():
            return []
        now = time.time()
        files = []
        for dirpath, dirnames, filenames in os.walk(self.folder):
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            for name in filenames:
                p = Path(dirpath) / name
                if name.startswith(".") or p.suffix.lower() not in FILE_TYPES:
                    continue
                try:
                    st = p.stat()
                except OSError:
                    continue
                if now - st.st_mtime >= SETTLE_S and 0 < st.st_size <= MAX_FILE_BYTES:
                    files.append(p)
        return sorted(files)

    async def import_new(self) -> int:
        async with self._lock:
            imported = 0
            for path in self.candidates():
                digest = await asyncio.to_thread(sha256_of, path)
                if self.db.query("SELECT 1 FROM receipts WHERE sha256 = ?", (digest,)):
                    continue
                try:
                    data = await self.parse(path)
                except Exception as e:
                    log.warning("Не удалось разобрать %s: %s", path.name, e)
                    self._save_status(digest, path, "error", str(e)[:500])
                    continue
                if self.save(digest, path, data):
                    imported += 1
            return imported

    async def parse(self, path: Path) -> dict:
        if self.client is None:
            raise RuntimeError("нет клиента Claude")
        media_type = FILE_TYPES[path.suffix.lower()]
        b64 = base64.b64encode(await asyncio.to_thread(path.read_bytes)).decode()
        if media_type == "application/pdf":
            block = {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": b64}}
        else:
            block = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}
        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            messages=[{"role": "user", "content": [block, {"type": "text", "text": PARSE_PROMPT}]}],
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": RESULT_SCHEMA}},
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("модель отказалась разбирать файл")
        if resp.stop_reason == "max_tokens":
            raise RuntimeError("чек слишком длинный для одного разбора")
        text = next(b.text for b in resp.content if b.type == "text")
        return json.loads(text)

    def _save_status(self, digest: str, path: Path, status: str, error: str | None = None) -> int:
        cur = self.db.execute(
            "INSERT INTO receipts(sha256, file, status, error, imported) VALUES (?, ?, ?, ?, ?)",
            (digest, str(path), status, error, time.time()),
        )
        return cur.lastrowid

    def save(self, digest: str, path: Path, data: dict) -> bool:
        if not data.get("is_receipt"):
            self._save_status(digest, path, "not_receipt")
            return False
        store, date, total = data["store"].strip(), data["date"].strip(), round(float(data["total"]), 2)
        dup = self.db.query(
            "SELECT id FROM receipts WHERE status = 'ok' AND lower(store) = lower(?) AND date = ? AND ABS(total - ?) < 0.01",
            (store, date, total),
        )
        if dup:
            self._save_status(digest, path, "duplicate", f"повтор чека №{dup[0]['id']}")
            return False
        with self.db.conn:
            cur = self.db.conn.execute(
                "INSERT INTO receipts(sha256, file, store, date, total, tax, status, imported) VALUES (?, ?, ?, ?, ?, ?, 'ok', ?)",
                (digest, str(path), store, date, total, float(data["tax"]), time.time()),
            )
            rid = cur.lastrowid
            self.db.conn.executemany(
                "INSERT INTO receipt_items(receipt_id, raw_name, name_en, name_ru, item_number, quantity, price, is_discount) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (rid, i["raw_name"], i["name_en"], i["name_ru"], i["item_number"], i["quantity"], i["price"], int(i["is_discount"]))
                    for i in data["items"]
                ],
            )
        return True

    # ---------- поиск ----------
    def search(self, query: str, store: str, limit: int = 10) -> list[dict]:
        words = [w.casefold() for w in query.replace(",", " ").split() if len(w) >= 2]
        rows = self.db.query(
            "SELECT r.store, r.date, i.raw_name, i.name_en, i.name_ru, i.quantity, i.price "
            "FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id "
            "WHERE r.status = 'ok' AND i.is_discount = 0 ORDER BY r.date DESC, r.id DESC"
        )
        found = []
        for r in rows:
            if store and store.casefold() not in (r["store"] or "").casefold():
                continue
            hay = " ".join(filter(None, [r["raw_name"], r["name_en"], r["name_ru"]])).casefold()
            if any(w in hay for w in words):  # регистр в Python: SQLite не умеет кириллицу
                found.append(dict(r))
                if len(found) >= limit:
                    break
        return found

    def summary(self, days: int, store: str) -> str:
        since = time.strftime("%Y-%m-%d", time.localtime(time.time() - days * 86400))
        rows = self.db.query(
            "SELECT store, COUNT(*) n, SUM(total) s FROM receipts WHERE status = 'ok' AND date >= ? GROUP BY store ORDER BY s DESC",
            (since,),
        )
        rows = [r for r in rows if not store or store.casefold() in (r["store"] or "").casefold()]
        if not rows:
            return f"Чеков за {days} дн. нет."
        lines = [f"Покупки за {days} дн. (с {since}):"]
        for r in rows:
            lines.append(f"- {r['store']}: {r['n']} чек(ов) на {r['s']:.2f} $")
        return "\n".join(lines)


def make_tools(p: Purchases) -> list[Tool]:
    def need_enabled():
        if not p.cfg.enabled or not p.folder:
            raise NotConfigured("чеки не подключены (раздел [purchases] в config.toml, инструкция docs/purchases.md).")

    async def search(args: dict, ctx: TurnContext):
        need_enabled()
        rows = p.search(args["query"], args["store"], limit=10)
        if not rows:
            total = p.db.query("SELECT COUNT(*) n FROM receipts WHERE status = 'ok'")[0]["n"]
            return f"В {total} чеках ничего не нашлось по «{args['query']}». Попробуй другие слова, в том числе по-английски."
        lines = ["Найдено (сначала самые свежие):"]
        for r in rows:
            qty = f", {r['quantity']:g} шт." if r["quantity"] and r["quantity"] != 1 else ""
            lines.append(f"- {r['date']}, {r['store']}: {r['name_ru'] or r['name_en']} («{r['raw_name']}»){qty} — {r['price']:.2f} $")
        return "\n".join(lines)

    async def summary(args: dict, ctx: TurnContext):
        need_enabled()
        return p.summary(max(1, min(int(args["days"]), 3650)), args["store"])

    async def import_now(args: dict, ctx: TurnContext):
        need_enabled()
        n = await p.import_new()
        total = p.db.query("SELECT COUNT(*) n FROM receipts WHERE status = 'ok'")[0]["n"]
        return f"Новых чеков: {n}. Всего в базе: {total}."

    return [
        Tool(
            "purchases_search",
            "Найти товар в чеках покупок: когда, где и почём покупали. query — ключевые слова; лучше дать и русское, "
            "и английское слово (например «огурцы cucumber»), потому что в чеках названия английские. "
            "store — магазин (например «Costco») или пустая строка для всех.",
            {"query": {"type": "string"}, "store": {"type": "string"}},
            search,
        ),
        Tool(
            "purchases_summary",
            "Сколько потрачено по чекам за последние дни, по магазинам. store — магазин или пустая строка.",
            {"days": {"type": "integer"}, "store": {"type": "string"}},
            summary,
        ),
        Tool(
            "purchases_import_now",
            "Проверить папку с чеками прямо сейчас и загрузить новые (обычно это происходит само раз в полчаса).",
            {},
            import_now,
        ),
    ]
