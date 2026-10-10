"""FastAPI endpoints for the Student Success prototype."""

from __future__ import annotations

from typing import Any
from backend.analytics import service
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.analytics import service

app = FastAPI(title="Student Success AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

interventions: list[dict[str, Any]] = []


class Intervention(BaseModel):
    student_id: str
    mentor: str = Field(min_length=1, max_length=100)
    action: str = Field(min_length=3, max_length=300)
    follow_up: str
    reason: str = Field(min_length=3, max_length=500)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    payload = service.dashboard()
    payload["insights"] = service.insights()
    payload["interventions"] = interventions
    return payload


@app.get("/api/students")
def students(
    department: str | None = None,
    year: int | None = None,
    risk: str | None = None,
    search: str | None = None,
    limit: int = Query(default=1000, ge=1, le=2000),
) -> list[dict[str, Any]]:
    items = service.students
    if department:
        items = [student for student in items if student["department"] == department.upper()]
    if year:
        items = [student for student in items if student["year"] == year]
    if risk:
        items = [student for student in items if student["overall_risk"] == risk]
    if search:
        query = search.strip().upper()
        items = [student for student in items if query in student["id"] or query in student["department"]]
    return items[:limit]


@app.get("/api/students/{student_id}")
def student_detail(student_id: str) -> dict[str, Any]:
    student = service.by_id.get(student_id.upper())
    if student is None:
        raise HTTPException(status_code=404, detail="Student ID not found")
    return student


@app.get("/api/segments")
def segments() -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for student in service.students:
        groups.setdefault(student["segment"], []).append(student)
    actions = {
        "Strong academics, low placement readiness": "Aptitude and coding practice, followed by a mock interview.",
        "Low attendance and academic concern": "Faculty check-in, attendance barrier review, and targeted remedial support.",
        "High attendance, academic support": "Subject-level diagnostic and faculty mentoring.",
        "Low LMS engagement": "Check platform access and assignment expectations; offer structured support.",
        "Technical strengths, communication practice": "Communication practice and mock interviews.",
        "Improving performance": "Recognize progress and identify supports worth continuing.",
        "Insufficient data": "Review data completeness before making a support recommendation.",
        "Strong academics and placement readiness": "Maintain momentum and offer advanced opportunities.",
        "Broad-based support": "Review the individual profile and ask the student what support would help.",
    }
    return [
        {"name": name, "count": len(members), "student_ids": [student["id"] for student in members], "action": actions.get(name, "Review individual support needs."), "average_score": round(sum(student["success_score"] or 0 for student in members) / len(members), 1)}
        for name, members in sorted(groups.items(), key=lambda item: -len(item[1]))
    ]


@app.get("/api/insights")
def insights() -> list[dict[str, Any]]:
    return service.insights()


@app.post("/api/interventions", status_code=201)
def create_intervention(request: Intervention) -> dict[str, Any]:
    if request.student_id.upper() not in service.by_id:
        raise HTTPException(status_code=404, detail="Student ID not found")
    item = {"id": len(interventions) + 1, **request.model_dump(), "student_id": request.student_id.upper(), "status": "Pending", "notes": []}
    interventions.insert(0, item)
    return item


@app.patch("/api/interventions/{intervention_id}")
def update_intervention(intervention_id: int, status: str = Query(...), note: str = Query(default="")) -> dict[str, Any]:
    if status not in {"Pending", "In progress", "Completed"}:
        raise HTTPException(status_code=400, detail="Unsupported intervention status")
    for item in interventions:
        if item["id"] == intervention_id:
            item["status"] = status
            if note.strip():
                item["notes"].append(note.strip())
            return item
    raise HTTPException(status_code=404, detail="Intervention not found")
