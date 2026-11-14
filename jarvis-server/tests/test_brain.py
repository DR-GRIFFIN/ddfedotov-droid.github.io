import asyncio

import anthropic

from conftest import FakeAnthropic, text_msg, tool_msg
from jarvis.brain import SYSTEM_PROMPT, Brain
from jarvis.db import DB
from jarvis.tools import Tool, Toolbox, TurnContext
from jarvis.tools import memory, thermostat


def run(coro):
    return asyncio.run(coro)


async def make_brain(cfg, fake: FakeAnthropic, tools=None, db=None):
    url = await fake.start()
    client = anthropic.AsyncAnthropic(api_key="sk-test", base_url=url, max_retries=0)
    db = db or DB(":memory:")
    return Brain(cfg, db, Toolbox(tools or []), client=client), db


def test_plain_answer_is_stored_and_request_is_well_formed(cfg):
    async def go():
        fake = FakeAnthropic()
        fake.replies = [text_msg("Добрый вечер."), text_msg("Второй ответ.")]
        brain, db = await make_brain(cfg, fake, memory.make_tools(DB(":memory:")))
        r1 = await brain.ask("Привет", source="watch")
        r2 = await brain.ask("Как дела?", source="web")
        await fake.close()
        return fake, db, r1, r2

    fake, db, r1, r2 = run(go())
    assert r1["reply"] == "Добрый вечер."
    assert r2["reply"] == "Второй ответ."
    body = fake.requests[0]["body"]
    assert body["model"] == "claude-haiku-5-5"
    assert body["output_config"] == {"effort": "low"}
    assert body["cache_control"] == {"type": "ephemeral"}
    assert body["system"] == SYSTEM_PROMPT
    assert "temperature" not in body and "thinking" not in body and "fallbacks" not in body
    assert all(t["strict"] and t["input_schema"]["additionalProperties"] is False for t in body["tools"])
    user_text = body["messages"][-1]["content"][-1]["text"]
    assert user_text.startswith("[") and "устройство: часы" in user_text and user_text.endswith("Привет")
    # Второй запрос: история только текстом, системный подсказ тот же самый.
    body2 = fake.requests[1]["body"]
    assert body2["system"] == body["system"]
    assert body2["messages"][0]["content"] == user_text
    assert body2["messages"][1] == {"role": "assistant", "content": "Добрый вечер."}
    assert len(db.recent_messages()) == 4


def test_tool_loop_passes_blocks_back_unchanged(cfg):
    calls = []

    async def fake_runner(name, text_input=None):
        calls.append((name, text_input))
        return ""

    cfg.thermostat.enabled = True

    async def go():
        fake = FakeAnthropic()
        fake.replies = [tool_msg("thermostat_set_temperature", {"celsius": 21}), text_msg("Готово, двадцать один градус.")]
        brain, db = await make_brain(cfg, fake, thermostat.make_tools(cfg.thermostat, runner=fake_runner))
        r = await brain.ask("Сделай 21 градус")
        await fake.close()
        return fake, r

    fake, r = run(go())
    assert calls == [("Джарвис термостат температура", "21")]
    assert r["reply"] == "Готово, двадцать один градус."
    assert r["tools"] == ["thermostat_set_temperature"]
    second = fake.requests[1]["body"]["messages"]
    assert second[-2]["role"] == "assistant"
    assert second[-2]["content"][0] == {"type": "thinking", "thinking": "", "signature": "sig-abc"}
    result = second[-1]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "toolu_1"
    assert "21°C" in result["content"]


def test_temperature_out_of_range_is_refused(cfg):
    cfg.thermostat.enabled = True
    calls = []

    async def fake_runner(name, text_input=None):
        calls.append(name)
        return ""

    async def go():
        tools = Toolbox(thermostat.make_tools(cfg.thermostat, runner=fake_runner))
        return await tools.run("thermostat_set_temperature", {"celsius": 35}, TurnContext(1, "web"))

    res = run(go())
    assert res.is_error and "диапазона" in res.text
    assert calls == []


def test_refusal_is_not_stored(cfg):
    async def go():
        fake = FakeAnthropic()
        msg = text_msg("")
        msg["stop_reason"] = "refusal"
        msg["content"] = []
        fake.replies = [msg]
        brain, db = await make_brain(cfg, fake)
        r = await brain.ask("что-то")
        await fake.close()
        return r, db

    r, db = run(go())
    assert "не могу" in r["reply"]
    assert db.recent_messages() == []


def test_tool_errors_do_not_crash_the_answer(cfg):
    async def broken(args, ctx):
        raise ValueError("сломалось")

    async def go():
        fake = FakeAnthropic()
        fake.replies = [tool_msg("broken", {}), text_msg("Не получилось.")]
        brain, _ = await make_brain(cfg, fake, [Tool("broken", "x", {}, broken)])
        r = await brain.ask("сделай")
        await fake.close()
        return fake, r

    fake, r = run(go())
    res = fake.requests[1]["body"]["messages"][-1]["content"][0]
    assert res["is_error"] is True and "сломалось" in res["content"]
    assert r["reply"] == "Не получилось."


def test_unconfigured_tool_says_so(cfg):
    async def go():
        tools = Toolbox(thermostat.make_tools(cfg.thermostat))
        return await tools.run("thermostat_status", {}, TurnContext(1, "web"))

    res = run(go())
    assert res.is_error and res.text.startswith("Не настроено")


def test_memory_facts_go_into_system_prompt(cfg):
    async def go():
        fake = FakeAnthropic()
        fake.replies = [text_msg("ok")]
        db = DB(":memory:")
        db.add_fact("В спальне любит 19 градусов")
        brain, _ = await make_brain(cfg, fake, db=db)
        await brain.ask("привет")
        await fake.close()
        return fake

    fake = run(go())
    assert "№1: В спальне любит 19 градусов" in fake.requests[0]["body"]["system"]
