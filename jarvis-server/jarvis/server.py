"""HTTP-сервер Джарвиса.

Слушает только 127.0.0.1: снаружи до него можно достучаться лишь через
Tailscale (serve или funnel), который сам даёт HTTPS. Каждый запрос, кроме
/health, требует ключ доступа: заголовок `Authorization: Bearer <ключ>`.
"""

from __future__ import annotations

import base64
import functools
import hmac
import json
import logging
import time
from collections import defaultdict, deque

import aiohttp
from aiohttp import web

from . import __version__
from .brain import Brain
from .config import Config
from .db import DB
from .notify import Notifier
from .tools import Toolbox
from .tools import blink as blink_tools
from .tools import files as files_tools
from .tools import memory as memory_tools
from .tools import network as network_tools
from .tools import purchases as purchases_tools
from .tools import thermostat as thermostat_tools

log = logging.getLogger(__name__)

# Русский текст в ответах без \uXXXX — удобнее читать в журналах и «Командах».
json_response = functools.partial(web.json_response, dumps=functools.partial(json.dumps, ensure_ascii=False))

MAX_BODY = 30 * 1024 * 1024
MAX_TEXT = 4000
MAX_ATTACHMENTS = 5
FAIL_LIMIT = 10           # неверных ключей с одного адреса…
FAIL_WINDOW_S = 600       # …за 10 минут — и адрес блокируется
BLOCK_S = 900


class Guard:
    """Проверка ключа и защита от подбора."""

    def __init__(self, key: str):
        self.key = key.encode()
        self.fails: dict[str, deque] = defaultdict(deque)
        self.blocked_until: dict[str, float] = {}

    @staticmethod
    def client_ip(request: web.Request) -> str:
        # Берём последний адрес: его дописал сам Tailscale, а первые клиент мог подделать.
        fwd = request.headers.get("X-Forwarded-For", "")
        return fwd.split(",")[-1].strip() or (request.remote or "?")

    def check(self, request: web.Request) -> str | None:
        """None, если всё хорошо, иначе текст ошибки."""
        ip = self.client_ip(request)
        now = time.time()
        if self.blocked_until.get(ip, 0) > now:
            return "blocked"
        auth = request.headers.get("Authorization", "")
        given = auth[7:].strip().encode() if auth.lower().startswith("bearer ") else b""
        if given and hmac.compare_digest(given, self.key):
            self.fails.pop(ip, None)
            return None
        q = self.fails[ip]
        q.append(now)
        while q and q[0] < now - FAIL_WINDOW_S:
            q.popleft()
        if len(q) >= FAIL_LIMIT:
            self.blocked_until[ip] = now + BLOCK_S
            log.warning("Адрес %s заблокирован на %d мин после %d неверных ключей", ip, BLOCK_S // 60, len(q))
        return "unauthorized"


def cors_headers(cfg: Config, request: web.Request) -> dict:
    origin = request.headers.get("Origin")
    if origin and origin in cfg.allowed_origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Max-Age": "600",
            "Vary": "Origin",
        }
    return {}


