# M2 candidate comparison (Simulated)

**Maturity: Simulated.** Same synthetic people, same person-level 60/20/20 split and the same education norms as
`ml/reports/m2.md`. No dataset that needs an application was used (NACC and DementiaBank were considered and
dropped; see implementation_plan.md 0.9). Test people: 1600.

## Selection rule, fixed before this ran (implementation_plan.md 5.8)

"Lowest mean absolute stage error among models with expected calibration error of 0.05 or less (Target);
ties go to the simpler model." Simpler, fixed before looking at results: ordinal logistic, then monotone LightGBM
(6 monotone constraints, depth 3, 200 trees), then EBM (an additive model, main effects only, no interactions).

The candidates reached the ECE target (M2 ordinal logistic with education norms (shipped), Monotone LightGBM, EBM (Explainable Boosting Classifier)).
**Result: M2 ordinal logistic with education norms (shipped).** Lowest MAE (0.409) among the 3 model(s) at or under the ECE target.

## Metrics, held-out test

| Model | QWK | MAE | Macro-F1 | AUROC MCI or worse | AUROC mild or worse | ECE | Brier | Coverage | Mean set size |
|---|---|---|---|---|---|---|---|---|---|
| M2 ordinal logistic with education norms (shipped) | 0.824 | 0.409 | 0.608 | 0.929 | 0.942 | 0.024 | 0.492 | 0.929 | 2.08 |
| Monotone LightGBM | 0.808 | 0.431 | 0.593 | 0.925 | 0.939 | 0.031 | 0.510 | 0.930 | 2.13 |
| EBM (Explainable Boosting Classifier) | 0.817 | 0.424 | 0.594 | 0.927 | 0.942 | 0.024 | 0.496 | 0.919 | 2.05 |

## ONNX export

Monotone LightGBM exported to ONNX and matched its native probabilities within 2.1e-07 (max absolute difference over the test set). EBM has no maintained mainstream ONNX converter, so it was not attempted; if EBM were ever chosen to
ship, it would need either a converter written for it or shipping the additive model's own lookup tables directly.

## What this does and does not show

- It shows the three model families reach comparable calibration and coverage on this simulator, under a rule
  fixed before training, and that a tree model here can export to ONNX with float32-level parity.
- It does not show which model would perform best on real assessments, on tablet-delivered instruments, or on
  any North East population. The simulator draws every instrument from the same stage variable the models then
  predict, so all three are flattered in the same way; this comparison is about the selection procedure and the
  export path, not a claim that one model is clinically better than another.
- Feature importances and interaction terms are not reported here; a real candidate comparison for shipping would
  add them, plus a stability check across simulator seeds.
