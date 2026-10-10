"""Minimal standard-library HTTP backend for the AURA planning API."""

from __future__ import annotations

from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from typing import Any

from backend.planner import (
    InvalidPlannerOutput,
    PlannerNotConfigured,
    PlannerTimeout,
    PlannerUnavailable,
    generate_plan,
)

MAX_BODY_BYTES = 1_048_576


def allowed_cors_origins() -> set[str]:
    configured = os.environ.get("AURA_CORS_ORIGINS", "")
    return {origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()}


def error_response(code: str, message: str, details: list[dict[str, str]] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def is_finite_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(float(value))
    except OverflowError:
        return False


def validate_plan(payload: Any) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if not isinstance(payload, dict):
        return [{"field": "body", "message": "Must be a JSON object."}]

    if not isinstance(payload.get("goal"), str) or not payload["goal"].strip():
        issues.append({"field": "goal", "message": "Must be a non-empty string."})

    if "budget" in payload and payload["budget"] is not None:
        budget = payload["budget"]
        if not is_finite_number(budget) or budget < 0:
            issues.append({"field": "budget", "message": "Must be a finite non-negative number."})

    if "target_date" in payload and payload["target_date"] is not None:
        target_date = payload["target_date"]
        try:
            if not isinstance(target_date, str) or date.fromisoformat(target_date).isoformat() != target_date:
                raise ValueError
        except ValueError:
            issues.append({"field": "target_date", "message": "Must be a real date in YYYY-MM-DD format."})
        else:
            if date.fromisoformat(target_date) < date.today():
                issues.append({"field": "target_date", "message": "Must be today or a future date."})

    if "commitments" in payload:
        commitments = payload["commitments"]
        if not isinstance(commitments, list) or any(not isinstance(item, str) or not item.strip() for item in commitments):
            issues.append({"field": "commitments", "message": "Must be an array of non-empty strings."})

    return issues


class AuraHandler(BaseHTTPRequestHandler):
    server_version = "AURA/0.1"

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin and origin.rstrip("/") in allowed_cors_origins():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:
        if self.path != "/api/plan":
            self._send_json(404, error_response("not_found", "Route not found."))
            return
        origin = self.headers.get("Origin", "").rstrip("/")
        if not origin or origin not in allowed_cors_origins():
            self._send_json(403, error_response("cors_origin_not_allowed", "Configure this frontend origin in AURA_CORS_ORIGINS."))
            return
        if self.headers.get("Access-Control-Request-Method", "").upper() != "POST":
            self._send_json(405, error_response("method_not_allowed", "Only POST is allowed for this API."))
            return
        requested_headers = {
            value.strip().lower()
            for value in self.headers.get("Access-Control-Request-Headers", "").split(",")
            if value.strip()
        }
        if not requested_headers <= {"content-type"}:
            self._send_json(400, error_response("cors_header_not_allowed", "Only the Content-Type request header is allowed."))
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/plan":
            self._send_json(404, error_response("not_found", "Route not found."))
            return

        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._send_json(400, error_response("invalid_request", "A valid Content-Length header is required."))
            return
        if length < 0:
            self._send_json(400, error_response("invalid_request", "Content-Length cannot be negative."))
            return
        if length > MAX_BODY_BYTES:
            self._send_json(413, error_response("payload_too_large", "Request body exceeds 1 MiB."))
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, error_response("malformed_json", "Request body must contain valid UTF-8 JSON."))
            return

        issues = validate_plan(payload)
        if issues:
            self._send_json(422, error_response("validation_error", "Request validation failed.", issues))
            return

        constraints = {
            "goal": payload["goal"].strip(),
            "budget": payload.get("budget"),
            "target_date": payload.get("target_date"),
            "commitments": payload.get("commitments", []),
        }
        try:
            generated = generate_plan(constraints)
        except PlannerNotConfigured:
            self._send_json(503, error_response("model_not_configured", "Configure the local model before requesting a plan."))
            return
        except PlannerTimeout:
            self._send_json(504, error_response("model_timeout", "The model took too long to generate a plan."))
            return
        except PlannerUnavailable:
            self._send_json(503, error_response("model_unavailable", "The local model is unavailable."))
            return
        except InvalidPlannerOutput:
            self._send_json(502, error_response("invalid_model_output", "The model returned a plan that failed validation."))
            return

        self._send_json(202, {
            "status": "accepted",
            "plan": {**constraints, **generated},
        })

    def do_GET(self) -> None:
        self._send_json(405, error_response("method_not_allowed", "Use POST /api/plan."))

    def log_message(self, fmt: str, *args: Any) -> None:
        return


def main() -> None:
    address = ("127.0.0.1", 8000)
    server = ThreadingHTTPServer(address, AuraHandler)
    print(f"AURA API listening on http://{address[0]}:{address[1]}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
