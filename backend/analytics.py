"""Cohort loading, explainable scoring, support rules, and proxy-label models."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.base import clone
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DEFAULT_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "student-success-cohort (1).csv"
DATA_PATH = Path(os.environ.get("STUDENT_SUCCESS_DATA_PATH", DEFAULT_DATA_PATH)).expanduser().resolve()
WEIGHTS = {
    "academic": 0.30,
    "attendance": 0.20,
    "lms": 0.15,
    "placement": 0.20,
    "skills": 0.10,
    "engagement": 0.05,
}
TARGETS = {
    "academic": "Academic_Risk_Flag",
    "placement": "Placement_Risk_Flag",
}
RISK_THRESHOLDS = {
    "academic_component_below": 55,
    "attendance_below_percent": 65,
    "backlogs_at_least": 2,
    "assignment_completion_below": 55,
    "placement_assessment_below": 50,
    "placement_readiness_below": 55,
    "high_priority_conditions": 2,
}
EXCLUDED_FEATURES = {
    "Student_ID", "Name", "Gender", "Age", "Program", "Faculty_Risk_Flag",
    "Success_Score", "Academic_Risk_Flag", "Placement_Risk_Flag", "Overall_Risk_Flag",
    "Student_Segment", "Platform_Success_Score", "Platform_Academic_Risk",
    "Platform_Placement_Risk", "Platform_Overall_Risk", "Platform_Success_Score_2",
    "Platform_Academic_Risk_2", "Platform_Placement_Risk_2", "Platform_Overall_Risk_2",
}
MODEL_FEATURES = {
    "CGPA", "Previous_Sem_CGPA", "Backlogs", "Subject_Performance_Avg",
    "Internal_Marks", "External_Marks", "Overall_Attendance_%",
    "Subject_Attendance_Critical_%", "Attendance_Trend",
    "LMS_Login_Frequency_per_week", "Assignment_Completion_%",
    "Content_Engagement_Hours", "Quiz_Avg_Score", "Events_Attended",
    "Clubs_Joined", "Hackathons_Participated", "Certifications_Count",
    "Extracurricular_Score", "Aptitude_Score", "Coding_Score",
    "Mock_Interview_Score", "Internship_Count", "Placement_Readiness_Score",
    "Technical_Skill_Score", "Soft_Skill_Score", "Overall_Skills_Score",
    "Student_Satisfaction_Score", "Faculty_Feedback_Score",
}


def _read_cohort(path: Path = DATA_PATH) -> pd.DataFrame:
    """Read CSV using pandas' duplicate-header mangling and normalize field names."""
    frame = pd.read_csv(path)
    frame.columns = [str(column).strip() for column in frame.columns]
    frame = frame.loc[:, ~frame.columns.duplicated()].copy()
    frame["Department"] = frame["Department"].astype("string").str.strip().str.upper()
    frame["Student_ID"] = frame["Student_ID"].astype("string").str.strip().str.upper()
    frame = frame.drop_duplicates(subset="Student_ID", keep="first")
    return frame.replace({np.nan: None})


def _number(record: dict[str, Any], key: str) -> float | None:
    value = record.get(key)
    if value is None or pd.isna(value):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return float(np.clip(result, 0, 100))


def _mean_available(values: list[float | None]) -> float | None:
    available = [value for value in values if value is not None]
    return round(float(np.mean(available)), 1) if available else None


def _components(record: dict[str, Any]) -> dict[str, float | None]:
    cgpa = _number(record, "CGPA")
    internal = _number(record, "Internal_Marks")
    external = _number(record, "External_Marks")
    logins = _number(record, "LMS_Login_Frequency_per_week")
    academic = _mean_available([
        cgpa * 10 if cgpa is not None else None,
        _number(record, "Subject_Performance_Avg"),
        internal * 2.5 if internal is not None else None,
        external * (100 / 60) if external is not None else None,
    ])
    lms = _mean_available([
        _number(record, "Assignment_Completion_%"),
        _number(record, "Quiz_Avg_Score"),
        logins * 10 if logins is not None else None,
    ])
    skills = _mean_available([
        _number(record, "Technical_Skill_Score"),
        _number(record, "Soft_Skill_Score"),
    ])
    return {
        "academic": academic,
        "attendance": _number(record, "Overall_Attendance_%"),
        "lms": lms,
        "placement": _number(record, "Placement_Readiness_Score"),
        "skills": skills,
        "engagement": _number(record, "Extracurricular_Score"),
    }


