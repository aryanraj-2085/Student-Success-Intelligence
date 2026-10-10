# Student Success Score and Risk Method

## Student Success Score

Each component is normalized to a 0–100 scale, then combined:

`Score = 0.30 Academic + 0.20 Attendance + 0.15 LMS + 0.20 Placement + 0.10 Skills + 0.05 Engagement`

- Academic: mean of CGPA × 10, subject performance average, internal marks scaled from 40 to 100, and external marks scaled from 60 to 100.
- Attendance: overall attendance percentage.
- LMS: mean of assignment completion, quiz average, and weekly logins scaled by 10.
- Placement: placement-readiness score.
- Skills: mean of technical and soft-skill scores.
- Engagement: extracurricular score.

If a component has no source values, it is omitted and the remaining weights are renormalized to sum to 1. Coverage is the percentage of the six top-level components available. Within academic, LMS, and skills components, available sub-indicators are averaged. Current supplied records have full top-level coverage; missing-data handling remains implemented for future imports.

These are transparent initial assumptions, not a scientifically validated measure or prediction. The component weights should be reviewed with faculty and evaluated against later outcomes.

## Support risk rules

Academic signals are generated from academic component below 55, attendance below 65%, at least two backlogs, or assignment completion below 55%. Placement signals use aptitude, coding, or mock-interview scores below 50, or placement readiness below 55. A single triggered condition is “Needs attention”; two or more in that area are “High priority”; otherwise it is “On track.” Academic and placement flags are kept separate. The overall flag takes the highest of those two. Thresholds are visible in `backend/analytics.py` and should be configurable with faculty review before use.

## ML baseline and limits

Separate logistic-regression pipelines target the file's existing academic and placement risk flags. Only an explicit allow-list of reviewed academic, attendance, LMS, engagement, placement, skill, and feedback indicators is eligible as a feature; identifiers, demographic fields, derived labels/scores, and newly imported unknown columns are excluded. The pipeline uses imputation, scaling, one-hot encoding, class weighting, a fixed stratified 75/25 holdout split, balanced accuracy, and ROC AUC. Profile probabilities are generated out-of-fold with stratified five-fold cross-validation rather than in-sample predictions. Placement risk has only 86 positive cases out of 1,000, so prevalence and class-specific errors matter.

With the reviewed feature allow-list, the current fixed holdout results are balanced accuracy / ROC AUC of 0.932 / 0.990 for academic risk and 0.913 / 0.970 for placement risk. Re-run the evaluation after any data or feature change.

These are proxy-label reproduction experiments on one cross-sectional cohort, not future-outcome forecasts. The source flags may already encode the same indicators used by the model, which likely explains the strong holdout metrics. A deployable predictor needs verified future outcomes, time-based validation, leakage controls, calibration, and subgroup/fairness review. The app displays model estimates separately from transparent score and rule-based support signals.