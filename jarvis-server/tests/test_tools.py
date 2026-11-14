import asyncio
import os
import time

import pytest

from jarvis.config import BlinkConfig, FilesConfig, NetworkConfig, NotifyConfig
from jarvis.db import DB
from jarvis.notify import Notifier
from jarvis.tools import Toolbox, TurnContext
from jarvis.tools import blink, files, network


def run(coro):
    return asyncio.run(coro)


# ---------- файлы ----------
@pytest.fixture
def docs(tmp_path):
    root = tmp_path / "Documents"
    (root / "Договоры").mkdir(parents=True)
    (root / "Договоры" / "Договор аренды 2026.txt").write_text("Срок аренды до 31 мая 2027 года.", encoding="utf-8")
    (root / ".secret").write_text("скрыто")
    outside = tmp_path / "private.txt"
    outside.write_text("не трогать")
    os.symlink(outside, root / "link.txt")
    return root


def test_files_search_and_read(docs):
    tb = Toolbox(files.make_tools(FilesConfig(folders=[str(docs)])))
    ctx = TurnContext(1, "web")
    found = run(tb.run("files_search", {"query": "договор аренды"}, ctx))
    assert "Договор аренды 2026.txt" in found.text
    path = str(docs / "Договоры" / "Договор аренды 2026.txt")
    content = run(tb.run("files_read", {"path": path, "start": 1}, ctx))
    assert "31 мая 2027" in content.text and not content.is_error
    listing = run(tb.run("files_list", {"path": str(docs)}, ctx))
    assert ".secret" not in listing.text


@pytest.mark.parametrize("bad", ["../private.txt", "link.txt", "/etc/passwd", "~/.ssh/id_rsa"])
def test_files_cannot_escape(docs, bad):
    tb = Toolbox(files.make_tools(FilesConfig(folders=[str(docs)])))
    res = run(tb.run("files_read", {"path": bad, "start": 1}, TurnContext(1, "web")))
    assert res.is_error
    assert "не трогать" not in res.text


def test_files_not_configured():
    tb = Toolbox(files.make_tools(FilesConfig()))
    res = run(tb.run("files_search", {"query": "x"}, TurnContext(1, "web")))
    assert res.is_error and "Не настроено" in res.text


# ---------- сеть ----------
def test_parse_arp_mac_and_linux():
    mac_out = (
        "? (192.168.0.1) at 74:25:84:9f:b7:8d on en0 ifscope [ethernet]\n"
        "? (192.168.0.23) at 2:42:ac:11:0:2 on en0 ifscope [ethernet]\n"
        "? (192.168.0.40) at (incomplete) on en0 ifscope [ethernet]\n"
        "? (192.168.0.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]\n"
    )
    assert network.parse_arp(mac_out) == {"74:25:84:9f:b7:8d": "192.168.0.1", "02:42:ac:11:00:02": "192.168.0.23"}
    assert network.is_random_mac("02:42:ac:11:00:02") and network.is_random_mac("da:00:00:00:00:01")
    assert not network.is_random_mac("74:25:84:9f:b7:8d")


def test_outage_is_recorded_and_summarized():
    db = DB(":memory:")
    sent = []

    class N(Notifier):
        async def send(self, title, text, priority=3):
            sent.append((title, text))

    mon = network.NetworkMonitor(NetworkConfig(), db, N(NotifyConfig()))
    seq = iter([None, None, 12.5])

    async def fake_probe():
        return next(seq)

    mon.probe = fake_probe

    async def go():
        await mon.check_once()
        await mon.check_once()
        await mon.check_once()

    run(go())
    outs = db.query("SELECT * FROM outages")
    assert len(outs) == 1 and outs[0]["ended"] is not None
    assert sent and sent[0][0] == "Интернет вернулся"
    db.execute("INSERT INTO speedtests(ts, down_mbps, up_mbps, latency_ms) VALUES (?, 900, 850, 4)", (time.time(),))
    text = mon.summary(7)
    assert "Обрывов: 1" in text and "900 Мбит/с" in text


