"""
Flask application with Socket.IO for theater script coordination.
Refactored for better organization and error handling.
"""

import os
import subprocess
import threading
import time
import datetime
import json
import re
import logging
import hmac
from collections import defaultdict, deque

import requests
from typing import Optional, Dict, Any
from flask import Flask, request, send_from_directory, render_template, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from dotenv import load_dotenv
from client_error_store import ClientErrorStore

# Load environment variables
load_dotenv()


class Config:
    """Application configuration."""

    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        print("WARNING: SECRET_KEY not set, using insecure default!")
        SECRET_KEY = "your-secret-key-here"

    PORT = int(os.getenv("PORT", 5000))

    DIRECTOR_PASSWORD = os.getenv("DIRECTOR_PASSWORD")
    if not DIRECTOR_PASSWORD:
        print("WARNING: DIRECTOR_PASSWORD not set, using insecure default!")
        DIRECTOR_PASSWORD = "your-password-here"

    ENABLE_GIT_PULL = os.getenv("ENABLE_DAILY_GIT_PULL", "1") in {"1", "true", "True"}
    GIT_PULL_HOUR = int(os.getenv("GIT_PULL_DAILY_HOUR", "3"))
    GIT_PULL_MINUTE = int(os.getenv("GIT_PULL_DAILY_MINUTE", "0"))
    DEBUG = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true"}


