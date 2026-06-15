"""Tests for Excel → module_ra_evaluations sync parser."""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
EXCEL = ROOT / "MODULOS 2025-2 POR RESULTADOS DE APRENDIZAJE.xlsx"
SCRIPT = ROOT / "scripts" / "sync_module_ra_evaluations_from_mapping.py"


def _load_script():
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("sync_mapping", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["sync_mapping"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def sync_mod():
    return _load_script()


@pytest.mark.skipif(not EXCEL.is_file(), reason="Institutional mapping Excel not in workspace")
def test_parse_ra_assignments_count_305(sync_mod):
    rows = sync_mod.parse_ra_assignments(EXCEL)
    assert len(rows) == 305


@pytest.mark.skipif(not EXCEL.is_file(), reason="Institutional mapping Excel not in workspace")
def test_adm17_ce_g1_has_three_ras(sync_mod):
    rows = sync_mod.parse_ra_assignments(EXCEL)
    hit = [r for r in rows if r.course_code == "ADM17" and r.group_name == "1_CE_G1"]
    assert {r.ra_code for r in hit} == {"RA3", "RA4", "RA5"}


def test_build_period_by_ra(sync_mod):
    periods = [
        {"id": 3, "student_outcome": {"code": "RA3"}},
        {"id": 4, "student_outcome": {"code": "RA4"}},
    ]
    lookup = sync_mod.build_period_by_ra(periods)
    assert lookup == {"RA3": 3, "RA4": 4}
