# AURA Plan API Contract

## `POST /api/plan`

Validates a plan request, generates structured planning content with a locally hosted Ollama model, validates the generated content, and returns it. The route and top-level success response remain compatible with the Part 1 API.

### Request

Send a UTF-8 JSON object with `Content-Type: application/json`. The body limit is 1 MiB.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `goal` | string | Yes | Must contain at least one non-whitespace character. |
| `budget` | number or `null` | No | When provided, must be finite and non-negative. Zero means no spending. |
| `target_date` | string or `null` | No | When provided, must be a real date in `YYYY-MM-DD` format. |
| `commitments` | array of strings | No | Every item must contain non-whitespace text; defaults to `[]`. |

A supplied target date must be today or later. A budget is a numeric amount in the unit or currency chosen by the caller; AURA does not infer currency or convert amounts.

Example request:

```json
{"goal":"Plan a study schedule","budget":250,"target_date":"2026-12-01","commitments":["Work weekdays"]}
```

### Success response

HTTP `202 Accepted` (the existing Part 1 status and response envelope):

```json
{
  "status": "accepted",
  "plan": {
    "goal": "Plan a study schedule",
    "budget": 250,
    "target_date": "2026-12-01",
    "commitments": ["Work weekdays"],
    "summary": "A steady schedule that fits the available time and budget.",
    "steps": [
      {
        "title": "Set up a study plan",
        "description": "Break the topics into manageable sessions.",
        "priority": "high",
        "day_offset": 0,
        "duration_days": 2,
        "estimated_cost": 0
      }
    ],
    "tips": ["Review progress each week."],
    "warnings": ["Suggestions are AI-generated, not confirmed events, bookings, or external facts; verify details before acting."]
  }
}
```

The original `goal`, `budget`, `target_date`, and `commitments` fields remain at `plan` top level. Generated fields are `summary`, `steps`, `tips`, and deterministic `warnings`. Steps remain in the suggested execution order and include `title`, `description`, and `priority` (`high`, `medium`, or `low`).

`day_offset` (zero-based from today) and positive `duration_days` are optional when the model cannot schedule reliably; unavailable values are returned as `null`. If both are present, the backend checks the target-date boundary and flags overlapping day-level ranges. It cannot check hour-level conflicts or conflicts with free-text commitments because the request has no availability/time-slot fields.

`estimated_cost` is a non-negative finite estimate, or `null` when unknown; an omitted value is normalized to `null`. Unknown amounts are never treated as zero. The backend totals known estimates using decimal arithmetic. A known over-budget total is returned with an actionable warning; if any step cost is unknown, the backend warns that full budget compliance cannot be verified. Cost estimates are not verified prices. Warnings also disclose absent budgets, incomplete timing, possible day-level overlaps, and that AI suggestions are not confirmed events, bookings, or external facts. Users should confirm that suggestions fit their goal and circumstances. A useful plan is returned with warnings when an optional estimate or timing detail is unavailable; malformed or structurally incomplete model output still returns the standard error envelope.

### Error response

All errors use the same JSON envelope. `details` is included for validation errors.

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [{"field": "goal", "message": "Must be a non-empty string."}]
  }
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `malformed_json` / `invalid_request` | Invalid UTF-8 JSON or invalid request length. |
| `404` | `not_found` | Route does not exist. |
| `405` | `method_not_allowed` | Method is unsupported for this endpoint. |
| `403` | `cors_origin_not_allowed` | Browser preflight origin is not listed in `AURA_CORS_ORIGINS`. |
| `400` | `cors_header_not_allowed` | Browser preflight requested a header other than `Content-Type`. |
| `413` | `payload_too_large` | Body exceeds 1 MiB. |
| `422` | `validation_error` | JSON parsed but one or more fields are invalid. |
| `502` | `invalid_model_output` | Model output is invalid or violates output constraints. |
| `503` | `model_not_configured` / `model_unavailable` | Model configuration is invalid, Ollama is stopped, or the configured model is not installed. |
| `504` | `model_timeout` | Generation exceeded the configured timeout. |

## Start and call the backend

After installing Ollama, download the model once (only when you choose to enable local inference):

```powershell
ollama pull qwen2.5:1.5b
```

Start Ollama if its desktop service is not already running:

```powershell
ollama serve
```

In a separate PowerShell window, start AURA:

```powershell
python -m backend.server
```

The API binds to `http://127.0.0.1:8000`. You can exercise the endpoint directly with:

```powershell
curl.exe -i -X POST http://127.0.0.1:8000/api/plan `
  -H "Content-Type: application/json" `
  --data-raw '{"goal":"Prepare for a certification exam","budget":100,"commitments":["Work weekdays"]}'
```

An unavailable or uninstalled model returns the documented `503` JSON error; the test suite mocks model calls and does not need a running Ollama service.

### Browser frontend calls

For a frontend served from a different local origin, configure its exact origin before starting AURA. For example, if the frontend runs at `http://localhost:5173`:

```powershell
$env:AURA_CORS_ORIGINS = "http://localhost:5173"
python -m backend.server
```

Separate origins such as `localhost` and `127.0.0.1` are distinct and must each be listed if both are used. The server allows only `POST` with `Content-Type` for `/api/plan`; it does not enable credentialed requests. A same-origin development proxy can be used instead of CORS configuration.

Example browser request:

```javascript
const response = await fetch("http://127.0.0.1:8000/api/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: "Prepare for a certification exam",
    budget: 100,
    commitments: ["Work weekdays"]
  })
});

const body = await response.json();
if (!response.ok) {
  throw new Error(body.error?.message ?? "Plan request failed");
}
// Read body.status, body.plan.summary, body.plan.steps, body.plan.tips,
// and show body.plan.warnings to the user.
```

## Local model setup

The backend itself uses Python 3.10 or newer and the standard library; it makes no paid API calls and needs no API key. Install [Ollama](https://ollama.com/download), then download the default open-weight model:

```powershell
ollama pull qwen2.5:1.5b
```

The Qwen2.5 1.5B model is listed at about 986 MB in the [Ollama model library](https://ollama.com/library/qwen2.5). The library identifies the 1.5B release as Apache 2.0; model license terms should be reviewed for the intended use. The model runs locally, so available memory and generation speed depend on the machine.

Optional configuration (defaults shown):

```powershell
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:AURA_MODEL = "qwen2.5:1.5b"
$env:AURA_MODEL_TIMEOUT_SECONDS = "60"
$env:AURA_CORS_ORIGINS = "http://localhost:5173"
```

`AURA_CORS_ORIGINS` is optional and defaults to no cross-origin browser access. Set it to a comma-separated allowlist of exact frontend origins (scheme, host, and port; no path). Server-to-server requests and same-origin proxy requests do not require it.

`AURA_MODEL_TIMEOUT_SECONDS` accepts a positive value up to 300 seconds. No secrets are required. Start Ollama first, then run the API from the repository root:

```powershell
python -m backend.server
```

The server listens on `http://127.0.0.1:8000`. From the repository root, run tests with:

```powershell
python -m unittest discover -s tests -v
```

Tests mock the Ollama HTTP call and do not download a model or consume hosted inference credits.
