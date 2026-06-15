"""Tests for Excel → program_id mapping parser (backfill script)."""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
EXCEL = ROOT / "MODULOS 2025-2 POR RESULTADOS DE APRENDIZAJE.xlsx"
SCRIPT = ROOT / "scripts" / "backfill_module_program_ids_from_mapping.py"


def _load_script():
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("backfill_mapping", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["backfill_mapping"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def backfill_mod():
    return _load_script()


@pytest.mark.skipif(not EXCEL.is_file(), reason="Institutional mapping Excel not in workspace")
def test_parse_excel_has_206_unique_modules(backfill_mod):
    rows = backfill_mod.parse_mapping_excel(EXCEL)
    assert len(rows) == 206
    keys = {(r.course_code, r.group_name) for r in rows}
    assert len(keys) == 206


@pytest.mark.skipif(not EXCEL.is_file(), reason="Institutional mapping Excel not in workspace")
def test_adm18_ce_group_maps_to_comercio_exterior(backfill_mod):
    rows = backfill_mod.parse_mapping_excel(EXCEL)
    hit = next(r for r in rows if r.course_code == "ADM18" and r.group_name == "1_CE_G2")
    assert hit.program_label == "Comercio Exterior"
    assert hit.sheet == "RA CE TGLI ANI"


def test_program_code_for_label_ani_alias(backfill_mod):
    programs = [
        {"id": 7, "code": "ANI", "name": "Adm. Negocios Internacionales"},
        {"id": 6, "code": "CE", "name": "Comercio Exterior"},
    ]
    assert backfill_mod.program_code_for_label(programs, "Adm. Neg. Internacionales") == "ANI"
    assert backfill_mod.program_code_for_label(programs, "Comercio Exterior") == "CE"


def test_build_program_lookup(backfill_mod):
    rows = [
        backfill_mod.ModuleMappingRow("ADM18", "1_CE_G2", "Comercio Exterior", "RA CE TGLI ANI"),
    ]
    programs = [{"id": 6, "code": "CE", "name": "Comercio Exterior"}]
    lookup, unresolved = backfill_mod.build_program_lookup(rows, programs)
    assert unresolved == []
    assert lookup[("ADM18", "1_CE_G2")] == 6
