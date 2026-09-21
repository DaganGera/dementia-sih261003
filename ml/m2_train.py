"""Train, calibrate and evaluate M2 on simulator output. Everything written here is tagged Simulated."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

import m2lib as L

VERSION = "m2-ordinal-sim-0.1"


def run(data: str, model_out: str, report_out: str, seed: int = 3) -> dict:
    df = L.load(data)
    parts = L.split_by_person(df, seed)
    norms = L.norms_from(parts["train"])
    tr, ca, te = (L.add_z(parts[k], norms) for k in ("train", "cal", "test"))

    fit = L.fit_ordinal(tr, L.MODEL_FEATURES)
    L.fit_temperature(fit, ca)
    conf = L.conformal_quantiles(fit, ca)
    main = L.evaluate(fit, te, conf)

    y = te["stage"].to_numpy(int)
    freq = np.bincount(tr["stage"].to_numpy(int), minlength=L.STAGES) / len(tr)
    baselines = {"majority class": L.metrics_p(np.tile(freq, (len(te), 1)), y)}

    def refit(name: str, feats: list[str], adjust: bool = True):
        t2, c2, e2 = (L.add_z(parts[k], norms, adjust) for k in ("train", "cal", "test"))
        f = L.fit_ordinal(t2, feats)
        L.fit_temperature(f, c2)
        return name, L.evaluate(f, e2, L.conformal_quantiles(f, c2))

    tests = [
        refit("age only", ["age"]),
        refit("age and schooling", ["age", "schooling"]),
        refit("informant block only", ["informant", "adl"]),
    ]
    baselines.update(dict(tests))
    ablations = dict(
        [
            refit("drop informant block", ["age", "fluency_z", "recall_z", "orientation"]),
            refit("drop cognitive tasks", ["age", "informant", "adl"]),
            refit(
                "no education adjustment",
                ["age", "informant", "adl", "fluency_z", "recall_z", "orientation"],
                adjust=False,
            ),
        ]
    )

    rng = np.random.default_rng(11)
    robust = {}
    for p in (0.1, 0.3, 0.5):
        d = te.copy()
        for c in ("informant", "adl", "fluency_z", "recall_z", "orientation"):
            miss = rng.random(len(d)) < p
            d.loc[miss, c] = fit.mean[fit.features.index(c)]
        robust[f"{int(p * 100)}% of features missing"] = L.evaluate(fit, d, conf)
    d = te.copy()
    for c in ("informant", "adl"):
        d[c] = fit.mean[fit.features.index(c)]
    robust["informant missing entirely"] = L.evaluate(fit, d, conf)
    d = te.copy()
    d["adl"] = (d["adl"] + rng.choice([-1, 1], len(d))).clip(0, 8)
    robust["count noise of plus or minus 1"] = L.evaluate(fit, d, conf)

    fixtures = []
    for i in range(50):
        row = parts["test"].iloc[i]
        P, sets = L.predict_sets(fit, te.iloc[[i]], conf)
        fixtures.append(
            {
                "x": {k: float(row[k]) for k in L.RAW},
                "probs": P[0].tolist(),
                "set": list(range(sets[0][0], sets[0][1] + 1)),
            }
        )

    Path(model_out).parent.mkdir(parents=True, exist_ok=True)
    Path(model_out).write_text(L.export(fit, norms, conf, main, fixtures, VERSION), encoding="utf-8")
    Path(report_out).parent.mkdir(parents=True, exist_ok=True)
    Path(report_out).write_text(
        report(main, baselines, ablations, robust, conf, len(parts["test"])), encoding="utf-8"
    )
    return main


def row(name: str, m: dict) -> str:
    cov = f"{m['coverage']:.3f}" if "coverage" in m else "n/a"
    size = f"{m['mean_set_size']:.2f}" if "mean_set_size" in m else "n/a"
    return (
        f"| {name} | {m['qwk']:.3f} | {m['mae']:.3f} | {m['macro_f1']:.3f} | {m['auroc_mci_or_worse']:.3f} | "
        f"{m['auroc_mild_or_worse']:.3f} | {m['ece']:.3f} | {m['brier']:.3f} | {cov} | {size} |"
    )


def table(rows: dict) -> str:
    head = (
        "| Model | QWK | MAE | Macro-F1 | AUROC MCI or worse | AUROC mild or worse | ECE | Brier | Coverage | Mean set size |\n"
        "|---|---|---|---|---|---|---|---|---|---|\n"
    )
    return head + "\n".join(row(k, v) for k, v in rows.items())


def report(main: dict, baselines: dict, ablations: dict, robust: dict, conf: dict, n_test: int) -> str:
    bands = " | ".join(f"{b}: {main['coverage_by_band'][b]:.3f}" for b in L.BANDS)
    return f"""# M2 evaluation (Simulated)

**Maturity: Simulated.** Trained and tested on synthetic people from `packages/sim`. The simulator draws every instrument
score from the same stage variable the model then predicts, so high scores here are expected and say nothing about real
people. No dataset that needs an application was used. The conformal target is {1 - conf["alpha"]:.0%} coverage.

Test people: {n_test}. Splits are by person (60 train, 20 calibration, 20 test). Norms come from stage 0 training rows only.

## Main model, held-out test

{table({"M2 ordinal logistic with education norms": main})}

Coverage by schooling band (years): {bands}

## Baselines

{table(baselines)}

## Ablations

{table(ablations)}

## Robustness (main model, fixed conformal thresholds)

{table(robust)}

## What this does and does not show

- It shows the pipeline runs end to end: split by person, leakage guard, norms, ordinal fit, temperature, education-stratified conformal sets, export and parity with the TypeScript evaluator.
- It does not show accuracy on real people, on tablet-delivered instruments, or on any North East population.
- Instrument distributions are assumed values in `packages/sim/src/instruments.ts`.
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/data/sim/m2.jsonl")
    ap.add_argument("--model", default="packages/ml/models/m2/m2-ordinal-sim-0.1.json")
    ap.add_argument("--report", default="ml/reports/m2.md")
    a = ap.parse_args()
    m = run(a.data, a.model, a.report)
    print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in m.items() if k != "coverage_by_band"})
