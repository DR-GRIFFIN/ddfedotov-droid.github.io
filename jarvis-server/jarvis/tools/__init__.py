"""Инструменты, которыми Claude может пользоваться: термостат, камеры, сеть, файлы, память.

Набор инструментов всегда один и тот же, даже если какое-то подключение не
настроено: тогда инструмент просто отвечает, что не настроен. Постоянный набор
нужен, чтобы не ломать кэш запросов и чтобы Claude мог честно сказать
пользователю, чего не хватает.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable

log = logging.getLogger(__name__)


@dataclass
class ToolResult:
    text: str
    images: list[tuple[str, bytes]] = field(default_factory=list)  # (media_type, данные)
    is_error: bool = False


@dataclass
class TurnContext:
    """Сведения о текущем вопросе, доступные инструментам."""

    turn_id: int
    source: str
    images_out: list[tuple[str, bytes]] = field(default_factory=list)  # картинки для показа пользователю


Handler = Callable[[dict, TurnContext], Awaitable["ToolResult | str"]]


@dataclass
class Tool:
    name: str
    description: str
    properties: dict
    handler: Handler

    def definition(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "strict": True,
            "input_schema": {
                "type": "object",
                "properties": self.properties,
                "required": list(self.properties),
                "additionalProperties": False,
            },
        }


class NotConfigured(Exception):
    """Подключение не настроено; текст объясняет, что сделать."""


class Toolbox:
    def __init__(self, tools: list[Tool], timeout_s: float = 90):
        names = [t.name for t in tools]
        if len(names) != len(set(names)):
            raise ValueError("Повторяющиеся имена инструментов")
        self.tools = {t.name: t for t in tools}
        self.timeout_s = timeout_s

    def definitions(self) -> list[dict]:
        return [t.definition() for t in self.tools.values()]

    async def run(self, name: str, args: dict, ctx: TurnContext) -> ToolResult:
        tool = self.tools.get(name)
        if tool is None:
            return ToolResult(f"Нет инструмента {name}.", is_error=True)
        try:
            result = await asyncio.wait_for(tool.handler(args or {}, ctx), self.timeout_s)
        except NotConfigured as e:
            return ToolResult(f"Не настроено: {e}", is_error=True)
        except asyncio.TimeoutError:
            return ToolResult("Устройство не ответило вовремя.", is_error=True)
        except Exception as e:  # инструмент не должен ронять весь ответ
            log.exception("Ошибка инструмента %s", name)
            return ToolResult(f"Ошибка: {e}", is_error=True)
        if isinstance(result, str):
            result = ToolResult(result)
        return result
