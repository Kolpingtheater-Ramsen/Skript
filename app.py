"""
Flask application with Socket.IO for theater script coordination.
Refactored for better organization and error handling.
"""

import os
import subprocess
import threading
import time
import datetime
from typing import Optional, Dict, Any
from flask import Flask, request, send_from_directory, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration."""

    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
    PORT = int(os.getenv("PORT", 5000))
    DIRECTOR_PASSWORD = os.getenv("DIRECTOR_PASSWORD", "your-password-here")
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
    async_mode='threading'
)

# Initialize managers
config = Config()
director_manager = DirectorManager()
git_scheduler = GitPullScheduler(config)


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
    return send_from_directory(".", "sw.js")


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
    play_id = data.get("playId", "default")
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

    # Broadcast marker to all clients in play except sender
    emit("marker_update", data, room=play_id, skip_sid=request.sid)


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
