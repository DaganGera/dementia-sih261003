"""M2 staging pipeline pieces. Every artefact is Simulated: trained on simulator output only."""

from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
from statsmodels.miscmodels.ordinal_model import OrderedModel

STAGES = 4
RAW = ["age", "schooling", "literate", "informant", "adl", "fluency", "recall", "orientation"]
MODEL_FEATURES = ["age", "informant", "adl", "fluency_z", "recall_z", "orientation"]
# Columns that would leak the label. The pipeline refuses to train if any is in the feature list.
BLOCKLIST = {"stage", "label", "cdr", "cdr_sob", "diagnosis", "person_id", "synthetic", "sim_version"}
ALPHA = 0.1


def band(schooling: float) -> str:
    if schooling <= 0:
        return "0"
    if schooling <= 4:
        return "1-4"
    if schooling <= 9:
        return "5-9"
    return "10+"


BANDS = ["0", "1-4", "5-9", "10+"]


def load(path: str) -> pd.DataFrame:
    df = pd.read_json(path, lines=True)
    df[RAW] = df[RAW].astype(float)
    df["band"] = df["schooling"].map(band)
    return df


def split_by_person(df: pd.DataFrame, seed: int = 3):
    """60 / 20 / 20 by person id. Every row of a person lands in one split."""
    ids = df["person_id"].unique()
    rng = np.random.default_rng(seed)
    rng.shuffle(ids)
    n = len(ids)
    parts = {
        "train": set(ids[: int(0.6 * n)]),
        "cal": set(ids[int(0.6 * n) : int(0.8 * n)]),
        "test": set(ids[int(0.8 * n) :]),
    }
    out = {k: df[df["person_id"].isin(v)].reset_index(drop=True) for k, v in parts.items()}
    assert (
        not (parts["train"] & parts["cal"])
        and not (parts["train"] & parts["test"])
        and not (parts["cal"] & parts["test"])
    )
    return out


def norms_from(train: pd.DataFrame) -> dict:
    """Education-adjusted norms from stage 0 (no impairment) training rows."""
    ref = train[train["stage"] == 0]
    out = {}
    for b in BANDS:
        sub = ref[ref["band"] == b]
        if len(sub) < 10:
            sub = ref
        out[b] = {
            "fluency": {"mean": float(sub["fluency"].mean()), "sd": float(sub["fluency"].std(ddof=1) or 1.0)},
            "recall": {"mean": float(sub["recall"].mean()), "sd": float(sub["recall"].std(ddof=1) or 1.0)},
        }
    return out


def add_z(df: pd.DataFrame, norms: dict, adjust: bool = True) -> pd.DataFrame:
    df = df.copy()
    for col, key in (("fluency_z", "fluency"), ("recall_z", "recall")):
        if adjust:
            df[col] = [
                (r[key] - norms[r["band"]][key]["mean"]) / norms[r["band"]][key]["sd"]
                for _, r in df.iterrows()
            ]
        else:
            df[col] = df[key]
    return df


@dataclass
class Fit:
    features: list[str]
    mean: np.ndarray
    scale: np.ndarray
    beta: np.ndarray
    thresholds: np.ndarray
    temperature: float = 1.0

    def logits(self, X: np.ndarray) -> np.ndarray:
        return ((X - self.mean) / self.scale) @ self.beta

    def probs(self, X: np.ndarray) -> np.ndarray:
        xb = self.logits(X)
        cum = np.stack([1 / (1 + np.exp(-(t - xb) / self.temperature)) for t in self.thresholds], axis=1)
        cum = np.hstack([np.zeros((len(X), 1)), cum, np.ones((len(X), 1))])
        return np.clip(np.diff(cum, axis=1), 1e-9, 1)


def fit_ordinal(train: pd.DataFrame, features: list[str]) -> Fit:
    assert not (set(features) & BLOCKLIST), "label leakage: blocklisted column in features"
    X = train[features].to_numpy(float)
    mean, scale = X.mean(axis=0), X.std(axis=0)
    scale[scale == 0] = 1.0
    Z = pd.DataFrame((X - mean) / scale, columns=features)
    y = pd.Series(pd.Categorical(train["stage"].to_numpy(int), categories=list(range(STAGES)), ordered=True))
    model = OrderedModel(y, Z, distr="logit")
    res = model.fit(method="bfgs", disp=False, maxiter=500)
    thr = np.asarray(model.transform_threshold_params(res.params))[1:-1]
    return Fit(features, mean, scale, np.asarray(res.params[: len(features)], float), thr)


def fit_temperature(fit: Fit, cal: pd.DataFrame) -> float:
    X = cal[fit.features].to_numpy(float)
    y = cal["stage"].to_numpy(int)

    def nll(t: float) -> float:
        fit.temperature = t
        p = fit.probs(X)
        return float(-np.log(p[np.arange(len(y)), y]).mean())

    best = minimize_scalar(nll, bounds=(0.5, 2.5), method="bounded").x
    fit.temperature = float(best)
    return fit.temperature


def grow(probs: np.ndarray, mass: float) -> tuple[int, int]:
    """Largest nested interval around the mode whose probability mass is at most `mass`.

    The interval always contains the mode. With `mass` set to a calibrated score quantile, a stage is in the
    set exactly when its score is at most the quantile, which gives the split-conformal coverage guarantee.
    """
    lo = hi = int(np.argmax(probs))
    m = float(probs[lo])
    while lo > 0 or hi < len(probs) - 1:
        left = probs[lo - 1] if lo > 0 else -1.0
        right = probs[hi + 1] if hi < len(probs) - 1 else -1.0
        add = float(max(left, right))
        if m + add > mass + 1e-12:
            break
        if left >= right:
            lo -= 1
        else:
            hi += 1
        m += add
    return lo, hi


