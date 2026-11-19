"""Хранилище SQLite: разговор, память, данные о сети."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    meta TEXT,
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS pings (
    ts REAL NOT NULL,
    up INTEGER NOT NULL,
    latency_ms REAL
);
CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started REAL NOT NULL,
    ended REAL
);
CREATE TABLE IF NOT EXISTS speedtests (
    ts REAL NOT NULL,
    down_mbps REAL,
    up_mbps REAL,
    latency_ms REAL,
    error TEXT
);
CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY,
    ip TEXT,
    hostname TEXT,
    label TEXT,
    first_seen REAL NOT NULL,
    last_seen REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pings_ts ON pings(ts);
CREATE INDEX IF NOT EXISTS speedtests_ts ON speedtests(ts);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
"""


class DB:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)

    def execute(self, sql: str, params=()) -> sqlite3.Cursor:
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        return cur

    def query(self, sql: str, params=()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    # ---------- разговор ----------
    def add_exchange(self, user_text: str, assistant_text: str, source: str, meta: dict | None = None):
        now = time.time()
        with self.conn:
            self.conn.execute(
                "INSERT INTO messages(role, content, source, created) VALUES ('user', ?, ?, ?)",
                (user_text, source, now),
            )
            self.conn.execute(
                "INSERT INTO messages(role, content, source, meta, created) VALUES ('assistant', ?, ?, ?, ?)",
                (assistant_text, source, json.dumps(meta or {}, ensure_ascii=False), now),
            )

    def history_for_model(self, limit: int) -> list[dict]:
        """Последние сообщения для Claude.

        Сообщения всегда хранятся парами «вопрос — ответ». Старые отрезаются
        блоками по половине лимита, а не по одному: так начало истории меняется
        редко и кэш запросов у Claude продолжает работать.
        """
        rows = self.query("SELECT role, content FROM messages ORDER BY id")
        total = len(rows)
        step = max(2, (limit // 2) // 2 * 2)
        start = 0
        if total > limit:
            start = ((total - limit) // step + 1) * step
        return [{"role": r["role"], "content": r["content"]} for r in rows[start:]]

    def recent_messages(self, limit: int = 50) -> list[dict]:
        rows = self.query(
            "SELECT id, role, content, source, created FROM messages ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        return [dict(r) for r in reversed(rows)]

    def clear_history(self):
        self.execute("DELETE FROM messages")

    # ---------- память ----------
    def add_fact(self, text: str) -> int:
        return self.execute("INSERT INTO facts(text, created) VALUES (?, ?)", (text, time.time())).lastrowid

    def facts(self) -> list[sqlite3.Row]:
        return self.query("SELECT id, text FROM facts ORDER BY id")

    def delete_fact(self, fact_id: int) -> bool:
        return self.execute("DELETE FROM facts WHERE id = ?", (fact_id,)).rowcount > 0

    # ---------- события ----------
    def add_event(self, kind: str, text: str):
        self.execute("INSERT INTO events(ts, kind, text) VALUES (?, ?, ?)", (time.time(), kind, text))

    def events_since(self, since: float, kind: str | None = None) -> list[sqlite3.Row]:
        if kind:
            return self.query("SELECT ts, kind, text FROM events WHERE ts >= ? AND kind = ? ORDER BY ts", (since, kind))
        return self.query("SELECT ts, kind, text FROM events WHERE ts >= ? ORDER BY ts", (since,))
