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
    assert "Cuatrimestres anteriores" in js
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
    assert "teacherPeriodIdsInCycle" in js
    assert "fetchTeacherCycleProgress" in js
    assert "xpModuleTotal" in js
    assert "buildTeacherPeriodSelect" in js
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
    assert 'role="tablist"' in html
    assert 'data-leader-tab="analysis"' in html
    assert 'data-leader-tab="distribution"' in html
    assert "Análisis por PI" in html
    assert "Medición consolidada" in html


def test_dashboard_js_leader_tabs():
    js = read_frontend("js/dashboard.js")

    assert "initLeaderTabs" in js
    assert "setLeaderTab" in js
    assert "data-leader-tab" in js
    assert "ra_leader_tab" in js


def test_dashboard_leader_cover_and_pi_charts():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'data-leader-tab="cover"' in html
    assert 'id="leader-report-cover"' in html
    assert "Portada del informe" in html
    assert "buildLeaderCoverData" in js
    assert "renderLeaderCover" in js
    assert "loadLeaderCover" in js
    assert "appendLeaderPiCharts" in js
    assert "leader-donut" in js
    assert "Leyenda ABET" in js


def test_dashboard_leader_export_uses_client_builder():
    js = read_frontend("js/dashboard.js")

    assert "exportLeaderReportClient" in js
    assert "buildLeaderExportHtml" in js
    assert "exportLeaderReport" in js
    assert "triggerFileDownload" in js


def test_dashboard_leader_autosave_uses_debounce():
    js = read_frontend("js/dashboard.js")

    assert "LEADER_AUTOSAVE_DELAY_MS = 2000" in js
    assert "leaderAnalysisAutosaveTimer" in js
    assert "leaderReportAutosaveTimer" in js
    assert "Guardando automáticamente…" in js
    assert "Guardado automáticamente." in js
    assert "persistLeaderAnalysis" in js
    assert "persistLeaderReport" in js


def test_dashboard_close_period_dialog_and_validations():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'id="close-period-dialog"' in html
    assert 'id="close-period-checklist"' in html
    assert 'id="close-period-force"' in html
    assert "buildPeriodCloseSummary" in js
    assert "openClosePeriodDialog" in js
    assert "executePeriodClose" in js
    assert "period_closed" in js
    assert "forzar el cierre" in html
    assert "showClosePeriodLoadingState" in js
    assert "setClosePeriodButtonLoading" in js
    assert "RaActionButton" in js
    assert "closePeriodDialog.showModal" in js
    assert "action-button.js" in html
    assert "RaActionButton" in js


def test_action_button_helper_exposes_loading_api():
    js = read_frontend("js/action-button.js")

    assert "window.RaActionButton" in js
    assert "aria-busy" in js
    assert "setLoading" in js
    assert "run" in js


def test_dashboard_js_loads_leader_analysis_via_supabase():
    js = read_frontend("js/dashboard.js")

    assert 'from("leader_analysis")' in js
    assert 'from("leader_report_drafts")' in js
    assert 'from("module_analysis")' in js
    assert "renderLeaderAnalysis" in js
    assert "buildLeaderPiReportData" in js
    assert "leader-pi-report" in js
    assert "Análisis de los docentes" in js
    assert "saveLeaderAnalysis" in js
    assert "sendReminderBtn" in js
    assert 'fetch("/api/v1/periods/"' not in js


def test_dashboard_js_sends_reminders_via_reminder_log():
    html = read_frontend("dashboard.html")
    js = read_frontend("js/dashboard.js")

    assert 'id="reminder-dialog"' in html
    assert 'id="reminder-template"' in html
    assert 'from("reminder_log")' in js
    assert "openReminderDialog" in js
    assert "executeReminderSend" in js
    assert "resolveReminderTemplate" in js
    assert "reminder_sent" in js
    assert "{nombre_docente}" in js
    assert "recipient_ids" in js
    assert "buildMailtoUrl" in js
    migration = (ROOT / "supabase/migrations/0021_reminder_log_consolidator_rls.sql").read_text(encoding="utf-8")
    assert "is_period_consolidator" in migration


def test_dashboard_declares_leader_report_surface_for_f14():
    html = read_frontend("dashboard.html")

    assert 'id="leader-report-form"' in html
    assert 'id="leader-report-list"' in html
    assert 'id="save-leader-report-btn"' in html
    assert 'id="leader-report-pdf-btn"' in html
    assert 'id="leader-report-docx-btn"' in html
    assert "Exportar texto" in html
    assert 'id="leader-report-status"' in html


def test_dashboard_js_exports_reports_via_edge_functions():
    js = read_frontend("js/dashboard.js")
    api = read_frontend("js/api.js")

    assert "RaApi.reportAbetPreview" in js
    assert "RaApi.reportAbetExport" in js
    assert "RaApi.reportLeaderExport" in js
    assert "report-abet" in api
    assert "report-leader" in api
    assert "program_id" in api
    assert "currentProgramId" in js
    assert 'reportAbetPreview(Number(periodId), Number(currentProgramId)' in js
    assert 'reportAbetExport(Number(currentPeriodId), Number(currentProgramId)' in js
    assert 'reportLeaderExport(Number(currentPeriodId), Number(currentProgramId)' in js


def test_dashboard_leader_renders_consolidated_distribution_chart():
    js = read_frontend("js/dashboard.js")

    assert "renderConsolidatedDistributionPreview" in js
    assert "renderConsolidatedDistributionChart" in js
    assert "buildConsolidatedDistributionClient" in js
    assert "dist-chart" in js
    assert "Distribución consolidada" in js


def test_dashboard_uses_work_mode_for_leader_periods():
    js = read_frontend("js/dashboard.js")
    assert "isLeaderMode" in js
    assert "isTeacherMode" in js
    assert "leaderPeriodIds" in js
    assert "buildLeaderPeriodSelect" in js
    assert "workMode" in js
    assert "RaRoleMode" in js


def test_dashboard_leader_links_to_module_review_page():
    js = read_frontend("js/dashboard.js")

    assert "./module_review.html?evaluation_id=" in js
    assert "isLeader()" in js


def test_dashboard_teacher_links_to_assessment_page():
    js = read_frontend("js/dashboard.js")

    assert "./assessment.html?evaluation_id=" in js
    assert "./module_review.html?evaluation_id=" in js


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
    assert "currentProgramId = null" in js
    assert "No está asignado como consolidador en este RA" in js


def test_dashboard_treats_consolidator_assignments_as_leader_capability():
    js = read_frontend("js/dashboard.js")

    assert "hasConsolidatorAssignments" in js
    assert "loadConsolidatorCapability" in js
    assert "formatRoleLabel" in js
    assert "docente y líder consolidador" in js
    assert 'from("ra_consolidator_assignments")' in js
    assert "hasConsolidatorAssignments" in js and "isLeader()" in js


def test_leader_program_select_preserves_choice_on_reload():
    js = read_frontend("js/dashboard.js")
    assert "previousProgramId" in js
    assert "stillValid" in js
