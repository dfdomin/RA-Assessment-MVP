from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_report_leader() -> str:
    return (ROOT / "supabase/functions/report-leader/index.ts").read_text(encoding="utf-8")


def test_report_leader_includes_full_cover_and_pi_sections():
    src = read_report_leader()

    assert "Informe final de medición" in src
    assert "Leyenda ABET" in src
    assert "module_analysis" in src
    assert "teacher_analyses" in src
    assert "renderStackedBars" in src
    assert "buildConicGradient" in src
    assert "Análisis del líder" in src
    assert "Conclusión del informe" in src


def test_report_leader_uses_level_values_1245():
    src = read_report_leader()

    assert "4: \"Adequate\"" in src
    assert "5: \"Exemplary\"" in src
    assert "3: \"Adequate\"" not in src


def test_report_leader_pdf_filename_includes_timestamp():
    src = read_report_leader()

    assert "informe-lider-" in src
    assert "toISOString" in src
