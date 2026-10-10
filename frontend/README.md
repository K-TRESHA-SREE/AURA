This is AURA's Next.js frontend (App Router). It contains an overview at `/` and the planner at `/plan`.

## Getting Started

Install dependencies and start the development server from this directory:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The planner calls the Python API directly at
`http://127.0.0.1:8000/api/plan` by default. To use another local API URL, set `NEXT_PUBLIC_AURA_API_BASE_URL`
before starting Next.js:

```powershell
$env:NEXT_PUBLIC_AURA_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

Start the backend from the repository root in another PowerShell window. Configure CORS with the exact frontend origin:

```powershell
$env:AURA_CORS_ORIGINS = "http://localhost:3000"
python -m backend.server
```

Start Ollama and ensure `qwen2.5:1.5b` is available before submitting a plan. See [`docs/api-contract.md`](../docs/api-contract.md)
for the request/response schema, validation behavior, errors, and Ollama setup.

These settings are for local development. A deployed website calling `127.0.0.1` would connect to the visitor's own
computer; online access requires a separately hosted backend and reachable inference service.
