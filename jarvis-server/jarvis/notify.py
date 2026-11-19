"""Уведомления на телефон и часы через ntfy (необязательно).

В приложении ntfy на iPhone подписываетесь на свою тему, и уведомления
приходят на телефон и на Apple Watch. Тема должна быть длинной и случайной:
кто её знает, тот видит уведомления.
"""

from __future__ import annotations

import logging

import aiohttp

from .config import NotifyConfig

log = logging.getLogger(__name__)


class Notifier:
    def __init__(self, cfg: NotifyConfig, session: aiohttp.ClientSession | None = None):
        self.cfg = cfg
        self.session = session

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.ntfy_topic)

    async def send(self, title: str, text: str, priority: int = 3):
        if not self.enabled or self.session is None:
            return
        # JSON-публикация: так заголовок может быть по-русски (в HTTP-заголовках нельзя).
        payload = {"topic": self.cfg.ntfy_topic, "title": title, "message": text, "priority": priority, "tags": ["robot"]}
        try:
            async with self.session.post(
                self.cfg.ntfy_server.rstrip("/") + "/",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status >= 300:
                    log.warning("ntfy ответил %s", resp.status)
        except Exception as e:
            log.warning("Не удалось отправить уведомление: %s", e)