def score_record(record: dict[str, Any]) -> dict[str, Any]:
    components = _components(record)
    available = {key: value for key, value in components.items() if value is not None}
    total_weight = sum(WEIGHTS[key] for key in available)
    score = (
        round(sum(float(value) * WEIGHTS[key] for key, value in available.items()) / total_weight, 1)
        if total_weight
        else None
    )
    coverage = round(len(available) / len(WEIGHTS) * 100)

    academic = components["academic"]
    attendance = components["attendance"]
    assignment = _number(record, "Assignment_Completion_%")
    backlogs = record.get("Backlogs")
    backlogs = int(backlogs) if backlogs is not None and not pd.isna(backlogs) else 0
    academic_reasons = []
    if academic is not None and academic < RISK_THRESHOLDS["academic_component_below"]:
        academic_reasons.append(f"Academic component below {RISK_THRESHOLDS['academic_component_below']}")
    if attendance is not None and attendance < RISK_THRESHOLDS["attendance_below_percent"]:
        academic_reasons.append(f"Attendance below {RISK_THRESHOLDS['attendance_below_percent']}%")
    if backlogs >= RISK_THRESHOLDS["backlogs_at_least"]:
        academic_reasons.append(f"{backlogs} current backlogs")
    if assignment is not None and assignment < RISK_THRESHOLDS["assignment_completion_below"]:
        academic_reasons.append(f"Assignment completion below {RISK_THRESHOLDS['assignment_completion_below']}%")

    placement_reasons = []
    for field, label in (("Aptitude_Score", "Aptitude"), ("Coding_Score", "Coding"), ("Mock_Interview_Score", "Mock interview")):
        value = _number(record, field)
        if value is not None and value < RISK_THRESHOLDS["placement_assessment_below"]:
            placement_reasons.append(f"{label} score below {RISK_THRESHOLDS['placement_assessment_below']}")
    placement = components["placement"]
    if placement is not None and placement < RISK_THRESHOLDS["placement_readiness_below"]:
        placement_reasons.append(f"Placement readiness below {RISK_THRESHOLDS['placement_readiness_below']}")

    if academic_reasons:
        academic_risk = "High priority" if len(academic_reasons) >= RISK_THRESHOLDS["high_priority_conditions"] else "Needs attention"
    else:
        academic_risk = "On track"
    if placement_reasons:
        placement_risk = "High priority" if len(placement_reasons) >= RISK_THRESHOLDS["high_priority_conditions"] else "Needs attention"
    else:
        placement_risk = "On track"

    driver = min(available, key=lambda key: components[key] if components[key] is not None else 101) if available else None
    strongest = max(available, key=lambda key: components[key] if components[key] is not None else -1) if available else None
    return {
        "success_score": score,
        "coverage": coverage,
        "components": components,
        "academic_risk": academic_risk,
        "academic_reasons": academic_reasons,
        "placement_risk": placement_risk,
        "placement_reasons": placement_reasons,
        "overall_risk": "High priority" if "High priority" in (academic_risk, placement_risk) else "Needs attention" if "Needs attention" in (academic_risk, placement_risk) else "On track",
        "lowest_component": driver,
        "strongest_component": strongest,
    }


def _segment(record: dict[str, Any], scored: dict[str, Any]) -> str:
    components = scored["components"]
    academic, placement = components["academic"], components["placement"]
    skills, attendance = components["skills"], components["attendance"]
    previous, current = _number(record, "Previous_Sem_CGPA"), _number(record, "CGPA")
    assignment, login = _number(record, "Assignment_Completion_%"), _number(record, "LMS_Login_Frequency_per_week")
    soft, interview = _number(record, "Soft_Skill_Score"), _number(record, "Mock_Interview_Score")
    if scored["coverage"] < 67:
        return "Insufficient data"
    if previous is not None and current is not None and current - previous >= 0.5:
        return "Improving performance"
    if academic is not None and placement is not None and academic >= 70 and placement < 55:
        return "Strong academics, low placement readiness"
    if skills is not None and soft is not None and interview is not None and skills >= 70 and min(soft, interview) < 55:
        return "Technical strengths, communication practice"
    if attendance is not None and academic is not None and attendance < 65 and academic < 60:
        return "Low attendance and academic concern"
    if attendance is not None and academic is not None and attendance >= 80 and academic < 60:
        return "High attendance, academic support"
    if (assignment is not None and assignment < 55) or (login is not None and login < 4):
        return "Low LMS engagement"
    if academic is not None and placement is not None and academic >= 70 and placement >= 65:
        return "Strong academics and placement readiness"
    return "Broad-based support"


