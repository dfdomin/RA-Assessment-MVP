from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_assessment_page_declares_grading_surface():
    html = read_frontend("assessment.html")

    assert 'id="assessment-status"' in html
    assert 'class="wizard-steps"' in html
    assert html.count('class="wizard-step"') == 5
    assert 'data-step-target="general"' in html
    assert 'data-step-target="roster"' in html
    assert 'data-step-target="grading"' in html
    assert 'data-step-target="analysis"' in html
    assert 'data-step-target="distribution"' not in html
    assert 'data-step-target="submit"' in html
    assert 'id="wizard-next-btn"' in html
    assert 'id="wizard-prev-btn"' in html
    assert 'id="module-summary"' in html
    assert 'id="distribution-body"' in html
    assert 'id="submit-readiness"' in html
    assert 'id="students-body"' in html
    assert 'id="analysis-body"' in html
    assert 'id="roster-body"' in html
    assert 'id="roster-pdf-input"' in html
    assert 'id="roster-preview-btn"' in html
    assert 'id="roster-confirm-btn"' in html
    assert 'id="roster-manual-toggle"' in html
    assert 'id="roster-manual-block"' in html
    assert "¿Necesita agregar estudiantes de forma manual?" in html
    assert 'id="roster-table-hint"' in html
    assert 'id="roster-table-wrap"' in html
    assert 'id="roster-import-notice"' in html
    assert "Excluir" in html
    assert 'id="save-qualitative-btn"' in html
    assert 'id="submit-module-btn"' in html
    assert "./js/module_assessment.js" in html
    assert "./js/supabase-client.js" in html
    assert "./js/api.js" in html


def test_assessment_js_loads_module_data_via_supabase():
    js = read_frontend("js/module_assessment.js")

    assert 'new URLSearchParams(window.location.search)' in js
    assert 'get("evaluation_id")' in js
    assert 'module_ra_evaluations' in js
    assert 'from("module_students")' in js
    assert 'from("assessments")' in js
    assert 'from("module_analysis")' in js
    assert 'fetch("/api/v1/modules/"' not in js


def test_assessment_js_saves_assessments_analysis_and_submit():
    js = read_frontend("js/module_assessment.js")

    assert "collectAssessments" in js or "collectAnalyses" in js
    assert "collectAnalyses" in js
    assert "updateWizardState" in js
    assert "allStudentsFullyGraded" in js or "allActiveStudentsFullyGraded" in js
    assert "allAnalysesComplete" in js
    assert 'module_ra_evaluation_id' in js
    assert "upsert" in js


def test_assessment_js_renders_distribution_and_wizard_navigation():
    js = read_frontend("js/module_assessment.js")

    assert "LEVEL_CRITERIA" in js
    assert "Deficiente" in js
    assert "Sobresaliente" in js
    assert "buildLevelSelectOptions" in js
    assert "course_name" in js
    assert "renderDistribution" in js
    assert "formatDistCell" in js
    assert "exactDistPercent" in js
    assert "renderDistributionChart" in js
    assert "toFixed(2)" in js
    assert 'stepOrder = ["general", "roster", "grading", "analysis", "submit"]' in js
    assert "showStep" in js
    assert 'document.querySelectorAll("[data-step-target]")' in js
    assert 'document.querySelectorAll("[data-step-panel]")' in js
    assert "wizardNextBtn.addEventListener" in js
    assert "wizardPrevBtn.addEventListener" in js


def test_assessment_js_roster_import_and_manual_add():
    js = read_frontend("js/module_assessment.js")

    assert "reloadRosterData" in js
    assert "renderRosterPanel" in js
    assert "handleRosterPreview" in js
    assert "handleRosterConfirm" in js
    assert "addManualStudent" in js
    assert "RaApi.studentsImportPreview" in js
    assert "RaApi.studentsImportConfirm" in js
    assert "roster_position" in js
    assert "canEnterStep" in js
    assert "roster-manual-toggle" in js
    assert "rosterManualBlock" in js
    assert "showRosterNotice" in js
    assert "roster-table-wrap" in js


def test_assessment_shows_leader_contact_on_general_and_submit():
    html = read_frontend("assessment.html")
    js = read_frontend("js/module_assessment.js")

    assert 'id="summary-ra"' in html
    assert 'id="summary-leader"' in html
    assert 'id="summary-leader-email"' in html
    assert 'id="leader-contact-hint"' in html
    assert 'id="submit-leader-notice"' in html
    assert "loadConsolidatorInfo" in js
    assert "renderLeaderContact" in js
    assert "ra_consolidator_assignments" in js
    assert "buildMailtoLink" in js
    assert "unibarranquilla" not in js
