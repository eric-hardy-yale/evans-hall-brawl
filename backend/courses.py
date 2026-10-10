"""Read-only access to the Yale SOM course catalog in data/yale_som.db.

Only public catalog fields leave this module: never faculty_1_email. PhD courses are skipped.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "yale_som.db"
FIELDS = [
    "course_number",
    "course_title",
    "course_category",
    "course_session",
    "course_description",
    "faculty_1",
    "faculty_bio",
    "daytimes",
    "room",
    "section",
    "units",
]
COLS = ", ".join(FIELDS)
NOT_PHD = "coalesce(course_category, '') <> 'PhD'"


def _connect() -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def _clean(row: sqlite3.Row) -> dict:
    return {k: " ".join(str(row[k] or "").split()) for k in FIELDS}


def normalize_number(number: str) -> str:
    """'mgt409', 'MGT-409' and 'MGT 409' all become 'MGT 409'."""
    letters = "".join(ch for ch in number if ch.isalpha()).upper()
    digits = "".join(ch for ch in number if ch.isdigit())
    return f"{letters} {digits}".strip() if letters and digits else number.strip().upper()


def course_sections(number: str) -> list[dict]:
    """Every section of one course, with description, instructor, days/times, and room."""
    with _connect() as con:
        rows = con.execute(
            f"SELECT {COLS} FROM courses WHERE upper(course_number) = ? AND {NOT_PHD} ORDER BY section",
            (normalize_number(number),),
        ).fetchall()
    return [_clean(r) for r in rows]


def search_courses(keyword: str, limit: int = 8) -> list[dict]:
    """Courses whose number, title, description, category, or instructor matches every word."""
    words = [w for w in keyword.lower().split() if w]
    if not words:
        return []
    where = " AND ".join(
        "(lower(course_number) LIKE ? OR lower(course_title) LIKE ? OR lower(course_description) LIKE ?"
        " OR lower(faculty_1) LIKE ? OR lower(course_category) LIKE ?)"
        for _ in words
    )
    params = [p for w in words for p in [f"%{w}%"] * 5]
    with _connect() as con:
        rows = con.execute(
            f"SELECT {COLS} FROM courses WHERE {NOT_PHD} AND {where} ORDER BY course_number, section",
            params,
        ).fetchall()
    # one entry per course (sections share a description), descriptions trimmed, no bio
    seen: dict[tuple, dict] = {}
    for r in rows:
        c = _clean(r)
        key = (c["course_number"], c["course_title"])
        if key in seen:
            seen[key]["sections"] += 1
            continue
        c.pop("faculty_bio")
        if len(c["course_description"]) > 400:
            c["course_description"] = c["course_description"][:400].rsplit(" ", 1)[0] + " …"
        c["sections"] = 1
        seen[key] = c
        if len(seen) >= limit:
            break
    return list(seen.values())


def course_brief(number: str) -> str:
    """Plain-text summary of a course for an agent's instructions."""
    sections = course_sections(number)
    if not sections:
        return f"No catalog entry found for {number}."
    first = sections[0]
    lines = [
        f"{first['course_number']}: {first['course_title']} ({first['course_category']}, {first['units']} units, session {first['course_session']})",
        f"Instructor: {first['faculty_1']}",
        f"Description: {first['course_description']}",
        "Sections:",
    ]
    for s in sections:
        when = s["daytimes"] or "no regular meeting time listed"
        where = s["room"] or "room TBA"
        lines.append(f"- Section {s['section']}: {when}, {where}")
    if first["faculty_bio"]:
        lines.append(f"Instructor bio: {first['faculty_bio']}")
    return "\n".join(lines)
