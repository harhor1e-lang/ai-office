# ALI AI COMPANY — Local Engine (Phase 1)

This backend is the first real service behind the virtual office. It connects to a local Ollama model, turns a project brief into a structured task plan, and persists projects/tasks in SQLite.

**Important:** Phase 1 performs real AI planning and database persistence. It does not yet execute generated code, operate Blender, publish to GitHub, or autonomously modify files. Those execution adapters are later phases and will require explicit approval gates.

## Requirements

- Windows 10/11, macOS, or Linux
- Python 3.11+
- Ollama installed and running
- A model supported by the laptop. Start with `qwen2.5:3b` only if the device can run it comfortably; otherwise choose a smaller model.

## Windows setup

Open PowerShell in this folder:

1. Create a virtual environment:
   `py -3 -m venv .venv`
2. Activate it:
   `.venv\\Scripts\\Activate.ps1`
3. Install packages:
   `python -m pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and set a long private `ALI_API_TOKEN`.
5. Install/start Ollama, then download the model:
   `ollama pull qwen2.5:3b`
6. Start the API:
   `uvicorn app:app --host 127.0.0.1 --port 8787`
7. Open `http://127.0.0.1:8787/docs` to inspect the local API.

## Health check

Open `http://127.0.0.1:8787/api/health`. It reports whether Ollama is reachable and whether the configured model is installed.

## Authentication

All project and model endpoints require:
`Authorization: Bearer YOUR_ALI_API_TOKEN`

The health endpoint intentionally exposes only service/model availability, not project data. Never commit `.env`, API tokens, or private project files.

## API

- `GET /api/health` — engine and Ollama status
- `GET /api/models` — installed local models (authenticated)
- `POST /api/projects/plan` — create and save an AI-generated project plan
- `GET /api/projects` — list saved projects
- `GET /api/projects/{project_id}/tasks` — list project tasks
- `PATCH /api/tasks/{task_id}` — update task status/result

Example request body for planning:

```json
{
  "title": "موقع تعليمي",
  "brief": "أنشئ خطة لموقع تعليمي عربي مع صفحات الدروس والبحث ولوحة إدارة واختبارات."
}
```

## Safety and deployment

- Keep this server bound to `127.0.0.1` while developing.
- Do not expose the local API directly to the public internet.
- Do not put tokens or cloud provider keys in the GitHub Pages frontend.
- Do not enable shell execution or unrestricted file access for agents.
- Before adding file-writing, GitHub publishing, or other external actions, implement per-project workspaces, allowlists, backups, logs, and owner approval.
- The GitHub Pages website is static hosting; it cannot run Python backend processes. The local engine must be running on the laptop for AI planning.
