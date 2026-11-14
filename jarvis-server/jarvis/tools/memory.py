"""Долговременная память: факты, которые пользователь просит запомнить."""

from __future__ import annotations

from ..db import DB
from . import Tool, TurnContext

MAX_FACTS = 100


def make_tools(db: DB) -> list[Tool]:
    async def remember(args: dict, ctx: TurnContext):
        text = args["fact"].strip()
        if not text:
            return "Пустой факт не сохранён."
        if len(db.facts()) >= MAX_FACTS:
            return f"В памяти уже {MAX_FACTS} фактов. Предложи пользователю что-нибудь забыть."
        fid = db.add_fact(text[:500])
        return f"Запомнил (№{fid}). Это будет доступно со следующего вопроса."

    async def forget(args: dict, ctx: TurnContext):
        return "Забыл." if db.delete_fact(int(args["fact_id"])) else "Такого факта нет."

    return [
        Tool(
            "memory_remember",
            "Запомнить надолго факт о пользователе или доме, когда пользователь об этом просит или явно сообщает "
            "устойчивое предпочтение (например, «в спальне люблю 19 градусов»).",
            {"fact": {"type": "string"}},
            remember,
        ),
        Tool(
            "memory_forget",
            "Удалить факт из долговременной памяти по номеру (номера видны в разделе «Память»).",
            {"fact_id": {"type": "integer"}},
            forget,
        ),
    ]