class DirectorManager:
    """Manages director state for multiple plays."""

    def __init__(self):
        self.current_director: Dict[str, Optional[str]] = {}
        self.current_director_sid: Dict[str, Optional[str]] = {}
        self.sid_to_play: Dict[str, str] = {}
        self.current_cursor: Dict[str, Dict[str, Any]] = {}
        self.cursor_sequence: Dict[str, int] = {}
        self._lock = threading.RLock()

    def get_director(self, play_id: str) -> Optional[str]:
        """Get current director name for a play."""
        return self.current_director.get(play_id)

    def get_director_sid(self, play_id: str) -> Optional[str]:
        """Get current director SID for a play."""
        return self.current_director_sid.get(play_id)

    def set_director(self, play_id: str, name: str, sid: str) -> Optional[str]:
        """Set director for a play. Returns previous director name."""
        previous = self.current_director.get(play_id)
        self.current_director[play_id] = name
        self.current_director_sid[play_id] = sid
        return previous

    def unset_director(self, play_id: str) -> Optional[str]:
        """Unset director for a play. Returns previous director name."""
        previous = self.current_director.get(play_id)
        self.current_director[play_id] = None
        self.current_director_sid[play_id] = None
        return previous

    def is_director(self, play_id: str, sid: str) -> bool:
        """Check if SID is the director for a play."""
        return self.current_director_sid.get(play_id) == sid

    def set_play_for_sid(self, sid: str, play_id: str):
        """Associate a SID with a play."""
        self.sid_to_play[sid] = play_id

    def get_play_for_sid(self, sid: str) -> str:
        """Get play ID for a SID."""
        return self.sid_to_play.get(sid, "default")

    def remove_sid(self, sid: str):
        """Remove SID tracking."""
        self.sid_to_play.pop(sid, None)

    def get_cursor(self, play_id: str) -> Optional[Dict[str, Any]]:
        """Return a copy of the latest canonical or legacy cursor for a play."""
        with self._lock:
            cursor = self.current_cursor.get(play_id)
            return dict(cursor) if cursor else None

    def get_cursor_event(
        self, play_id: str
    ) -> Optional[tuple[str, Dict[str, Any]]]:
        """Return the latest ordered marker or explicit-clear snapshot."""
        with self._lock:
            cursor = self.current_cursor.get(play_id)
            if cursor:
                return "marker_update", dict(cursor)

            sequence = self.cursor_sequence.get(play_id)
            if sequence is not None:
                return "marker_clear", {
                    "playId": play_id,
                    "sequence": sequence,
                }
            return None

    def _next_cursor_sequence(self, play_id: str) -> int:
        """Issue a server-authoritative, monotonically increasing sequence."""
        previous = self.cursor_sequence.get(play_id, 0)
        timestamp = time.time_ns() // 1_000
        sequence = max(previous + 1, timestamp)
        self.cursor_sequence[play_id] = sequence
        return sequence

    def set_cursor(
        self, play_id: str, cursor: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Store and return a cursor with a server-issued sequence."""
        with self._lock:
            stored_cursor = dict(cursor)
            stored_cursor["sequence"] = self._next_cursor_sequence(play_id)
            self.current_cursor[play_id] = stored_cursor
            return dict(stored_cursor)

    def clear_cursor(self, play_id: str) -> Dict[str, Any]:
        """Explicitly clear a cursor and return an ordered clear event."""
        with self._lock:
            self.current_cursor.pop(play_id, None)
            return {
                "playId": play_id,
                "sequence": self._next_cursor_sequence(play_id),
            }


class GitPullScheduler:
    """Manages daily git pull operations."""

    def __init__(self, config: Config):
        self.config = config
        self.running = False

    def _run_git_pull_once(self) -> None:
        """Execute a single git pull operation."""
        if not self.config.ENABLE_GIT_PULL:
            return

        repo_root = os.path.dirname(os.path.abspath(__file__))
        try:
            result = subprocess.run(
                ["git", "pull", "--no-edit"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            stdout = (result.stdout or "").strip()
            stderr = (result.stderr or "").strip()
            status = f"(code={result.returncode})"

            if stdout:
                print(f"[git-pull] stdout {status}:\n{stdout}")
            if stderr:
                print(f"[git-pull] stderr {status}:\n{stderr}")
            if not stdout and not stderr:
                print(f"[git-pull] completed {status} with no output")

        except FileNotFoundError:
            print("[git-pull] 'git' executable not found")
        except subprocess.TimeoutExpired:
            print("[git-pull] operation timed out")
        except Exception as exc:
            print(f"[git-pull] error: {exc}")

    def _seconds_until_next_run(self) -> float:
        """Calculate seconds until next scheduled run."""
        now = datetime.datetime.now()
        next_run = now.replace(
            hour=self.config.GIT_PULL_HOUR,
            minute=self.config.GIT_PULL_MINUTE,
            second=0,
            microsecond=0,
        )
        if next_run <= now:
            next_run += datetime.timedelta(days=1)
        return (next_run - now).total_seconds()

    def _scheduler_loop(self) -> None:
        """Main scheduler loop."""
        while self.running:
            sleep_seconds = self._seconds_until_next_run()
            print(
                f"[git-pull] next run in ~{int(sleep_seconds)}s at "
                f"{self.config.GIT_PULL_HOUR:02d}:{self.config.GIT_PULL_MINUTE:02d}"
            )
            time.sleep(max(1, sleep_seconds))
            self._run_git_pull_once()
            time.sleep(24 * 60 * 60)  # Wait 24 hours before next run

    def start(self) -> None:
        """Start the scheduler in a background thread."""
        if not self.config.ENABLE_GIT_PULL:
            print("[git-pull] disabled via ENABLE_DAILY_GIT_PULL")
            return

        self.running = True
        thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        thread.start()
        print("[git-pull] scheduler started")

    def stop(self) -> None:
        """Stop the scheduler."""
        self.running = False


# Initialize Flask app
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = Config.SECRET_KEY

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    async_mode="threading",
)

# Initialize managers
config = Config()
director_manager = DirectorManager()
git_scheduler = GitPullScheduler(config)

# Small per-process limiter avoids adding infrastructure. Each accepted report
# is emitted as one structured JSON record to the normal container logs.
CLIENT_ERROR_MAX_BODY = 16 * 1024
CLIENT_ERROR_RATE_LIMIT = 20
CLIENT_ERROR_RATE_WINDOW = 60
_client_error_requests = defaultdict(deque)
_client_error_lock = threading.Lock()
client_error_logger = logging.getLogger("client_errors")
client_error_store = ClientErrorStore()


def _admin_authorized() -> bool:
    supplied = request.headers.get("X-Director-Password", "")
    return bool(supplied) and hmac.compare_digest(supplied.encode(), config.DIRECTOR_PASSWORD.encode())


def _require_admin():
    if not _admin_authorized():
        return jsonify({"error": "unauthorized"}), 401
    return None


def _require_safe_mutation():
    unauthorized = _require_admin()
    if unauthorized:
        return unauthorized
    if not request.is_json or request.headers.get("X-Requested-With") != "ErrorDashboard":
        return jsonify({"error": "JSON and X-Requested-With required"}), 415
    origin = request.headers.get("Origin")
    if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
        return jsonify({"error": "cross-origin request rejected"}), 403
    return None


def _client_ip() -> str:
    """Trust forwarding headers only from explicitly configured proxies."""
    remote = request.remote_addr or "unknown"
    trusted = {"127.0.0.1", "::1"}
    trusted.update(filter(None, os.getenv("TRUSTED_PROXY_IPS", "").split(",")))
    if remote in trusted:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            candidate = forwarded.split(",", 1)[0].strip()
            if re.fullmatch(r"[0-9a-fA-F:.]{2,45}", candidate):
                return candidate
    return remote


def _safe_text(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    value = re.sub(r"(https?://[^\s?#]+)[?#][^\s)\]]*", r"\1", value)
    value = re.sub(r"(?i)(password|passwd|token|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+", r"\1=[REDACTED]", value)
    return value[:limit]


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    with _client_error_lock:
        entries = _client_error_requests[ip]
        while entries and entries[0] <= now - CLIENT_ERROR_RATE_WINDOW:
            entries.popleft()
        if len(entries) >= CLIENT_ERROR_RATE_LIMIT:
            return True
        entries.append(now)
    return False


MAX_SAFE_JS_INTEGER = 9_007_199_254_740_991


def _nonnegative_safe_int(value: Any) -> Optional[int]:
    """Return a JSON/JavaScript-safe non-negative integer or None."""
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value < 0 or value > MAX_SAFE_JS_INTEGER:
        return None
    return value


def _bounded_string(value: Any, max_length: int) -> Optional[str]:
    """Return a trimmed, bounded string or None."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > max_length:
        return None
    return value


def sanitize_cursor_payload(
    data: Any, play_id: str
) -> Optional[Dict[str, Any]]:
    """Validate and normalize canonical v2 and legacy marker payloads."""
    if not isinstance(data, dict):
        return None

    supplied_play_id = data.get("playId")
    if supplied_play_id is not None and supplied_play_id != play_id:
        return None

    cue_id = _bounded_string(data.get("cueId"), 256)
    ordinal = _nonnegative_safe_int(data.get("ordinal"))
    legacy_index = _nonnegative_safe_int(data.get("index"))
    if cue_id is None and ordinal is None and legacy_index is None:
        return None

    cursor: Dict[str, Any] = {"playId": play_id}
    protocol_version = _nonnegative_safe_int(data.get("protocolVersion"))
    script_revision = _bounded_string(data.get("scriptRevision"), 256)
    sequence = _nonnegative_safe_int(data.get("sequence"))

    if protocol_version is not None:
        cursor["protocolVersion"] = protocol_version
    if script_revision is not None:
        cursor["scriptRevision"] = script_revision
    if cue_id is not None:
        cursor["cueId"] = cue_id
    if ordinal is not None:
        cursor["ordinal"] = ordinal
    if sequence is not None:
        cursor["sequence"] = sequence
    if legacy_index is not None:
        cursor["index"] = legacy_index

    return cursor


# Flask routes
@app.route("/")
def index():
    """Serve index page."""
    return render_template("index.html")


@app.route("/<path:path>.html")
def serve_html(path):
    """Serve HTML templates."""
    return render_template(f"{path}.html")


@app.route("/sw.js")
def serve_sw():
    """Serve service worker from root for scope."""
    response = send_from_directory(".", "sw.js")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/manifest.json")
def serve_manifest():
    """Serve manifest from root."""
    return send_from_directory(".", "manifest.json")


@app.route("/favicon.ico")
def favicon():
    """Serve favicon from root assets."""
    return send_from_directory("static/assets", "logo.png")


@app.route("/plays.json")
def serve_plays_json_compat():
    """Compatibility route for root plays.json."""
    return send_from_directory("static/data", "plays.json")


@app.route("/api/plays")
def api_plays():
    """API endpoint to get list of plays."""
    try:
        with open("static/data/plays.json", "r", encoding="utf-8") as f:
            plays_data = json.load(f)
        plays_list = [
            {"id": play_id, "name": play_info.get("name", play_id)}
            for play_id, play_info in plays_data.items()
        ]
        return jsonify(plays_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/client-errors")
def api_client_errors():
    """Validate and log a privacy-conscious browser error report."""
    if request.content_length is not None and request.content_length > CLIENT_ERROR_MAX_BODY:
        return jsonify({"error": "payload too large"}), 413
    if not request.is_json:
        return jsonify({"error": "application/json required"}), 415
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object required"}), 400
    ip = _client_ip()
    if _rate_limited(ip):
        return jsonify({"error": "rate limit exceeded"}), 429

    error_type = _safe_text(data.get("type"), 64)
    message = _safe_text(data.get("message"), 1000)
    client_id = _safe_text(data.get("clientId"), 64)
    if not error_type or not message or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", client_id):
        return jsonify({"error": "type, message and valid clientId are required"}), 400

    pathname = _safe_text(data.get("pathname"), 256).split("?", 1)[0].split("#", 1)[0]
    if not pathname.startswith("/"):
        pathname = "/"
    record = {
        "event": "client_error",
        "serverTimestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "ip": ip,
        "userAgent": _safe_text(request.user_agent.string, 512),
        "pathname": pathname,
        "appId": _safe_text(data.get("appId"), 64),
        "playId": _safe_text(data.get("playId"), 64),
        "actorRole": _safe_text(data.get("actorRole"), 128),
        "clientId": client_id,
        "type": error_type,
        "message": message,
        "stack": _safe_text(data.get("stack"), 6000),
        "source": _safe_text(data.get("source"), 512).split("?", 1)[0].split("#", 1)[0],
        "line": data.get("line") if isinstance(data.get("line"), int) else None,
        "column": data.get("column") if isinstance(data.get("column"), int) else None,
        "appVersion": _safe_text(data.get("appVersion"), 64),
        "serviceWorkerVersion": _safe_text(data.get("serviceWorkerVersion"), 64),
    }
    client_error_store.add(record)
    client_error_logger.warning(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
    return "", 204


@app.get("/api/admin/client-errors")
def admin_client_errors():
    unauthorized = _require_admin()
    if unauthorized:
        return unauthorized
    status = request.args.get("status", "all")
    if status not in ("all", "open", "resolved"):
        return jsonify({"error": "invalid status"}), 400
    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 100))
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        return jsonify({"error": "invalid pagination"}), 400
    search = request.args.get("search", "")[:200]
    response = jsonify(client_error_store.list(status, search, limit, offset))
    response.headers["Cache-Control"] = "no-store"
    return response


@app.patch("/api/admin/client-errors/<int:error_id>")
def admin_update_client_error(error_id):
    rejected = _require_safe_mutation()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}
    if not client_error_store.set_status(error_id, data.get("status")):
        return jsonify({"error": "not found or invalid status"}), 404
    return jsonify({"ok": True})


