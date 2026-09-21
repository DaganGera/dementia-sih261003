import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

import m2lib as L

ROOT = Path(__file__).resolve().parents[2]


def test_grow_and_score_agree():
    rng = np.random.default_rng(0)
    for _ in range(300):
        p = rng.dirichlet(np.ones(4))
        y = int(rng.integers(0, 4))
        s = L.score(p, y)
        lo, hi = L.grow(p, s)
        assert lo <= y <= hi
        # A smaller threshold that still admits a score below s never shrinks the set below the mode.
        lo0, hi0 = L.grow(p, 0.0)
        assert lo0 == hi0 == int(np.argmax(p))


def test_blocklist_refuses_leaky_features():
    import pandas as pd

    df = pd.DataFrame({"stage": [0, 1, 2, 3], "age": [1, 2, 3, 4]})
    with pytest.raises(AssertionError):
        L.fit_ordinal(df, ["age", "stage"])


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    d = tmp_path_factory.mktemp("m2")
    data = d / "m2.jsonl"
    subprocess.run(
        [
            "pnpm",
            "--filter",
            "@hillpath/sim",
            "exec",
            "tsx",
            "src/cli.ts",
            "m2-data",
            "--n",
            "2400",
            "--out",
            str(data),
        ],
        cwd=ROOT,
        check=True,
        shell=sys.platform == "win32",
    )
    import m2_train

    model = d / "model.json"
    m = m2_train.run(str(data), str(model), str(d / "report.md"))
    return m, json.loads(model.read_text(encoding="utf-8")), data


def test_person_split_has_no_overlap(trained):
    _, _, data = trained
    df = L.load(str(data))
    parts = L.split_by_person(df)
    ids = [set(parts[k]["person_id"]) for k in ("train", "cal", "test")]
    assert not (ids[0] & ids[1]) and not (ids[0] & ids[2]) and not (ids[1] & ids[2])


def test_model_is_useful_and_sets_cover(trained):
    m, model, _ = trained
    assert m["qwk"] > 0.6
    assert m["coverage"] >= 0.86
    assert model["maturity"] == "Simulated"
    for b, c in m["coverage_by_band"].items():
        assert c >= 0.8, b


def test_export_reproduces_fixtures(trained):
    _, model, _ = trained
    beta, thr = np.array(model["beta"]), np.array(model["thresholds"])
    for fx in model["fixtures"]:
        x = fx["x"]
        b = L.band(x["schooling"])
        n = model["norms"][b]
        feats = {
            "age": x["age"],
            "informant": x["informant"],
            "adl": x["adl"],
            "orientation": x["orientation"],
            "fluency_z": (x["fluency"] - n["fluency"]["mean"]) / n["fluency"]["sd"],
            "recall_z": (x["recall"] - n["recall"]["mean"]) / n["recall"]["sd"],
        }
        v = np.array([feats[f] for f in model["features"]])
        xb = ((v - np.array(model["mean"])) / np.array(model["scale"])) @ beta
        cum = [0.0] + [1 / (1 + np.exp(-(t - xb) / model["temperature"])) for t in thr] + [1.0]
        p = np.diff(cum)
        assert np.allclose(p, fx["probs"], atol=1e-6)
