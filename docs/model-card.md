# Model card

Version 0.1, 2026-09-22. Maturity for every model below is stated per model. None has been used with a real person.

## M1: ability estimate and next-level choice

| Item | Detail |
|---|---|
| Purpose | Choose how hard the next round of an activity is, for one person, aiming at about 8 successes in 10 |
| Method | A Gaussian belief over five ability areas with a shared factor. Each trial updates it by assumed-density filtering on a logistic response with a floor at chance. Thompson sampling picks among neighbouring levels. After a hard round it never steps up and prefers a level with 0.85 predicted success. Uncertainty grows between sessions |
| Inputs | Trial outcomes, the design of each round, the number of sessions per activity (practice is discounted) |
| Runs | On the device, in TypeScript, under 1 ms per update |
| Item difficulty weights | Assumed values in `packages/ml/src/games.ts`. They are not fitted to any data |
| Maturity | Implemented. Evaluated on Simulated people only |
| Evaluation | `ml/reports/m1.md`: in-band share 0.399 against 0.152 for the old 80 and 60 percent rule (60 synthetic people, 90 days). With a mismatched response form 0.297 against 0.132. Ability error falls from 0.73 at 20 rounds to 0.50 at 100 |
| Limits | The simulator uses the same response family, so the first result is optimistic. Real people differ in fatigue, mood and device familiarity. A trial that cannot be failed (chance of 1) is ignored |

## M2: screening range

| Item | Detail |
|---|---|
| Purpose | A screening estimate, never a diagnosis: which of four ranges the answers look similar to, with a 90% set |
| Ranges | no impairment, a mild change range (CDR 0.5), a mild dementia range (CDR 1), a moderate or severe range (CDR 2 or more) |
| Method | Proportional-odds logistic regression on age, the family change score, daily-task count, animal fluency and delayed recall as z-scores against people of the same schooling, and orientation. Temperature scaling. Split conformal with thresholds per schooling band |
| Training data | Synthetic people from `packages/sim`, 8,000 rows, split by person. No dataset that needs an application. No real data |
| Maturity | Simulated. Every screen that shows it says so |
| Metrics (held-out synthetic) | QWK 0.824, MAE 0.409, macro-F1 0.608, AUROC 0.929 (mild change or worse) and 0.942 (mild dementia or worse), ECE 0.024, Brier 0.492, coverage 0.929, mean set size 2.08. Age alone has a QWK near zero. See `ml/reports/m2.md` for baselines, ablations and missing-data runs |
| Abstains when | A sudden change was reported in the last 14 days, no check in the last 60 days, no family informant, or a vision or hearing problem is flagged. A positive mood screen shows a caveat |
| Intended use | Prompt a person to ask for a clinical check |
| Out of scope | Diagnosis, insurance, employment, triage without a clinician, use with tablet-delivered instruments as if they were validated |
| Limits | Circular by construction: the simulator draws each instrument from the stage the model predicts. Incorporation bias would also exist with real labels. Education norms reduce, but do not remove, literacy bias |
| Candidates considered | A monotone-constrained LightGBM and an Explainable Boosting Classifier (interpret, main effects only) were trained on the same split and norms, and compared under the selection rule fixed in section 5.8 of the plan: lowest mean absolute stage error among models with an expected calibration error of 0.05 or less, ties to the simpler model. All three cleared the ECE target; the shipped ordinal model had the lowest MAE (0.409 against 0.431 for LightGBM and 0.424 for EBM) and kept its place. `ml/reports/m2-candidates.md`, `ml/m2_candidates.py` |
| ONNX | The LightGBM candidate exports to ONNX and matches its native probabilities to about 2e-7 (max absolute difference). EBM has no maintained mainstream ONNX converter, so that path was left unattempted rather than faked. Neither candidate ships; this is a feasibility check, not a deployment |

## M3: trend, forecast and sudden-change path

| Item | Detail |
|---|---|
| Trend | Local linear trend filter on a weekly composite, with a slope prior by range (assumed values). Forecasts at 3, 6 and 12 months with 80% bands. Under 8 weeks of data the screen says the range reflects typical change |
| Faster than typical | Shown only when the personal slope is steeper than the range's 90th percentile with probability above 0.9 |
| Stage outlook | An assumed transition table, interpolated for 3 and 6 months. Not from data |
| Change points | Bayesian online change-point detection is implemented and tested; the app uses the sudden-change path |
| Sudden change | Two paths. The family checklist (sudden confusion, drowsiness or agitation) always raises a same-day health check. Stroke signs say to call 108. The data rule pools recent play against the previous six weeks and needs a drop of at least 0.2 with z above 3.5 across two or more areas. In simulation, against the current ten-activity roster: 15 of 30 episodes found (was 22 of 30 against the five-activity roster this was first tuned on; see `docs/known-gaps.md` item 9), 0.30 false alarms per stable person-year |
| Acute windows | Excluded from trend estimation in the plan; the trend code has the mask function but the app does not yet open a window automatically |
| Time-of-day pattern (F24) | Bins a person's own sessions by hour into morning, afternoon, evening and night, and flags an evening dip only once both groups have at least 6 sessions. Descriptive only: never feeds the stage estimate or the trend. `packages/ml/src/timeofday.ts`. In simulation (S8_evening personas, 120 days of play): 24 of 30 flagged, 0 of 30 false positives on stable personas |
| Maturity | Simulated |

## M4: explanations

Plain sentences built from the largest exact contributions of the M2 model, with the action ("Please arrange a check with a doctor or health worker."). Wording rules are tested: no "you have", no reassurance, always "not a diagnosis". English only.

## Ethical considerations

Screening can frighten or falsely reassure. The app never says a person is fine. It asks for a clinical check when any range above no impairment is possible, and the abstain rules keep it quiet when a confounder is likely. See `docs/known-gaps.md`.