@app.delete("/api/admin/client-errors/<int:error_id>")
def admin_delete_client_error(error_id):
    rejected = _require_safe_mutation()
    if rejected:
        return rejected
    if not client_error_store.delete(error_id):
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})


@app.delete("/api/admin/client-errors")
def admin_clear_client_errors():
    rejected = _require_safe_mutation()
    if rejected:
        return rejected
    return jsonify({"ok": True, "deleted": client_error_store.clear_resolved()})


def _load_plays_data():
    with open("static/data/plays.json", "r", encoding="utf-8") as f:
        return json.load(f)


def _sheet_url_for_play(play_id: str) -> Optional[str]:
    plays_data = _load_plays_data()
    play = plays_data.get(play_id) or plays_data.get("default")
    if not play:
        return None
    return play.get("sheet")


def _csv_export_url(sheet_url: str) -> str:
    match = re.search(r"/spreadsheets/d/([^/]+)", sheet_url or "")
    if not match:
        return sheet_url
    if "/export" in sheet_url and "format=csv" in sheet_url:
        return sheet_url
    gid_match = re.search(r"[?#&]gid=([^&#]+)", sheet_url)
    gid = gid_match.group(1) if gid_match else "0"
    return f"https://docs.google.com/spreadsheets/d/{match.group(1)}/export?format=csv&gid={gid}"


