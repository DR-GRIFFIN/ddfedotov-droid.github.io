"""Мониторинг домашней сети без доступа к роутеру.

* Связь: раз в минуту пробуем подключиться к нескольким публичным серверам.
  Если не отвечает ни один, интернет считается пропавшим.
* Скорость: раз в час качаем и отправляем файл через speed.cloudflare.com.
  Меряется скорость этого Mac: если он на Wi‑Fi, результат упирается в Wi‑Fi.
* Устройства: раз в 10 минут «стучимся» во все адреса своей подсети и читаем
  ARP-таблицу. Новое устройство — событие и (если включено) уведомление.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import re
import socket
import subprocess
import sys
import time
from datetime import datetime

import aiohttp

from ..config import NetworkConfig
from ..db import DB
from ..notify import Notifier
from . import NotConfigured, Tool, TurnContext

log = logging.getLogger(__name__)

PROBES = [("1.1.1.1", 443), ("8.8.8.8", 53), ("9.9.9.9", 443)]
SPEED_HOST = "https://speed.cloudflare.com"
ARP_RE = re.compile(r"\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-fA-F:]{11,17})")


def normalize_mac(mac: str) -> str:
    return ":".join(p.zfill(2) for p in mac.lower().split(":"))


def is_random_mac(mac: str) -> bool:
    """«Частный» адрес, который iPhone и Android выдумывают для каждой сети."""
    try:
        return bool(int(mac.split(":")[0], 16) & 0x02)
    except ValueError:
        return False


def local_ipv4() -> str | None:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("1.1.1.1", 80))  # пакеты не отправляются, только выбирается интерфейс
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def parse_arp(text: str) -> dict[str, str]:
    """{mac: ip} из вывода `arp -an` (macOS и Linux)."""
    result = {}
    for ip, mac in ARP_RE.findall(text):
        mac = normalize_mac(mac)
        if mac in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00") or ip.endswith(".255"):
            continue
        result[mac] = ip
    return result


def fmt_duration(seconds: float) -> str:
    m = int(round(seconds / 60))
    if m < 1:
        return "меньше минуты"
    if m < 60:
        return f"{m} мин"
    h, m = divmod(m, 60)
    return f"{h} ч {m} мин" if m else f"{h} ч"


def fmt_ts(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%d.%m %H:%M")


class NetworkMonitor:
    def __init__(self, cfg: NetworkConfig, db: DB, notifier: Notifier, session: aiohttp.ClientSession | None = None):
        self.cfg = cfg
        self.db = db
        self.notifier = notifier
        self.session = session
        self.tasks: list[asyncio.Task] = []
        self._outage_id: int | None = None
        self._speed_lock = asyncio.Lock()
        row = db.query("SELECT id FROM outages WHERE ended IS NULL ORDER BY id DESC LIMIT 1")
        if row:
            self._outage_id = row[0]["id"]

    # ---------- фоновые задачи ----------
    def start(self):
        if not self.cfg.enabled:
            return
        self.tasks = [
            asyncio.create_task(self._loop(self.check_once, self.cfg.check_every_s), name="net-check"),
            asyncio.create_task(self._loop(self.speedtest, self.cfg.speedtest_every_min * 60, delay=120), name="net-speed"),
            asyncio.create_task(self._loop(self.scan_devices, self.cfg.scan_every_min * 60, delay=30), name="net-scan"),
            asyncio.create_task(self._loop(self.prune, 24 * 3600, delay=600), name="net-prune"),
        ]

    async def stop(self):
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)

    async def _loop(self, fn, every_s: float, delay: float = 0):
        await asyncio.sleep(delay)
        while True:
            try:
                await fn()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Ошибка фоновой задачи %s", fn.__name__)
            await asyncio.sleep(every_s)

    # ---------- связь ----------
    async def probe(self) -> float | None:
        async def one(host, port):
            t0 = time.perf_counter()
            try:
                _, w = await asyncio.wait_for(asyncio.open_connection(host, port), 3)
            except (OSError, asyncio.TimeoutError):
                return None
            w.close()
            return (time.perf_counter() - t0) * 1000

        results = [r for r in await asyncio.gather(*(one(h, p) for h, p in PROBES)) if r is not None]
        return min(results) if results else None

    async def check_once(self):
        latency = await self.probe()
        up = latency is not None
        now = time.time()
        self.db.execute("INSERT INTO pings(ts, up, latency_ms) VALUES (?, ?, ?)", (now, int(up), latency))
        if not up and self._outage_id is None:
            self._outage_id = self.db.execute("INSERT INTO outages(started) VALUES (?)", (now,)).lastrowid
            log.warning("Интернет пропал")
        elif up and self._outage_id is not None:
            row = self.db.query("SELECT started FROM outages WHERE id = ?", (self._outage_id,))
            self.db.execute("UPDATE outages SET ended = ? WHERE id = ?", (now, self._outage_id))
            self._outage_id = None
            if row:
                took = fmt_duration(now - row[0]["started"])
                text = f"Интернет пропадал с {fmt_ts(row[0]['started'])} на {took}."
                self.db.add_event("outage", text)
                await self.notifier.send("Интернет вернулся", text)

    # ---------- скорость ----------
    async def speedtest(self) -> dict:
        async with self._speed_lock:
            return await self._speedtest()

    async def _speedtest(self) -> dict:
        if self.session is None:
            raise RuntimeError("нет HTTP-сессии")
        timeout = aiohttp.ClientTimeout(total=120)
        result = {"down_mbps": None, "up_mbps": None, "latency_ms": None, "error": None}
        try:
            lat = []
            for _ in range(5):
                t0 = time.perf_counter()
                async with self.session.get(f"{SPEED_HOST}/__down?bytes=0", timeout=timeout) as r:
                    await r.read()
                lat.append((time.perf_counter() - t0) * 1000)
            result["latency_ms"] = round(sorted(lat)[len(lat) // 2], 1)

            n = self.cfg.speedtest_download_mb * 1_000_000
            t0 = time.perf_counter()
            got = 0
            async with self.session.get(f"{SPEED_HOST}/__down?bytes={n}", timeout=timeout) as r:
                async for chunk in r.content.iter_chunked(1 << 16):
                    got += len(chunk)
            result["down_mbps"] = round(got * 8 / (time.perf_counter() - t0) / 1e6, 1)

            n = self.cfg.speedtest_upload_mb * 1_000_000
            payload = os.urandom(n)
            t0 = time.perf_counter()
            async with self.session.post(f"{SPEED_HOST}/__up", data=payload, timeout=timeout) as r:
                await r.read()
            result["up_mbps"] = round(n * 8 / (time.perf_counter() - t0) / 1e6, 1)
        except Exception as e:
            result["error"] = str(e) or type(e).__name__
        self.db.execute(
            "INSERT INTO speedtests(ts, down_mbps, up_mbps, latency_ms, error) VALUES (?, ?, ?, ?, ?)",
            (time.time(), result["down_mbps"], result["up_mbps"], result["latency_ms"], result["error"]),
        )
        return result

    # ---------- устройства ----------
    async def read_arp(self) -> dict[str, str]:
        ip = local_ipv4()
        if not ip:
            return {}
        net = ipaddress.ip_network(f"{ip}/24", strict=False)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setblocking(False)
        try:
            for host in net.hosts():  # пустой UDP-пакет заставляет систему выяснить MAC адреса
                try:
                    sock.sendto(b"", (str(host), 9))
                except OSError:
                    pass
        finally:
            sock.close()
        await asyncio.sleep(3)
        cmd = ["arp", "-an"] if sys.platform == "darwin" or os.path.exists("/usr/sbin/arp") else ["ip", "neigh"]
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        out, _ = await proc.communicate()
        text = out.decode(errors="replace")
        if cmd[0] == "ip":  # «192.168.0.5 dev eth0 lladdr aa:bb:… REACHABLE» → формат arp
            text = "\n".join(
                f"? ({m.group(1)}) at {m.group(2)}"
                for m in re.finditer(r"^(\d+\.\d+\.\d+\.\d+) .*lladdr ([0-9a-f:]+)", text, re.M)
            )
        return {mac: a for mac, a in parse_arp(text).items() if ipaddress.ip_address(a) in net}

    async def scan_devices(self):
        found = await self.read_arp()
        if not found:
            return
        now = time.time()
        first_scan = not self.db.query("SELECT 1 FROM devices LIMIT 1")
        loop = asyncio.get_running_loop()
        for mac, ip in found.items():
            row = self.db.query("SELECT mac FROM devices WHERE mac = ?", (mac,))
            if row:
                self.db.execute("UPDATE devices SET ip = ?, last_seen = ? WHERE mac = ?", (ip, now, mac))
                continue
            try:
                hostname = (await asyncio.wait_for(loop.run_in_executor(None, socket.gethostbyaddr, ip), 2))[0]
            except Exception:
                hostname = None
            self.db.execute(
                "INSERT INTO devices(mac, ip, hostname, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)",
                (mac, ip, hostname, now, now),
            )
            if not first_scan:  # при самом первом сканировании все устройства «новые», не шумим
                text = f"В сети новое устройство: {hostname or 'без имени'} ({ip}, {mac})."
                self.db.add_event("new_device", text)
                await self.notifier.send("Новое устройство в сети", text)

    async def prune(self):
        cutoff = time.time() - self.cfg.keep_days * 86400
        self.db.execute("DELETE FROM pings WHERE ts < ?", (cutoff,))
        self.db.execute("DELETE FROM speedtests WHERE ts < ?", (cutoff,))
        self.db.execute("DELETE FROM events WHERE ts < ?", (cutoff,))

    # ---------- сводка для Claude ----------
    def summary(self, days: int) -> str:
        since = time.time() - days * 86400
        lines = [f"Сводка по интернету за {days} дн. (измерения с этого Mac):"]

        pings = self.db.query("SELECT COUNT(*) n, SUM(up) up, AVG(latency_ms) lat FROM pings WHERE ts >= ?", (since,))[0]
        if pings["n"]:
            share = 100 * (pings["up"] or 0) / pings["n"]
            lines.append(f"Связь была в {share:.2f}% проверок, средняя задержка {pings['lat'] or 0:.0f} мс.")
        else:
            lines.append("Проверок связи ещё нет.")

        outs = self.db.query(
            "SELECT started, ended FROM outages WHERE COALESCE(ended, ?) >= ? ORDER BY started", (time.time(), since)
        )
        if outs:
            lines.append(f"Обрывов: {len(outs)}.")
            for o in outs[-10:]:
                if o["ended"]:
                    lines.append(f"- {fmt_ts(o['started'])}, длительность {fmt_duration(o['ended'] - o['started'])}")
                else:
                    lines.append(f"- {fmt_ts(o['started'])}, интернета нет до сих пор")
        else:
            lines.append("Обрывов не было.")

        st = self.db.query(
            "SELECT AVG(down_mbps) d, MIN(down_mbps) dmin, MAX(down_mbps) dmax, AVG(up_mbps) u, AVG(latency_ms) l, COUNT(down_mbps) n "
            "FROM speedtests WHERE ts >= ? AND error IS NULL",
            (since,),
        )[0]
        if st["n"]:
            lines.append(
                f"Скорость (замеров {st['n']}): скачивание в среднем {st['d']:.0f} Мбит/с "
                f"(от {st['dmin']:.0f} до {st['dmax']:.0f}), загрузка {st['u']:.0f} Мбит/с, задержка {st['l']:.0f} мс."
            )
            evening = self.db.query(
                "SELECT AVG(down_mbps) d FROM speedtests WHERE ts >= ? AND error IS NULL "
                "AND CAST(strftime('%H', ts, 'unixepoch', 'localtime') AS INTEGER) BETWEEN 19 AND 23",
                (since,),
            )[0]["d"]
            if evening:
                lines.append(f"Вечером (19–23 ч) в среднем {evening:.0f} Мбит/с.")
        else:
            lines.append("Замеров скорости ещё нет.")
        errors = self.db.query("SELECT COUNT(*) n FROM speedtests WHERE ts >= ? AND error IS NOT NULL", (since,))[0]["n"]
        if errors:
            lines.append(f"Неудачных замеров: {errors}.")

        new = self.db.events_since(since, "new_device")
        if new:
            lines.append(f"Новых устройств в сети: {len(new)}.")
        return "\n".join(lines)

    def devices_text(self, only_recent_hours: int) -> str:
        since = time.time() - only_recent_hours * 3600
        rows = self.db.query("SELECT * FROM devices WHERE last_seen >= ? ORDER BY ip", (since,))
        if not rows:
            return "Устройств пока не найдено (сканирование раз в 10 минут)."
        lines = [f"Устройства, замеченные за {only_recent_hours} ч: {len(rows)}."]
        for r in rows:
            name = r["label"] or r["hostname"] or "без имени"
            extra = " (случайный «частный» MAC — телефон/планшет)" if is_random_mac(r["mac"]) else ""
            lines.append(f"- {name}: {r['ip']}, {r['mac']}{extra}, впервые {fmt_ts(r['first_seen'])}")
        return "\n".join(lines)


def make_tools(mon: NetworkMonitor) -> list[Tool]:
    def need_enabled():
        if not mon.cfg.enabled:
            raise NotConfigured("мониторинг сети выключен в config.toml ([network] enabled).")

    async def status(args: dict, ctx: TurnContext):
        need_enabled()
        days = max(1, min(int(args["days"]), 90))
        return mon.summary(days)

    async def speedtest(args: dict, ctx: TurnContext):
        need_enabled()
        r = await mon.speedtest()
        if r["error"]:
            return f"Замер не удался: {r['error']}"
        return f"Только что: скачивание {r['down_mbps']} Мбит/с, загрузка {r['up_mbps']} Мбит/с, задержка {r['latency_ms']} мс."

    async def devices(args: dict, ctx: TurnContext):
        need_enabled()
        return mon.devices_text(max(1, min(int(args["hours"]), 24 * 30)))

    async def label(args: dict, ctx: TurnContext):
        need_enabled()
        mac = normalize_mac(args["mac"])
        n = mon.db.execute("UPDATE devices SET label = ? WHERE mac = ?", (args["name"].strip(), mac)).rowcount
        return f"Устройство {mac} теперь называется «{args['name']}»." if n else f"Устройство {mac} не найдено."

    return [
        Tool(
            "network_status",
            "Статистика домашнего интернета: обрывы, скорость, задержка, новые устройства за последние дни.",
            {"days": {"type": "integer", "description": "За сколько дней, от 1 до 90"}},
            status,
        ),
        Tool(
            "network_speedtest",
            "Измерить скорость интернета прямо сейчас (около 10–30 секунд).",
            {},
            speedtest,
        ),
        Tool(
            "network_devices",
            "Список устройств в домашней сети, замеченных за последние часы.",
            {"hours": {"type": "integer", "description": "За сколько часов, например 24"}},
            devices,
        ),
        Tool(
            "network_label_device",
            "Дать устройству в сети понятное имя по его MAC-адресу (например, «Телевизор в гостиной»).",
            {"mac": {"type": "string"}, "name": {"type": "string"}},
            label,
        ),
    ]
