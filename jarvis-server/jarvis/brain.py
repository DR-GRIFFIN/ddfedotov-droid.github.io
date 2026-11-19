"""«Мозг» Джарвиса: разговор с Claude и вызов инструментов.

Как устроена история разговора (важно для Claude 5.5):
* Системный подсказ не меняется от запроса к запросу (дата и время идут в
  сообщение пользователя), набор инструментов тоже постоянный.
* Между вопросами хранится только текст: вопрос и итоговый ответ. Внутри одного
  вопроса блоки размышлений и вызовы инструментов передаются обратно без
  изменений, как требует API. Поэтому обрезка старой истории ничего не ломает.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from datetime import datetime

import anthropic

from .config import Config
from .db import DB
from .tools import ToolResult, Toolbox, TurnContext

log = logging.getLogger(__name__)

MAX_STEPS = 8
WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
SOURCES = {"watch": "часы", "phone": "телефон", "web": "веб-страница", "cli": "терминал"}
IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}

SYSTEM_PROMPT = """\
Ты — Джарвис, личный голосовой ассистент владельца. Ты работаешь на его домашнем Mac и отвечаешь ему с Apple Watch, iPhone и веб-страницы. Характер: спокойный, вежливый, собранный, с лёгкой сухой иронией, как у хорошего дворецкого. Обращайся на «вы».

Ответы чаще всего озвучиваются синтезатором речи, поэтому:
- отвечай коротко: 1–3 предложения, если не просят подробнее;
- пиши обычным разговорным текстом: без markdown, списков, таблиц, эмодзи и ссылок;
- числа и единицы пиши так, чтобы их было удобно произнести: «двадцать один градус» или «21 градус», но не «21°C».
Отвечай на языке собеседника; по умолчанию — по-русски. Речь распознаётся автоматически и иногда с ошибками: понимай фразу по смыслу, а если смысл неясен — коротко переспроси.

В начале каждого сообщения пользователя в квадратных скобках указаны текущие дата, время и устройство, с которого он говорит. Это служебная пометка: не пересказывай её.

В истории разговора видны только тексты твоих прошлых ответов, без вызовов инструментов. Цифры и факты в прошлых ответах ты получал из инструментов — не сомневайся в них, не извиняйся и не комментируй прошлые ответы без просьбы пользователя. Если нужны свежие данные — просто вызови инструмент снова.

У тебя есть инструменты: термостат Ecobee, камеры Blink, статистика домашнего интернета, чтение файлов на Mac, чеки покупок и долговременная память. Как ими пользоваться:
- Если просьба требует действия или свежих данных — вызови инструмент, а не гадай. Про температуру дома, камеры и интернет всегда спрашивай инструмент: прошлые ответы в разговоре могли устареть.
- После действия коротко подтверди результат: «Готово, поставил двадцать один градус».
- Если инструмент ответил «Не настроено», скажи пользователю одной фразой, чего не хватает.
- Снимать камеры с охраны можно только после явного подтверждения пользователя в его следующей реплике. Ставить на охрану можно сразу.
- На снимках с камер описывай, что происходит, и людей по внешнему виду. Не пытайся узнать или назвать, кто это.
- Файлы ты можешь только читать, менять и удалять их нельзя.
- На вопросы о покупках («почём брал огурцы в Costco») ищи в чеках через purchases_search. Цены называй с датой покупки. Если не нашёл — попробуй другие слова, в том числе по-английски.
- Запоминай факты в долговременную память, только когда пользователь просит запомнить или явно сообщает устойчивое предпочтение.