@app.route("/api/script/<play_id>")
def api_script(play_id):
    """API endpoint to get script data for a play."""
    import csv
    from io import StringIO

    try:
        sheet_url = _sheet_url_for_play(play_id)
        if not sheet_url:
            return jsonify({"error": "No sheet URL configured"}), 400

        # Fetch CSV from Google Sheets
        response = requests.get(_csv_export_url(sheet_url), timeout=30)
        response.raise_for_status()

        # Parse CSV
        csv_content = response.text
        reader = csv.DictReader(StringIO(csv_content))
        data = list(reader)

        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch script: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/static/<path:path>")
def serve_static(path):
    """Serve static files."""
    return send_from_directory("static", path)


# Socket.IO handlers
@socketio.on("connect")
def handle_connect():
    """Handle client connection."""
    print(f"Client connected: {request.sid}")


@socketio.on("join_play")
def handle_join_play(data: Dict[str, Any]):
    """Handle client joining a play room."""
    join_data = data if isinstance(data, dict) else {}
    play_id = _bounded_string(join_data.get("playId"), 128) or "default"
    previous = director_manager.get_play_for_sid(request.sid)

    # Leave previous room if different
    if previous and previous != play_id:
        try:
            leave_room(previous)
        except Exception as e:
            print(f"Error leaving room {previous}: {e}")

    director_manager.set_play_for_sid(request.sid, play_id)
    join_room(play_id)

    # Send current director info
    emit(
        "set_director",
        {
            "success": True,
            "director": director_manager.get_director(play_id) or "Niemand",
            "isDirector": director_manager.is_director(play_id, request.sid),
        },
        to=request.sid,
    )

    # A joining or reconnecting display must immediately recover the current
    # playback position instead of waiting for the Director's next click.
    cursor_event = director_manager.get_cursor_event(play_id)
    if cursor_event:
        event_name, payload = cursor_event
        emit(event_name, payload, to=request.sid)


