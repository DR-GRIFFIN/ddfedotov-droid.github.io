import asyncio

from aiohttp.test_utils import TestClient, TestServer

from jarvis.db import DB
from jarvis.server import FAIL_LIMIT, build_app

KEY = "k" * 40


class FakeBrain:
    def __init__(self):
        self.calls = []

    async def ask(self, text, source="web", attachments=None):
        self.calls.append((text, source, attachments))
        return {"reply": f"Эхо: {text}", "images": [{"mime": "image/jpeg", "data": "AAAA"}], "tools": []}


def with_client(cfg, fn, brain=None):
    async def go():
        brain_ = brain or FakeBrain()
        app = build_app(cfg, db=DB(":memory:"), brain=brain_, start_background=False)
        async with TestClient(TestServer(app)) as client:
            return await fn(client, brain_)

    return asyncio.run(go())


def auth(key=KEY):
    return {"Authorization": f"Bearer {key}"}


def test_health_needs_no_key(cfg):
    async def fn(c, b):
        r = await c.get("/health")
        return r.status, await r.json()

    status, body = with_client(cfg, fn)
    assert status == 200 and body["ok"] is True


def test_ask_requires_key_and_returns_reply(cfg):
    async def fn(c, b):
        r1 = await c.post("/api/ask", json={"text": "привет"})
        r2 = await c.post("/api/ask", json={"text": "привет", "source": "watch"}, headers=auth("неверный"))
        r3 = await c.post("/api/ask", json={"text": "привет", "source": "watch"}, headers=auth())
        return r1.status, r2.status, r3.status, await r3.json(), b.calls

    s1, s2, s3, body, calls = with_client(cfg, fn)
    assert (s1, s2, s3) == (401, 401, 200)
    assert body["reply"] == "Эхо: привет"
    assert body["image"] == "AAAA"
    assert calls == [("привет", "watch", [])]


def test_brute_force_is_blocked(cfg):
    async def fn(c, b):
        for _ in range(FAIL_LIMIT):
            await c.get("/api/status", headers=auth("x" * 40))
        blocked = await c.get("/api/status", headers=auth())  # даже верный ключ ждёт
        other_ip = await c.get("/api/status", headers={**auth(), "X-Forwarded-For": "203.0.113.9"})
        return blocked.status, other_ip.status

    blocked, other = with_client(cfg, fn)
    assert blocked == 429
    assert other == 200


def test_cors_only_for_allowed_origin(cfg):
    async def fn(c, b):
        good = await c.options("/api/ask", headers={"Origin": "https://ddfedotov-droid.github.io"})
        bad = await c.options("/api/ask", headers={"Origin": "https://evil.example"})
        return good.headers.get("Access-Control-Allow-Origin"), bad.headers.get("Access-Control-Allow-Origin")

    good, bad = with_client(cfg, fn)
    assert good == "https://ddfedotov-droid.github.io"
    assert bad is None


def test_bad_attachments_rejected(cfg):
    async def fn(c, b):
        r = await c.post("/api/ask", json={"text": "x", "files": [{"name": "a", "mime": "text/plain", "data": "@@@"}]}, headers=auth())
        return r.status

    assert with_client(cfg, fn) == 400


def test_weak_key_refuses_to_start(cfg):
    cfg.access_key = "short"
    try:
        build_app(cfg, db=DB(":memory:"), brain=FakeBrain(), start_background=False)
    except SystemExit as e:
        assert "access_key" in str(e)
    else:
        raise AssertionError("сервер не должен запускаться с коротким ключом")
