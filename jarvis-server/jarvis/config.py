"""Настройки Джарвиса.

Все настройки и секреты лежат вне репозитория, в ~/.jarvis/config.toml
(путь можно сменить переменной окружения JARVIS_HOME). Файл создаёт install.sh.
"""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path


def jarvis_home() -> Path:
    return Path(os.environ.get("JARVIS_HOME", "~/.jarvis")).expanduser()


@dataclass
class ThermostatConfig:
    enabled: bool = False
    shortcut_status: str = "Джарвис термостат статус"
    shortcut_set_temperature: str = "Джарвис термостат температура"
    shortcut_set_mode: str = "Джарвис термостат режим"
    min_c: float = 16.0
    max_c: float = 26.0


@dataclass
class BlinkConfig:
    enabled: bool = False
    # Камеры, которые Джарвису можно показывать Claude. Пусто = все камеры.
    allowed_cameras: list[str] = field(default_factory=list)


@dataclass
class NetworkConfig:
    enabled: bool = True
    check_every_s: int = 60
    speedtest_every_min: int = 60
    speedtest_download_mb: int = 25
    speedtest_upload_mb: int = 10
    scan_every_min: int = 10
    keep_days: int = 90


@dataclass
class FilesConfig:
    folders: list[str] = field(default_factory=list)


@dataclass
class NotifyConfig:
    # Тема ntfy.sh. Пусто = уведомления выключены.
    ntfy_topic: str = ""
    ntfy_server: str = "https://ntfy.sh"


@dataclass
class Config:
    anthropic_api_key: str = ""
    access_key: str = ""
    model: str = "claude-haiku-5-5"
    effort: str = "low"
    port: int = 8765
    host: str = "127.0.0.1"
    allowed_origins: list[str] = field(
        default_factory=lambda: ["https://ddfedotov-droid.github.io"]
    )
    history_messages: int = 40
    home: Path = field(default_factory=jarvis_home)
    thermostat: ThermostatConfig = field(default_factory=ThermostatConfig)
    blink: BlinkConfig = field(default_factory=BlinkConfig)
    network: NetworkConfig = field(default_factory=NetworkConfig)
    files: FilesConfig = field(default_factory=FilesConfig)
    notify: NotifyConfig = field(default_factory=NotifyConfig)

    @property
    def db_path(self) -> Path:
        return self.home / "jarvis.db"

    @property
    def blink_credentials_path(self) -> Path:
        return self.home / "blink-credentials.json"


_SECTIONS = {
    "thermostat": ThermostatConfig,
    "blink": BlinkConfig,
    "network": NetworkConfig,
    "files": FilesConfig,
    "notify": NotifyConfig,
}


def _build(cls, data: dict):
    known = cls.__dataclass_fields__
    unknown = set(data) - set(known)
    if unknown:
        raise ValueError(f"Неизвестные настройки в [{cls.__name__}]: {', '.join(sorted(unknown))}")
    return cls(**data)


def load_config(path: Path | None = None) -> Config:
    home = jarvis_home()
    path = path or home / "config.toml"
    data: dict = {}
    if path.exists():
        with path.open("rb") as f:
            data = tomllib.load(f)
    sections = {name: _build(cls, data.pop(name, {})) for name, cls in _SECTIONS.items()}
    cfg = _build(Config, {**data, **sections})
    cfg.home = home
    # Ключи можно передать и через окружение (удобно для тестов).
    cfg.anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", cfg.anthropic_api_key)
    cfg.access_key = os.environ.get("JARVIS_ACCESS_KEY", cfg.access_key)
    return cfg
