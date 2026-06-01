from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_dashboard_declares_modules_progress_surface():
    html = read_frontend("dashboard.html")

    assert 'id="period-select"' in html
    assert 'id="modules-status"' in html
    assert 'id="modules-table"' in html
    assert 'id="modules-body"' in html
    assert 'src="/js/dashboard.js"' in html


def test_dashboard_js_loads_periods_and_modules_with_credentials():
    js = read_frontend("js/dashboard.js")

    assert 'fetch("/api/v1/periods"' in js
    assert '"/api/v1/periods/" + periodId + "/modules"' in js
    assert js.count('credentials: "same-origin"') >= 3
    assert "renderModules" in js


def test_dashboard_js_renders_real_progress_and_actions():
    js = read_frontend("js/dashboard.js")

    assert "students_active" in js
    assert "students_graded" in js
    assert "statusLabel" in js
    assert "Calificar" in js
    assert "Sin módulos asignados" in js


def test_dashboard_js_uses_module_response_contract_names():
    js = read_frontend("js/dashboard.js")

    assert "moduleItem.group_name" in js
    assert "moduleItem.teacher" in js
    assert "moduleItem.teacher.full_name" in js


def test_dashboard_declares_leader_surface_for_s4():
    html = read_frontend("dashboard.html")

    assert 'id="leader-panel"' in html
    assert 'id="period-progress-bar"' in html
    assert 'id="period-progress-text"' in html
    assert 'id="view-report-btn"' in html
    assert 'id="close-period-btn"' in html
    assert 'id="send-reminder-btn"' in html
    assert 'id="leader-analysis-list"' in html
    assert 'id="report-preview"' in html


def test_dashboard_js_loads_leader_analysis_and_report_preview():
    js = read_frontend("js/dashboard.js")

    assert '"/api/v1/periods/" + periodId + "/report/preview"' in js
    assert '"/api/v1/periods/" + periodId + "/leader-analysis"' in js
    assert '"/api/v1/periods/" + periodId + "/action-plan"' in js
    assert '"/api/v1/periods/" + periodId + "/close"' in js
    assert "renderLeaderAnalysis" in js
    assert "saveLeaderAnalysis" in js
    assert "sendReminderBtn" in js


def test_dashboard_js_sends_reminders_to_pending_teachers():
    js = read_frontend("js/dashboard.js")

    assert '"/api/v1/periods/" + periodId + "/tracking"' in js
    assert '"/api/v1/periods/" + currentPeriodId + "/reminders/preview"' in js
    assert '"/api/v1/periods/" + currentPeriodId + "/reminders"' in js
    assert "sendPendingReminders" in js
    assert "recipient_ids" in js
    assert "Se enviaron " in js


def test_dashboard_declares_leader_report_surface_for_f14():
    html = read_frontend("dashboard.html")

    assert 'id="leader-report-form"' in html
    assert 'id="leader-report-list"' in html
    assert 'id="save-leader-report-btn"' in html
    assert 'id="leader-report-pdf-btn"' in html
    assert 'id="leader-report-docx-btn"' in html
    assert 'id="leader-report-status"' in html


def test_dashboard_js_loads_saves_and_exports_leader_report():
    js = read_frontend("js/dashboard.js")

    assert '"/api/v1/periods/" + periodId + "/leader-report"' in js
    assert '"/api/v1/periods/" + currentPeriodId + "/leader-report"' in js
    assert '"/api/v1/periods/" + currentPeriodId + "/leader-report/pdf"' in js
    assert '"/api/v1/periods/" + currentPeriodId + "/leader-report/docx"' in js
    assert "renderLeaderReport" in js
    assert "saveLeaderReport" in js
    assert "conclusion_text" in js
