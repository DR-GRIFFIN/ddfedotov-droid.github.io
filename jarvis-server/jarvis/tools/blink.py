"""Камеры Blink через неофициальную библиотеку blinkpy.

Официального API у Blink нет. blinkpy давно используется в Home Assistant, но
если Amazon что-то поменяет, функции могут временно перестать работать.

Вход делается один раз командой `python -m jarvis blink-login`; дальше сервер
обновляет токены сам и сохраняет их в ~/.jarvis/blink-credentials.json.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import time
from pathlib import Path

import json

import aiohttp

from ..config import BlinkConfig
from . import NotConfigured, Tool, ToolResult, TurnContext

log = logging.getLogger(__name__)

CONFIRM_WINDOW_S = 180


class BlinkService:
    """Ленивое подключение к Blink: входим при первом обращении."""

    def __init__(self, cfg: BlinkConfig, creds_path: Path, session: aiohttp.ClientSession | None = None):
        self.cfg = cfg
        self.creds_path = creds_path
        self.session = session
        self.blink = None
        self._lock = asyncio.Lock()

    async def get(self):
        if not self.cfg.enabled:
            raise NotConfigured("камеры Blink не подключены (раздел [blink] в config.toml, инструкция docs/blink.md).")
        async with self._lock:
            if self.blink is not None and self.blink.available:
                await self.blink.refresh(force_cache=True)
                return self.blink
            if not self.creds_path.exists():
                raise NotConfigured("нет входа в Blink. На Mac выполните: ./jarvis.sh blink-login")
            from blinkpy.auth import Auth, BlinkTwoFARequiredError
            from blinkpy.blinkpy import Blink
            from blinkpy.helpers.util import json_load

            creds = await json_load(str(self.creds_path))
            blink = Blink(session=self.session, refresh_rate=30, no_owls=False)
            blink.auth = Auth(creds, no_prompt=True, session=self.session, callback=lambda: asyncio.ensure_future(self._save(blink)))
            try:
                ok = await blink.start()
            except BlinkTwoFARequiredError:
                raise NotConfigured("Blink снова просит код подтверждения. На Mac выполните: ./jarvis.sh blink-login")
            if not ok:
                raise RuntimeError("не удалось подключиться к Blink. Если пароль меняли, выполните ./jarvis.sh blink-login")
            await self._save(blink)
            self.blink = blink
            return blink

    async def _save(self, blink):
        try:
            save_credentials(blink.auth.login_attributes, self.creds_path)
        except Exception as e:
            log.warning("Не удалось сохранить токены Blink: %s", e)

    def allowed(self, name: str) -> bool:
        allow = [c.lower() for c in self.cfg.allowed_cameras]
        return not allow or name.lower() in allow


def save_credentials(attrs: dict, path: Path):
    """Сохраняет токены входа без пароля, доступ только владельцу файла."""
    data = {k: v for k, v in attrs.items() if k != "password"}
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def _camera(blink, svc: BlinkService, name: str):
    cams = {n: c for n, c in blink.cameras.items() if svc.allowed(n)}
    if not cams:
        raise RuntimeError("нет доступных камер")
    for n, c in cams.items():
        if n.lower() == name.lower():
            return n, c
    for n, c in cams.items():  # частичное совпадение: «двор» → «Задний двор»
        if name.lower() in n.lower():
            return n, c
    raise RuntimeError(f"камера «{name}» не найдена. Есть: {', '.join(cams)}")


def make_tools(svc: BlinkService) -> list[Tool]:
    pending_disarm: dict = {}  # {"turn_id": int, "ts": float}

    async def cameras(args: dict, ctx: TurnContext):
        blink = await svc.get()
        lines = []
        for sync_name, sync in blink.sync.items():
            armed = sync.arm
            state = "на охране" if armed else ("снята с охраны" if armed is False else "состояние неизвестно")
            lines.append(f"Система «{sync_name}»: {state}, {'в сети' if sync.online else 'НЕ в сети'}.")
        for name, cam in blink.cameras.items():
            if not svc.allowed(name):
                continue
            a = cam.attributes
            parts = [f"Камера «{name}»"]
            if a.get("battery"):
                parts.append(f"батарея: {a['battery']}")
            if a.get("temperature_c") is not None:
                parts.append(f"температура у камеры {a['temperature_c']}°C")
            if a.get("wifi_strength") is not None:
                parts.append(f"сигнал Wi‑Fi {a['wifi_strength']}")
            if a.get("last_record"):
                parts.append(f"последняя запись: {a['last_record']}")
            if a.get("motion_detected"):
                parts.append("недавно было движение")
            lines.append(", ".join(parts) + ".")
        return "\n".join(lines) or "Камер не найдено."

    async def snapshot(args: dict, ctx: TurnContext):
        blink = await svc.get()
        name, cam = _camera(blink, svc, args["camera"])
        await cam.snap_picture()
        await asyncio.sleep(4)  # камера на батарейках просыпается не сразу
        await blink.refresh(force_cache=True)
        resp = await cam.get_media()
        data = await resp.read() if resp is not None and resp.status == 200 else cam.image_from_cache
        if not data:
            return ToolResult(f"Камера «{name}» не прислала снимок.", is_error=True)
        ctx.images_out.append(("image/jpeg", data))
        return ToolResult(
            f"Снимок с камеры «{name}», сделан только что. Опиши пользователю, что на нём видно; "
            "людей описывай по внешнему виду, не пытайся узнать, кто это.",
            images=[("image/jpeg", data)],
        )

    async def recent_events(args: dict, ctx: TurnContext):
        blink = await svc.get()
        hours = max(1, min(int(args["hours"]), 24 * 7))
        since = dt.datetime.now() - dt.timedelta(hours=hours)
        videos = await blink.get_videos_metadata(since=since.strftime("%Y/%m/%d %H:%M:%S"), stop=4)
        videos = [v for v in videos if svc.allowed(v.get("device_name", ""))]
        if not videos:
            return f"За последние {hours} ч записей движения нет."
        lines = [f"Записей за {hours} ч: {len(videos)}."]
        for v in videos[:30]:
            when = v.get("created_at", "?")
            try:
                when = dt.datetime.fromisoformat(when.replace("Z", "+00:00")).astimezone().strftime("%d.%m %H:%M")
            except Exception:
                pass
            lines.append(f"- {when}, камера «{v.get('device_name', '?')}»")
        images = []
        if args["with_pictures"]:
            for v in videos[:3]:
                thumb = v.get("thumbnail")
                if not thumb:
                    continue
                try:
                    url = thumb if thumb.endswith(".jpg") or "?" in thumb else thumb + ".jpg"
                    resp = await blink.do_http_get(url)
                    if resp is not None and resp.status == 200:
                        images.append(("image/jpeg", await resp.read()))
                except Exception as e:
                    log.info("Не удалось скачать превью: %s", e)
            if images:
                lines.append(f"Приложены превью {len(images)} последних записей (сначала самые новые).")
                ctx.images_out.extend(images)
        return ToolResult("\n".join(lines), images=images)

    async def set_armed(args: dict, ctx: TurnContext):
        blink = await svc.get()
        armed = bool(args["armed"])
        if not armed:
            # Снятие с охраны: только после явного подтверждения в следующей реплике пользователя.
            p = pending_disarm.get("p")
            confirmed_ok = (
                args["user_confirmed"]
                and p is not None
                and p["turn_id"] < ctx.turn_id
                and time.time() - p["ts"] < CONFIRM_WINDOW_S
            )
            if not confirmed_ok:
                pending_disarm["p"] = {"turn_id": ctx.turn_id, "ts": time.time()}
                return ToolResult(
                    "Нужно подтверждение. Спроси пользователя: «Точно снять камеры с охраны?» и закончи ответ. "
                    "Если он в следующей реплике ясно подтвердит, вызови этот инструмент снова с user_confirmed=true.",
                    is_error=True,
                )
            pending_disarm.pop("p", None)
        for sync in blink.sync.values():
            await sync.async_arm(armed)
        await asyncio.sleep(2)
        await blink.refresh(force_cache=True)
        return "Камеры поставлены на охрану." if armed else "Камеры сняты с охраны."

    return [
        Tool(
            "blink_cameras",
            "Состояние камер Blink: на охране ли система, батарея, сигнал, последнее движение.",
            {},
            cameras,
        ),
        Tool(
            "blink_snapshot",
            "Сделать свежий снимок с камеры Blink и посмотреть на него (например, «кто у двери?»). Занимает 5–10 секунд.",
            {"camera": {"type": "string", "description": "Название камеры, как его назвал пользователь или как в blink_cameras"}},
            snapshot,
        ),
        Tool(
            "blink_recent_events",
            "Записи движения с камер Blink за последние часы. with_pictures=true добавляет превью трёх последних записей.",
            {
                "hours": {"type": "integer", "description": "За сколько последних часов, от 1 до 168"},
                "with_pictures": {"type": "boolean"},
            },
            recent_events,
        ),
        Tool(
            "blink_set_armed",
            "Поставить камеры Blink на охрану (armed=true) или снять с охраны (armed=false). "
            "Снятие с охраны требует подтверждения пользователя: в первый раз передай user_confirmed=false.",
            {"armed": {"type": "boolean"}, "user_confirmed": {"type": "boolean"}},
            set_armed,
        ),
    ]


async def interactive_login(creds_path: Path):
    """Однократный вход в Blink из терминала (с кодом подтверждения)."""
    import getpass

    from blinkpy.auth import Auth, BlinkTwoFARequiredError
    from blinkpy.blinkpy import Blink

    username = input("E-mail учётной записи Blink: ").strip()
    password = getpass.getpass("Пароль Blink (не отображается): ")
    async with aiohttp.ClientSession() as session:
        blink = Blink(session=session)
        blink.auth = Auth({"username": username, "password": password}, no_prompt=True, session=session)
        try:
            ok = await blink.start()
        except BlinkTwoFARequiredError:
            code = input("Blink прислал код подтверждения (SMS или e-mail). Введите его: ").strip()
            ok = await blink.send_2fa_code(code)
        if not ok:
            print("Не получилось войти. Проверьте e-mail, пароль и код и попробуйте ещё раз.")
            return False
        save_credentials(blink.auth.login_attributes, creds_path)
        print(f"Готово. Камеры: {', '.join(blink.cameras) or 'не найдены'}.")
        print("Пароль не сохранён, сохранены только токены входа.")
        return True
