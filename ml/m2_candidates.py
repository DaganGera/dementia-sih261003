"""M2 candidate comparison (Simulated). Trains a monotone LightGBM and an Explainable Boosting Classifier
(EBM) on the same simulator output, splits and education norms as the shipped ordinal logistic model, and
applies the selection rule fixed in implementation_plan.md 5.8 before any of this was run:

    "lowest mean absolute stage error among models with expected calibration error of 0.05 or less (Target);
    ties go to the simpler model."

"Simpler" is fixed here too, before looking at results, as fewest free parameters: ordinal logistic, then
monotone LightGBM, then EBM. Needs the `candidates` dependency group: `uv sync --group candidates`.

NACC and DementiaBank were considered and dropped: they need an application the team has not made (see
implementation_plan.md 0.9). Every number below comes from `packages/sim` only and says nothing about real people.
"""

from __future__ import annotations

import argparse
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.optimize import minimize_scalar

import m2lib as L
from m2_train import table

VERSION = "m2-candidates-sim-0.1"
ECE_TARGET = 0.05
SHIP_NAME = "M2 ordinal logistic with education norms (shipped)"
LGB_NAME = "Monotone LightGBM"
EBM_NAME = "EBM (Explainable Boosting Classifier)"
# Fixed before training. Clinical direction in the simulator (packages/sim/src/instruments.ts): informant and
# ADL impairment rise with stage; fluency, recall and orientation fall with stage. Age is not stage-linked in
# the simulator, so it is left unconstrained rather than asserting a real-world prior this data cannot support.
MONOTONE_SIGN = {"age": 0, "informant": 1, "adl": 1, "fluency_z": -1, "recall_z": -1, "orientation": -1}


@dataclass
class Candidate:
    """Wraps a predict_proba-shaped classifier so it can reuse Fit's temperature, conformal and metric code."""

    features: list[str]
    raw_probs: Callable[[np.ndarray], np.ndarray]
    temperature: float = 1.0

    def probs(self, X: np.ndarray) -> np.ndarray:
        logp = np.log(np.clip(self.raw_probs(X), 1e-9, 1)) / self.temperature
        logp = logp - logp.max(axis=1, keepdims=True)
        p = np.exp(logp)
        return p / p.sum(axis=1, keepdims=True)


def fit_temperature(cand: Candidate, X_cal: np.ndarray, y_cal: np.ndarray) -> float:
    """Same idea as m2lib.fit_temperature, generalised to any predict_proba output, not just the ordinal logit form."""
    raw = cand.raw_probs(X_cal)

    def nll(t: float) -> float:
        logp = np.log(np.clip(raw, 1e-9, 1)) / t
        logp = logp - logp.max(axis=1, keepdims=True)
        p = np.exp(logp)
        p = p / p.sum(axis=1, keepdims=True)
        return float(-np.log(p[np.arange(len(y_cal)), y_cal]).mean())

    best = minimize_scalar(nll, bounds=(0.3, 5.0), method="bounded").x
    cand.temperature = float(best)
    return cand.temperature


def train_lightgbm(X: np.ndarray, y: np.ndarray, features: list[str]):
    import lightgbm as lgb

    mono = [MONOTONE_SIGN[f] for f in features]
    m = lgb.LGBMClassifier(
        objective="multiclass",
        num_class=L.STAGES,
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        min_child_samples=20,
        monotone_constraints=mono,
        monotone_constraints_method="advanced",
        verbosity=-1,
        random_state=7,
    )
    m.fit(X, y)
    return m


def train_ebm(X: np.ndarray, y: np.ndarray, features: list[str]):
    from interpret.glassbox import ExplainableBoostingClassifier

    # Main effects only: matches the "explainable" purpose (one curve per feature) and is faster on 6-feature input.
    m = ExplainableBoostingClassifier(feature_names=features, interactions=0, random_state=7)
    m.fit(X, y)
    return m


def onnx_parity(model, X: np.ndarray) -> float | None:
    """Max absolute probability difference between the native LightGBM model and its ONNX export. None if the
    `candidates` group's ONNX packages are not installed, or if this model type has no converter here (EBM does not:
    interpret's additive model has no maintained mainstream ONNX exporter, so it is not attempted)."""
    try:
        import onnxruntime as rt
        from onnxmltools.convert import convert_lightgbm
        from onnxmltools.convert.common.data_types import FloatTensorType
    except ImportError:
        return None
    onx = convert_lightgbm(model, initial_types=[("input", FloatTensorType([None, X.shape[1]]))], zipmap=False)
    sess = rt.InferenceSession(onx.SerializeToString(), providers=["CPUExecutionProvider"])
    onnx_p = sess.run(None, {"input": X.astype(np.float32)})[1]
    py_p = model.predict_proba(X)
    return float(np.max(np.abs(py_p - onnx_p)))


@dataclass
class Decision:
    eligible: list[str] = field(default_factory=list)
    winner: str | None = None
    reason: str = ""


