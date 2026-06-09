from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_dashboard_declares_modules_progress_surface():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'id="period-select"' in html
    assert 'id="modules-status"' in html
    assert 'id="modules-table"' in html
    assert 'id="modules-body"' in html
    assert 'id="teacher-xp-panel"' in html
    assert 'id="teacher-period-hint"' in html
    assert "Todos mis módulos" in js
    assert 'id="teacher-xp-value"' in html
    assert "./js/dashboard.js" in html
    assert "./js/api.js" in html
    assert "./js/supabase-client.js" in html


def test_dashboard_js_uses_supabase_for_periods_and_modules():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'from("periods")' in js
    assert 'from("module_ra_evaluations")' in js
    assert "ensureSupabase" in js
    assert "renderModules" in js
    assert "syncTeacherXpUi" in js
    assert "teacherCycleProgress" in js
    assert "module-row--completed" in js
    assert "appendXpCell" in js
    assert "computeXpCumulative" in js
    assert 'id="modules-xp-head"' in html
    assert 'fetch("/api/v1/periods"' not in js


def test_dashboard_js_renders_real_progress_and_actions():
    js = read_frontend("js/dashboard.js")

    assert "students_active" in js
    assert "students_graded" in js
    assert "statusLabel" in js
    assert "Calificar" in js
    assert "pickDefaultPeriodId" in js
    assert "filterEvaluationsForRole" in js
    assert "currentUser.id" in js
    assert "Selecciona otro período en el filtro" in js


def test_dashboard_js_uses_module_response_contract_names():
    js = read_frontend("js/dashboard.js")

    assert "group_name" in js
    assert "teacher" in js
    assert "full_name" in js


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


def test_dashboard_js_loads_leader_analysis_via_supabase():
    js = read_frontend("js/dashboard.js")

    assert 'from("leader_analysis")' in js
    assert 'from("action_plans")' in js
    assert 'from("leader_report_drafts")' in js
    assert "renderLeaderAnalysis" in js
    assert "saveLeaderAnalysis" in js
    assert "sendReminderBtn" in js
    assert 'fetch("/api/v1/periods/"' not in js


def test_dashboard_js_sends_reminders_via_reminder_log():
    js = read_frontend("js/dashboard.js")

    assert 'from("reminder_log")' in js
    assert "sendPendingReminders" in js
    assert "recipient_ids" in js


def test_dashboard_declares_leader_report_surface_for_f14():
    html = read_frontend("dashboard.html")

    assert 'id="leader-report-form"' in html
    assert 'id="leader-report-list"' in html
    assert 'id="save-leader-report-btn"' in html
    assert 'id="leader-report-pdf-btn"' in html
    assert 'id="leader-report-docx-btn"' in html
    assert 'id="leader-report-status"' in html


def test_dashboard_js_exports_reports_via_edge_functions():
    js = read_frontend("js/dashboard.js")
    api = read_frontend("js/api.js")

    assert "RaApi.reportAbetPreview" in js
    assert "RaApi.reportAbetExport" in js
    assert "RaApi.reportLeaderExport" in js
    assert "report-abet" in api
    assert "report-leader" in api


def test_dashboard_links_to_assessment_page_with_evaluation_id():
    js = read_frontend("js/dashboard.js")

    assert "./assessment.html?evaluation_id=" in js


def test_dashboard_declares_admin_measurement_panel():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'id="admin-panel"' in html
    assert 'id="admin-lines"' in html
    assert "loadAdminDashboard" in js
    assert "isAdmin" in js
    assert "MEASUREMENT_LINES" in js
    assert "ra_consolidator_assignments" in js


def test_dashboard_hides_modules_panel_for_admin():
    js = read_frontend("js/dashboard.js")

    assert "modulesPanel.hidden = admin" in js
    assert "adminPanel.hidden = !admin" in js


def test_dashboard_leader_scopes_by_program():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'id="program-select"' in html
    assert "currentProgramId" in js
    assert "program_id" in js
    assert "loadLeaderPrograms" in js
