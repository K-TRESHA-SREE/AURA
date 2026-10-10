from datetime import date, timedelta
from io import BytesIO
import json
import os
import socket
import unittest
from unittest.mock import patch
from urllib.error import URLError

from backend.planner import (
    InvalidPlannerOutput,
    PlannerNotConfigured,
    PlannerTimeout,
    PlannerUnavailable,
    generate_plan,
)


def constraints(**overrides):
    value = {
        "goal": "Prepare for a certification exam",
        "budget": 100,
        "target_date": (date.today() + timedelta(days=30)).isoformat(),
        "commitments": ["Work weekdays"],
    }
    value.update(overrides)
    return value


def model_plan(**overrides):
    value = {
        "summary": "A steady study plan.",
        "steps": [{
            "title": "Review fundamentals",
            "description": "Study the core concepts.",
            "priority": "high",
            "day_offset": 0,
            "duration_days": 7,
            "estimated_cost": 20,
        }],
        "tips": ["Take regular breaks."],
    }
    value.update(overrides)
    return value


def ollama_response(plan):
    return BytesIO(json.dumps({"response": json.dumps(plan)}).encode("utf-8"))


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
            "AURA_MODEL": "qwen2.5:1.5b",
            "AURA_MODEL_TIMEOUT_SECONDS": "2",
        }, clear=False)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_sends_json_schema_and_returns_validated_plan(self):
        with patch("backend.planner.urlopen", return_value=ollama_response(model_plan())) as open_url:
            result = generate_plan(constraints())

        request = open_url.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/generate")
        self.assertEqual(body["model"], "qwen2.5:1.5b")
        self.assertEqual(body["format"]["required"], ["summary", "steps", "tips"])
        self.assertFalse(body["stream"])
        self.assertIn("Prepare for a certification exam", body["prompt"])
        self.assertIn('"budget": 100', body["prompt"])
        self.assertIn('"commitments": ["Work weekdays"]', body["prompt"])
        self.assertIn('"target_date":', body["prompt"])
        self.assertEqual(open_url.call_args.kwargs["timeout"], 2)
        self.assertEqual(result["summary"], "A steady study plan.")

    def test_missing_model_configuration_is_reported(self):
        with patch.dict(os.environ, {"AURA_MODEL": ""}), self.assertRaises(PlannerNotConfigured):
            generate_plan(constraints())

    def test_unreachable_ollama_is_reported(self):
        with patch("backend.planner.urlopen", side_effect=URLError("connection refused")):
            with self.assertRaises(PlannerUnavailable):
                generate_plan(constraints())

    def test_ollama_timeout_is_reported(self):
        with patch("backend.planner.urlopen", side_effect=socket.timeout()):
            with self.assertRaises(PlannerTimeout):
                generate_plan(constraints())

    def test_non_json_model_output_is_rejected(self):
        response = BytesIO(json.dumps({"response": "not JSON"}).encode("utf-8"))
        with patch("backend.planner.urlopen", return_value=response):
            with self.assertRaises(InvalidPlannerOutput):
                generate_plan(constraints())

    def test_valid_plan_within_budget_has_no_budget_warning(self):
        with patch("backend.planner.urlopen", return_value=ollama_response(model_plan())):
            result = generate_plan(constraints())
        self.assertFalse(any("exceeds the budget" in warning for warning in result["warnings"]))
        self.assertIn("not verified prices", " ".join(result["warnings"]))

    def test_known_cost_over_budget_returns_actionable_warning(self):
        plan = model_plan(steps=[{
            "title": "Study", "description": "Use a tutor.", "priority": "high", "day_offset": 0,
            "duration_days": 7, "estimated_cost": 101,
        }])
        with patch("backend.planner.urlopen", return_value=ollama_response(plan)):
            result = generate_plan(constraints())
        self.assertIn("Estimated total cost exceeds the budget; revise the plan or increase the budget.", result["warnings"])

    def test_schedule_beyond_target_date_returns_warning(self):
        plan = model_plan(steps=[{
            "title": "Study", "description": "Review all topics.", "priority": "high", "day_offset": 20,
            "duration_days": 15, "estimated_cost": 10,
        }])
        with patch("backend.planner.urlopen", return_value=ollama_response(plan)):
            result = generate_plan(constraints(target_date=(date.today() + timedelta(days=10)).isoformat()))
        self.assertTrue(any("extends beyond the target date" in warning for warning in result["warnings"]))

    def test_unknown_cost_is_null_and_warns_that_total_cannot_be_verified(self):
        plan = model_plan(steps=[{
            "title": "Study", "description": "Review topics.", "priority": "high",
            "day_offset": 0, "duration_days": 7,
        }])
        with patch("backend.planner.urlopen", return_value=ollama_response(plan)):
            result = generate_plan(constraints())
        self.assertIsNone(result["steps"][0]["estimated_cost"])
        self.assertTrue(any("budget compliance cannot be fully verified" in warning for warning in result["warnings"]))

    def test_explicit_unknown_cost_is_not_treated_as_zero(self):
        plan = model_plan(steps=[{**model_plan()["steps"][0], "estimated_cost": None}])
        with patch("backend.planner.urlopen", return_value=ollama_response(plan)):
            result = generate_plan(constraints())
        self.assertIsNone(result["steps"][0]["estimated_cost"])
        self.assertTrue(any("Cost estimates are missing" in warning for warning in result["warnings"]))

    def test_schedule_overlap_is_reported_only_when_timing_is_available(self):
        without_timing = model_plan(steps=[
            {"title": "First", "description": "Begin.", "priority": "high"},
            {"title": "Second", "description": "Continue.", "priority": "medium"},
        ])
        with patch("backend.planner.urlopen", return_value=ollama_response(without_timing)):
            result = generate_plan(constraints())
        self.assertFalse(any("overlap on the day-level schedule" in warning for warning in result["warnings"]))
        self.assertTrue(any("incomplete timing" in warning for warning in result["warnings"]))

        with_overlap = model_plan(steps=[
            {"title": "First", "description": "Begin.", "priority": "high", "day_offset": 0, "duration_days": 4, "estimated_cost": 10},
            {"title": "Second", "description": "Continue.", "priority": "medium", "day_offset": 2, "duration_days": 3, "estimated_cost": 10},
        ])
        with patch("backend.planner.urlopen", return_value=ollama_response(with_overlap)):
            result = generate_plan(constraints())
        self.assertTrue(any("overlap on the day-level schedule" in warning for warning in result["warnings"]))

    def test_invalid_or_incomplete_model_plan_is_rejected(self):
        with patch("backend.planner.urlopen", return_value=ollama_response({"summary": "", "steps": [], "tips": []})):
            with self.assertRaises(InvalidPlannerOutput):
                generate_plan(constraints())

    def test_invalid_cost_value_is_rejected(self):
        plan = model_plan(steps=[{
            **model_plan()["steps"][0], "estimated_cost": -0.01,
        }])
        with patch("backend.planner.urlopen", return_value=ollama_response(plan)):
            with self.assertRaises(InvalidPlannerOutput):
                generate_plan(constraints())


if __name__ == "__main__":
    unittest.main()
