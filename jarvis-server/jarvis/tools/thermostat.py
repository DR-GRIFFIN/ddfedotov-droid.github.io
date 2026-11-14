"""Термостат Ecobee через приложение «Дом» и «Команды» на Mac.

У Ecobee больше нет открытого API для новых разработчиков, зато термостат
умеет работать с Apple Home. На Mac создаются три команды (см. docs/ecobee.md),
а сервер запускает их встроенной утилитой macOS `shortcuts`.
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path

from ..config import ThermostatConfig
from . import NotConfigured, Tool, ToolResult, TurnContext

MODES = {"heat": "обогрев", "cool": "охлаждение", "auto": "авто", "off": "выключен"}


async def run_shortcut(name: str, text_input: str | None = None, timeout_s: float = 40) -> str:
    """Запускает команду macOS по имени и возвращает её текстовый вывод."""
    exe = shutil.which("shortcuts")
    if not exe:
        raise NotConfigured("утилита shortcuts есть только на macOS 12 и новее.")
    with tempfile.TemporaryDirectory() as tmp:
        out_path = Path(tmp) / "out.txt"
        args = [exe, "run", name, "--output-path", str(out_path), "--output-type", "public.plain-text"]
        if text_input is not None:
            in_path = Path(tmp) / "in.txt"
            in_path.write_text(text_input, encoding="utf-8")
            args += ["--input-path", str(in_path)]
        proc = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            _, err = await asyncio.wait_for(proc.communicate(), timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError(f"команда «{name}» не ответила за {timeout_s:.0f} с")
        if proc.returncode != 0:
            msg = err.decode(errors="replace").strip()
            if "couldn't find" in msg.lower() or "not find" in msg.lower():
                raise NotConfigured(f"на Mac нет команды «{name}». Создайте её по инструкции docs/ecobee.md.")
            raise RuntimeError(f"команда «{name}» завершилась с ошибкой: {msg or proc.returncode}")
        return out_path.read_text(encoding="utf-8", errors="replace").strip() if out_path.exists() else ""


def make_tools(cfg: ThermostatConfig, runner=run_shortcut) -> list[Tool]:
    def need_enabled():
        if not cfg.enabled:
            raise NotConfigured("термостат пока не подключён (раздел [thermostat] в config.toml, инструкция docs/ecobee.md).")

    async def status(args: dict, ctx: TurnContext):
        need_enabled()
        out = await runner(cfg.shortcut_status)
        return out or "Команда статуса ничего не вернула."

    async def set_temperature(args: dict, ctx: TurnContext):
        need_enabled()
        value = float(args["celsius"])
        if not (cfg.min_c <= value <= cfg.max_c):
            return ToolResult(
                f"Отказано: {value:g}° вне разрешённого диапазона {cfg.min_c:g}–{cfg.max_c:g}°. "
                "Скажите пользователю, что такую температуру поставить нельзя.",
                is_error=True,
            )
        value = round(value * 2) / 2  # термостат принимает шаг 0,5°
        out = await runner(cfg.shortcut_set_temperature, f"{value:g}")
        return f"Целевая температура установлена: {value:g}°C." + (f" Ответ команды: {out}" if out else "")

    async def set_mode(args: dict, ctx: TurnContext):
        need_enabled()
        mode = args["mode"]
        out = await runner(cfg.shortcut_set_mode, mode)
        return f"Режим термостата: {MODES[mode]}." + (f" Ответ команды: {out}" if out else "")

    return [
        Tool(
            "thermostat_status",
            "Текущее состояние домашнего термостата Ecobee: температура в доме, целевая температура, режим, влажность.",
            {},
            status,
        ),
        Tool(
            "thermostat_set_temperature",
            f"Установить целевую температуру термостата в градусах Цельсия. Разрешено от {cfg.min_c:g} до {cfg.max_c:g}. "
            "Для «теплее/холоднее на N» сначала узнай текущую цель через thermostat_status.",
            {"celsius": {"type": "number", "description": "Целевая температура, °C"}},
            set_temperature,
        ),
        Tool(
            "thermostat_set_mode",
            "Сменить режим термостата: heat — обогрев, cool — охлаждение, auto — авто, off — выключить.",
            {"mode": {"type": "string", "enum": list(MODES)}},
            set_mode,
        ),
    ]
