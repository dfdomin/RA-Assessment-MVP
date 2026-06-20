from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_module_review_page_declares_supervision_surface():
    html = read_frontend("module_review.html")

    assert "<title>Revisión de módulo — RA Assessment</title>" in html
    assert 'id="review-status-banner"' in html
    assert 'id="review-summary"' in html
    assert 'id="review-weights"' in html
    assert 'id="review-roster"' in html
    assert 'id="review-grades"' in html
    assert 'id="review-analysis"' in html
    assert 'id="review-status"' in html
    assert 'class="wizard-steps"' not in html
    assert "./js/module_review.js" in html
    assert "./js/supabase-client.js" in html
    assert 'href="./dashboard.html"' in html


def test_module_review_js_loads_evaluation_via_supabase():
    js = read_frontend("js/module_review.js")

    assert 'get("evaluation_id")' in js
    assert 'from("module_ra_evaluations")' in js
    assert 'from("module_ra_evaluation_pi_weights")' in js
    assert 'from("module_students")' in js
    assert 'from("assessments")' in js
    assert 'from("module_analysis")' in js
    assert "verifyReviewAccess" in js
    assert "renderReviewPage" in js
    assert "<input" not in js
    assert "<textarea" not in js
    assert "<select" not in js


def test_module_review_js_status_messages_for_pending_modules():
    js = read_frontend("js/module_review.js")

    assert "pending" in js
    assert "El docente aún no ha enviado este módulo" in js
    assert "Sin registrar" in js
    assert "Sin lista cargada" in js


def test_assessment_redirects_legacy_review_mode_to_module_review():
    js = read_frontend("js/module_assessment.js")

    assert 'params.get("mode") === "review"' in js
    assert "./module_review.html?evaluation_id=" in js
