# Student Success AI

## 🚀 Live Demo & Project Walkthrough

<p align="center">
  <a href="https://student-success-intelligence.onrender.com/">
    <img src="https://img.shields.io/badge/🌐_LIVE_DEMO-Open_Project-16a34a?style=for-the-badge" alt="Live Demo" />
  </a>
  <a href="https://www.youtube.com/watch?v=W1TQu3Yv4ww">
    <img src="https://img.shields.io/badge/▶_WATCH_VIDEO-YouTube-red?style=for-the-badge" alt="Watch Demo Video" />
  </a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=W1TQu3Yv4ww">
    <img src="https://img.youtube.com/vi/W1TQu3Yv4ww/hqdefault.jpg" width="800" alt="Student Success Intelligence Demo Video" />
  </a>
</p>

<p align="center">
  <b>▶ Click the video thumbnail above to watch the complete project demonstration.</b>
</p>

---

### 🌐 Try the Application

Explore the live Student Success Intelligence platform to see student analytics, academic risk insights, student profiles, and faculty intervention features.

**[🚀 Open Live Application](https://student-success-intelligence.onrender.com/)**

**[🎬 Watch Project Walkthrough on YouTube](https://www.youtube.com/watch?v=W1TQu3Yv4ww)**

---
An explainable student-support analytics prototype using the cohort CSV in `data/`, a React/Vite interface, and a FastAPI/scikit-learn service. The prototype keeps identifiable names out of its API and UI and displays the supplied Student_ID as the profile key.

## Run locally

Use two terminals from the workspace root.

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

Open the Vite URL printed by npm (normally `http://localhost:5173`). The API is at `http://localhost:8000`; its interactive endpoint reference is `/docs`.

## What is implemented

- Executive overview with department/year filters, KPIs, rule-based risk distribution, department comparisons, previous/current CGPA comparison, attendance/CGPA scatter, and cohort-derived insights.
- Student directory with search, risk filter, sorting, pagination, CSV export with ripple feedback, recommended next action, and profile drill-through.
- Student profile with score components, data coverage, observed academic/LMS/placement/feedback fields, rule explanations, and proxy-model probabilities.
- Transparent student segments and descriptive, filtered insights, with interactive Three.js risk-cluster visualization, year-level CGPA/attendance comparisons, and side-by-side student comparisons.
- Faculty support-plan creation and status tracking, animated cohort-derived intervention suggestions, and staggered notification alerts. The demo API keeps plans in process memory; restart clears them.
- FastAPI endpoints for dashboard, directory, profile, segments, insights, and intervention creation/update.
- Responsive layout and reduced-motion support.
- Judge-ready demo slides in `docs/demo-slides.md`, alongside the detailed score note and demo outline.
- A fully synthetic future-outcome dataset/model demo with a chronological holdout report (not connected to real student predictions).

### Synthetic future-outcome demo

To demonstrate the future-outcome training/evaluation workflow without inventing outcomes for the real cohort, run:

```powershell
python -m backend.synthetic_future_demo
```

This reproducibly generates 3,600 artificial records across six ordered cohorts, trains academic-failure-next-term and placement-not-ready-next-cycle classifiers on earlier cohorts, and evaluates on the last two cohorts. It writes `data/synthetic-future-outcomes-demo.csv`, `models/synthetic-future-demo.joblib`, and `docs/synthetic-future-model-report.md`. The generated IDs use the `SIM-*` prefix. The target labels are simulated by the data generator, so reported test metrics only demonstrate the ML workflow; they are not real-world accuracy, student-level estimates, or validated evidence that outcomes can be predicted.

## Data notes

The original cohort CSV is deliberately excluded from Git because it contains student names and demographic information. A clone therefore needs an authorized local cohort file (set `STUDENT_SUCCESS_DATA_PATH`) before starting the API/dashboard. The synthetic future-outcome demo data is safe to share, but it is not a replacement for the dashboard's cohort schema or real student evidence.

The application uses the supplied cohort CSV as-is. Its 49-column header repeats four `Platform_*` column names; pandas safely mangles duplicate headers and the analytics layer excludes all `Platform_*` fields. The current file contains 1,000 unique Student_IDs and no missing cells. No event-date field is present, so date-range filtering and multi-semester trend analysis are not meaningful for this snapshot. `Previous_Sem_CGPA` and `CGPA` support only a two-point comparison.

### Integrating scheduled CSV exports

`backend/integrate_exports.py` provides a vendor-neutral, validated batch-import path while institution API access is being arranged. Start from the authoritative roster/cohort file, map each export's student key to `Student_ID`, and map source headers to the canonical headers used in the supplied cohort. The base roster is authoritative: an import fails if a source contains an unknown or duplicate student ID. Source files are applied in the order given; later non-empty values override earlier values, and the command reports override counts without printing student identifiers. Inputs are never overwritten.

Example PowerShell invocation:

```powershell
python -m backend.integrate_exports `
  --base "data/student-success-cohort (1).csv" `
  --source data/attendance-export.csv `
  --source data/lms-export.csv `
  --column-map data/column-map.json `
  --output data/integrated-cohort.csv
$env:STUDENT_SUCCESS_DATA_PATH = (Resolve-Path data/integrated-cohort.csv).Path
python -m uvicorn backend.main:app --reload
```

A column-map JSON file maps exact source headers to canonical headers, for example:

```json
{
  "SIS Primary Key": "Student_ID",
  "Roll Call Percent": "Overall_Attendance_%"
}
```

The API reads `STUDENT_SUCCESS_DATA_PATH` when it starts. Restart it after generating a new integrated file. This is a local/scheduled-export bridge, not a live connector: no campus platform names, API specifications, sandbox access, or service credentials were provided. Live SIS/LMS connectors must be configured against the institution's actual API and authentication requirements; endpoints and credentials must not be guessed or placed in source code.

The source contains student names and demographic fields. The API only exposes Student_ID, does not use Gender/Age/Name as model features, and should still be treated as sensitive institutional data. The proxy model uses an explicit allow-list of reviewed cohort indicators; adding a new imported column does not automatically make it a model feature. Add authentication, authorization, audit logging, and institutional privacy review before any real deployment.

## Prototype limitations

- `Academic_Risk_Flag` and `Placement_Risk_Flag` are pre-existing labels in this file, not verified future outcomes. Logistic regression reproduces these proxy labels using a reviewed indicator allow-list, a stratified 75/25 split (random seed 27), class weighting, median/mode imputation, scaling/one-hot encoding, balanced accuracy, and ROC AUC. Per-student probabilities shown in profiles are generated out-of-fold with stratified five-fold cross-validation. The current holdout results are 0.932 / 0.990 for academic risk and 0.913 / 0.970 for placement risk. Because the labels are contemporaneous and likely derived from overlapping indicators, these values must not be presented as evidence of future prediction quality.
- Use historical outcome labels (for example, subsequent semester failure or placement outcome), time-ordered student-level splits, leakage review, calibration, and class-specific metrics before claiming predictive performance.
- Support-risk chips in the UI are deterministic threshold rules, separate from the classifier estimates. They are prompts for review, never fixed student judgments.
- The weighted score is a design assumption, not a validated outcome model. Consult faculty and students and evaluate against historical outcomes before operational use.
- Date filtering, subject-level attendance/marks, and longitudinal intervention effectiveness are unavailable because those records are not in the provided file.
- Intervention plans are unauthenticated and in-memory only. Do not use for real student records.

## Main project paths

- `backend/analytics.py`: cohort cleaning, score, support thresholds, segments, insights, and proxy-model evaluation.
- `backend/integrate_exports.py`: validated merge of canonical scheduled SIS/LMS/attendance/etc. CSV exports.
- `backend/synthetic_future_demo.py`: reproducible synthetic future-target generation, chronological training, and test reporting.
- `backend/main.py`: FastAPI endpoint and demo intervention state.
- `frontend/src/App.jsx`: routed UI and interactions.
- `frontend/src/services/api.js`: API client.
- `docs/model-methodology.md`: short score and risk note.
- `docs/model-test-report.md`: held-out test accuracy, class-level report, and confusion matrices.
- `docs/synthetic-future-model-report.md`: report for the explicitly synthetic chronological model demonstration.
- `docs/demo-outline.md`: hackathon presentation outline.
- `docs/demo-slides.md`: concise judge-ready presentation content with a demo narrative and cohort snapshot.
