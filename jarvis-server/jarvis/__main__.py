"""Командная строка: python -m jarvis <команда> (обычно через ./jarvis.sh)."""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
import secrets
import shutil
import subprocess
import sys

from . import __version__
from .config import jarvis_home, load_config


def cmd_serve(args):
    from .server import serve

    serve(load_config())


def cmd_ask(args):
    """Задать вопрос прямо из терминала, без HTTP (для проверки)."""
    import aiohttp

    from .brain import Brain
    from .db import DB
    from .notify import Notifier
    from .tools import Toolbox
    from .tools import blink, files, memory, network, thermostat

    cfg = load_config()

    async def run():
        async with aiohttp.ClientSession() as session:
            db = DB(cfg.db_path)
            mon = network.NetworkMonitor(cfg.network, db, Notifier(cfg.notify, session), session)
            toolbox = Toolbox(
                thermostat.make_tools(cfg.thermostat)
                + blink.make_tools(blink.BlinkService(cfg.blink, cfg.blink_credentials_path, session))
                + network.make_tools(mon)
                + files.make_tools(cfg.files)
                + memory.make_tools(db)
            )
            result = await Brain(cfg, db, toolbox).ask(" ".join(args.text), source="cli")
            print(result["reply"])
            if result["tools"]:
                print(f"(инструменты: {', '.join(result['tools'])})")

    asyncio.run(run())


def cmd_blink_login(args):
    from .tools.blink import interactive_login

    ok = asyncio.run(interactive_login(load_config().blink_credentials_path))
    sys.exit(0 if ok else 1)


def cmd_key(args):
    """Показать ключ доступа или создать новый (--new)."""
    path = jarvis_home() / "config.toml"
    if not path.exists():
        sys.exit("Нет ~/.jarvis/config.toml. Сначала запустите install.sh.")
    text = path.read_text(encoding="utf-8")
    m = re.search(r'^access_key\s*=\s*"([^"]*)"', text, re.M)
    if args.new or not m or len(m.group(1)) < 24:
        key = secrets.token_urlsafe(32)
        line = f'access_key = "{key}"'
        text = re.sub(r"^access_key\s*=.*$", line, text, flags=re.M) if m else line + "\n" + text
        path.write_text(text, encoding="utf-8")
        print("Создан новый ключ доступа. Обновите его в команде на часах и на веб-странице,")
        print("затем перезапустите сервер: ./jarvis.sh restart")
    else:
        key = m.group(1)
    print(f"\nКлюч доступа: {key}\n")


def cmd_doctor(args):
    """Проверка настроек."""
    cfg = load_config()
    ok = True

    def line(good: bool | None, text: str):
        nonlocal ok
        mark = {True: "✅", False: "❌", None: "➖"}[good]
        if good is False:
            ok = False
        print(f"{mark} {text}")

    print(f"Джарвис {__version__}, настройки: {jarvis_home() / 'config.toml'}\n")
    line(bool(cfg.anthropic_api_key), "Ключ Claude API указан" if cfg.anthropic_api_key else "Нет anthropic_api_key")
    line(len(cfg.access_key) >= 24, "Ключ доступа указан" if cfg.access_key else "Нет access_key (./jarvis.sh key)")
    line(None, f"Модель: {cfg.model}, effort: {cfg.effort}, порт: {cfg.port}")

    if cfg.thermostat.enabled:
        if shutil.which("shortcuts"):
            names = subprocess.run(["shortcuts", "list"], capture_output=True, text=True).stdout.splitlines()
            for n in (cfg.thermostat.shortcut_status, cfg.thermostat.shortcut_set_temperature, cfg.thermostat.shortcut_set_mode):
                line(n in names, f"Команда «{n}»" + ("" if n in names else " не найдена (docs/ecobee.md)"))
        else:
            line(False, "Термостат включён, но утилиты shortcuts нет (нужна macOS 12+)")
    else:
        line(None, "Термостат выключен")

    if cfg.blink.enabled:
        exists = cfg.blink_credentials_path.exists()
        line(exists, "Вход в Blink выполнен" if exists else "Blink включён, но вход не выполнен: ./jarvis.sh blink-login")
    else:
        line(None, "Blink выключен")

    for folder in cfg.files.folders:
        from pathlib import Path

        p = Path(folder).expanduser()
        line(p.is_dir(), f"Папка для чтения: {p}" + ("" if p.is_dir() else " — не найдена"))
    if not cfg.files.folders:
        line(None, "Доступ к файлам не настроен")

    line(None, "Уведомления ntfy: " + ("включены" if cfg.notify.ntfy_topic else "выключены"))
    print("\nВсё в порядке." if ok else "\nЕсть что поправить (см. ❌ выше).")
    sys.exit(0 if ok else 1)


def main(argv=None):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for noisy in ("httpx", "httpx2", "blinkpy"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    p = argparse.ArgumentParser(prog="jarvis", description="Джарвис: голосовой ассистент на Claude")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("serve", help="запустить сервер").set_defaults(fn=cmd_serve)
    a = sub.add_parser("ask", help="задать вопрос из терминала")
    a.add_argument("text", nargs="+")
    a.set_defaults(fn=cmd_ask)
    sub.add_parser("blink-login", help="войти в Blink").set_defaults(fn=cmd_blink_login)
    k = sub.add_parser("key", help="показать или создать ключ доступа")
    k.add_argument("--new", action="store_true", help="создать новый ключ (старый перестанет работать)")
    k.set_defaults(fn=cmd_key)
    sub.add_parser("doctor", help="проверить настройки").set_defaults(fn=cmd_doctor)
    args = p.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