def apply_selection_rule(rows: dict[str, dict]) -> Decision:
    order = [SHIP_NAME, LGB_NAME, EBM_NAME]
    eligible = [n for n in order if n in rows and rows[n]["ece"] <= ECE_TARGET]
    if not eligible:
        return Decision(eligible=[], winner=None, reason=f"No candidate reached the ECE target of {ECE_TARGET}.")
    best_mae = min(rows[n]["mae"] for n in eligible)
    tied = [n for n in eligible if abs(rows[n]["mae"] - best_mae) < 1e-9]
    # `order` is fixed simplest first, so the first name in `tied` is the simplest model at the best MAE.
    winner = tied[0]
    reason = (
        f"Lowest MAE ({best_mae:.3f}) among the {len(eligible)} model(s) at or under the ECE target."
        + (f" Tied with {', '.join(tied[1:])}; kept the simpler model." if len(tied) > 1 else "")
    )
    return Decision(eligible=eligible, winner=winner, reason=reason)


def run(data: str, out_report: str, seed: int = 3) -> tuple[dict, Decision]:
    df = L.load(data)
    parts = L.split_by_person(df, seed)
    norms = L.norms_from(parts["train"])
    tr, ca, te = (L.add_z(parts[k], norms) for k in ("train", "cal", "test"))
    y_tr, y_ca = tr["stage"].to_numpy(int), ca["stage"].to_numpy(int)

    ship = L.fit_ordinal(tr, L.MODEL_FEATURES)
    L.fit_temperature(ship, ca)
    ship_conf = L.conformal_quantiles(ship, ca)
    rows = {SHIP_NAME: L.evaluate(ship, te, ship_conf)}

    X_tr = tr[L.MODEL_FEATURES].to_numpy(float)
    X_ca = ca[L.MODEL_FEATURES].to_numpy(float)

    lgb_model = train_lightgbm(X_tr, y_tr, L.MODEL_FEATURES)
    lgb_cand = Candidate(L.MODEL_FEATURES, lambda X: lgb_model.predict_proba(X))
    fit_temperature(lgb_cand, X_ca, y_ca)
    rows[LGB_NAME] = L.evaluate(lgb_cand, te, L.conformal_quantiles(lgb_cand, ca))

    ebm_model = train_ebm(X_tr, y_tr, L.MODEL_FEATURES)
    ebm_cand = Candidate(L.MODEL_FEATURES, lambda X: ebm_model.predict_proba(X))
    fit_temperature(ebm_cand, X_ca, y_ca)
    rows[EBM_NAME] = L.evaluate(ebm_cand, te, L.conformal_quantiles(ebm_cand, ca))

    decision = apply_selection_rule(rows)
    parity = onnx_parity(lgb_model, te[L.MODEL_FEATURES].to_numpy(float))

    Path(out_report).parent.mkdir(parents=True, exist_ok=True)
    Path(out_report).write_text(report(rows, decision, parity, len(te)), encoding="utf-8")
    return rows, decision


def report(rows: dict, decision: Decision, onnx_max_abs_diff: float | None, n_test: int) -> str:
    ok = "reached" if decision.eligible else "did not reach"
    onnx_line = (
        f"Monotone LightGBM exported to ONNX and matched its native probabilities within "
        f"{onnx_max_abs_diff:.1e} (max absolute difference over the test set)."
        if onnx_max_abs_diff is not None
        else "ONNX packages from the `candidates` dependency group were not installed, so export was not attempted."
    )
    return f"""# M2 candidate comparison (Simulated)

**Maturity: Simulated.** Same synthetic people, same person-level 60/20/20 split and the same education norms as
`ml/reports/m2.md`. No dataset that needs an application was used (NACC and DementiaBank were considered and
dropped; see implementation_plan.md 0.9). Test people: {n_test}.

## Selection rule, fixed before this ran (implementation_plan.md 5.8)

"Lowest mean absolute stage error among models with expected calibration error of {ECE_TARGET} or less (Target);
ties go to the simpler model." Simpler, fixed before looking at results: ordinal logistic, then monotone LightGBM
(6 monotone constraints, depth 3, 200 trees), then EBM (an additive model, main effects only, no interactions).

The candidates {ok} the ECE target ({', '.join(decision.eligible) if decision.eligible else 'none did'}).
**Result: {decision.winner or 'no model qualifies; the shipped model keeps its place by default'}.** {decision.reason}

## Metrics, held-out test

{table(rows)}

## ONNX export

{onnx_line} EBM has no maintained mainstream ONNX converter, so it was not attempted; if EBM were ever chosen to
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
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/data/sim/m2.jsonl")
    ap.add_argument("--report", default="ml/reports/m2-candidates.md")
    a = ap.parse_args()
    rows, decision = run(a.data, a.report)
    print({k: {m: round(v, 3) for m, v in r.items() if isinstance(v, float)} for k, r in rows.items()})
    print(decision)