def build_app(cfg: Config, db: DB | None = None, brain: Brain | None = None, start_background: bool = True) -> web.Application:
    if not cfg.access_key or len(cfg.access_key) < 24:
        raise SystemExit("В config.toml нет надёжного access_key (минимум 24 символа). Запустите ./jarvis.sh key")
    db = db or DB(cfg.db_path)
    guard = Guard(cfg.access_key)
    app = web.Application(client_max_size=MAX_BODY)
    state: dict = {}

    @web.middleware
    async def middleware(request: web.Request, handler):
        cors = cors_headers(cfg, request)
        if request.method == "OPTIONS":
            return web.Response(status=204, headers=cors)
        if request.path != "/health":
            err = guard.check(request)
            if err == "blocked":
                return json_response({"error": "Слишком много неверных попыток. Подождите 15 минут."}, status=429, headers=cors)
            if err:
                return json_response({"error": "Неверный ключ доступа."}, status=401, headers=cors)
        try:
            resp = await handler(request)
        except web.HTTPException as e:
            resp = json_response({"error": e.reason}, status=e.status)
        resp.headers.update(cors)
        resp.headers["Cache-Control"] = "no-store"
        return resp

    app.middlewares.append(middleware)

    async def health(request):
        return json_response({"ok": True, "version": __version__})

    async def ask(request: web.Request):
        try:
            body = await request.json()
        except Exception:
            return json_response({"error": "Нужен JSON вида {\"text\": \"…\"}"}, status=400)
        text = str(body.get("text", ""))[:MAX_TEXT]
        source = str(body.get("source", "web"))[:20]
        attachments = body.get("files") or []
        if not isinstance(attachments, list) or len(attachments) > MAX_ATTACHMENTS:
            return json_response({"error": f"Не больше {MAX_ATTACHMENTS} файлов за раз."}, status=400)
        try:
            for a in attachments:
                base64.b64decode(a.get("data", ""), validate=True)
        except Exception:
            return json_response({"error": "Файлы должны быть в base64."}, status=400)
        try:
            result = await state["brain"].ask(text, source=source, attachments=attachments)
        except Exception as e:
            log.exception("Ошибка при ответе")
            return json_response({"error": explain_error(e), "reply": explain_error(e)}, status=502)
        # Для «Команд» на часах удобно иметь первую картинку отдельным полем.
        result["image"] = result["images"][0]["data"] if result["images"] else ""
        return json_response(result)

    async def history(request: web.Request):
        limit = max(1, min(int(request.query.get("limit", 50)), 200))
        return json_response({"messages": db.recent_messages(limit)})

    async def reset(request: web.Request):
        db.clear_history()
        return json_response({"ok": True})

    async def status(request: web.Request):
        return json_response(
            {
                "model": cfg.model,
                "thermostat": cfg.thermostat.enabled,
                "blink": cfg.blink.enabled and cfg.blink_credentials_path.exists(),
                "network": cfg.network.enabled,
                "files": len(cfg.files.folders),
                "purchases": cfg.purchases.enabled,
                "notifications": bool(cfg.notify.ntfy_topic),
                "facts": len(db.facts()),
            }
        )

    app.router.add_get("/health", health)
    app.router.add_post("/api/ask", ask)
    app.router.add_get("/api/history", history)
    app.router.add_post("/api/reset", reset)
    app.router.add_get("/api/status", status)

    async def on_startup(app):
        session = aiohttp.ClientSession()
        state["session"] = session
        notifier = Notifier(cfg.notify, session)
        monitor = network_tools.NetworkMonitor(cfg.network, db, notifier, session)
        state["monitor"] = monitor
        if brain is not None:
            state["brain"] = brain
        else:
            import anthropic

            claude = anthropic.AsyncAnthropic(api_key=cfg.anthropic_api_key, timeout=120, max_retries=2)
            purchases = purchases_tools.Purchases(cfg.purchases, db, claude, cfg.model)
            state["purchases"] = purchases
            blink_svc = blink_tools.BlinkService(cfg.blink, cfg.blink_credentials_path, session)
            toolbox = Toolbox(
                thermostat_tools.make_tools(cfg.thermostat)
                + blink_tools.make_tools(blink_svc)
                + network_tools.make_tools(monitor)
                + files_tools.make_tools(cfg.files)
                + purchases_tools.make_tools(purchases)
                + memory_tools.make_tools(db)
            )
            state["brain"] = Brain(cfg, db, toolbox, client=claude)
        if start_background:
            monitor.start()
            if "purchases" in state:
                state["purchases"].start()
        log.info("Джарвис %s готов: http://%s:%s (модель %s)", __version__, cfg.host, cfg.port, cfg.model)

    async def on_cleanup(app):
        if "monitor" in state:
            await state["monitor"].stop()
        if "purchases" in state:
            await state["purchases"].stop()
        if "session" in state:
            await state["session"].close()

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def explain_error(e: Exception) -> str:
    import anthropic

    if isinstance(e, anthropic.AuthenticationError):
        return "Ключ Claude API на сервере не подошёл. Проверьте anthropic_api_key в config.toml."
    if isinstance(e, anthropic.PermissionDeniedError):
        return "Claude API отказал в доступе. Проверьте ключ и баланс в console.anthropic.com."
    if isinstance(e, anthropic.RateLimitError):
        return "Слишком много запросов к Claude, подождите минуту."
    if isinstance(e, anthropic.BadRequestError) and "credit" in str(e).lower():
        return "На счёте Claude API закончились средства."
    if isinstance(e, anthropic.APIConnectionError):
        return "Сервер не может связаться с Claude. Проверьте интернет на Mac."
    if isinstance(e, anthropic.APIStatusError) and e.status_code >= 500:
        return "Claude сейчас недоступен, попробуйте ещё раз."
    return "Что-то пошло не так на сервере. Подробности в журнале ~/.jarvis/logs."


def serve(cfg: Config):
    app = build_app(cfg)
    web.run_app(app, host=cfg.host, port=cfg.port, access_log=None, print=None)
