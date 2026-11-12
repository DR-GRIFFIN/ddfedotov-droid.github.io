import asyncio
import json
import os
import time

import anthropic

from conftest import FakeAnthropic, message
from jarvis.config import PurchasesConfig
from jarvis.db import DB
from jarvis.tools import Toolbox, TurnContext
from jarvis.tools.purchases import Purchases, make_tools

RECEIPT = {
    "is_receipt": True,
    "store": "Costco",
    "date": "2026-10-28",
    "total": 87.45,
    "tax": 2.1,
    "items": [
        {"raw_name": "KS MINI CUCUMBR", "name_en": "Kirkland mini cucumbers", "name_ru": "мини-огурцы Kirkland",
         "item_number": "1234", "quantity": 1, "price": 6.49, "is_discount": False},
        {"raw_name": "TPD/1234", "name_en": "Instant savings", "name_ru": "скидка",
         "item_number": "", "quantity": 1, "price": -1.0, "is_discount": True},
        {"raw_name": "ORG MILK 3X2L", "name_en": "Organic milk 3x2L", "name_ru": "органическое молоко 3×2 л",
         "item_number": "5678", "quantity": 1, "price": 13.99, "is_discount": False},
    ],
}


def json_msg(obj):
    return message([{"type": "thinking", "thinking": "", "signature": "s"}, {"type": "text", "text": json.dumps(obj, ensure_ascii=False)}])


def old_file(path, data=b"%PDF-1.4 test"):
    path.write_bytes(data)
    past = time.time() - 3600
    os.utime(path, (past, past))


def setup(tmp_path, replies):
    async def go():
        fake = FakeAnthropic()
        fake.replies = replies
        url = await fake.start()
        client = anthropic.AsyncAnthropic(api_key="sk-test", base_url=url, max_retries=0)
        db = DB(":memory:")
        p = Purchases(PurchasesConfig(enabled=True, folder=str(tmp_path / "Costco")), db, client, "claude-haiku-5-5")
        n = await p.import_new()
        n2 = await p.import_new()  # повторный проход ничего не делает
        await fake.close()
        return fake, p, n, n2

    return asyncio.run(go())


def test_import_parses_and_dedupes(tmp_path):
    folder = tmp_path / "Costco"
    folder.mkdir()
    old_file(folder / "2026-10-28.pdf")
    old_file(folder / "2026-10-28 (1).pdf", b"%PDF-1.4 same receipt exported again")
    old_file(folder / "notes.txt", b"not a receipt type")
    fresh = folder / "just-synced.pdf"
    fresh.write_bytes(b"%PDF still downloading")  # слишком свежий — ждём

    fake, p, n, n2 = setup(tmp_path, [json_msg(RECEIPT), json_msg(RECEIPT)])
    assert n == 1 and n2 == 0
    statuses = sorted(r["status"] for r in p.db.query("SELECT status FROM receipts"))
    assert statuses == ["duplicate", "ok"]
    body = fake.requests[0]["body"]
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["messages"][0]["content"][0]["type"] == "document"
    assert len(fake.requests) == 2  # txt и свежий файл не отправлялись


def test_search_in_russian_and_english(tmp_path):
    folder = tmp_path / "Costco"
    folder.mkdir()
    old_file(folder / "r.pdf")
    _, p, _, _ = setup(tmp_path, [json_msg(RECEIPT)])
    tb = Toolbox(make_tools(p))
    ctx = TurnContext(1, "watch")
    ru = asyncio.run(tb.run("purchases_search", {"query": "огурцы cucumber", "store": "Costco"}, ctx))
    assert "2026-10-28" in ru.text and "6.49" in ru.text and "скидка" not in ru.text
    up = asyncio.run(tb.run("purchases_search", {"query": "ОГУРЦЫ", "store": ""}, ctx))
    assert "6.49" in up.text  # регистр кириллицы не мешает
    none = asyncio.run(tb.run("purchases_search", {"query": "бананы", "store": ""}, ctx))
    assert "ничего не нашлось" in none.text
    summary = asyncio.run(tb.run("purchases_summary", {"days": 36500, "store": "costco"}, ctx))
    assert "87.45" in summary.text


def test_errors_are_recorded_not_fatal(tmp_path):
    folder = tmp_path / "Costco"
    folder.mkdir()
    old_file(folder / "broken.pdf")
    refusal = message([], stop_reason="refusal")
    _, p, n, _ = setup(tmp_path, [refusal])
    assert n == 0
    row = p.db.query("SELECT status, error FROM receipts")[0]
    assert row["status"] == "error" and "отказалась" in row["error"]


def test_not_configured():
    p = Purchases(PurchasesConfig(), DB(":memory:"), None, "m")
    res = asyncio.run(Toolbox(make_tools(p)).run("purchases_search", {"query": "x", "store": ""}, TurnContext(1, "web")))
    assert res.is_error and "Не настроено" in res.text