@dataclass
class TrainedModel:
    pipeline: Pipeline
    features: list[str]
    metrics: dict[str, float | int]
    out_of_fold_probabilities: np.ndarray
    student_ids: list[str]


def train_proxy_models(frame: pd.DataFrame) -> dict[str, TrainedModel]:
    models: dict[str, TrainedModel] = {}
    for area, target in TARGETS.items():
        if target not in frame:
            continue
        labels = pd.to_numeric(frame[target], errors="coerce")
        usable = labels.notna()
        features = [
            column for column in frame.columns
            if column in MODEL_FEATURES and column not in EXCLUDED_FEATURES and column != target
        ]
        data = frame.loc[usable, features].copy()
        y = labels.loc[usable].astype(int)
        if y.nunique() < 2 or y.value_counts().min() < 5:
            continue
        numeric = data.select_dtypes(include=[np.number]).columns.tolist()
        categorical = [column for column in features if column not in numeric]
        preprocessor = ColumnTransformer([
            ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric),
            ("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encode", OneHotEncoder(handle_unknown="ignore"))]), categorical),
        ])
        pipeline = Pipeline([
            ("preprocess", preprocessor),
            ("classifier", LogisticRegression(class_weight="balanced", max_iter=1200, random_state=27)),
        ])
        x_train, x_test, y_train, y_test = train_test_split(
            data, y, test_size=0.25, stratify=y, random_state=27
        )
        pipeline.fit(x_train, y_train)
        probabilities = pipeline.predict_proba(x_test)[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        metrics: dict[str, float | int] = {
            "train_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
            "balanced_accuracy": round(float(balanced_accuracy_score(y_test, predictions)), 3),
            "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 3),
            "positive_rate": round(float(y.mean()), 3),
        }
        out_of_fold_probabilities = cross_val_predict(
            clone(pipeline),
            data,
            y,
            cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=27),
            method="predict_proba",
        )[:, 1]
        student_ids = frame.loc[usable, "Student_ID"].astype(str).tolist()
        models[area] = TrainedModel(pipeline, features, metrics, out_of_fold_probabilities, student_ids)
    return models


