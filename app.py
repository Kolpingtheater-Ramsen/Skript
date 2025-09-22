from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import subprocess
import threading
import time
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder=".")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your-secret-key-here")
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    async_mode="threading",
)

# Global state for director, per play (room)
current_director_by_play = {}
current_director_sid_by_play = {}
sid_to_play = {}
DIRECTOR_PASSWORD = os.getenv("DIRECTOR_PASSWORD", "your-password-here")


def _run_git_pull_once() -> None:
    """Run a single `git pull` in the repository root and log output."""
    if os.getenv("ENABLE_DAILY_GIT_PULL", "1") not in {"1", "true", "True"}:
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
            print(f"[daily-git-pull] stdout {status}:\n{stdout}")
        if stderr:
            print(f"[daily-git-pull] stderr {status}:\n{stderr}")
        if not stdout and not stderr:
            print(f"[daily-git-pull] completed {status} with no output")
    except FileNotFoundError:
        # git not installed / not in PATH
        print("[daily-git-pull] 'git' executable not found. Skipping.")
    except Exception as exc:
        print(f"[daily-git-pull] error: {exc}")


def _seconds_until_next_run(target_hour: int, target_minute: int) -> float:
    now = datetime.datetime.now()
    next_run = now.replace(
        hour=target_hour, minute=target_minute, second=0, microsecond=0
    )
    if next_run <= now:
        next_run += datetime.timedelta(days=1)
    return (next_run - now).total_seconds()


def start_daily_git_pull_scheduler() -> None:
    """Start a background thread that performs a `git pull` once per day.

    Time can be configured with env vars `GIT_PULL_DAILY_HOUR` and
    `GIT_PULL_DAILY_MINUTE` (defaults 3:00). Enable/disable via
    `ENABLE_DAILY_GIT_PULL` (default enabled).
    """
    if os.getenv("ENABLE_DAILY_GIT_PULL", "1") not in {"1", "true", "True"}:
        print("[daily-git-pull] disabled via ENABLE_DAILY_GIT_PULL")
        return

    try:
        target_hour = int(os.getenv("GIT_PULL_DAILY_HOUR", "3"))
        target_minute = int(os.getenv("GIT_PULL_DAILY_MINUTE", "0"))
    except ValueError:
        target_hour, target_minute = 3, 0

    def scheduler_loop() -> None:
        while True:
            sleep_seconds = _seconds_until_next_run(target_hour, target_minute)
            print(
                f"[daily-git-pull] next run in ~{int(sleep_seconds)}s at {target_hour:02d}:{target_minute:02d}"
            )
            time.sleep(max(1, sleep_seconds))
            _run_git_pull_once()
            # Subsequent runs every 24h
            time.sleep(24 * 60 * 60)

    threading.Thread(target=scheduler_loop, daemon=True).start()


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def serve_file(path):
    return send_from_directory(".", path)


@socketio.on("connect")
def handle_connect():
    # Client must call join_play with a playId; nothing to emit yet
    pass


@socketio.on("join_play")
def handle_join_play(data):
    play_id = data.get("playId") or "default"
    previous = sid_to_play.get(request.sid)
    if previous and previous != play_id:
        try:
            leave_room(previous)
        except Exception:
            pass
    sid_to_play[request.sid] = play_id
    join_room(play_id)
    emit(
        "set_director",
        {
            "success": True,
            "director": current_director_by_play.get(play_id) or "Niemand",
            "isDirector": current_director_sid_by_play.get(play_id) == request.sid,
        },
        to=request.sid,
    )


@socketio.on("set_director")
def handle_set_director(data):
    # Determine play (room) for this SID
    play_id = sid_to_play.get(request.sid) or "default"

    # Extract data
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
    if password != DIRECTOR_PASSWORD:
        emit("set_director", {"success": False, "message": "Falsches Passwort"})
        return

    # Store the previous director for this play
    previous_director = current_director_by_play.get(play_id)
    previous_director_sid = current_director_sid_by_play.get(play_id)

    # Set new director immediately for this play
    current_director_by_play[play_id] = name
    current_director_sid_by_play[play_id] = request.sid

    # If there was a previous director, notify about the takeover
    if previous_director:
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director_by_play.get(play_id),
                "isDirector": False,
            },
            to=previous_director_sid,
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director_by_play.get(play_id),
                "isDirector": True,
            },
            to=current_director_sid_by_play.get(play_id),
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director_by_play.get(play_id),
                "isDirector": False,
            },
            room=play_id,
            skip_sid=[previous_director_sid, current_director_sid_by_play.get(play_id)],
        )
    else:
        # If there was no previous director, just notify about the new director
        emit(
            "set_director",
            {
                "success": True,
                "director": current_director_by_play.get(play_id),
                "isDirector": True,
            },
            to=current_director_sid_by_play.get(play_id),
        )
        emit(
            "set_director",
            {
                "success": True,
                "director": current_director_by_play.get(play_id),
                "isDirector": False,
            },
            room=play_id,
            skip_sid=current_director_sid_by_play.get(play_id),
        )


@socketio.on("unset_director")
def handle_unset_director(data):
    play_id = sid_to_play.get(request.sid) or "default"

    # Only the current director can unset themselves for this play
    if request.sid == current_director_sid_by_play.get(play_id):
        previous_director = current_director_by_play.get(play_id)
        current_director_by_play[play_id] = None
        current_director_sid_by_play[play_id] = None
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
    play_id = sid_to_play.pop(request.sid, None)
    if play_id is None:
        return

    # If a client disconnects and they were the director for this play, clear the director state
    if request.sid == current_director_sid_by_play.get(play_id):
        previous_director = current_director_by_play.get(play_id)
        current_director_by_play[play_id] = None
        current_director_sid_by_play[play_id] = None
        emit(
            "unset_director",
            {
                "director": "Niemand",
                "previousDirector": previous_director,
                "isDirector": False,
            },
            room=play_id,
        )


@socketio.on("set_marker")
def handle_set_marker(data):
    play_id = sid_to_play.get(request.sid) or "default"
    # Only allow the director to set markers for this play
    if request.sid == current_director_sid_by_play.get(play_id):
        # Broadcast the marker to all clients in the same play except the sender
        emit("marker_update", data, room=play_id, skip_sid=request.sid)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    # Avoid double-scheduling under the development reloader
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not os.getenv("FLASK_DEBUG"):
        start_daily_git_pull_scheduler()
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=True,
        use_reloader=True,
        allow_unsafe_werkzeug=True,
    )
