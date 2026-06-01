from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_assessment_page_declares_grading_surface():
    html = read_frontend("assessment.html")

    assert 'id="assessment-status"' in html
    assert 'class="wizard-steps"' in html
    assert html.count('class="wizard-step"') >= 5
    assert 'data-step-target="general"' in html
    assert 'data-step-target="grading"' in html
    assert 'data-step-target="distribution"' in html
    assert 'data-step-target="analysis"' in html
    assert 'data-step-target="submit"' in html
    assert 'id="wizard-next-btn"' in html
    assert 'id="wizard-prev-btn"' in html
    assert 'id="module-summary"' in html
    assert 'id="distribution-body"' in html
    assert 'id="submit-readiness"' in html
    assert 'id="students-body"' in html
    assert 'id="analysis-body"' in html
    assert 'id="save-assessments-btn"' in html
    assert 'id="save-qualitative-btn"' in html
    assert 'id="submit-module-btn"' in html
    assert 'src="/js/module_assessment.js"' in html


def test_assessment_js_loads_module_data_with_credentials():
    js = read_frontend("js/module_assessment.js")

    assert 'new URLSearchParams(window.location.search).get("module_id")' in js
    assert '"/api/v1/modules/" + moduleId + "/students"' in js
    assert '"/api/v1/modules/" + moduleId + "/assessments"' in js
    assert '"/api/v1/modules/" + moduleId + "/qualitative"' in js
    assert js.count('credentials: "same-origin"') >= 5


def test_assessment_js_saves_assessments_analysis_and_submit():
    js = read_frontend("js/module_assessment.js")

    assert "collectAssessments" in js
    assert "collectAnalyses" in js
    assert "updateWizardState" in js
    assert "allStudentsFullyGraded" in js
    assert "allAnalysesComplete" in js
    assert 'method: "PUT"' in js
    assert '"/api/v1/modules/" + moduleId + "/submit"' in js
    assert "Módulo enviado" in js
    assert "submitModuleBtn.disabled = !(allStudentsFullyGraded() && allAnalysesComplete())" in js


def test_assessment_js_renders_distribution_and_wizard_navigation():
    js = read_frontend("js/module_assessment.js")

    assert "renderDistribution" in js
    assert "showStep" in js
    assert "studentsResponse.active_perf_indicators" in js
    assert 'document.querySelectorAll("[data-step-target]")' in js
    assert 'document.querySelectorAll("[data-step-panel]")' in js
    assert "wizardNextBtn.addEventListener" in js
    assert "wizardPrevBtn.addEventListener" in js


def test_dashboard_links_to_assessment_page_with_module_id():
    js = read_frontend("js/dashboard.js")

    assert '"/assessment.html?module_id=" + moduleItem.id' in js