def test_new_device_event_after_first_scan():
    db = DB(":memory:")
    mon = network.NetworkMonitor(NetworkConfig(), db, Notifier(NotifyConfig()))
    scans = iter([{"aa:bb:cc:00:00:01": "192.168.0.10"}, {"aa:bb:cc:00:00:01": "192.168.0.10", "aa:bb:cc:00:00:02": "192.168.0.11"}])

    async def fake_arp():
        return next(scans)

    mon.read_arp = fake_arp
    run(mon.scan_devices())
    assert db.events_since(0) == []  # первое сканирование — без шума
    run(mon.scan_devices())
    ev = db.events_since(0, "new_device")
    assert len(ev) == 1 and "192.168.0.11" in ev[0]["text"]


# ---------- Blink: подтверждение снятия с охраны ----------
class FakeSync:
    def __init__(self):
        self.arm = True
        self.online = True
        self.calls = []

    async def async_arm(self, value):
        self.calls.append(value)
        self.arm = value


class FakeBlink:
    def __init__(self):
        self.sync = {"Дом": FakeSync()}
        self.cameras = {}

    async def refresh(self, force_cache=False):
        return True


class FakeService(blink.BlinkService):
    def __init__(self):
        super().__init__(BlinkConfig(enabled=True), None)
        self.fake = FakeBlink()

    async def get(self):
        return self.fake


def test_disarm_needs_confirmation_in_a_later_turn(monkeypatch):
    async def no_sleep(_):
        return None

    monkeypatch.setattr(blink.asyncio, "sleep", no_sleep)
    svc = FakeService()
    tb = Toolbox(blink.make_tools(svc))
    sync = svc.fake.sync["Дом"]

    first = run(tb.run("blink_set_armed", {"armed": False, "user_confirmed": True}, TurnContext(1, "watch")))
    assert first.is_error and "подтверждение" in first.text.lower()
    same_turn = run(tb.run("blink_set_armed", {"armed": False, "user_confirmed": True}, TurnContext(1, "watch")))
    assert same_turn.is_error  # в том же вопросе подтвердить нельзя
    assert sync.calls == []
    later = run(tb.run("blink_set_armed", {"armed": False, "user_confirmed": True}, TurnContext(2, "watch")))
    assert not later.is_error and sync.calls == [False]
    arm = run(tb.run("blink_set_armed", {"armed": True, "user_confirmed": False}, TurnContext(3, "watch")))
    assert not arm.is_error and sync.calls == [False, True]


def test_blink_credentials_saved_without_password(tmp_path):
    path = tmp_path / "creds.json"
    blink.save_credentials({"username": "a@b.c", "password": "secret", "refresh_token": "r"}, path)
    text = path.read_text()
    assert "secret" not in text and "refresh_token" in text
    assert oct(path.stat().st_mode & 0o777) == "0o600"


# ---------- история ----------
def test_history_trimmed_in_chunks_and_starts_with_user():
    db = DB(":memory:")
    for i in range(30):
        db.add_exchange(f"вопрос {i}", f"ответ {i}", "web")
    h1 = db.history_for_model(40)
    db.add_exchange("вопрос 30", "ответ 30", "web")
    h2 = db.history_for_model(40)
    assert h1[0]["role"] == "user" and h2[0]["role"] == "user"
    assert len(h1) <= 40 and len(h2) <= 40
    assert h1[0] == h2[0]  # начало истории не сдвигается с каждым вопросом


def test_recent_events_include_usb_clips(monkeypatch):
    import datetime as dt
    from types import SimpleNamespace

    now = dt.datetime.now(dt.timezone.utc)

    class LocalSync(FakeSync):
        local_storage = True
        name = "Дом"

        def __init__(self):
            super().__init__()
            self._local_storage = {"manifest": []}

        async def update_local_storage_manifest(self):
            self._local_storage["manifest"] = [
                SimpleNamespace(name="Входная дверь", created_at=now - dt.timedelta(hours=2)),
                SimpleNamespace(name="Двор", created_at=now - dt.timedelta(days=3)),  # старая
            ]

    svc = FakeService()
    svc.fake.sync = {"Дом": LocalSync()}

    async def no_cloud(**kwargs):
        return []

    svc.fake.get_videos_metadata = no_cloud
    res = run(Toolbox(blink.make_tools(svc)).run("blink_recent_events", {"hours": 24, "with_pictures": False}, TurnContext(1, "web")))
    assert "Записей за 24 ч: 1." in res.text
    assert "Входная дверь" in res.text and "флешка" in res.text and "Двор" not in res.text
