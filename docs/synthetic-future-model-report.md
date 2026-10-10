# Synthetic Future-Outcome Model Report

> **Demonstration only.** This dataset and its future-outcome labels are simulated. No real student records or observed future outcomes were used. These scores are not evidence of real-world predictive performance.

## Evaluation setup

- Synthetic observations: 3,600 (6 cohorts, 600 records each).
- Chronological holdout: train on cohorts 1-4 (2,400 rows); test on later cohorts 5-6 (1,200 rows).
- Generator seed: 2026; probability threshold: 0.50.
- Student IDs are synthetic `SIM-*` identifiers. Features are generated independently and do not copy the supplied cohort.
- Target values are sampled from simulated probabilities derived from earlier academic/attendance/LMS or placement/skill indicators, with added random noise.

## Test-set results

| Future target | Accuracy | Balanced accuracy | ROC AUC | Test positive rate |
|---|---:|---:|---:|---:|
| Academic failure next term (`academic_failure_next_term`) | 0.749 (74.9%) | 0.689 | 0.755 | 11.6% |
| Placement not ready next cycle (`placement_not_ready_next_cycle`) | 0.664 (66.4%) | 0.659 | 0.705 | 25.6% |

## Academic failure next term

Confusion matrix (rows = actual, columns = predicted; order `[0, 1]`):

- Actual 0: predicted 0 = 814, predicted 1 = 247
- Actual 1: predicted 0 = 54, predicted 1 = 85

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Not positive (0) | 0.938 | 0.767 | 0.844 | 1061 |
| Positive (1) | 0.256 | 0.612 | 0.361 | 139 |

## Placement not ready next cycle

Confusion matrix (rows = actual, columns = predicted; order `[0, 1]`):

- Actual 0: predicted 0 = 598, predicted 1 = 295
- Actual 1: predicted 0 = 108, predicted 1 = 199

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Not positive (0) | 0.847 | 0.670 | 0.748 | 893 |
| Positive (1) | 0.403 | 0.648 | 0.497 | 307 |

## Interpretation

The chronological split demonstrates a train/test workflow in which test cohorts are later than training cohorts. However, the generator itself defines the relationship between indicators and outcomes; a model can learn that artificial rule. These metrics only validate the code path and illustrate report shape. They must not be presented as accuracy on real college students or future real-world outcomes.

For a valid institutional model, replace these generated rows with de-identified, dated student observations and verified outcomes from a later term or placement cycle. Freeze predictors at the intended decision date, split by time (and student where students repeat), check label leakage, compare against simple baselines, calibrate probabilities, and review subgroup errors with faculty.

## Reproduce

```powershell
python -m backend.synthetic_future_demo
```
