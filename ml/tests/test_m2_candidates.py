"""Needs the `candidates` dependency group (lightgbm, interpret-core, onnxmltools, skl2onnx, onnxruntime):
`uv sync --group candidates`. Skips cleanly without it, so the base test run never needs the heavier packages.
"""

import subprocess
import sys
from pathlib import Path

import pytest

lgb = pytest.importorskip("lightgbm")
pytest.importorskip("interpret")

import m2_candidates as C

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def data(tmp_path_factory):
    d = tmp_path_factory.mktemp("m2c")
    out = d / "m2.jsonl"
    subprocess.run(
        ["pnpm", "--filter", "@hillpath/sim", "exec", "tsx", "src/cli.ts", "m2-data", "--n", "2400", "--out", str(out)],
        cwd=ROOT,
        check=True,
        shell=sys.platform == "win32",
    )
    return out


def test_all_three_models_are_calibrated_and_useful(data, tmp_path):
    rows, decision = C.run(str(data), str(tmp_path / "report.md"))
    assert set(rows) == {C.SHIP_NAME, C.LGB_NAME, C.EBM_NAME}
    for name, m in rows.items():
        assert m["qwk"] > 0.55, name
        assert 0.75 <= m["coverage"] <= 1.0, name
    # The selection rule is meant to be able to say no: if nothing hit the ECE target it must say so, not guess.
    assert decision.winner is None or decision.winner in rows


def test_selection_rule_picks_lowest_mae_at_or_under_the_ece_target():
    rows = {
        C.SHIP_NAME: {"mae": 0.5, "ece": 0.02},
        C.LGB_NAME: {"mae": 0.4, "ece": 0.02},
        C.EBM_NAME: {"mae": 0.3, "ece": 0.08},  # best MAE but fails the ECE target: must not win
    }
    d = C.apply_selection_rule(rows)
    assert d.winner == C.LGB_NAME
    assert C.EBM_NAME not in d.eligible


def test_selection_rule_breaks_a_tie_toward_the_simpler_model():
    rows = {C.SHIP_NAME: {"mae": 0.4, "ece": 0.01}, C.LGB_NAME: {"mae": 0.4, "ece": 0.01}}
    d = C.apply_selection_rule(rows)
    assert d.winner == C.SHIP_NAME


def test_selection_rule_says_no_model_qualifies_rather_than_guessing():
    rows = {C.SHIP_NAME: {"mae": 0.4, "ece": 0.2}}
    d = C.apply_selection_rule(rows)
    assert d.winner is None
    assert d.eligible == []


def test_onnx_export_matches_native_lightgbm_probabilities():
    import numpy as np

    rng = np.random.default_rng(0)
    X = rng.random((100, len(C.MONOTONE_SIGN))).astype(np.float32)
    y = rng.integers(0, 4, 100)
    model = C.train_lightgbm(X, y, list(C.MONOTONE_SIGN))
    diff = C.onnx_parity(model, X)
    assert diff is not None
    assert diff < 1e-4


def test_report_writes_a_labelled_file(data, tmp_path):
    out = tmp_path / "report.md"
    C.run(str(data), str(out))
    text = out.read_text(encoding="utf-8")
    assert "Simulated" in text
    assert "NACC" in text and "DementiaBank" in text
    assert "Selection rule" in text