@socketio.on("set_director")
def handle_set_director(data: Dict[str, Any]):
    """Handle director set request."""
    play_id = director_manager.get_play_for_sid(request.sid)
    name = data.get("name")
    password = data.get("password")

    # Validate input
    if not name or not password:
        emit(
            "set_director",
            {"success": False, "message": "Name und Passwort erforderlich"},
        )
        return

    # Validate password
    if password != config.DIRECTOR_PASSWORD:
        emit("set_director", {"success": False, "message": "Falsches Passwort"})
        return

    # Set new director
    previous_director = director_manager.get_director(play_id)
    previous_director_sid = director_manager.get_director_sid(play_id)
    director_manager.set_director(play_id, name, request.sid)

    # Notify about takeover if there was a previous director
    if previous_director:
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": name,
                "isDirector": False,
            },
            to=previous_director_sid,
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": name,
                "isDirector": True,
            },
            to=request.sid,
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": name,
                "isDirector": False,
            },
            room=play_id,
            skip_sid=[previous_director_sid, request.sid],
        )
    else:
        # No previous director, just notify all
        emit(
            "set_director",
            {"success": True, "director": name, "isDirector": True},
            to=request.sid,
        )
        emit(
            "set_director",
            {"success": True, "director": name, "isDirector": False},
            room=play_id,
            skip_sid=request.sid,
        )


@socketio.on("unset_director")
def handle_unset_director(data: Dict[str, Any]):
    """Handle director unset request."""
    play_id = director_manager.get_play_for_sid(request.sid)

    # Only current director can unset themselves
    if not director_manager.is_director(play_id, request.sid):
        return

    previous_director = director_manager.unset_director(play_id)

    emit(
        "unset_director",
        {
            "director": "Niemand",
            "previousDirector": previous_director,
            "isDirector": False,
        },
        room=play_id,
    )


@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection."""
    print(f"Client disconnected: {request.sid}")
    play_id = director_manager.get_play_for_sid(request.sid)

    # If disconnecting client was director, clear director state
    if director_manager.is_director(play_id, request.sid):
        previous_director = director_manager.unset_director(play_id)
        emit(
            "unset_director",
            {
                "director": "Niemand",
                "previousDirector": previous_director,
                "isDirector": False,
            },
            room=play_id,
        )

    director_manager.remove_sid(request.sid)


@socketio.on("set_marker")
def handle_set_marker(data: Dict[str, Any]):
    """Handle marker set request (director only)."""
    play_id = director_manager.get_play_for_sid(request.sid)

    # Only director can set markers
    if not director_manager.is_director(play_id, request.sid):
        return

    cursor = sanitize_cursor_payload(data, play_id)
    if cursor is None:
        return

    cursor = director_manager.set_cursor(play_id, cursor)

    # Broadcast the authoritative server sequence to every client, including
    # the sender, so all displays share the same ordering state.
    emit("marker_update", cursor, room=play_id)


@socketio.on("clear_marker")
def handle_clear_marker():
    """Handle marker clear request (director only)."""
    play_id = director_manager.get_play_for_sid(request.sid)

    if not director_manager.is_director(play_id, request.sid):
        return

    clear_event = director_manager.clear_cursor(play_id)
    emit("marker_clear", clear_event, room=play_id)


if __name__ == "__main__":
    # Start git pull scheduler (only in production or main process)
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not config.DEBUG:
        git_scheduler.start()

    # Run the app
    socketio.run(
        app,
        host="0.0.0.0",
        port=config.PORT,
        debug=config.DEBUG,
        use_reloader=config.DEBUG,
        allow_unsafe_werkzeug=True,
    )