class CohortService:
    def __init__(self, path: Path = DATA_PATH) -> None:
        self.path = path
        self.frame = _read_cohort(path)
        self.models = train_proxy_models(self.frame)
        self.students = self._prepare_students()
        self.by_id = {student["id"]: student for student in self.students}

    def _prepare_students(self) -> list[dict[str, Any]]:
        raw_records = self.frame.to_dict(orient="records")
        model_predictions: dict[str, dict[str, float]] = {}
        for area, model in self.models.items():
            probabilities = model.out_of_fold_probabilities
            for student_id, probability in zip(model.student_ids, probabilities, strict=True):
                model_predictions.setdefault(student_id, {})[area] = round(float(probability), 3)

        students = []
        for record in raw_records:
            scored = score_record(record)
            student_id = str(record["Student_ID"])
            students.append({
                "id": student_id,
                "department": record.get("Department"),
                "program": record.get("Program"),
                "year": int(record["Year"]) if record.get("Year") is not None else None,
                "cgpa": _number(record, "CGPA"),
                "previous_cgpa": _number(record, "Previous_Sem_CGPA"),
                "attendance": scored["components"]["attendance"],
                "critical_attendance": _number(record, "Subject_Attendance_Critical_%"),
                "assignment_completion": _number(record, "Assignment_Completion_%"),
                "placement_readiness": scored["components"]["placement"],
                "aptitude": _number(record, "Aptitude_Score"),
                "coding": _number(record, "Coding_Score"),
                "mock_interview": _number(record, "Mock_Interview_Score"),
                "backlogs": int(record["Backlogs"]) if record.get("Backlogs") is not None else 0,
                "lms_logins": _number(record, "LMS_Login_Frequency_per_week"),
                "content_engagement_hours": _number(record, "Content_Engagement_Hours"),
                "quiz_average": _number(record, "Quiz_Avg_Score"),
                "events": int(record["Events_Attended"]) if record.get("Events_Attended") is not None else 0,
                "clubs": int(record["Clubs_Joined"]) if record.get("Clubs_Joined") is not None else 0,
                "hackathons": int(record["Hackathons_Participated"]) if record.get("Hackathons_Participated") is not None else 0,
                "certifications": int(record["Certifications_Count"]) if record.get("Certifications_Count") is not None else 0,
                "internships": int(record["Internship_Count"]) if record.get("Internship_Count") is not None else 0,
                "technical_skills": _number(record, "Technical_Skill_Score"),
                "soft_skills": _number(record, "Soft_Skill_Score"),
                "satisfaction": _number(record, "Student_Satisfaction_Score"),
                "faculty_feedback": _number(record, "Faculty_Feedback_Score"),
                "subject_performance": _number(record, "Subject_Performance_Avg"),
                "internal_marks": _number(record, "Internal_Marks"),
                "external_marks": _number(record, "External_Marks"),
                "attendance_trend": record.get("Attendance_Trend"),
                **scored,
                "segment": _segment(record, scored),
                "proxy_probabilities": model_predictions.get(student_id, {}),
            })
        return students

    def dashboard(self) -> dict[str, Any]:
        original_count = len(pd.read_csv(self.path))
        return {
            "students": self.students,
            "weights": WEIGHTS,
            "risk_thresholds": RISK_THRESHOLDS,
            "model_metrics": {area: model.metrics for area, model in self.models.items()},
            "data_quality": {
                "rows": len(self.frame),
                "unique_students": len(self.students),
                "duplicate_ids_removed": int(original_count - len(self.frame)),
                "missing_cells": int(self.frame.isna().sum().sum()),
                "columns": len(self.frame.columns),
            },
            "notes": [
                "Risk classifiers learn the supplied cohort's existing risk flags, which are proxy labels rather than verified future outcomes.",
                "Predicted probabilities are support-prioritization estimates, not validated forecasts or student judgments.",
                "Success scores are transparent weighted summaries; missing components are excluded and available weights are renormalized.",
            ],
        }

    def insights(self) -> list[dict[str, Any]]:
        students = self.students
        insights: list[dict[str, Any]] = []
        low_attendance = [student for student in students if (student["attendance"] or 100) < 65]
        low_assignment = [student for student in students if (student["assignment_completion"] or 100) < 55]
        academic_gap = [student for student in students if (student["cgpa"] or 0) >= 7 and (student["placement_readiness"] or 100) < 55]
        improving = [student for student in students if student["previous_cgpa"] is not None and student["cgpa"] is not None and student["cgpa"] - student["previous_cgpa"] >= 0.5]
        for title, subset, metric, action, priority in [
            ("Attendance support cohort", low_attendance, "Attendance below 65%", "Offer an attendance check-in and identify timetable or access barriers.", "High"),
            ("Assignment completion gap", low_assignment, "Assignment completion below 55%", "Review course-level submission friction and offer structured LMS support.", "Medium"),
            ("Academic strength, placement gap", academic_gap, "CGPA at least 7.0 with placement readiness below 55", "Offer aptitude and coding practice with mock-interview feedback.", "Medium"),
            ("Students showing improvement", improving, "CGPA increased by at least 0.5 vs previous semester", "Recognize progress and ask which supports are working.", "Positive"),
        ]:
            if subset:
                insights.append({"title": title, "count": len(subset), "metric": metric, "action": action, "priority": priority, "student_ids": [student["id"] for student in subset[:100]], "kind": "descriptive"})
        department_rows = pd.DataFrame(students).groupby("department", dropna=True)
        departments = [(department, group) for department, group in department_rows if len(group) >= 10]
        if len(departments) >= 2:
            low_department = min(departments, key=lambda item: item[1]["assignment_completion"].mean())
            high_department = max(departments, key=lambda item: item[1]["assignment_completion"].mean())
            difference = high_department[1]["assignment_completion"].mean() - low_department[1]["assignment_completion"].mean()
            if difference >= 8:
                ids = low_department[1]["id"].tolist()
                insights.append({
                    "title": "Assignment completion varies across departments",
                    "count": len(ids),
                    "metric": f"{low_department[0]} average {low_department[1]['assignment_completion'].mean():.1f}% vs {high_department[0]} {high_department[1]['assignment_completion'].mean():.1f}%",
                    "action": "Review assignment timing, LMS access, and support practices before attributing the difference to students.",
                    "priority": "Medium", "student_ids": ids[:100], "kind": "descriptive",
                })
        return insights


service = CohortService()