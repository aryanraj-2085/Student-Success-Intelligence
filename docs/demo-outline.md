# Hackathon Demo Outline

## 1. The problem

Academic, attendance, LMS, engagement, placement, skills, and feedback records are hard to review together. Faculty need a way to spot support opportunities without turning a score into a verdict.

## 2. Integrated cohort view

Show the 1,000-row provided cohort, department/year filters, data completeness, support-signal distribution, attendance/CGPA scatter, and department comparisons. Explain that the file is already cohort-joined; this prototype normalizes the fields and handles its repeated `Platform_*` headers.

## 3. Explainable score and flags

Open the methodology strip and one student profile. Walk through the six weighted components, missing-data coverage, threshold reasons for academic and placement support, and strongest/weakest components.

## 4. Turn insight into action

Open a generated insight, inspect a linked student, create a support plan with a mentor and follow-up date, then change its status. Show a segment such as strong academics with a placement-readiness gap.

## 5. ML baseline and honest limits

Explain that logistic regression reproduces supplied risk flags, not future outcomes. Show the fixed holdout metrics and class imbalance, then explain the next data required: dated historical records and verified later academic/placement outcomes. Mention no date field and in-memory intervention storage.

## 6. Intended impact

Use indicators to prioritize a human conversation, review the underlying evidence, offer appropriate support, and later measure outcomes. Do not use them for punitive or automated decisions.