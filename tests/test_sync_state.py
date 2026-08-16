import unittest
import uuid

from app import (
    app,
    config,
    director_manager,
    sanitize_cursor_payload,
    socketio,
)


class CursorPayloadTests(unittest.TestCase):
    def test_accepts_v2_and_legacy_payloads(self):
        canonical = sanitize_cursor_payload(
            {
                "protocolVersion": 2,
                "playId": "play-a",
                "scriptRevision": "script-v1-1234",
                "cueId": "cue-s-1234-0",
                "ordinal": 7,
                "sequence": 10,
                "index": 9,
            },
            "play-a",
        )
        self.assertEqual(canonical["cueId"], "cue-s-1234-0")
        self.assertEqual(canonical["ordinal"], 7)
        self.assertEqual(canonical["index"], 9)

        self.assertEqual(
            sanitize_cursor_payload({"index": 4}, "play-a"),
            {"playId": "play-a", "index": 4},
        )

    def test_rejects_invalid_or_cross_play_payloads(self):
        self.assertIsNone(sanitize_cursor_payload(None, "play-a"))
        self.assertIsNone(sanitize_cursor_payload({"index": -1}, "play-a"))
        self.assertIsNone(
            sanitize_cursor_payload(
                {"playId": "play-b", "cueId": "cue-s-1234-0"}, "play-a"
            )
        )


class CursorSocketTests(unittest.TestCase):
    def setUp(self):
        self.play_id = f"test-{uuid.uuid4().hex}"
        self.password = config.DIRECTOR_PASSWORD
        config.DIRECTOR_PASSWORD = "test-password"
        self.clients = []

    def tearDown(self):
        for client in self.clients:
            if client.is_connected():
                client.disconnect()
        director_manager.clear_cursor(self.play_id)
        config.DIRECTOR_PASSWORD = self.password

    def client(self):
        client = socketio.test_client(app)
        self.clients.append(client)
        return client

    @staticmethod
    def events(client, name):
        return [event for event in client.get_received() if event["name"] == name]

    def join(self, client):
        client.emit("join_play", {"playId": self.play_id})
        client.get_received()

    def make_director(self, client):
        self.join(client)
        client.emit(
            "set_director", {"name": "Test", "password": "test-password"}
        )
        client.get_received()

    def test_join_receives_cursor_snapshot_and_explicit_clear_removes_it(self):
        director = self.client()
        observer = self.client()
        self.make_director(director)
        self.join(observer)

        cursor = {
            "protocolVersion": 2,
            "playId": self.play_id,
            "scriptRevision": "script-v1-abc",
            "cueId": "cue-s-abc-0",
            "ordinal": 3,
            "sequence": 100,
            "index": 4,
        }
        director.emit("set_marker", cursor)
        updates = self.events(observer, "marker_update")
        self.assertEqual(len(updates), 1)
        authoritative = updates[0]["args"][0]
        self.assertEqual(authoritative["cueId"], cursor["cueId"])
        self.assertEqual(authoritative["index"], cursor["index"])
        self.assertNotEqual(authoritative["sequence"], cursor["sequence"])

        sender_updates = self.events(director, "marker_update")
        self.assertEqual(sender_updates[0]["args"][0], authoritative)

        late_display = self.client()
        late_display.emit("join_play", {"playId": self.play_id})
        snapshots = self.events(late_display, "marker_update")
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(snapshots[0]["args"][0], authoritative)

        director.emit("clear_marker")
        self.assertEqual(len(self.events(observer, "marker_clear")), 1)

        after_clear = self.client()
        after_clear.emit("join_play", {"playId": self.play_id})
        after_clear_events = after_clear.get_received()
        self.assertEqual(
            [event for event in after_clear_events if event["name"] == "marker_update"],
            [],
        )
        clear_snapshots = [
            event for event in after_clear_events if event["name"] == "marker_clear"
        ]
        self.assertEqual(len(clear_snapshots), 1)
        self.assertGreater(
            clear_snapshots[0]["args"][0]["sequence"],
            authoritative["sequence"],
        )

    def test_rejoin_receives_clear_that_happened_while_display_was_offline(self):
        director = self.client()
        self.make_director(director)
        director.emit("set_marker", {"index": 6})
        marker = self.events(director, "marker_update")[0]["args"][0]

        offline_display = self.client()
        offline_display.emit("join_play", {"playId": self.play_id})
        offline_events = offline_display.get_received()
        marker_snapshots = [
            event for event in offline_events if event["name"] == "marker_update"
        ]
        self.assertEqual(marker_snapshots[0]["args"][0], marker)
        offline_display.disconnect()

        director.emit("clear_marker")
        clear_event = self.events(director, "marker_clear")[0]["args"][0]

        rejoined_display = self.client()
        rejoined_display.emit("join_play", {"playId": self.play_id})
        rejoined_events = rejoined_display.get_received()
        self.assertEqual(
            [event for event in rejoined_events if event["name"] == "marker_update"],
            [],
        )
        self.assertEqual(
            [event for event in rejoined_events if event["name"] == "marker_clear"][0]["args"][0],
            clear_event,
        )

    def test_server_replaces_client_sequence_and_orders_every_update(self):
        director = self.client()
        observer = self.client()
        self.make_director(director)
        self.join(observer)

        director.emit("set_marker", {"index": 8, "sequence": 20})
        first = self.events(observer, "marker_update")[0]["args"][0]

        director.emit("set_marker", {"index": 2, "sequence": 19})
        second = self.events(observer, "marker_update")[0]["args"][0]
        self.assertGreater(second["sequence"], first["sequence"])
        self.assertNotIn(second["sequence"], (19, 20))
        self.assertEqual(director_manager.get_cursor(self.play_id)["index"], 2)

    def test_director_disconnect_retains_cursor_for_late_displays(self):
        director = self.client()
        self.make_director(director)
        director.emit("set_marker", {"index": 6})
        authoritative = self.events(director, "marker_update")[0]["args"][0]

        director.disconnect()

        late_display = self.client()
        late_display.emit("join_play", {"playId": self.play_id})
        snapshot = self.events(late_display, "marker_update")[0]["args"][0]
        self.assertEqual(snapshot, authoritative)


if __name__ == "__main__":
    unittest.main()