def score(probs: np.ndarray, y: int) -> float:
    """Mass of the growing interval at the moment it first contains the true stage."""
    lo = hi = int(np.argmax(probs))
    m = float(probs[lo])
    while not (lo <= y <= hi):
        left = probs[lo - 1] if lo > 0 else -1.0
        right = probs[hi + 1] if hi < len(probs) - 1 else -1.0
        if left >= right:
            lo -= 1
            m += float(left)
        else:
            hi += 1
            m += float(right)
    return m


def conformal_quantiles(fit: Fit, cal: pd.DataFrame, alpha: float = ALPHA) -> dict:
    P = fit.probs(cal[fit.features].to_numpy(float))
    y = cal["stage"].to_numpy(int)
    scores = np.array([score(P[i], y[i]) for i in range(len(y))])

    def q(s: np.ndarray) -> float:
        n = len(s)
        level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
        return float(np.quantile(s, level, method="higher"))

    out = {"alpha": alpha, "fallback": q(scores), "bands": {}}
    for b in BANDS:
        s = scores[(cal["band"] == b).to_numpy()]
        out["bands"][b] = q(s) if len(s) >= 30 else out["fallback"]
    return out


def predict_sets(fit: Fit, df: pd.DataFrame, conf: dict):
    P = fit.probs(df[fit.features].to_numpy(float))
    sets = []
    for i, b in enumerate(df["band"]):
        lo, hi = grow(P[i], conf["bands"][b])
        sets.append((lo, hi))
    return P, sets


# ---------- metrics (no sklearn) ----------


def qwk(y: np.ndarray, p: np.ndarray, k: int = STAGES) -> float:
    O = np.zeros((k, k))
    for a, b in zip(y, p):
        O[a, b] += 1
    W = np.array([[(i - j) ** 2 for j in range(k)] for i in range(k)]) / (k - 1) ** 2
    E = np.outer(O.sum(1), O.sum(0)) / O.sum()
    return float(1 - (W * O).sum() / (W * E).sum())


def macro_f1(y: np.ndarray, p: np.ndarray, k: int = STAGES) -> float:
    f = []
    for c in range(k):
        tp = ((y == c) & (p == c)).sum()
        fp = ((y != c) & (p == c)).sum()
        fn = ((y == c) & (p != c)).sum()
        f.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f))


def auroc(pos: np.ndarray, score_: np.ndarray) -> float:
    order = np.argsort(score_)
    ranks = np.empty(len(score_))
    ranks[order] = np.arange(1, len(score_) + 1)
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def ece(P: np.ndarray, y: np.ndarray, bins: int = 15) -> float:
    conf, pred = P.max(1), P.argmax(1)
    edges = np.linspace(0, 1, bins + 1)
    e = 0.0
    for i in range(bins):
        m = (conf > edges[i]) & (conf <= edges[i + 1])
        if m.any():
            e += m.mean() * abs((pred[m] == y[m]).mean() - conf[m].mean())
    return float(e)


def brier(P: np.ndarray, y: np.ndarray) -> float:
    onehot = np.eye(STAGES)[y]
    return float(((P - onehot) ** 2).sum(1).mean())


def metrics_p(P: np.ndarray, y: np.ndarray) -> dict:
    pred = P.argmax(1)
    return {
        "qwk": qwk(y, pred),
        "mae": float(np.abs(y - pred).mean()),
        "macro_f1": macro_f1(y, pred),
        "auroc_mci_or_worse": auroc(y >= 1, P[:, 1:].sum(1)),
        "auroc_mild_or_worse": auroc(y >= 2, P[:, 2:].sum(1)),
        "ece": ece(P, y),
        "brier": brier(P, y),
    }


def evaluate(fit: Fit, df: pd.DataFrame, conf: dict | None = None) -> dict:
    P = fit.probs(df[fit.features].to_numpy(float))
    y = df["stage"].to_numpy(int)
    out = metrics_p(P, y)
    if conf:
        _, sets = predict_sets(fit, df, conf)
        cover = np.array([lo <= t <= hi for (lo, hi), t in zip(sets, y)])
        out["coverage"] = float(cover.mean())
        out["mean_set_size"] = float(np.mean([hi - lo + 1 for lo, hi in sets]))
        out["coverage_by_band"] = {b: float(cover[(df["band"] == b).to_numpy()].mean()) for b in BANDS}
    return out


def export(fit: Fit, norms: dict, conf: dict, metrics: dict, fixtures: list[dict], version: str) -> str:
    return json.dumps(
        {
            "version": version,
            "maturity": "Simulated",
            "data_tag": "sim-0.1",
            "note": "Trained on simulator output only. Says nothing about real people.",
            "raw_features": RAW,
            "features": fit.features,
            "mean": fit.mean.tolist(),
            "scale": fit.scale.tolist(),
            "beta": fit.beta.tolist(),
            "thresholds": fit.thresholds.tolist(),
            "temperature": fit.temperature,
            "norms": norms,
            "conformal": conf,
            "metrics": metrics,
            "fixtures": fixtures,
        },
        indent=1,
    )
