"""Доступ к файлам на Mac: только чтение и только в разрешённых папках."""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime
from pathlib import Path

from ..config import FilesConfig
from . import NotConfigured, Tool, ToolResult, TurnContext

TEXT_EXT = {
    ".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".html", ".htm", ".log", ".yaml", ".yml",
    ".ini", ".toml", ".py", ".js", ".ts", ".sh", ".rtf", ".srt", ".vtt",
}
IMAGE_EXT = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
SKIP_DIRS = {"node_modules", ".git", "Library", ".Trash", "__pycache__", ".venv"}
MAX_TEXT_CHARS = 30_000
MAX_IMAGE_BYTES = 4_500_000
MAX_SEARCH_RESULTS = 30
SEARCH_TIME_LIMIT_S = 8


class FileAccess:
    def __init__(self, cfg: FilesConfig):
        self.roots = [Path(f).expanduser().resolve() for f in cfg.folders]

    def check(self, path: str) -> Path:
        """Возвращает реальный путь, если он внутри разрешённых папок, иначе ошибка."""
        if not self.roots:
            raise NotConfigured("доступ к файлам не настроен (раздел [files] folders в config.toml).")
        p = Path(path).expanduser()
        if not p.is_absolute():
            p = self.roots[0] / p
        real = p.resolve()  # раскрывает «..» и символические ссылки
        for root in self.roots:
            if real == root or root in real.parents:
                return real
        raise PermissionError("этот путь вне папок, к которым у Джарвиса есть доступ.")

    def search(self, query: str) -> list[Path]:
        words = [w for w in query.lower().split() if w]
        deadline = time.monotonic() + SEARCH_TIME_LIMIT_S
        found: list[Path] = []
        for root in self.roots:
            for dirpath, dirnames, filenames in os.walk(root):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
                for name in filenames:
                    if name.startswith("."):
                        continue
                    low = name.lower()
                    if all(w in low for w in words):
                        found.append(Path(dirpath) / name)
                        if len(found) >= MAX_SEARCH_RESULTS:
                            return found
                if time.monotonic() > deadline:
                    return found
        return found


def _describe(p: Path) -> str:
    try:
        st = p.stat()
    except OSError:
        return str(p)
    when = datetime.fromtimestamp(st.st_mtime).strftime("%d.%m.%Y")
    if p.is_dir():
        return f"{p}/ (папка, изменена {when})"
    size = st.st_size
    human = f"{size / 1e6:.1f} МБ" if size >= 1e6 else f"{max(1, size // 1000)} КБ"
    return f"{p} ({human}, изменён {when})"


def read_pdf(path: Path, start_page: int) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    total = len(reader.pages)
    parts, size, page, any_text = [], 0, start_page, False
    while page <= total and size < MAX_TEXT_CHARS:
        text = reader.pages[page - 1].extract_text() or ""
        any_text = any_text or bool(text.strip())
        parts.append(f"--- страница {page} ---\n{text}")
        size += len(text)
        page += 1
    head = f"PDF «{path.name}», страниц: {total}. Показаны страницы {start_page}–{page - 1}."
    if page <= total:
        head += f" Чтобы читать дальше, вызови files_read с start={page}."
    if not any_text:
        head += " Текста не найдено: возможно, это скан без текстового слоя."
    return head + "\n" + "\n".join(parts)


def make_tools(cfg: FilesConfig) -> list[Tool]:
    fa = FileAccess(cfg)

    async def search(args: dict, ctx: TurnContext):
        if not fa.roots:
            fa.check("")  # объяснит, что доступ не настроен
        results = await asyncio.to_thread(fa.search, args["query"])
        if not results:
            return f"По запросу «{args['query']}» в названиях файлов ничего не найдено. Можно попробовать другое слово."
        return "Найдено:\n" + "\n".join(_describe(p) for p in results)

    async def list_dir(args: dict, ctx: TurnContext):
        if not args["path"]:
            if not fa.roots:
                fa.check("")
            return "Разрешённые папки:\n" + "\n".join(_describe(r) for r in fa.roots)
        p = fa.check(args["path"])
        if not p.is_dir():
            return ToolResult("Это не папка.", is_error=True)
        entries = sorted(e for e in p.iterdir() if not e.name.startswith("."))
        text = "\n".join(_describe(e) for e in entries[:200])
        if len(entries) > 200:
            text += f"\n…и ещё {len(entries) - 200}."
        return text or "Папка пустая."

    async def read(args: dict, ctx: TurnContext):
        p = fa.check(args["path"])
        if not p.is_file():
            return ToolResult("Файл не найден.", is_error=True)
        ext = p.suffix.lower()
        start = max(1, int(args["start"]))
        if ext == ".pdf":
            return await asyncio.to_thread(read_pdf, p, start)
        if ext in IMAGE_EXT:
            data = p.read_bytes()
            if len(data) > MAX_IMAGE_BYTES:
                return ToolResult("Картинка слишком большая (больше 4,5 МБ).", is_error=True)
            return ToolResult(f"Изображение «{p.name}».", images=[(IMAGE_EXT[ext], data)])
        if ext in TEXT_EXT or p.stat().st_size < 200_000:
            raw = p.read_bytes()
            if b"\x00" in raw[:4096]:
                return ToolResult(f"«{p.name}» — двоичный файл, прочитать его как текст нельзя.", is_error=True)
            text = raw.decode("utf-8", errors="replace")
            chunk = text[start - 1 : start - 1 + MAX_TEXT_CHARS]
            tail = ""
            if start - 1 + MAX_TEXT_CHARS < len(text):
                tail = f"\n[Показана часть. Продолжение: files_read со start={start + MAX_TEXT_CHARS}]"
            return f"Файл «{p.name}», символы {start}–{start - 1 + len(chunk)} из {len(text)}:\n{chunk}{tail}"
        return ToolResult(
            f"Формат «{ext or 'без расширения'}» пока не поддерживается. Читаю текст, PDF и картинки.", is_error=True
        )

    return [
        Tool(
            "files_search",
            "Найти файлы на Mac пользователя по словам в названии (только в разрешённых папках).",
            {"query": {"type": "string", "description": "Слова из названия файла, например «договор аренды»"}},
            search,
        ),
        Tool(
            "files_list",
            "Показать содержимое папки. Пустой path — список разрешённых папок.",
            {"path": {"type": "string"}},
            list_dir,
        ),
        Tool(
            "files_read",
            "Прочитать файл: текст, PDF (по страницам) или картинку. start — с какой страницы PDF или с какого символа текста, обычно 1.",
            {"path": {"type": "string", "description": "Полный путь из files_search или files_list"}, "start": {"type": "integer"}},
            read,
        ),
    ]
