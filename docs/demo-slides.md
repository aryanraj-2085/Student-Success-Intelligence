# Student Success Intelligence — Demo Slides

## Slide 1 — From disconnected signals to timely support

**Challenge:** Attendance, academics, LMS activity, engagement, skills, placement preparation, and feedback are difficult to review together.

**Approach:** Bring the available cohort fields into one student view, surface descriptive support signals, and leave intervention decisions with faculty and students.

**Say:** “This prototype helps staff decide where to start a supportive conversation; it does not make decisions about students.”

## Slide 2 — One explainable student view

- One supplied cohort file: 1,000 unique student records and 0 missing cells.
- Six score components: Academic 30%, Attendance 20%, LMS 15%, Placement 20%, Skills 10%, Engagement 5%.
- Component sub-scores use the available indicators; missing top-level components are excluded and the remaining weights are renormalized.
- Feedback and detailed academic, activity, and placement fields remain visible on student profiles for context.

**Say:** “These are transparent prototype weights, not a validated prediction. The supplied file is already cohort-joined; live SIS/LMS connections are not configured.”

## Slide 3 — What the supplied cohort snapshot shows

- Average CGPA: 6.86 / 10; average attendance: 72.0%; average placement readiness: 63.9 / 100.
- Rule-based support bands: 441 high priority, 196 needs attention, and 637 students with at least one support flag.
- Dashboard filters let faculty compare the full cohort with a department, program, or year.

**Say:** “These are descriptive snapshot summaries. A flag asks us to review context—it is not a forecast or a student label.”

## Slide 4 — From signal to human action

1. Filter the cohort and review an attendance, assignment, academic, or placement signal.
2. Open a student profile to see the underlying indicators and risk-rule reasons.
3. Agree a support action, mentor, and follow-up date; track the plan in the prototype.
4. Revisit the student with the relevant faculty member.

**Say:** “The prototype records demo support plans in API memory. It is not a persistent, authenticated case-management system.”

## Slide 5 — Segmentation and explainability

- Rule-based segments surface actionable groups, including strong academics with low placement readiness and low attendance with academic concern.
- Student profiles show component scores, data coverage, strongest/lowest components, and triggered risk reasons.
- Interactive cohort visualizations support comparison without treating groups as permanent student types.

**Say:** “Segments and explanations make the signal inspectable; staff should confirm the evidence and ask the student what support would help.”

## Slide 6 — Evidence, limits, and next step

- The logistic-regression baseline reproduces existing cohort risk labels; it does not predict verified future outcomes.
- Current data has no event dates, so it cannot support multi-semester trends or intervention-effectiveness analysis.
- Before operational use: configure secure, authorized connectors for the college’s actual systems; validate identifiers and data ownership; use historical future outcomes and time-ordered evaluation; add persistent audited intervention storage.

**Demo close:** “The next integration should start with the college’s system of record and LMS, then add attendance and placement sources using a shared Student_ID and agreed refresh schedule.”
