from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO, emit
import os
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

# Global state for director
current_director = None
current_director_sid = None
DIRECTOR_PASSWORD = os.getenv("DIRECTOR_PASSWORD", "your-password-here")


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def serve_file(path):
    return send_from_directory(".", path)


@socketio.on("connect")
def handle_connect():
    # Send current director state to new clients
    emit(
        "set_director",
        {
            "success": True,
            "director": current_director or "Niemand",
            "isDirector": current_director_sid == request.sid,
        },
    )


@socketio.on("set_director")
def handle_set_director(data):
    global current_director, current_director_sid

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

    # Store the previous director
    previous_director = current_director
    previous_director_sid = current_director_sid

    # Set new director immediately
    current_director = name
    current_director_sid = request.sid

    # If there was a previous director, notify about the takeover
    if previous_director:
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director,
                "isDirector": False,
            },
            to=previous_director_sid,
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director,
                "isDirector": True,
            },
            to=current_director_sid,
        )
        emit(
            "director_takeover",
            {
                "previousDirector": previous_director,
                "newDirector": current_director,
                "isDirector": False,
            },
            broadcast=True,
            include_self=False,
            skip_sid=[previous_director_sid, current_director_sid],
        )
    else:
        # If there was no previous director, just notify about the new director
        emit(
            "set_director",
            {"success": True, "director": current_director, "isDirector": True},
            to=current_director_sid,
        )
        emit(
            "set_director",
            {"success": True, "director": current_director, "isDirector": False},
            broadcast=True,
            include_self=False,
        )


@socketio.on("unset_director")
def handle_unset_director(data):
    global current_director, current_director_sid

    # Only the current director can unset themselves
    if request.sid == current_director_sid:
        previous_director = current_director
        current_director = None
        current_director_sid = None
        emit(
            "unset_director",
            {
                "director": "Niemand",
                "previousDirector": previous_director,
                "isDirector": False,
            },
            broadcast=True,
        )


@socketio.on("disconnect")
def handle_disconnect():
    global current_director, current_director_sid

    # If a client disconnects and they were the director, clear the director state
    if request.sid == current_director_sid:
        previous_director = current_director
        current_director = None
        current_director_sid = None
        emit(
            "unset_director",
            {
                "director": "Niemand",
                "previousDirector": previous_director,
                "isDirector": False,
            },
            broadcast=True,
        )


@socketio.on("set_marker")
def handle_set_marker(data):
    global current_director_sid
    # Only allow the director to set markers
    if request.sid == current_director_sid:
        # Broadcast the marker to all clients except the sender
        emit("marker_update", data, broadcast=True, include_self=False)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True, use_reloader=True)
