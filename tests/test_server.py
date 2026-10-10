import json
from datetime import date, timedelta
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import os
from threading import Thread
import unittest
from unittest.mock import patch

from backend.server import AuraHandler
from backend.planner import InvalidPlannerOutput, PlannerNotConfigured, PlannerTimeout, PlannerUnavailable


MODEL_PLAN = {
    "summary": "A practical plan.",
    "steps": [{
        "title": "Start",
        "description": "Take the first action.",
        "priority": "high",
        "day_offset": 0,
        "duration_days": 1,
        "estimated_cost": 25,
    }],
    "tips": ["Review progress weekly."],
}


class PlanApiTests(unittest.TestCase):
    def setUp(self):
        self.generate_patch = patch("backend.server.generate_plan", return_value=MODEL_PLAN)
        self.mock_generate = self.generate_patch.start()
        self.addCleanup(self.generate_patch.stop)

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), AuraHandler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post_raw(self, body, extra_headers=None):
        connection = HTTPConnection("127.0.0.1", self.port)
        headers = {"Content-Type": "application/json", **(extra_headers or {})}
        connection.request("POST", "/api/plan", body=body, headers=headers)
        response = connection.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        return result

    def post_json(self, payload):
        return self.post_raw(json.dumps(payload))

    def assert_error(self, response, status, code):
        self.assertEqual(response[0], status)
        self.assertTrue(response[1].startswith("application/json"))
        body = json.loads(response[2])
        self.assertEqual(body["error"]["code"], code)
        self.assertIsInstance(body["error"]["message"], str)
        return body["error"]

    def test_valid_input_is_accepted(self):
        status, content_type, raw = self.post_json({
            "goal": "Plan a study schedule", "budget": 250,
            "target_date": (date.today() + timedelta(days=52)).isoformat(),
            "commitments": ["Work weekdays"],
        })
        self.assertEqual(status, 202)
        self.assertTrue(content_type.startswith("application/json"))
        body = json.loads(raw)
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["plan"]["goal"], "Plan a study schedule")
        self.assertEqual(body["plan"]["budget"], 250)
        self.assertEqual(body["plan"]["target_date"], (date.today() + timedelta(days=52)).isoformat())
        self.assertEqual(body["plan"]["commitments"], ["Work weekdays"])
        self.assertEqual(body["plan"]["summary"], MODEL_PLAN["summary"])
        self.mock_generate.assert_called_once()

    def test_zero_budget_is_valid(self):
        zero_cost_plan = {
            **MODEL_PLAN,
            "steps": [{**MODEL_PLAN["steps"][0], "estimated_cost": 0}],
            "warnings": ["Suggestions are AI-generated, not confirmed events, bookings, or external facts; verify details before acting."],
        }
        self.mock_generate.return_value = zero_cost_plan
        status, _, raw = self.post_json({"goal": "Plan a free walk", "budget": 0})
        self.assertEqual(status, 202)
        self.assertEqual(json.loads(raw)["plan"]["budget"], 0)

    def test_allowed_browser_origin_receives_cors_header(self):
        origin = "http://localhost:5173"
        with patch.dict(os.environ, {"AURA_CORS_ORIGINS": origin}):
            connection = HTTPConnection("127.0.0.1", self.port)
            connection.request("POST", "/api/plan", body=json.dumps({"goal": "Plan"}), headers={
                "Content-Type": "application/json", "Origin": origin,
            })
            response = connection.getresponse()
            status, cors_origin = response.status, response.getheader("Access-Control-Allow-Origin")
            response.read()
            connection.close()
        self.assertEqual(status, 202)
        self.assertEqual(cors_origin, origin)

    def test_allowed_browser_preflight_succeeds(self):
        origin = "http://localhost:5173"
        with patch.dict(os.environ, {"AURA_CORS_ORIGINS": origin}):
            connection = HTTPConnection("127.0.0.1", self.port)
            connection.request("OPTIONS", "/api/plan", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            response = connection.getresponse()
            result = response.status, response.getheader("Access-Control-Allow-Origin"), response.read()
            connection.close()
        self.assertEqual(result, (204, origin, b""))

    def test_unconfigured_browser_origin_is_rejected_on_preflight(self):
        connection = HTTPConnection("127.0.0.1", self.port)
        connection.request("OPTIONS", "/api/plan", headers={
            "Origin": "http://localhost:9999",
            "Access-Control-Request-Method": "POST",
        })
        response = connection.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        self.assert_error(result, 403, "cors_origin_not_allowed")

    def test_model_unavailable_uses_consistent_error(self):
        self.mock_generate.side_effect = PlannerUnavailable()
        self.assert_error(self.post_json({"goal": "Plan"}), 503, "model_unavailable")

    def test_missing_model_configuration_uses_consistent_error(self):
        self.mock_generate.side_effect = PlannerNotConfigured()
        self.assert_error(self.post_json({"goal": "Plan"}), 503, "model_not_configured")

    def test_model_timeout_uses_consistent_error(self):
        self.mock_generate.side_effect = PlannerTimeout()
        self.assert_error(self.post_json({"goal": "Plan"}), 504, "model_timeout")

    def test_invalid_model_output_uses_consistent_error(self):
        self.mock_generate.side_effect = InvalidPlannerOutput()
        self.assert_error(self.post_json({"goal": "Plan"}), 502, "invalid_model_output")

    def test_missing_goal_returns_validation_error(self):
        error = self.assert_error(self.post_json({}), 422, "validation_error")
        self.assertEqual(error["details"][0]["field"], "goal")
        self.mock_generate.assert_not_called()

    def test_invalid_budget_returns_validation_error(self):
        error = self.assert_error(self.post_json({"goal": "Plan", "budget": -1}), 422, "validation_error")
        self.assertIn("budget", [item["field"] for item in error["details"]])

    def test_unrepresentably_large_budget_returns_validation_error(self):
        error = self.assert_error(self.post_json({"goal": "Plan", "budget": 10 ** 1000}), 422, "validation_error")
        self.assertIn("budget", [item["field"] for item in error["details"]])

    def test_invalid_date_returns_validation_error(self):
        error = self.assert_error(self.post_json({"goal": "Plan", "target_date": "2026-02-30"}), 422, "validation_error")
        self.assertIn("target_date", [item["field"] for item in error["details"]])

    def test_past_date_returns_validation_error(self):
        error = self.assert_error(
            self.post_json({"goal": "Plan", "target_date": (date.today() - timedelta(days=1)).isoformat()}),
            422,
            "validation_error",
        )
        self.assertIn("target_date", [item["field"] for item in error["details"]])

    def test_invalid_commitments_returns_validation_error(self):
        error = self.assert_error(self.post_json({"goal": "Plan", "commitments": ["", 3]}), 422, "validation_error")
        self.assertIn("commitments", [item["field"] for item in error["details"]])

    def test_malformed_json_returns_consistent_error(self):
        self.assert_error(self.post_raw(b"{broken"), 400, "malformed_json")

    def test_unknown_route_returns_consistent_error(self):
        connection = HTTPConnection("127.0.0.1", self.port)
        connection.request("POST", "/other", body="{}", headers={"Content-Length": "2"})
        response = connection.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        self.assert_error(result, 404, "not_found")

    def test_wrong_method_returns_consistent_error(self):
        connection = HTTPConnection("127.0.0.1", self.port)
        connection.request("GET", "/api/plan")
        response = connection.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        self.assert_error(result, 405, "method_not_allowed")


if __name__ == "__main__":
    unittest.main()
