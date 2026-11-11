"""Общие заготовки для тестов: поддельный Claude API на локальном порту."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jarvis.config import Config  # noqa: E402


def message(content: list[dict], stop_reason: str = "end_turn") -> dict:
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": "claude-haiku-5-5",
        "content": content,
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


def text_msg(text: str) -> dict:
    return message([{"type": "text", "text": text}])


def tool_msg(name: str, inp: dict, tool_id: str = "toolu_1") -> dict:
    return message(
        [
            {"type": "thinking", "thinking": "", "signature": "sig-abc"},
            {"type": "tool_use", "id": tool_id, "name": name, "input": inp},
        ],
        stop_reason="tool_use",
    )


class FakeAnthropic:
    """Отвечает заранее заданными сообщениями и запоминает все запросы."""

    def __init__(self):
        self.replies: list[dict] = []
        self.requests: list[dict] = []
        self.server: TestServer | None = None

    async def handler(self, request: web.Request):
        body = await request.json()
        self.requests.append({"body": json.loads(json.dumps(body)), "headers": dict(request.headers)})
        if not self.replies:
            return web.json_response({"type": "error", "error": {"type": "api_error", "message": "no scripted reply"}}, status=500)
        return web.json_response(self.replies.pop(0))

    async def start(self) -> str:
        app = web.Application()
        app.router.add_post("/v1/messages", self.handler)
        self.server = TestServer(app)
        await self.server.start_server()
        return str(self.server.make_url(""))

    async def close(self):
        if self.server:
            await self.server.close()


@pytest.fixture
def cfg(tmp_path, monkeypatch) -> Config:
    monkeypatch.setenv("JARVIS_HOME", str(tmp_path / "home"))
    c = Config(anthropic_api_key="sk-test", access_key="k" * 40)
    c.home = tmp_path / "home"
    c.network.enabled = False
    return c