Чего у тебя нет: доступа к интернету в целом, почте, календарю, звонкам и сообщениям. Если об этом просят — так и скажи.
"""


def stamp(now: datetime, source: str) -> str:
    return (
        f"[{WEEKDAYS[now.weekday()]}, {now.day} {MONTHS[now.month - 1]} {now.year}, "
        f"{now:%H:%M}; устройство: {SOURCES.get(source, source)}]"
    )


def attachment_blocks(attachments: list[dict]) -> tuple[list[dict], list[str]]:
    """Файлы с веб-страницы → блоки для Claude. Передаются только в этом вопросе."""
    blocks, names = [], []
    for a in attachments or []:
        name, mime, data = a.get("name", "файл"), a.get("mime", ""), a.get("data", "")
        names.append(name)
        if mime in IMAGE_TYPES:
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": mime, "data": data}})
        elif mime == "application/pdf":
            blocks.append({"type": "document", "title": name, "source": {"type": "base64", "media_type": "application/pdf", "data": data}})
        else:
            text = base64.b64decode(data).decode("utf-8", errors="replace")
            blocks.append({"type": "text", "text": f"Файл «{name}»:\n\n{text}"})
    return blocks, names


def tool_result_block(tool_use_id: str, result: ToolResult) -> dict:
    if result.images:
        content: list[dict] | str = [
            {"type": "image", "source": {"type": "base64", "media_type": mt, "data": base64.b64encode(d).decode()}}
            for mt, d in result.images
        ] + [{"type": "text", "text": result.text}]
    else:
        content = result.text
    block = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
    if result.is_error:
        block["is_error"] = True
    return block


def to_param(block) -> dict:
    return block.to_dict() if hasattr(block, "to_dict") else dict(block)


class Brain:
    def __init__(self, cfg: Config, db: DB, toolbox: Toolbox, client: anthropic.AsyncAnthropic | None = None):
        self.cfg = cfg
        self.db = db
        self.toolbox = toolbox
        self.client = client or anthropic.AsyncAnthropic(api_key=cfg.anthropic_api_key, timeout=90, max_retries=2)
        self.lock = asyncio.Lock()
        self.turn_id = 0

    def system_prompt(self) -> str:
        facts = self.db.facts()
        if not facts:
            return SYSTEM_PROMPT
        lines = "\n".join(f"№{f['id']}: {f['text']}" for f in facts)
        return SYSTEM_PROMPT + f"\n## Память (то, что пользователь просил запомнить)\n{lines}\n"

    async def ask(self, text: str, source: str = "web", attachments: list[dict] | None = None) -> dict:
        text = (text or "").strip()
        if not text and not attachments:
            return {"reply": "Я вас не расслышал.", "images": [], "tools": []}
        async with self.lock:  # часы и страница не должны перебивать друг друга
            self.turn_id += 1
            ctx = TurnContext(turn_id=self.turn_id, source=source)
            user_text = f"{stamp(datetime.now(), source)}\n{text or 'Посмотри прикреплённые файлы.'}"
            att_blocks, att_names = attachment_blocks(attachments or [])
            messages = self.db.history_for_model(self.cfg.history_messages)
            messages.append({"role": "user", "content": [*att_blocks, {"type": "text", "text": user_text}]})
            system = self.system_prompt()
            tools = self.toolbox.definitions()
            used: list[str] = []
            reply = None
            refused = False

            for _ in range(MAX_STEPS):
                resp = await self.client.messages.create(
                    model=self.cfg.model,
                    max_tokens=8000,
                    system=system,
                    tools=tools,
                    messages=messages,
                    output_config={"effort": self.cfg.effort},
                    cache_control={"type": "ephemeral"},
                )
                if resp.stop_reason == "refusal":
                    refused = True
                    reply = "С этим я помочь не могу."
                    break
                if resp.stop_reason in ("tool_use", "pause_turn"):
                    messages.append({"role": "assistant", "content": [to_param(b) for b in resp.content]})
                    calls = [b for b in resp.content if b.type == "tool_use"]
                    if not calls:  # pause_turn без вызовов: просто продолжаем
                        continue
                    used += [c.name for c in calls]
                    log.info("Инструменты: %s", ", ".join(f"{c.name}({c.input})" for c in calls))
                    results = await asyncio.gather(*(self.toolbox.run(c.name, c.input, ctx) for c in calls))
                    messages.append({"role": "user", "content": [tool_result_block(c.id, r) for c, r in zip(calls, results)]})
                    continue
                reply = "".join(b.text for b in resp.content if b.type == "text").strip()
                if resp.stop_reason == "max_tokens" and not reply:
                    reply = "Ответ получился слишком длинным, спросите, пожалуйста, покороче."
                break
            else:
                reply = "Не успел закончить: слишком много шагов. Попробуйте спросить проще."

            reply = reply or "Готово."
            if not refused:
                stored_user = user_text + (f"\n[Прикреплены файлы: {', '.join(att_names)}]" if att_names else "")
                self.db.add_exchange(stored_user, reply, source, {"tools": used})
            images = [{"mime": mt, "data": base64.b64encode(d).decode()} for mt, d in ctx.images_out]
            return {"reply": reply, "images": images, "tools": used}
