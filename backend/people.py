"""The AI avatars you can talk to in the game. Each one is a PydanticAI agent.

To add an avatar: write backend/prompts/<id>.md, add a Person to PEOPLE, add an entry to
PEOPLE_INFO in src/talk.js, and give a professor preset that talkId in a classroom.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

import courses

PROMPTS = Path(__file__).resolve().parent / "prompts"
PORTKEY_BASE = "https://api.portkey.ai/v1"
DEFAULT_MODEL = "gpt-6-luna"


@dataclass(frozen=True)
class Person:
    id: str
    name: str
    title: str
    room: str
    course_number: str
    prompt_file: str


PEOPLE: dict[str, Person] = {
    "zaman": Person(
        id="zaman",
        name="Tauhid Zaman",
        title="Professor",
        room="2200",
        course_number="MGT 409",
        prompt_file="zaman.md",
    ),
}


def model_name() -> str:
    return os.getenv("OPENAI_MODEL") or DEFAULT_MODEL


def get_model() -> OpenAIResponsesModel:
    # gpt-6-luna on Portkey only takes function tools through the Responses API
    key = (os.getenv("PORTKEY_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is missing: put it in backend/.env")
    return OpenAIResponsesModel(model_name(), provider=OpenAIProvider(base_url=PORTKEY_BASE, api_key=key))


def search_courses(keyword: str) -> list[dict]:
    """Search the Yale SOM course catalog. Matches course number, title, description, category,
    or instructor name (every word must match). Use it for questions about other classes.

    Args:
        keyword: e.g. "regression", "negotiation", "Zaman", "MGT 403", "Finance".
    """
    return courses.search_courses(keyword)


def course_info(course_number: str) -> list[dict]:
    """Every section of one course: description, instructor, days/times, room, units, and bio.

    Args:
        course_number: e.g. "MGT 409" or "mgt403".
    """
    return courses.course_sections(course_number)


@lru_cache(maxsize=None)
def agent_for(person_id: str) -> Agent:
    person = PEOPLE[person_id]
    persona = (PROMPTS / person.prompt_file).read_text(encoding="utf-8")
    instructions = (
        f"{persona}\n\n## Course facts (from the Yale SOM catalog)\n{courses.course_brief(person.course_number)}"
    )
    return Agent(get_model(), instructions=instructions, tools=[search_courses, course_info], name=person.id)
