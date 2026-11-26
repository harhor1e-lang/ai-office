from __future__ import annotations

import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(APP_DIR / "data" / "ali_company.db")))
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
API_TOKEN = os.getenv("ALI_API_TOKEN", "")
ALLOWED_ORIGINS = [x.strip() for x in os.getenv(
    "ALLOWED_ORIGINS",
    "https://harhor1e-lang.github.io,http://localhost:8000,http://127.0.0.1:8000"
).split(",") if x.strip()]

app = FastAPI(title="ALI AI COMPANY Local Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            brief TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            result TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id)
        );
        """)


@app.on_event("startup")
def startup() -> None:
    init_db()


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN or API_TOKEN == "replace-with-a-long-random-secret":
        raise HTTPException(503, "Set a private ALI_API_TOKEN in backend/.env first.")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not secrets.compare_digest(supplied, API_TOKEN):
        raise HTTPException(401, "Unauthorized")


class PlanRequest(BaseModel):
    brief: str = Field(min_length=8, max_length=5000)
    title: str | None = Field(default=None, max_length=160)


class TaskUpdate(BaseModel):
    status: str = Field(pattern="^(pending|in_progress|review|completed|blocked)$")
    result: str | None = Field(default=None, max_length=5000)


SYSTEM_PROMPT = """أنت المدير التنفيذي لشركة ALI AI COMPANY.
حوّل طلب المستخدم إلى خطة مشروع عملية باللغة العربية.
أعد JSON فقط بهذا الشكل:
{"title":"عنوان واضح","tasks":[{"title":"مهمة قصيرة","department":"اسم القسم","description":"مخرجات المهمة ومعيار قبولها"}]}
أنشئ من 3 إلى 8 مهام مرتبة. لا تدّع تنفيذ أي مهمة. لا تطلب مفاتيح سرية.
الأقسام المتاحة: الإدارة، البرمجة، تطوير الويب، التطبيقات، التصميم، Blender، البحث، البيانات، الاختبار، الجودة، المحتوى.
اجعل كل مهمة قابلة للتحقق ولها مخرج واضح."""


async def ask_ollama(brief: str) -> dict[str, Any]:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": brief},
        ],
        "options": {"temperature": 0.2},
    }
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            response.raise_for_status()
            raw = response.json()["message"]["content"]
            data = json.loads(raw)
    except httpx.ConnectError as exc:
        raise HTTPException(503, "Ollama is not running. Start Ollama and download the configured model.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "The local model took too long to respond.") from exc
    except (httpx.HTTPStatusError, KeyError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "The local model returned an invalid response.") from exc

    tasks = data.get("tasks")
    if not isinstance(tasks, list) or not 3 <= len(tasks) <= 8:
        raise HTTPException(502, "The model plan must contain between 3 and 8 tasks.")
    clean = []
    for item in tasks:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()[:180]
        department = str(item.get("department", "الإدارة")).strip()[:80]
        description = str(item.get("description", "")).strip()[:1200]
        if title and description:
            clean.append({"title": title, "department": department, "description": description})
    if not 3 <= len(clean) <= 8:
        raise HTTPException(502, "The model plan did not contain enough valid tasks.")
    return {"title": str(data.get("title") or "مشروع جديد").strip()[:160], "tasks": clean}


@app.get("/api/health")
async def health():
    ollama_ok = False
    models: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            ollama_ok = True
    except Exception:
        pass
    return {
        "service": "ALI AI COMPANY Local Engine",
        "status": "online",
        "ollama": "online" if ollama_ok else "offline",
        "configured_model": OLLAMA_MODEL,
        "model_available": OLLAMA_MODEL in models,
        "available_models": models,
        "database": str(DB_PATH),
    }


@app.get("/api/models", dependencies=[Depends(require_token)])
async def models():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Cannot reach Ollama.") from exc


@app.post("/api/projects/plan", dependencies=[Depends(require_token)])
async def create_project_plan(request: PlanRequest):
    plan = await ask_ollama(request.brief)
    project_id = str(uuid4())
    title = (request.title or plan["title"]).strip()[:160]
    now = utc_now()
    with db() as conn:
        conn.execute(
            "INSERT INTO projects(id,title,brief,status,created_at) VALUES(?,?,?,?,?)",
            (project_id, title, request.brief, "planned", now),
        )
        for task in plan["tasks"]:
            conn.execute(
                """INSERT INTO tasks(id,project_id,title,department,description,status,created_at)
                   VALUES(?,?,?,?,?,?,?)""",
                (str(uuid4()), project_id, task["title"], task["department"],
                 task["description"], "pending", now),
            )
    return {"project_id": project_id, "title": title, "status": "planned",
            "message": "تم إعداد الخطة وحفظ المهام. لم يبدأ التنفيذ بعد.",
            "tasks": plan["tasks"]}


@app.get("/api/projects", dependencies=[Depends(require_token)])
async def list_projects():
    with db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]


@app.get("/api/projects/{project_id}/tasks", dependencies=[Depends(require_token)])
async def list_tasks(project_id: str):
    with db() as conn:
        exists = conn.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
        if not exists:
            raise HTTPException(404, "Project not found.")
        rows = conn.execute("SELECT * FROM tasks WHERE project_id=? ORDER BY created_at,id", (project_id,)).fetchall()
        return [dict(row) for row in rows]


@app.patch("/api/tasks/{task_id}", dependencies=[Depends(require_token)])
async def update_task(task_id: str, update: TaskUpdate):
    with db() as conn:
        cur = conn.execute(
            "UPDATE tasks SET status=?, result=? WHERE id=?",
            (update.status, update.result, task_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Task not found.")
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        return dict(row)


@app.get("/")
async def root():
    return {"message": "ALI AI COMPANY local engine. See /docs for API documentation."}
