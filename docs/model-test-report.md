# Held-Out Model Test Report

## Evaluation setup

- Dataset: supplied student cohort CSV, 1,000 records.
- Targets: existing `Academic_Risk_Flag` and `Placement_Risk_Flag` columns.
- Split: stratified 75% training / 25% held-out testing, `random_state=27`.
- Training: logistic regression with class weighting and the project's median/mode imputation, scaling, and one-hot preprocessing pipeline.
- Classification threshold: positive when predicted probability is at least 0.50.
- Labels: 0 = source risk flag not set; 1 = source risk flag set.

These are held-out results for reproducing risk labels already in the source file. They do **not** measure prediction of later academic or placement outcomes.

## Summary

| Target | Train rows | Test rows | Test accuracy | Balanced accuracy | ROC AUC |
|---|---:|---:|---:|---:|---:|
| Academic risk flag | 750 | 250 | 0.932 (93.2%) | 0.932 | 0.990 |
| Placement risk flag | 750 | 250 | 0.916 (91.6%) | 0.913 | 0.970 |

## Academic risk classification report

Confusion matrix (rows = actual, columns = predicted; order `[0, 1]`):

|  | Predicted 0 | Predicted 1 |
|---|---:|---:|
| Actual 0 | 129 | 9 |
| Actual 1 | 8 | 104 |

| Class | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| Not flagged (0) | 0.942 | 0.935 | 0.938 | 138 |
| Flagged (1) | 0.920 | 0.929 | 0.924 | 112 |
| Macro average | 0.931 | 0.932 | 0.931 | 250 |
| Weighted average | 0.932 | 0.932 | 0.932 | 250 |

## Placement risk classification report

Confusion matrix (rows = actual, columns = predicted; order `[0, 1]`):

|  | Predicted 0 | Predicted 1 |
|---|---:|---:|
| Actual 0 | 209 | 19 |
| Actual 1 | 2 | 20 |

| Class | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| Not flagged (0) | 0.991 | 0.917 | 0.952 | 228 |
| Flagged (1) | 0.513 | 0.909 | 0.656 | 22 |
| Macro average | 0.752 | 0.913 | 0.804 | 250 |
| Weighted average | 0.948 | 0.916 | 0.926 | 250 |

## Interpretation and limits

- The placement set contains only 22 flagged examples in the test split. Despite 91.6% accuracy and 0.909 recall for the flagged class, precision is only 0.513: 19 of 39 positive predictions are false positives. Review precision/recall trade-offs with faculty before using any threshold.
- Accuracy can obscure class imbalance. Consider per-class precision, recall, F1, balanced accuracy, and the confusion matrix together.
- The source labels are contemporaneous proxy flags and may encode indicators also used as model inputs. The scores can therefore overstate generalization and are not evidence of future-outcome prediction.
- Do not use these estimates for automated or punitive decisions. Before operational prediction, collect verified later outcomes, use time-ordered validation, check leakage and calibration, and evaluate performance across relevant student groups.

## Reproduction

Run from the project root:

```powershell
python -m unittest backend.test_analytics
```

The model split, feature allow-list, preprocessing, and random seed are defined in `backend/analytics.py`. Recompute this report after changing data, features, labels, or training logic.
