"""Persistent, grouped storage for browser error reports."""
import hashlib
import json
import os
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).resolve().parent / "instance" / "client-errors.sqlite3"


class ClientErrorStore:
    def __init__(self, path=None):
        self.path = str(path or os.getenv("CLIENT_ERROR_DB_PATH") or DEFAULT_DB_PATH)

    def _connect(self):
        Path(self.path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS client_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL, message TEXT NOT NULL, stack TEXT NOT NULL,
                source TEXT NOT NULL, line INTEGER, column_no INTEGER,
                pathname TEXT NOT NULL, app_id TEXT NOT NULL, play_id TEXT NOT NULL,
                actor_role TEXT NOT NULL, client_id TEXT NOT NULL,
                user_agent TEXT NOT NULL, app_version TEXT NOT NULL,
                service_worker_version TEXT NOT NULL,
                first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
                details_json TEXT NOT NULL
            )
        """)
        connection.execute("CREATE INDEX IF NOT EXISTS idx_client_errors_status_last ON client_errors(status, last_seen DESC)")
        return connection

    @staticmethod
    def fingerprint(record):
        # Location and normalized error identity group repeats across users/browsers.
        identity = [record["type"], record["message"], record["source"], record["line"], record["column"], record["pathname"], record["appId"], record["playId"]]
        return hashlib.sha256(json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()

    def add(self, record):
        fingerprint = self.fingerprint(record)
        values = (fingerprint, record["type"], record["message"], record["stack"], record["source"], record["line"], record["column"], record["pathname"], record["appId"], record["playId"], record["actorRole"], record["clientId"], record["userAgent"], record["appVersion"], record["serviceWorkerVersion"], record["serverTimestamp"], record["serverTimestamp"], json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        with self._connect() as db:
            db.execute("""
                INSERT INTO client_errors (fingerprint,type,message,stack,source,line,column_no,pathname,app_id,play_id,actor_role,client_id,user_agent,app_version,service_worker_version,first_seen,last_seen,details_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(fingerprint) DO UPDATE SET
                    last_seen=excluded.last_seen, occurrence_count=client_errors.occurrence_count+1,
                    stack=excluded.stack, actor_role=excluded.actor_role, client_id=excluded.client_id,
                    user_agent=excluded.user_agent, app_version=excluded.app_version,
                    service_worker_version=excluded.service_worker_version, details_json=excluded.details_json
            """, values)

    def list(self, status="all", search="", limit=50, offset=0):
        clauses, params = [], []
        if status in ("open", "resolved"):
            clauses.append("status = ?")
            params.append(status)
        if search:
            clauses.append("(message LIKE ? ESCAPE '\\' OR type LIKE ? ESCAPE '\\' OR actor_role LIKE ? ESCAPE '\\' OR client_id LIKE ? ESCAPE '\\' OR play_id LIKE ? ESCAPE '\\' OR pathname LIKE ? ESCAPE '\\')")
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            params.extend([f"%{escaped}%"] * 6)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with self._connect() as db:
            total = db.execute("SELECT COUNT(*) FROM client_errors" + where, params).fetchone()[0]
            rows = db.execute("SELECT * FROM client_errors" + where + " ORDER BY last_seen DESC, id DESC LIMIT ? OFFSET ?", params + [limit, offset]).fetchall()
            summary = dict(db.execute("SELECT COUNT(*) total, COALESCE(SUM(occurrence_count),0) occurrences, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open, SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved FROM client_errors").fetchone())
        return {"items": [self._serialize(row) for row in rows], "total": total, "limit": limit, "offset": offset, "summary": summary}

    @staticmethod
    def _serialize(row):
        item = dict(row)
        item["column"] = item.pop("column_no")
        item.update({"appId": item.pop("app_id"), "playId": item.pop("play_id"), "actorRole": item.pop("actor_role"), "clientId": item.pop("client_id"), "userAgent": item.pop("user_agent"), "appVersion": item.pop("app_version"), "serviceWorkerVersion": item.pop("service_worker_version"), "firstSeen": item.pop("first_seen"), "lastSeen": item.pop("last_seen"), "occurrenceCount": item.pop("occurrence_count")})
        item["details"] = json.loads(item.pop("details_json"))
        return item

    def set_status(self, error_id, status):
        if status not in ("open", "resolved"):
            return False
        with self._connect() as db:
            return db.execute("UPDATE client_errors SET status=? WHERE id=?", (status, error_id)).rowcount == 1

    def delete(self, error_id):
        with self._connect() as db:
            return db.execute("DELETE FROM client_errors WHERE id=?", (error_id,)).rowcount == 1

    def clear_resolved(self):
        with self._connect() as db:
            return db.execute("DELETE FROM client_errors WHERE status='resolved'").rowcount
