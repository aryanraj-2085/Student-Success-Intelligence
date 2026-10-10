"""Generate and evaluate a clearly synthetic future-outcome demo model."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
FEATURES = [
    "current_cgpa",
    "previous_cgpa",
    "backlogs",
    "subject_performance",
    "attendance_percent",
    "assignment_completion_percent",
    "lms_logins_per_week",
    "aptitude_score",
    "coding_score",
    "mock_interview_score",
    "technical_skill_score",
    "soft_skill_score",
    "internship_count",
]
TARGETS = {
    "academic_failure_next_term": "Academic failure next term",
    "placement_not_ready_next_cycle": "Placement not ready next cycle",
}


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-np.clip(values, -30, 30)))


def generate_synthetic_dataset(
    cohort_count: int = 6,
    students_per_cohort: int = 600,
    seed: int = 2026,
) -> pd.DataFrame:
    """Create artificial snapshots and simulated future outcomes; never reads real records."""
    if cohort_count < 3:
        raise ValueError("Use at least three cohorts for a chronological train/test split.")
    if students_per_cohort < 50:
        raise ValueError("Generate at least 50 students per cohort.")

    rng = np.random.default_rng(seed)
    frames = []
    student_number = 1
    for cohort in range(1, cohort_count + 1):
        count = students_per_cohort
        shift = (cohort - 1) * 0.06
        current_cgpa = np.clip(rng.normal(6.6 + shift, 1.05, count), 3.0, 10.0)
        previous_cgpa = np.clip(current_cgpa + rng.normal(-0.12, 0.7, count), 2.0, 10.0)
        attendance = np.clip(rng.beta(7, 2.4, count) * 100 + rng.normal(0, 4, count), 25, 100)
        subject_performance = np.clip(current_cgpa * 9.6 + rng.normal(0, 10, count), 20, 100)
        backlogs = np.clip(rng.poisson(np.maximum(0.12, (7.0 - current_cgpa) * 0.42), count), 0, 6)
        assignment = np.clip(rng.beta(6.5, 2.5, count) * 100 + rng.normal(0, 4, count), 15, 100)
        logins = np.clip(rng.poisson(np.maximum(1.2, assignment / 15), count), 0, 20)
        aptitude = np.clip(rng.normal(59 + shift * 2, 14, count), 10, 100)
        coding = np.clip(rng.normal(57 + shift * 2, 16, count), 5, 100)
        mock_interview = np.clip(rng.normal(55 + shift, 15, count), 5, 100)
        technical = np.clip(rng.normal(60 + shift, 13, count), 10, 100)
        soft = np.clip(rng.normal(64, 12, count), 10, 100)
        internships = np.clip(rng.poisson(0.35 + np.maximum(0, technical - 50) / 65, count), 0, 4)

        academic_logit = (
            -2.0
            + 0.8 * (6.5 - current_cgpa)
            + 0.035 * (70 - attendance)
            + 0.22 * backlogs
            + 0.012 * (60 - assignment)
            - 0.08 * (logins - 5)
            + rng.normal(0, 0.65, count)
        )
        placement_logit = (
            -1.4
            + 0.035 * (60 - aptitude)
            + 0.04 * (60 - coding)
            + 0.025 * (60 - mock_interview)
            + 0.018 * (60 - technical)
            + 0.015 * (60 - soft)
            - 0.22 * internships
            + rng.normal(0, 0.7, count)
        )
        frame = pd.DataFrame({
            "student_id": [f"SIM-{number:06d}" for number in range(student_number, student_number + count)],
            "cohort_period": cohort,
            "current_cgpa": current_cgpa.round(2),
            "previous_cgpa": previous_cgpa.round(2),
            "backlogs": backlogs.astype(int),
            "subject_performance": subject_performance.round(1),
            "attendance_percent": attendance.round(1),
            "assignment_completion_percent": assignment.round(1),
            "lms_logins_per_week": logins.astype(int),
            "aptitude_score": aptitude.round(1),
            "coding_score": coding.round(1),
            "mock_interview_score": mock_interview.round(1),
            "technical_skill_score": technical.round(1),
            "soft_skill_score": soft.round(1),
            "internship_count": internships.astype(int),
            "academic_failure_next_term": rng.binomial(1, _sigmoid(academic_logit)),
            "placement_not_ready_next_cycle": rng.binomial(1, _sigmoid(placement_logit)),
        })
        frames.append(frame)
        student_number += count
    return pd.concat(frames, ignore_index=True)


def _make_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer([
        ("numeric", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]), FEATURES),
    ])
    return Pipeline([
        ("preprocess", preprocessor),
        ("classifier", LogisticRegression(class_weight="balanced", max_iter=1200, random_state=27)),
    ])


def evaluate_synthetic_dataset(frame: pd.DataFrame) -> tuple[dict[str, Any], dict[str, Pipeline]]:
    """Train on earlier cohorts and evaluate once on the chronologically later cohorts."""
    cohort_count = int(frame["cohort_period"].max())
    last_train_cohort = cohort_count - 2
    train = frame[frame["cohort_period"] <= last_train_cohort]
    test = frame[frame["cohort_period"] > last_train_cohort]
    models: dict[str, Pipeline] = {}
    report: dict[str, Any] = {
        "dataset_rows": len(frame),
        "cohort_count": cohort_count,
        "students_per_cohort": int(len(frame) / cohort_count),
        "train_cohorts": f"1-{last_train_cohort}",
        "test_cohorts": f"{last_train_cohort + 1}-{cohort_count}",
        "train_rows": len(train),
        "test_rows": len(test),
        "seed": 2026,
        "targets": {},
    }

    for target, label in TARGETS.items():
        model = _make_pipeline()
        model.fit(train[FEATURES], train[target].astype(int))
        probabilities = model.predict_proba(test[FEATURES])[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        actual = test[target].astype(int)
        matrix = confusion_matrix(actual, predictions, labels=[0, 1])
        class_report = classification_report(
            actual,
            predictions,
            labels=[0, 1],
            output_dict=True,
            zero_division=0,
        )
        models[target] = model
        report["targets"][target] = {
            "label": label,
            "test_prevalence": float(actual.mean()),
            "accuracy": float(accuracy_score(actual, predictions)),
            "balanced_accuracy": float(balanced_accuracy_score(actual, predictions)),
            "roc_auc": float(roc_auc_score(actual, probabilities)),
            "confusion_matrix_labels_0_1": matrix.tolist(),
            "classification_report": class_report,
        }
    return report, models


def _markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Synthetic Future-Outcome Model Report",
        "",
        "> **Demonstration only.** This dataset and its future-outcome labels are simulated. No real student records or observed future outcomes were used. These scores are not evidence of real-world predictive performance.",
        "",
        "## Evaluation setup",
        "",
        f"- Synthetic observations: {report['dataset_rows']:,} ({report['cohort_count']} cohorts, {report['students_per_cohort']} records each).",
        f"- Chronological holdout: train on cohorts {report['train_cohorts']} ({report['train_rows']:,} rows); test on later cohorts {report['test_cohorts']} ({report['test_rows']:,} rows).",
        f"- Generator seed: {report['seed']}; probability threshold: 0.50.",
        "- Student IDs are synthetic `SIM-*` identifiers. Features are generated independently and do not copy the supplied cohort.",
        "- Target values are sampled from simulated probabilities derived from earlier academic/attendance/LMS or placement/skill indicators, with added random noise.",
        "",
        "## Test-set results",
        "",
        "| Future target | Accuracy | Balanced accuracy | ROC AUC | Test positive rate |",
        "|---|---:|---:|---:|---:|",
    ]
    for target, result in report["targets"].items():
        lines.append(
            f"| {result['label']} (`{target}`) | {result['accuracy']:.3f} ({result['accuracy']:.1%}) "
            f"| {result['balanced_accuracy']:.3f} | {result['roc_auc']:.3f} | {result['test_prevalence']:.1%} |"
        )
    for target, result in report["targets"].items():
        lines.extend([
            "",
            f"## {result['label']}",
            "",
            "Confusion matrix (rows = actual, columns = predicted; order `[0, 1]`):",
            "",
            f"- Actual 0: predicted 0 = {result['confusion_matrix_labels_0_1'][0][0]}, predicted 1 = {result['confusion_matrix_labels_0_1'][0][1]}",
            f"- Actual 1: predicted 0 = {result['confusion_matrix_labels_0_1'][1][0]}, predicted 1 = {result['confusion_matrix_labels_0_1'][1][1]}",
            "",
            "| Class | Precision | Recall | F1 | Support |",
            "|---|---:|---:|---:|---:|",
        ])
        class_report = result["classification_report"]
        for key, name in (("0", "Not positive (0)"), ("1", "Positive (1)")):
            row = class_report[key]
            lines.append(
                f"| {name} | {row['precision']:.3f} | {row['recall']:.3f} | "
                f"{row['f1-score']:.3f} | {int(row['support'])} |"
            )
    lines.extend([
        "",
        "## Interpretation",
        "",
        "The chronological split demonstrates a train/test workflow in which test cohorts are later than training cohorts. However, the generator itself defines the relationship between indicators and outcomes; a model can learn that artificial rule. These metrics only validate the code path and illustrate report shape. They must not be presented as accuracy on real college students or future real-world outcomes.",
        "",
        "For a valid institutional model, replace these generated rows with de-identified, dated student observations and verified outcomes from a later term or placement cycle. Freeze predictors at the intended decision date, split by time (and student where students repeat), check label leakage, compare against simple baselines, calibrate probabilities, and review subgroup errors with faculty.",
        "",
        "## Reproduce",
        "",
        "```powershell",
        "python -m backend.synthetic_future_demo",
        "```",
    ])
    return "\n".join(lines) + "\n"


def run(output_root: Path = ROOT) -> dict[str, Any]:
    data_path = output_root / "data" / "synthetic-future-outcomes-demo.csv"
    model_path = output_root / "models" / "synthetic-future-demo.joblib"
    report_path = output_root / "docs" / "synthetic-future-model-report.md"
    frame = generate_synthetic_dataset()
    report, models = evaluate_synthetic_dataset(frame)

    data_path.parent.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(data_path, index=False)
    joblib.dump({
        "models": models,
        "features": FEATURES,
        "targets": TARGETS,
        "train_cohorts": report["train_cohorts"],
        "test_cohorts": report["test_cohorts"],
        "synthetic_only": True,
    }, model_path)
    report_path.write_text(_markdown_report(report), encoding="utf-8")
    print(f"Synthetic dataset: {data_path}")
    print(f"Trained demo model: {model_path}")
    print(f"Test report: {report_path}")
    for target, result in report["targets"].items():
        print(
            f"{target}: accuracy={result['accuracy']:.3f}, "
            f"balanced_accuracy={result['balanced_accuracy']:.3f}, "
            f"roc_auc={result['roc_auc']:.3f}"
        )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    arguments = parser.parse_args()
    run(arguments.output_root)


if __name__ == "__main__":
    main()
