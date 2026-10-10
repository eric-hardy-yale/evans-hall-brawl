"""Backend for Yale SOM Virtual: chat with the AI avatars in the game.

Run from the repo root:
    backend/.venv/bin/python -m uvicorn main:app --app-dir backend --port 8000
Docs: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import logging
import uuid
from collections import OrderedDict
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
# backend/.env first: earlier files win, so a parent .env can't override the key or model set here
for env in [HERE / ".env", HERE.parent / ".env", HERE.parent.parent / ".env", HERE.parent.parent.parent / ".env"]:
    load_dotenv(env, override=False)

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from pydantic_ai.messages import ModelMessage, ModelRequest, UserPromptPart  # noqa: E402

from people import PEOPLE, agent_for, model_name  # noqa: E402

log = logging.getLogger("uvicorn.error")

app = FastAPI(title="Yale SOM Virtual: AI avatars", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_SESSIONS = 200
MAX_MESSAGES = 40
# (person_id, session_id) -> PydanticAI message history, oldest session first
SESSIONS: OrderedDict[tuple[str, str], list[ModelMessage]] = OrderedDict()


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None


class ChatOut(BaseModel):
    reply: str
    session_id: str


def trimmed(history: list[ModelMessage]) -> list[ModelMessage]:
    """Keep about the last MAX_MESSAGES, starting at a user turn so tool calls stay paired."""
    if len(history) <= MAX_MESSAGES:
        return history
    for i in range(len(history) - MAX_MESSAGES, len(history)):
        m = history[i]
        if isinstance(m, ModelRequest) and any(isinstance(p, UserPromptPart) for p in m.parts):
            return history[i:]
    return []


@app.get("/api/health")
def health():
    return {"ok": True, "model": model_name(), "people": list(PEOPLE)}


@app.get("/api/people")
def people():
    return [
        {"id": p.id, "name": p.name, "title": p.title, "room": p.room, "course": p.course_number}
        for p in PEOPLE.values()
    ]


@app.post("/api/people/{person_id}/chat", response_model=ChatOut)
async def chat(person_id: str, body: ChatIn):
    if person_id not in PEOPLE:
        raise HTTPException(404, f"No one called {person_id!r} here.")
    session_id = body.session_id or uuid.uuid4().hex
    key = (person_id, session_id)
    history = trimmed(SESSIONS.get(key, []))
    try:
        result = await agent_for(person_id).run(body.message, message_history=history)
    except Exception as exc:  # model or network trouble: tell the game, keep the server up
        log.warning("chat with %s failed: %s", person_id, exc)
        raise HTTPException(502, "The avatar couldn't reach the AI model. Try again in a moment.") from exc
    SESSIONS[key] = result.all_messages()
    SESSIONS.move_to_end(key)
    while len(SESSIONS) > MAX_SESSIONS:
        SESSIONS.popitem(last=False)
    return ChatOut(reply=result.output, session_id=session_id)
