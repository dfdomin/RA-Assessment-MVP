(function () {
  "use strict";

  const welcomeMsg = document.getElementById("welcome-msg");
  const logoutBtn = document.getElementById("logout-btn");
  const periodSelect = document.getElementById("period-select");
  const programSelect = document.getElementById("program-select");
  const modulesStatus = document.getElementById("modules-status");
  const modulesBody = document.getElementById("modules-body");
  const leaderPanel = document.getElementById("leader-panel");
  const periodProgressBar = document.getElementById("period-progress-bar");
  const periodProgressText = document.getElementById("period-progress-text");
  const viewReportBtn = document.getElementById("view-report-btn");
  const closePeriodBtn = document.getElementById("close-period-btn");
  const closePeriodDialog = document.getElementById("close-period-dialog");
  const closePeriodForm = document.getElementById("close-period-form");
  const closePeriodIntro = document.getElementById("close-period-intro");
  const closePeriodChecklist = document.getElementById("close-period-checklist");
  const closePeriodPendingWrap = document.getElementById("close-period-pending-wrap");
  const closePeriodPendingList = document.getElementById("close-period-pending-list");
  const closePeriodForceWrap = document.getElementById("close-period-force-wrap");
  const closePeriodForce = document.getElementById("close-period-force");
  const closePeriodConfirm = document.getElementById("close-period-confirm");
  const closePeriodDialogStatus = document.getElementById("close-period-dialog-status");
  const sendReminderBtn = document.getElementById("send-reminder-btn");
  const reminderDialog = document.getElementById("reminder-dialog");
  const reminderForm = document.getElementById("reminder-form");
  const reminderDialogIntro = document.getElementById("reminder-dialog-intro");
  const reminderSelectAll = document.getElementById("reminder-select-all");
  const reminderRecipientList = document.getElementById("reminder-recipient-list");
  const reminderTemplate = document.getElementById("reminder-template");
  const reminderPreviewWrap = document.getElementById("reminder-preview-wrap");
  const reminderPreview = document.getElementById("reminder-preview");
  const reminderMailtoWrap = document.getElementById("reminder-mailto-wrap");
  const reminderMailtoList = document.getElementById("reminder-mailto-list");
  const reminderDialogStatus = document.getElementById("reminder-dialog-status");
  const reminderSendBtn = document.getElementById("reminder-send-btn");
  const reminderHistoryWrap = document.getElementById("reminder-history-wrap");
  const reminderHistoryList = document.getElementById("reminder-history-list");
  const reportPreview = document.getElementById("report-preview");
  const leaderReportCover = document.getElementById("leader-report-cover");
  const leaderAnalysisForm = document.getElementById("leader-analysis-form");
  const leaderAnalysisList = document.getElementById("leader-analysis-list");
  const leaderAnalysisStatus = document.getElementById("leader-analysis-status");
  const leaderReportForm = document.getElementById("leader-report-form");
  const leaderReportList = document.getElementById("leader-report-list");
  const leaderReportStatus = document.getElementById("leader-report-status");
  const leaderReportPdfBtn = document.getElementById("leader-report-pdf-btn");
  const leaderReportDocxBtn = document.getElementById("leader-report-docx-btn");
  const saveLeaderAnalysisBtn = document.getElementById("save-leader-analysis-btn");
  const saveLeaderReportBtn = document.getElementById("save-leader-report-btn");
  const adminPanel = document.getElementById("admin-panel");
  const adminLines = document.getElementById("admin-lines");
  const adminStatus = document.getElementById("admin-status");
  const modogrillaCsvInput = document.getElementById("modogrilla-csv-input");
  const modogrillaCsvApply = document.getElementById("modogrilla-csv-apply");
  const modogrillaCsvResult = document.getElementById("modogrilla-csv-result");
  const modogrillaTeacherSearch = document.getElementById("modogrilla-teacher-search");
  const modogrillaTeachersBody = document.getElementById("modogrilla-teachers-body");
  const modulesPanel = document.getElementById("modules-panel");
  const teacherXpPanel = document.getElementById("teacher-xp-panel");
  const teacherXpValue = document.getElementById("teacher-xp-value");
  const teacherXpBar = document.getElementById("teacher-xp-bar");
  const teacherXpDetail = document.getElementById("teacher-xp-detail");
  const teacherXpCheer = document.getElementById("teacher-xp-cheer");
  const modulesXpHead = document.getElementById("modules-xp-head");
  const teacherPeriodHint = document.getElementById("teacher-period-hint");
  const periodSelectLabel = document.getElementById("period-select-label");
  const workModeSwitcher = document.getElementById("work-mode-switcher");
  const workModeLabel = document.getElementById("work-mode-label");
  const changeRoleBtn = document.getElementById("change-role-btn");
  const leaderTabButtons = Array.from(document.querySelectorAll("[data-leader-tab]"));
  const LEADER_TAB_STORAGE_KEY = "ra_leader_tab";
  const TEACHER_ALL_PERIODS = "all";

  var adminTeachersCache = [];
  var teacherAllCycleId = null;

  const MEASUREMENT_LINES = [
    {
      key: "ce",
      title: "Línea CE — TGLI — ANI",
      blurb: "Comercio Exterior · Logística Internacional · Adm. Negocios Internacionales",
      programMatch: function (name) {
        var n = (name || "").toLowerCase();
        return n.indexOf("comercio") >= 0 || n.indexOf("logíst") >= 0 || n.indexOf("logist") >= 0
          || n.indexOf("negocios intern") >= 0 || n.indexOf("neg. neg") >= 0;
      },
    },
    {
      key: "tga",
      title: "Línea TGA — INE",
      blurb: "TG Administrativa · Inteligencia de Negocios",
      programMatch: function (name) {
        var n = (name || "").toLowerCase();
        return n.indexOf("gestión administrativa") >= 0 || n.indexOf("gestion administrativa") >= 0
          || n.indexOf("tga") >= 0 || n.indexOf("inteligencia de negocios") >= 0;
      },
    },
  ];

  let currentUser = null;
  let hasConsolidatorAssignments = false;
  let hasDualCapability = false;
  let workMode = null;
  let currentPeriodId = "";
  let currentProgramId = "";
  let currentModules = [];
  let currentTrackingRows = [];

  const periodCache = new Map();
  const activePiCache = new Map();
  var leaderAnalysisAutosaveTimer = null;
  var leaderReportAutosaveTimer = null;
  var LEADER_AUTOSAVE_DELAY_MS = 2000;
  var closePeriodSummaryCache = null;
  var closePeriodDialogLoading = false;
  var closePeriodLoadToken = 0;
  var reminderRecipientsCache = [];
  var reminderDialogLoading = false;
  var reminderLoadToken = 0;

  const REMINDER_TEMPLATE_DEFAULT = "Hola {nombre_docente},\n\n"
    + "Le recordamos completar la evaluación del módulo {modulo}. "
    + "Su avance actual es {avance_pct}%.\n"
    + "Quedan {dias_restantes} día(s) para el cierre del período.\n\n"
    + "Ingrese a la aplicación aquí: {login_url}\n\n"
    + "Gracias.";
  const REMINDER_MAX_RECIPIENTS_PER_WINDOW = 15;
  const REMINDER_WINDOW_MS = 60000;

  function actionButton() {
    return window.RaActionButton;
  }

  function redirectToIndex() { window.location.replace("./index.html"); }

  function ensureSupabase() {
    if (typeof supabase === "undefined" || !supabase || !supabase.auth) {
      throw new Error("Supabase client not available.");
    }
    return supabase;
  }

  async function requireSession() {
    const sb = ensureSupabase();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data || !data.session) { redirectToIndex(); return null; }
    return data.session;
  }

  function setStatus(message, kind) {
    modulesStatus.textContent = message;
    modulesStatus.className = "status-message" + (kind ? " " + kind : "");
  }
  function setLeaderAnalysisStatus(message, kind) {
    leaderAnalysisStatus.textContent = message;
    leaderAnalysisStatus.className = "status-message" + (kind ? " " + kind : "");
  }
  function setLeaderReportStatus(message, kind) {
    leaderReportStatus.textContent = message;
    leaderReportStatus.className = "status-message" + (kind ? " " + kind : "");
  }

  function clearLeaderAutosaveTimers() {
    if (leaderAnalysisAutosaveTimer) {
      clearTimeout(leaderAnalysisAutosaveTimer);
      leaderAnalysisAutosaveTimer = null;
    }
    if (leaderReportAutosaveTimer) {
      clearTimeout(leaderReportAutosaveTimer);
      leaderReportAutosaveTimer = null;
    }
  }

  function safeText(value) {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatModuleAnalysisLabel(ev) {
    var code = safeText(ev.course_code);
    var name = ev.course_name ? String(ev.course_name).trim() : "";
    if (name && name !== "—") return "« " + code + " " + name + " »";
    return "« " + code + " »";
  }

  function emptyLevelCounts() {
    var counts = {};
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      counts[level.distKey] = 0;
    });
    return counts;
  }

  function formatLevelPercent(count, activeCount) {
    return String(Math.round(consolidatedDistPercent(count, activeCount))) + "%";
  }

  function statusLabel(status) {
    const labels = { pending: "Pendiente", in_progress: "En progreso", completed: "Completado" };
    return labels[status] || safeText(status);
  }

  function progressText(m) {
    const active = Number(m.students_active || 0);
    const graded = Number(m.students_graded || 0);
    return "Activos: " + active + " | Calificados: " + graded + " | Pendientes: " + Math.max(active - graded, 0);
  }

  function teacherText(m) {
    if (!m.teacher) return "Sin docente";
    return m.teacher.full_name;
  }

  function isLeader() {
    return currentUser && (currentUser.role === "leader" || hasConsolidatorAssignments);
  }
  function isAdmin() { return currentUser && currentUser.role === "admin"; }
  function isTeacher() {
    return currentUser && (currentUser.role === "teacher" || currentUser.role === "leader");
  }

  function isTeacherMode() {
    return workMode === "teacher";
  }

  function isLeaderMode() {
    return workMode === "leader";
  }

  function formatRoleLabel(profile) {
    if (!profile) return "—";
    if (profile.role === "admin") return safeText(profile.role);
    var leader = isLeader();
    var teacher = profile.role === "teacher" || profile.role === "leader";
    if (leader && teacher) return "docente y líder consolidador";
    if (leader) return "líder consolidador";
    return safeText(profile.role);
  }

  async function loadConsolidatorCapability() {
    hasConsolidatorAssignments = false;
    if (!currentUser || isAdmin()) return;
    try {
      var sb = ensureSupabase();
      var res = await sb.from("ra_consolidator_assignments")
        .select("id", { count: "exact", head: true })
        .eq("consolidator_user_id", currentUser.id);
      if (!res.error && Number(res.count || 0) > 0) {
        hasConsolidatorAssignments = true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function applyRoleChrome() {
    var admin = isAdmin();
    if (adminPanel) adminPanel.hidden = !admin;
    if (modulesPanel) modulesPanel.hidden = admin;
    var teacherUi = isTeacherMode() && !admin;
    var leaderUi = isLeaderMode() && !admin;
    if (teacherXpPanel) teacherXpPanel.hidden = !teacherUi;
    if (modulesXpHead) modulesXpHead.hidden = !teacherUi;
    if (teacherPeriodHint) teacherPeriodHint.hidden = !teacherUi;
    if (periodSelectLabel && teacherUi) periodSelectLabel.textContent = "RA / período";
    leaderPanel.hidden = !leaderUi;
    leaderReportPdfBtn.hidden = !leaderUi;
    leaderReportDocxBtn.hidden = !leaderUi;
    if (programSelect) programSelect.hidden = !leaderUi;
    var titleEl = document.getElementById("dashboard-title");
    var modulesTitleEl = document.getElementById("modules-title");
    var modulesSubtitle = modulesPanel && modulesPanel.querySelector(".modules-header .muted");
    if (titleEl) {
      if (admin) titleEl.textContent = "Líder de medición";
      else if (leaderUi) titleEl.textContent = "Consolidación de RA";
      else titleEl.textContent = "Módulos asignados";
    }
    if (modulesTitleEl && leaderUi) modulesTitleEl.textContent = "Módulos del programa";
    else if (modulesTitleEl) modulesTitleEl.textContent = "Progreso por período";
    if (modulesSubtitle && leaderUi) {
      modulesSubtitle.textContent = "Revise cada módulo con «Revisar» antes de interpretar la medición consolidada.";
    } else if (modulesSubtitle) {
      modulesSubtitle.textContent = "Consulta los módulos visibles para tu rol y su avance de calificación.";
    }
    if (leaderUi) restoreLeaderTab();
    renderWorkModeSwitcher();
  }

  function leaderTabPanelId(tabKey) {
    return "leader-tab-" + tabKey;
  }

  function setLeaderTab(tabKey, persist) {
    if (!leaderTabButtons.length) return;
    var valid = leaderTabButtons.some(function (btn) { return btn.dataset.leaderTab === tabKey; });
    if (!valid) tabKey = "tracking";
    leaderTabButtons.forEach(function (btn) {
      var selected = btn.dataset.leaderTab === tabKey;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
    });
    leaderTabButtons.forEach(function (btn) {
      var panel = document.getElementById(leaderTabPanelId(btn.dataset.leaderTab));
      if (!panel) return;
      panel.hidden = btn.dataset.leaderTab !== tabKey;
    });
    if (persist !== false) {
      try { sessionStorage.setItem(LEADER_TAB_STORAGE_KEY, tabKey); } catch (_e) {}
    }
  }

  function restoreLeaderTab() {
    var saved = "tracking";
    try {
      var stored = sessionStorage.getItem(LEADER_TAB_STORAGE_KEY);
      if (stored) saved = stored;
    } catch (_e) {}
    setLeaderTab(saved, false);
  }

  function initLeaderTabs() {
    leaderTabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLeaderTab(btn.dataset.leaderTab);
      });
      btn.addEventListener("keydown", function (event) {
        var idx = leaderTabButtons.indexOf(btn);
        if (event.key === "ArrowRight") {
          event.preventDefault();
          var next = leaderTabButtons[(idx + 1) % leaderTabButtons.length];
          setLeaderTab(next.dataset.leaderTab);
          next.focus();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          var prev = leaderTabButtons[(idx - 1 + leaderTabButtons.length) % leaderTabButtons.length];
          setLeaderTab(prev.dataset.leaderTab);
          prev.focus();
        }
      });
    });
    restoreLeaderTab();
  }

  function renderWorkModeSwitcher() {
    if (!workModeSwitcher || isAdmin()) return;
    workModeSwitcher.hidden = !hasDualCapability;
    if (workModeLabel) {
      workModeLabel.textContent = isLeaderMode()
        ? "Modo: líder consolidador"
        : "Modo: docente";
    }
  }

  function computeXpCumulative(completed, total) {
    var safeTotal = total > 0 ? total : 1;
    var safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
    if (safeCompleted === safeTotal) return 100;
    return Math.round((safeCompleted / safeTotal) * 100);
  }

  function xpPerModuleValue(total) {
    if (total <= 0) return 0;
    return Math.max(Math.round(100 / total), 1);
  }

  function appendXpCell(row, module, cycleModuleTotal) {
    var cell = document.createElement("td");
    if (!isTeacherMode()) {
      cell.textContent = "—";
      row.appendChild(cell);
      return;
    }
    var per = xpPerModuleValue(cycleModuleTotal);
    var span = document.createElement("span");
    span.className = module.status === "completed" ? "module-xp-earned" : "module-xp-pending";
    span.textContent = "🎈 +" + per + " XP";
    cell.appendChild(span);
    row.appendChild(cell);
  }

  async function resolveTeacherCycleId(sb, periodId) {
    if (periodId === TEACHER_ALL_PERIODS && teacherAllCycleId) return teacherAllCycleId;
    if (periodId && periodId !== TEACHER_ALL_PERIODS) {
      var periodRes = await sb.from("periods").select("cycle_id").eq("id", periodId).maybeSingle();
      if (!periodRes.error && periodRes.data) return periodRes.data.cycle_id;
    }
    return null;
  }

  async function fetchTeacherCycleProgress(periodId) {
    var sb = ensureSupabase();
    var cycleId = await resolveTeacherCycleId(sb, periodId);
    return teacherCycleProgress(sb, currentUser.id, cycleId);
  }

  async function teacherCycleProgress(sb, userId, cycleId) {
    var staffRes = await sb.from("module_staff").select("module_id").eq("user_id", userId);
    if (staffRes.error) throw staffRes.error;
    var moduleIds = [];
    (staffRes.data || []).forEach(function (row) {
      if (row.module_id != null) moduleIds.push(row.module_id);
    });
    if (!moduleIds.length) return { total: 0, completed: 0 };
    var evalRes = await sb.from("module_ra_evaluations")
      .select("id, status, period:periods(cycle_id)")
      .in("module_id", moduleIds);
    if (evalRes.error) throw evalRes.error;
    var rows = (evalRes.data || []).filter(function (row) {
      return !cycleId || (row.period && row.period.cycle_id === cycleId);
    });
    return {
      total: rows.length,
      completed: rows.filter(function (row) { return row.status === "completed"; }).length,
    };
  }

  async function syncTeacherXpUi(modules, periodId, cycleProgress) {
    if (!teacherXpPanel) return;
    if (!isTeacherMode()) {
      teacherXpPanel.hidden = true;
      return;
    }
    teacherXpPanel.hidden = false;
    var visibleTotal = modules.length;
    var visibleCompleted = modules.filter(function (m) { return m.status === "completed"; }).length;
    if (!cycleProgress) {
      try {
        await requireSession();
        cycleProgress = await fetchTeacherCycleProgress(periodId);
      } catch (e) {
        console.error(e);
        cycleProgress = { total: visibleTotal, completed: visibleCompleted };
      }
    }
    renderTeacherXpPanel({
      total: cycleProgress.total,
      completed: cycleProgress.completed,
      visibleTotal: visibleTotal,
      visibleCompleted: visibleCompleted,
      viewingAll: periodId === TEACHER_ALL_PERIODS,
    });
  }

  function renderTeacherXpPanel(progress) {
    if (!teacherXpPanel) return;
    var xp = computeXpCumulative(progress.completed, progress.total);
    if (teacherXpValue) teacherXpValue.textContent = String(xp);
    if (teacherXpBar) teacherXpBar.style.width = xp + "%";
    if (teacherXpDetail) {
      if (progress.visibleTotal != null && progress.visibleTotal !== progress.total && !progress.viewingAll) {
        teacherXpDetail.textContent = progress.visibleCompleted + " de " + progress.visibleTotal
          + " en este RA · " + progress.completed + " de " + progress.total + " en el cuatrimestre";
      } else {
        teacherXpDetail.textContent = progress.completed + " de " + progress.total
          + " módulos enviados en el cuatrimestre";
      }
    }
    if (teacherXpCheer) {
      if (progress.total > 0 && progress.completed === progress.total) {
        teacherXpCheer.textContent = "¡Misión cumplida! Completaste todos tus módulos y alcanzaste 100 XP. 🎉✨🏆";
        teacherXpPanel.classList.add("teacher-xp-panel--max");
      } else if (progress.total > 0) {
        var remaining = progress.total - progress.completed;
        teacherXpCheer.textContent = "Sigue sumando XP: te faltan " + remaining
          + (remaining === 1 ? " módulo" : " módulos") + " por enviar.";
        teacherXpPanel.classList.remove("teacher-xp-panel--max");
      } else {
        teacherXpCheer.textContent = "Cuando tengas módulos asignados, cada envío sumará experiencia.";
        teacherXpPanel.classList.remove("teacher-xp-panel--max");
      }
    }
  }

  function setAdminStatus(message, kind) {
    if (!adminStatus) return;
    adminStatus.textContent = message;
    adminStatus.className = "status-message" + (kind ? " " + kind : "");
  }

  function moduleStatsForPeriod(periodId, allEvaluations, programId) {
    var rows = (allEvaluations || []).filter(function (e) {
      if (String(e.period_id) !== String(periodId)) return false;
      if (programId && e.module && String(e.module.program_id) !== String(programId)) return false;
      return true;
    });
    var completed = rows.filter(function (e) { return e.status === "completed"; }).length;
    return { total: rows.length, completed: completed };
  }

  function setModogrillaCsvResult(message, kind) {
    if (!modogrillaCsvResult) return;
    modogrillaCsvResult.textContent = message;
    modogrillaCsvResult.className = "status-message" + (kind ? " " + kind : "");
  }

  function renderModogrillaTeachersTable(filter) {
    if (!modogrillaTeachersBody) return;
    var q = (filter || "").trim().toLowerCase();
    var rows = adminTeachersCache.filter(function (t) {
      if (!q) return true;
      return (t.full_name || "").toLowerCase().indexOf(q) >= 0
        || (t.email || "").toLowerCase().indexOf(q) >= 0;
    });
    modogrillaTeachersBody.innerHTML = "";
    if (!rows.length) {
      modogrillaTeachersBody.innerHTML = "<tr><td colspan=\"3\">Sin docentes.</td></tr>";
      return;
    }
    rows.forEach(function (t) {
      var tr = document.createElement("tr");
      var tdName = document.createElement("td");
      tdName.textContent = t.full_name || "—";
      var tdEmail = document.createElement("td");
      tdEmail.textContent = t.email || "—";
      var tdToggle = document.createElement("td");
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.grid_grading_enabled;
      cb.dataset.userId = t.id;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" Habilitado"));
      tdToggle.appendChild(label);
      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdToggle);
      modogrillaTeachersBody.appendChild(tr);
    });
  }

  async function loadModogrillaTeachers() {
    if (!modogrillaTeachersBody) return;
    try {
      var sb = ensureSupabase();
      var res = await sb.from("users")
        .select("id, full_name, email, role, grid_grading_enabled")
        .eq("role", "teacher")
        .order("full_name");
      if (res.error) throw res.error;
      adminTeachersCache = res.data || [];
      renderModogrillaTeachersTable(modogrillaTeacherSearch && modogrillaTeacherSearch.value);
    } catch (e) {
      modogrillaTeachersBody.innerHTML = "<tr><td colspan=\"3\">Error al cargar docentes.</td></tr>";
    }
  }

  async function updateTeacherGridFlag(userId, enabled) {
    var sb = ensureSupabase();
    var { error } = await sb.from("users")
      .update({ grid_grading_enabled: enabled })
      .eq("id", userId);
    if (error) throw error;
    var row = adminTeachersCache.find(function (t) { return t.id === userId; });
    if (row) row.grid_grading_enabled = enabled;
    await sb.from("security_events").insert({
      event: "modogrilla_teacher_toggle",
      detail: { user_id: userId, grid_grading_enabled: enabled },
    });
  }

  function parseModogrillaCsv(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var header = lines[0].toLowerCase().replace(/^\uFEFF/, "");
    var col = header.indexOf("docente_email") >= 0 ? "docente_email" : header.indexOf("email") >= 0 ? "email" : null;
    if (!col) throw new Error("El CSV debe tener columna docente_email.");
    var start = 1;
    var emails = [];
    for (var i = start; i < lines.length; i++) {
      var parts = lines[i].split(",");
      var email = (parts[0] || "").trim().toLowerCase();
      if (email) emails.push(email);
    }
    return emails;
  }

  async function applyModogrillaCsv(file) {
    setModogrillaCsvResult("Procesando CSV…");
    var text = await file.text();
    var emails = parseModogrillaCsv(text);
    if (!emails.length) {
      setModogrillaCsvResult("El archivo no contiene correos.", "error");
      return;
    }
    var sb = ensureSupabase();
    var ok = 0;
    var errors = [];
    for (var idx = 0; idx < emails.length; idx++) {
      var email = emails[idx];
      var rowNum = idx + 2;
      var lookup = await sb.from("users").select("id, role, email").eq("email", email).maybeSingle();
      if (lookup.error || !lookup.data) {
        errors.push("Fila " + rowNum + ": correo no encontrado — " + email);
        continue;
      }
      if (lookup.data.role !== "teacher") {
        errors.push("Fila " + rowNum + ": no es docente — " + email);
        continue;
      }
      var upd = await sb.from("users").update({ grid_grading_enabled: true }).eq("id", lookup.data.id);
      if (upd.error) {
        errors.push("Fila " + rowNum + ": " + upd.error.message);
        continue;
      }
      ok += 1;
    }
    await sb.from("security_events").insert({
      event: "modogrilla_csv_apply",
      detail: { enabled: ok, failed: errors.length, errors: errors.slice(0, 20) },
    });
    await loadModogrillaTeachers();
    var msg = ok + " docente(s) habilitado(s) para ModoGrilla.";
    if (errors.length) msg += " " + errors.length + " error(es): " + errors.join(" · ");
    setModogrillaCsvResult(msg, errors.length ? "error" : "success");
  }

  async function loadAdminDashboard() {
    if (!adminLines) return;
    adminLines.innerHTML = "<p class=\"muted\">Cargando…</p>";
    setAdminStatus("Cargando panorama del cuatrimestre…");
    try {
      await requireSession();
      var sb = ensureSupabase();
      var cycle = null;
      var cycleRes = await sb.from("measurement_cycles").select("id, code, name").eq("code", "2025-2").maybeSingle();
      if (!cycleRes.error) cycle = cycleRes.data;

      var assignments = [];
      if (cycle) {
        var assignRes = await sb.from("ra_consolidator_assignments")
          .select("program_id, student_outcome_id, program:programs(name), student_outcome:student_outcomes(code), consolidator:users(full_name, email)")
          .eq("cycle_id", cycle.id);
        if (!assignRes.error) assignments = assignRes.data || [];
      }

      var periodsRes = await sb.from("periods").select("id, name, student_outcome_id, student_outcomes(code)").order("name");
      var periods = periodsRes.data || [];
      var evalRes = await sb.from("module_ra_evaluations")
        .select("id, period_id, status, module:modules(program_id)");
      var allEvaluations = evalRes.data || [];

      adminLines.innerHTML = "";
      MEASUREMENT_LINES.forEach(function (line) {
        var card = document.createElement("article");
        card.className = "admin-line-card";
        var heading = document.createElement("header");
        heading.innerHTML = "<h4>" + line.title + "</h4><p class=\"muted\">" + line.blurb + "</p>";
        card.appendChild(heading);

        var list = document.createElement("ul");
        list.className = "admin-ra-list";

        var lineAssignments = assignments.filter(function (a) {
          return line.programMatch(a.program && a.program.name);
        });

        if (!lineAssignments.length) {
          periods.forEach(function (p) {
            var stats = moduleStatsForPeriod(p.id, allEvaluations);
            if (!stats.total) return;
            var raCode = (p.student_outcomes && p.student_outcomes.code) || p.name;
            var li = document.createElement("li");
            li.textContent = raCode + " · " + stats.completed + "/" + stats.total + " módulos completados · líder: pendiente mapeo";
            list.appendChild(li);
          });
        } else {
          lineAssignments.forEach(function (a) {
            var raCode = (a.student_outcome && a.student_outcome.code) || "RA";
            var period = periods.find(function (p) { return p.student_outcome_id === a.student_outcome_id; });
            var stats = period ? moduleStatsForPeriod(period.id, allEvaluations, a.program_id) : { total: 0, completed: 0 };
            var leader = a.consolidator || {};
            var li = document.createElement("li");
            var prog = (a.program && a.program.name) || "Programa";
            li.textContent = prog + " · " + raCode + " — "
              + stats.completed + "/" + stats.total + " módulos · Líder: "
              + safeText(leader.full_name) + " <" + safeText(leader.email) + ">";
            list.appendChild(li);
          });
        }

        if (!list.children.length) {
          var empty = document.createElement("p");
          empty.className = "muted";
          empty.textContent = "Sin mediciones cargadas para esta línea.";
          card.appendChild(empty);
        } else {
          card.appendChild(list);
        }

        var actions = document.createElement("p");
        actions.className = "admin-line-actions muted";
        actions.textContent = "Informe ejecutivo de línea (F17): disponible cuando los informes por RA estén completos.";
        card.appendChild(actions);
        adminLines.appendChild(card);
      });

      var cycleLabel = cycle ? cycle.name : "2025-2";
      if (!assignments.length) {
        setAdminStatus(cycleLabel + " — ejecute scripts/seed_consolidators_from_mapping.py para cargar líderes del Excel.", "info");
      } else {
        setAdminStatus(cycleLabel + " — " + assignments.length + " asignaciones programa×RA cargadas.", "success");
      }
      await loadModogrillaTeachers();
    } catch (e) {
      console.error(e);
      adminLines.innerHTML = "<p class=\"muted\">Error al cargar panorama administrativo.</p>";
      setAdminStatus("Error al cargar consolidación.", "error");
    }
  }

  function selectedPeriodName() {
    const option = periodSelect.options[periodSelect.selectedIndex];
    return option ? option.textContent : "periodo";
  }

  function renderEmpty(message) {
    modulesBody.innerHTML = "";
    const row = document.createElement("tr"), cell = document.createElement("td");
    cell.colSpan = isTeacherMode() ? 8 : 7;
    cell.textContent = message;
    row.appendChild(cell); modulesBody.appendChild(row);
  }

  function updatePeriodProgress(modules) {
    const total = modules.length;
    const completed = modules.filter(function(m) { return m.status === "completed"; }).length;
    periodProgressText.textContent = completed + " de " + total + " (" + (total ? Math.round((completed / total) * 100) : 0) + "%)";
    periodProgressBar.style.width = (total ? Math.round((completed / total) * 100) : 0) + "%";
  }

  function emptyModulesMessage() {
    const periodName = selectedPeriodName();
    if (currentUser && currentUser.role === "teacher") {
      return "Sin módulos asignados en " + periodName + ". Selecciona otro período en el filtro.";
    }
    return "Sin módulos en " + periodName + ".";
  }

  function renderModules(modules, periodId, cycleProgress) {
    currentModules = modules;
    modulesBody.innerHTML = "";
    var resolvedPeriodId = periodId || currentPeriodId;
    syncTeacherXpUi(modules, resolvedPeriodId, cycleProgress);
    updatePeriodProgress(modules);
    var xpModuleTotal = cycleProgress && cycleProgress.total > 0
      ? cycleProgress.total
      : modules.length;
    if (!modules.length) {
      const message = emptyModulesMessage();
      renderEmpty(message);
      setStatus(message, "info");
      return;
    }
    modules.forEach(function(m) {
      const row = document.createElement("tr");
      if (m.status === "completed") row.classList.add("module-row--completed");
      const actionHref = isLeaderMode()
        ? "./module_review.html?evaluation_id=" + m.evaluation_id
        : "./assessment.html?evaluation_id=" + m.evaluation_id;
      [safeText(m.course_name), safeText(m.ra_code), safeText(m.group_name), teacherText(m), statusLabel(m.status), progressText(m)]
        .forEach(function(t) { const c = document.createElement("td"); c.textContent = t; row.appendChild(c); });
      appendXpCell(row, m, xpModuleTotal);
      const ac = document.createElement("td"), a = document.createElement("a");
      a.className = "table-action"; a.href = actionHref;
      a.textContent = isLeaderMode() ? "Revisar" : "Calificar";
      ac.appendChild(a); row.appendChild(ac);
      modulesBody.appendChild(row);
    });
    setStatus("Módulos cargados: " + modules.length + ".", "success");
  }

  async function evaluationHasDraft(client, evaluationId, moduleId) {
    var evRes = await client.from("module_ra_evaluations")
      .select("status, conclusions_text, recommendations_text, preventive_measures_text, corrective_measures_text, improvement_plan_text")
      .eq("id", evaluationId)
      .single();
    var ev = evRes.data;
    if (!ev) return false;
    if (ev.status === "in_progress") return true;
    if (ev.status !== "pending") return false;
    if (ev.conclusions_text || ev.recommendations_text || ev.preventive_measures_text
      || ev.corrective_measures_text || ev.improvement_plan_text) return true;
    var w = await client.from("module_ra_evaluation_pi_weights")
      .select("id", { count: "exact", head: true })
      .eq("module_ra_evaluation_id", evaluationId);
    if (Number(w.count) > 0) return true;
    var ms = await client.from("module_students").select("id").eq("module_id", moduleId).eq("status", "active");
    var msIds = (ms.data || []).map(function (r) { return r.id; });
    if (!msIds.length) return false;
    var a = await client.from("assessments")
      .select("id", { count: "exact", head: true })
      .in("module_student_id", msIds);
    if (Number(a.count) > 0) return true;
    var ma = await client.from("module_analysis")
      .select("id", { count: "exact", head: true })
      .eq("module_ra_evaluation_id", evaluationId);
    return Number(ma.count) > 0;
  }

  async function teacherPeriodIsDone(client, periodId, userId) {
    var rows = await client.from("module_ra_evaluations")
      .select("id, status, module:modules!inner(id, module_staff!inner(user_id))")
      .eq("period_id", periodId)
      .eq("module_staff.user_id", userId);
    var evals = rows.data || [];
    if (!evals.length) return true;
    for (var i = 0; i < evals.length; i++) {
      var row = evals[i];
      if (row.status !== "completed") {
        if (row.status === "pending" || row.status === "in_progress") {
          if (await evaluationHasDraft(client, row.id, row.module.id)) return false;
          return false;
        }
        return false;
      }
    }
    return true;
  }

  async function assignedProgramIdsForPeriod(periodId) {
    var sb = ensureSupabase();
    var periodRes = await sb.from("periods").select("student_outcome_id, cycle_id").eq("id", periodId).single();
    if (!periodRes.data) return [];
    var period = periodRes.data;
    var q = sb.from("ra_consolidator_assignments")
      .select("program_id")
      .eq("consolidator_user_id", currentUser.id)
      .eq("student_outcome_id", period.student_outcome_id);
    if (period.cycle_id) q = q.eq("cycle_id", period.cycle_id);
    var res = await q;
    return (res.data || []).map(function (r) { return r.program_id; });
  }

  async function piHasGradedStudentsInProgram(client, periodId, programId, piId) {
    var evalsRes = await client.from("module_ra_evaluations")
      .select("module:modules!inner(id)")
      .eq("period_id", periodId)
      .eq("modules.program_id", programId);
    var moduleIds = (evalsRes.data || []).map(function (r) { return r.module.id; });
    if (!moduleIds.length) return false;
    for (var i = 0; i < moduleIds.length; i++) {
      var graded = await countGraded(moduleIds[i], [piId]);
      if (graded > 0) return true;
    }
    return false;
  }

  async function leaderProgramPeriodIsDone(client, periodId, programId) {
    var evalsRes = await client.from("module_ra_evaluations")
      .select("id, status, module:modules!inner(program_id)")
      .eq("period_id", periodId)
      .eq("modules.program_id", programId);
    var evals = evalsRes.data || [];
    if (!evals.length) return true;
    if (evals.some(function (e) { return e.status !== "completed"; })) return false;
    var piIds = await getActivePis(periodId);
    var pisNeedingAnalysis = [];
    for (var i = 0; i < piIds.length; i++) {
      if (await piHasGradedStudentsInProgram(client, periodId, programId, piIds[i])) {
        pisNeedingAnalysis.push(piIds[i]);
      }
    }
    if (!pisNeedingAnalysis.length) return true;
    var la = await client.from("leader_analysis")
      .select("perf_indicator_id, analysis_text")
      .eq("period_id", periodId)
      .eq("program_id", programId);
    var map = {};
    (la.data || []).forEach(function (r) { map[r.perf_indicator_id] = (r.analysis_text || "").trim(); });
    for (var j = 0; j < pisNeedingAnalysis.length; j++) {
      if (!map[pisNeedingAnalysis[j]]) return false;
    }
    return true;
  }

  async function leaderPeriodIsDone(client, periodId, programIds) {
    if (!programIds.length) return true;
    for (var i = 0; i < programIds.length; i++) {
      if (!(await leaderProgramPeriodIsDone(client, periodId, programIds[i]))) return false;
    }
    return true;
  }

  async function getLeaderAnalysisGapList(client, periodId, programId) {
    var pis = await getActivePisFull(periodId);
    var gaps = [];
    var la = await client.from("leader_analysis")
      .select("perf_indicator_id, analysis_text")
      .eq("period_id", periodId)
      .eq("program_id", programId);
    var map = {};
    (la.data || []).forEach(function (r) { map[r.perf_indicator_id] = (r.analysis_text || "").trim(); });
    for (var i = 0; i < pis.length; i++) {
      var pi = pis[i];
      if (await piHasGradedStudentsInProgram(client, periodId, programId, pi.id)) {
        if (!map[pi.id]) gaps.push({ id: pi.id, code: pi.code, description: pi.description });
      }
    }
    return gaps;
  }

  async function buildPeriodCloseSummary(periodId, programId) {
    const sb = ensureSupabase();
    const period = await getPeriod(periodId);
    const { data: evalRows, error } = await sb
      .from("module_ra_evaluations")
      .select("id, status, module:modules(id, course_name, group_name, program_id, program:programs(name), module_staff(user_id, users(full_name)))")
      .eq("period_id", periodId);
    if (error) throw error;

    const modules = (evalRows || []).map(function (row) {
      const mod = row.module || {};
      const staff = mod.module_staff || [];
      const teacherNames = staff
        .map(function (s) { return s.users && s.users.full_name; })
        .filter(Boolean)
        .join(", ");
      return {
        evaluation_id: row.id,
        status: row.status,
        course_name: mod.course_name,
        group_name: mod.group_name,
        program_id: mod.program_id,
        program_name: mod.program && mod.program.name,
        teacher_names: teacherNames || "—",
        inCurrentProgram: String(mod.program_id) === String(programId),
      };
    });

    const pendingAll = modules.filter(function (m) { return m.status !== "completed"; });
    const pendingProgram = pendingAll.filter(function (m) { return m.inCurrentProgram; });
    const programModules = modules.filter(function (m) { return m.inCurrentProgram; });
    const completedAll = modules.length - pendingAll.length;
    const completedProgram = programModules.length - pendingProgram.length;
    const leaderAnalysisGaps = await getLeaderAnalysisGapList(sb, periodId, programId);
    const program = programSelect && programSelect.selectedOptions.length
      ? programSelect.selectedOptions[0].textContent
      : "su programa";

    return {
      periodId: periodId,
      periodName: period && period.name,
      periodStatus: period && period.status,
      raCode: period && period.student_outcomes && period.student_outcomes.code,
      programName: program,
      totalModules: modules.length,
      completedModules: completedAll,
      programModuleTotal: programModules.length,
      programModuleCompleted: completedProgram,
      pendingAll: pendingAll,
      pendingProgram: pendingProgram,
      leaderAnalysisGaps: leaderAnalysisGaps,
      canCloseClean: pendingAll.length === 0 && leaderAnalysisGaps.length === 0,
    };
  }

  function setClosePeriodDialogStatus(message, kind) {
    if (!closePeriodDialogStatus) return;
    closePeriodDialogStatus.textContent = message || "";
    closePeriodDialogStatus.className = "status-message" + (kind ? " " + kind : "");
  }

  function setClosePeriodButtonLoading(loading) {
    closePeriodDialogLoading = loading;
    if (!closePeriodBtn || !actionButton()) return;
    actionButton().setLoading(closePeriodBtn, loading, "Cargando…");
    if (!loading) updateClosePeriodButtonState(currentPeriodId);
  }

  function showClosePeriodLoadingState() {
    closePeriodSummaryCache = null;
    if (closePeriodDialog) closePeriodDialog.classList.add("is-loading");
    if (closePeriodIntro) {
      closePeriodIntro.textContent = "Preparando validaciones del período. Esto puede tardar unos segundos.";
    }
    if (closePeriodChecklist) closePeriodChecklist.innerHTML = "";
    if (closePeriodPendingWrap) closePeriodPendingWrap.hidden = true;
    if (closePeriodPendingList) closePeriodPendingList.innerHTML = "";
    if (closePeriodForceWrap) closePeriodForceWrap.hidden = true;
    if (closePeriodForce) closePeriodForce.checked = false;
    if (closePeriodConfirm) closePeriodConfirm.disabled = true;
    setClosePeriodDialogStatus("Cargando validaciones…", "info");
  }

  function clearClosePeriodLoadingState() {
    if (closePeriodDialog) closePeriodDialog.classList.remove("is-loading");
  }

  function syncClosePeriodConfirmState() {
    if (!closePeriodConfirm || !closePeriodSummaryCache) return;
    var forceChecked = closePeriodForce && closePeriodForce.checked;
    var canConfirm = closePeriodSummaryCache.canCloseClean || forceChecked;
    closePeriodConfirm.disabled = !canConfirm;
  }

  function renderClosePeriodDialog(summary) {
    clearClosePeriodLoadingState();
    closePeriodSummaryCache = summary;
    if (!closePeriodIntro || !closePeriodChecklist) return;

    if (summary.periodStatus === "closed") {
      closePeriodIntro.textContent = "Este período ya está cerrado. Los docentes ya no pueden modificar calificaciones.";
      closePeriodChecklist.innerHTML = "";
      if (closePeriodPendingWrap) closePeriodPendingWrap.hidden = true;
      if (closePeriodForceWrap) closePeriodForceWrap.hidden = true;
      if (closePeriodConfirm) closePeriodConfirm.disabled = true;
      return;
    }

    closePeriodIntro.textContent = "Va a cerrar el período "
      + safeText(summary.periodName) + " del RA " + safeText(summary.raCode)
      + ". Esto bloquea la edición de calificaciones para todos los programas de este RA.";

    closePeriodChecklist.innerHTML = "";
    [
      {
        ok: summary.pendingAll.length === 0,
        text: "Módulos completados en todo el RA: " + summary.completedModules + " de " + summary.totalModules,
      },
      {
        ok: summary.pendingProgram.length === 0,
        text: "Módulos completados en " + safeText(summary.programName) + ": "
          + summary.programModuleCompleted + " de " + summary.programModuleTotal,
      },
      {
        ok: summary.leaderAnalysisGaps.length === 0,
        text: summary.leaderAnalysisGaps.length === 0
          ? "Análisis del líder por PI: completo"
          : "Análisis del líder por PI: faltan " + summary.leaderAnalysisGaps.length + " indicador(es)",
      },
    ].forEach(function (item) {
      var li = document.createElement("li");
      li.className = item.ok ? "is-ok" : "is-warn";
      li.textContent = (item.ok ? "✓ " : "⚠ ") + item.text;
      closePeriodChecklist.appendChild(li);
    });

    if (summary.leaderAnalysisGaps.length) {
      var gapLi = document.createElement("li");
      gapLi.className = "is-warn";
      gapLi.textContent = "Pendientes: " + summary.leaderAnalysisGaps.map(function (g) { return g.code; }).join(", ");
      closePeriodChecklist.appendChild(gapLi);
    }

    var pendingToShow = summary.pendingAll.length ? summary.pendingAll : summary.pendingProgram;
    if (closePeriodPendingWrap && closePeriodPendingList) {
      if (pendingToShow.length) {
        closePeriodPendingWrap.hidden = false;
        closePeriodPendingList.innerHTML = "";
        pendingToShow.forEach(function (mod) {
          var li = document.createElement("li");
          li.textContent = safeText(mod.course_name) + " · " + safeText(mod.group_name)
            + " · " + safeText(mod.program_name) + " · " + safeText(mod.teacher_names)
            + " · " + statusLabel(mod.status);
          closePeriodPendingList.appendChild(li);
        });
      } else {
        closePeriodPendingWrap.hidden = true;
        closePeriodPendingList.innerHTML = "";
      }
    }

    if (closePeriodForceWrap && closePeriodForce) {
      var needsForce = !summary.canCloseClean;
      closePeriodForceWrap.hidden = !needsForce;
      closePeriodForce.checked = false;
    }
    setClosePeriodDialogStatus(
      summary.canCloseClean
        ? "Todo listo. Puede cerrar el período con seguridad."
        : "Revise los pendientes. Si aún así desea cerrar, marque la casilla de confirmación forzada.",
      summary.canCloseClean ? "success" : "info"
    );
    syncClosePeriodConfirmState();
  }

  async function openClosePeriodDialog() {
    if (!closePeriodDialog || !currentPeriodId) return;
    if (closePeriodDialogLoading) return;
    if (closePeriodDialog.open) return;
    if (!currentProgramId) {
      setStatus("Seleccione un programa antes de cerrar el período.", "error");
      return;
    }

    var loadToken = ++closePeriodLoadToken;
    setClosePeriodButtonLoading(true);
    showClosePeriodLoadingState();
    if (typeof closePeriodDialog.showModal === "function") closePeriodDialog.showModal();

    try {
      await requireSession();
      if (loadToken !== closePeriodLoadToken) return;
      const summary = await buildPeriodCloseSummary(Number(currentPeriodId), Number(currentProgramId));
      if (loadToken !== closePeriodLoadToken) return;
      renderClosePeriodDialog(summary);
      setClosePeriodButtonLoading(false);
      await updateClosePeriodButtonState(currentPeriodId);
    } catch (e) {
      console.error(e);
      if (loadToken !== closePeriodLoadToken) return;
      clearClosePeriodLoadingState();
      if (closePeriodDialog && typeof closePeriodDialog.close === "function") closePeriodDialog.close();
      setClosePeriodButtonLoading(false);
      await updateClosePeriodButtonState(currentPeriodId);
      setStatus("No se pudo preparar el cierre del período.", "error");
    }
  }

  async function executePeriodClose(force) {
    if (!currentPeriodId || !currentProgramId || !closePeriodSummaryCache) return;
    const sb = ensureSupabase();
    const pendingSnapshot = (closePeriodSummaryCache.pendingAll || []).map(function (mod) {
      return {
        evaluation_id: mod.evaluation_id,
        course_name: mod.course_name,
        group_name: mod.group_name,
        program_name: mod.program_name,
        status: mod.status,
      };
    });
    const { error: periodError } = await sb
      .from("periods")
      .update({ status: "closed" })
      .eq("id", Number(currentPeriodId));
    if (periodError) throw periodError;
    await sb.from("security_events").insert({
      event: "period_closed",
      user_id: currentUser ? currentUser.id : null,
      severity: force ? "WARN" : "INFO",
      detail: {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        force: force,
        pending_modules: pendingSnapshot,
        leader_analysis_gaps: (closePeriodSummaryCache.leaderAnalysisGaps || []).map(function (g) { return g.code; }),
      },
    });
    periodCache.delete(Number(currentPeriodId));
    if (closePeriodDialog && typeof closePeriodDialog.close === "function") closePeriodDialog.close();
    setStatus(force ? "Período cerrado con advertencia (había pendientes)." : "Período cerrado correctamente.", "success");
    await loadPeriods();
  }

  async function updateClosePeriodButtonState(periodId) {
    if (!closePeriodBtn || !isLeaderMode()) return;
    if (closePeriodDialogLoading) return;
    if (!periodId || periodId === TEACHER_ALL_PERIODS) {
      closePeriodBtn.disabled = true;
      return;
    }
    try {
      const period = await getPeriod(periodId);
      closePeriodBtn.disabled = !period || period.status === "closed";
      closePeriodBtn.title = period && period.status === "closed"
        ? "El período ya está cerrado"
        : "Cerrar el período de captura del RA";
    } catch (e) {
      closePeriodBtn.disabled = false;
    }
  }

  async function pickFirstPendingPeriodId(orderedPeriods, mode) {
    var client = ensureSupabase();
    for (var i = 0; i < orderedPeriods.length; i++) {
      var p = orderedPeriods[i];
      var done = false;
      if (mode === "teacher") {
        done = await teacherPeriodIsDone(client, p.id, currentUser.id);
      } else {
        var programIds = await assignedProgramIdsForPeriod(p.id);
        done = await leaderPeriodIsDone(client, p.id, programIds);
      }
      if (!done) return String(p.id);
    }
    return "";
  }

  async function resolveDefaultPeriodId(periodPool, mode) {
    if (!periodPool.length) return "";
    var pending = await pickFirstPendingPeriodId(periodPool, mode);
    if (pending) return pending;
    return String(periodPool[0].id);
  }

  async function teacherPeriodIds() {
    if (!currentUser || !isTeacherMode()) return new Set();
    const { data, error } = await ensureSupabase()
      .from("module_staff")
      .select("module_id, modules!inner(module_ra_evaluations(period_id))")
      .eq("user_id", currentUser.id);
    if (error) throw error;
    const ids = new Set();
    (data || []).forEach(function (row) {
      var evals = row.modules && row.modules.module_ra_evaluations;
      (evals || []).forEach(function (ev) {
        if (ev.period_id != null) ids.add(String(ev.period_id));
      });
    });
    return ids;
  }

  async function leaderPeriodIds() {
    if (!currentUser || !isLeaderMode()) return new Set();
    const sb = ensureSupabase();
    const activeCycle = await getActiveMeasurementCycle(sb);
    let assignQuery = sb.from("ra_consolidator_assignments")
      .select("program_id, student_outcome_id, cycle_id")
      .eq("consolidator_user_id", currentUser.id);
    if (activeCycle) assignQuery = assignQuery.eq("cycle_id", activeCycle.id);
    const { data: assigns, error } = await assignQuery;
    if (error) throw error;
    const ids = new Set();
    for (var i = 0; i < (assigns || []).length; i++) {
      var a = assigns[i];
      const { data: periods } = await sb.from("periods")
        .select("id")
        .eq("student_outcome_id", a.student_outcome_id)
        .eq("cycle_id", a.cycle_id);
      for (var j = 0; j < (periods || []).length; j++) {
        var p = periods[j];
        const { data: evals } = await sb.from("module_ra_evaluations")
          .select("id, module:modules!inner(program_id)")
          .eq("period_id", p.id)
          .eq("modules.program_id", a.program_id)
          .limit(1);
        if (evals && evals.length) ids.add(String(p.id));
      }
    }
    return ids;
  }

  async function teacherPeriodIdsInCycle(cycleId) {
    var allIds = await teacherPeriodIds();
    if (!allIds || !allIds.size || !cycleId) return allIds || new Set();
    var res = await ensureSupabase()
      .from("periods")
      .select("id")
      .eq("cycle_id", cycleId)
      .in("id", Array.from(allIds));
    if (res.error) throw res.error;
    var ids = new Set();
    (res.data || []).forEach(function (row) {
      if (row.id != null) ids.add(String(row.id));
    });
    return ids;
  }

  async function getActiveMeasurementCycle(sb) {
    var openRes = await sb.from("measurement_cycles")
      .select("id, code, name")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!openRes.error && openRes.data) return openRes.data;
    var fallbackRes = await sb.from("measurement_cycles")
      .select("id, code, name")
      .eq("code", "2025-2")
      .maybeSingle();
    if (!fallbackRes.error && fallbackRes.data) return fallbackRes.data;
    return null;
  }

  function appendPeriodOptions(container, periodList) {
    periodList.forEach(function (p) {
      container.appendChild(new Option(p.name, p.id));
    });
  }

  function buildTeacherPeriodSelect(periods, periodIdsWithData, activeCycle) {
    periodSelect.innerHTML = "";
    teacherAllCycleId = activeCycle ? activeCycle.id : null;
    var teacherPeriods = periods.filter(function (p) {
      return periodIdsWithData.has(String(p.id));
    });
    if (!teacherPeriods.length) {
      periodSelect.appendChild(new Option("Sin módulos asignados", ""));
      periodSelect.disabled = true;
      return { defaultPool: [] };
    }
    var currentCyclePeriods = activeCycle
      ? teacherPeriods.filter(function (p) { return p.cycle_id === activeCycle.id; })
      : teacherPeriods.slice();
    var archivePeriods = activeCycle
      ? teacherPeriods.filter(function (p) { return p.cycle_id !== activeCycle.id; })
      : [];

    if (currentCyclePeriods.length) {
      var currentGroup = document.createElement("optgroup");
      currentGroup.label = activeCycle ? (activeCycle.name || activeCycle.code) : "Cuatrimestre actual";
      appendPeriodOptions(currentGroup, currentCyclePeriods);
      if (currentCyclePeriods.length > 1) {
        currentGroup.appendChild(new Option(
          "Todos mis módulos (" + (activeCycle ? activeCycle.code : "cuatrimestre") + ")",
          TEACHER_ALL_PERIODS
        ));
      }
      periodSelect.appendChild(currentGroup);
    }
    if (archivePeriods.length) {
      var archiveGroup = document.createElement("optgroup");
      archiveGroup.label = "Cuatrimestres anteriores";
      appendPeriodOptions(archiveGroup, archivePeriods);
      periodSelect.appendChild(archiveGroup);
    }
    periodSelect.disabled = false;
    var defaultPool = currentCyclePeriods.length ? currentCyclePeriods : teacherPeriods;
    return { defaultPool: defaultPool };
  }

  function buildLeaderPeriodSelect(periods, periodIdsWithData, activeCycle) {
    periodSelect.innerHTML = "";
    var leaderPeriods = periods.filter(function (p) {
      return periodIdsWithData.has(String(p.id));
    });
    if (!leaderPeriods.length) {
      periodSelect.appendChild(new Option("Sin RAs de consolidación", ""));
      periodSelect.disabled = true;
      return { defaultPool: [] };
    }
    var currentCyclePeriods = activeCycle
      ? leaderPeriods.filter(function (p) { return p.cycle_id === activeCycle.id; })
      : leaderPeriods.slice();
    var archivePeriods = activeCycle
      ? leaderPeriods.filter(function (p) { return p.cycle_id !== activeCycle.id; })
      : [];
    if (currentCyclePeriods.length) {
      var currentGroup = document.createElement("optgroup");
      currentGroup.label = activeCycle ? (activeCycle.name || activeCycle.code) : "Cuatrimestre actual";
      appendPeriodOptions(currentGroup, currentCyclePeriods);
      periodSelect.appendChild(currentGroup);
    }
    if (archivePeriods.length) {
      var archiveGroup = document.createElement("optgroup");
      archiveGroup.label = "Cuatrimestres anteriores";
      appendPeriodOptions(archiveGroup, archivePeriods);
      periodSelect.appendChild(archiveGroup);
    }
    periodSelect.disabled = false;
    var defaultPool = currentCyclePeriods.length ? currentCyclePeriods : leaderPeriods;
    return { defaultPool: defaultPool };
  }

  async function periodsWithModules() {
    const { data, error } = await ensureSupabase().from("module_ra_evaluations").select("period_id");
    if (error) throw error;
    const ids = new Set();
    (data || []).forEach(function (row) {
      if (row.period_id != null) ids.add(String(row.period_id));
    });
    return ids;
  }

  function pickDefaultPeriodId(periods, periodIdsWithData) {
    if (!periods.length) return "";
    var candidates = periods;
    if (periodIdsWithData && periodIdsWithData.size) {
      candidates = periods.filter(function (p) { return periodIdsWithData.has(String(p.id)); });
      if (!candidates.length) return String(periods[0].id);
    }
    var openMatch = candidates.find(function (p) { return p.status === "open"; });
    if (openMatch) return String(openMatch.id);
    return String(candidates[0].id);
  }

  function filterEvaluationsForRole(rows) {
    if (!currentUser) return rows || [];
    if (isAdmin()) return rows || [];
    if (isLeaderMode()) return rows || [];
    if (isTeacherMode()) {
      return (rows || []).filter(function (row) {
        const mod = row.module || {};
        return (mod.module_staff || []).some(function (staff) {
          return staff.user_id === currentUser.id;
        });
      });
    }
    if (isLeader()) return rows || [];
    if (currentUser.role !== "teacher") return rows || [];
    return (rows || []).filter(function (row) {
      const mod = row.module || {};
      return (mod.module_staff || []).some(function (staff) {
        return staff.user_id === currentUser.id;
      });
    });
  }

  function normalizeTeacher(m) {
    const staff = (m && m.module_staff) || [];
    if (!staff.length) return null;
    if (currentUser) {
      const mine = staff.find(function (s) { return s.user_id === currentUser.id; });
      if (mine) {
        return { id: mine.user_id, full_name: (mine.users && mine.users.full_name) || "—" };
      }
    }
    const f = staff[0];
    return { id: f.user_id, full_name: (f.users && f.users.full_name) || "—" };
  }

  async function loadUser() {
    try {
      await requireSession();
      const sb = ensureSupabase();
      const { data: ud, error: ue } = await sb.auth.getUser();
      if (ue || !ud || !ud.user) { redirectToIndex(); return false; }
      const { data: profile, error: pe } = await sb.from("users").select("*").eq("id", ud.user.id).single();
      if (pe) throw pe;
      currentUser = profile;
      await loadConsolidatorCapability();
      if (!isAdmin() && typeof RaRoleMode !== "undefined") {
        var caps = await RaRoleMode.detectUserCapabilities(sb, profile.id);
        hasDualCapability = caps.dual;
        if (caps.teacher && !caps.leader) RaRoleMode.setWorkMode("teacher");
        if (caps.leader && !caps.teacher) RaRoleMode.setWorkMode("leader");
        workMode = RaRoleMode.getWorkMode();
        if (caps.dual && !workMode) {
          window.location.replace("./role-select.html");
          return false;
        }
        if (!workMode && profile.role === "leader") {
          RaRoleMode.setWorkMode("leader");
          workMode = "leader";
        }
        if (!workMode && caps.teacher) {
          RaRoleMode.setWorkMode("teacher");
          workMode = "teacher";
        }
      } else if (!isAdmin() && profile.role === "leader") {
        workMode = "leader";
      } else if (!isAdmin()) {
        workMode = "teacher";
      }
      welcomeMsg.textContent = "Hola, " + safeText(profile.full_name) + " (" + formatRoleLabel(profile) + ")";
      applyRoleChrome();
      return true;
    } catch (e) { console.error(e); welcomeMsg.textContent = "No se pudo cargar."; return false; }
  }

  async function getPeriod(id) {
    if (periodCache.has(id)) return periodCache.get(id);
    const { data, error } = await ensureSupabase()
      .from("periods")
      .select("id, name, status, rubric_id, end_date, student_outcomes(code)")
      .eq("id", id)
      .single();
    if (error) throw error;
    periodCache.set(id, data);
    return data;
  }

  async function getActivePis(periodId) {
    if (activePiCache.has(periodId)) return activePiCache.get(periodId);
    const p = await getPeriod(periodId);
    if (!p || !p.rubric_id) { activePiCache.set(periodId, []); return []; }
    const { data, error } = await ensureSupabase().from("perf_indicators").select("id").eq("rubric_id", p.rubric_id).eq("is_active", true).order("position");
    if (error) throw error;
    const ids = (data || []).map(function(r) { return r.id; });
    activePiCache.set(periodId, ids);
    return ids;
  }

  async function countActive(moduleId) {
    const { count, error } = await ensureSupabase().from("module_students").select("*", { count: "exact", head: true }).eq("module_id", moduleId).eq("status", "active");
    if (error) throw error;
    return Number(count || 0);
  }

  async function countGraded(moduleId, piIds) {
    if (!piIds.length) return 0;
    const sb = ensureSupabase();
    const { data: ms } = await sb.from("module_students").select("id").eq("module_id", moduleId).eq("status", "active");
    if (!ms || !ms.length) return 0;
    const msIds = ms.map(function(r) { return r.id; });
    const { data: a } = await sb.from("assessments").select("module_student_id, perf_indicator_id").in("module_student_id", msIds).in("perf_indicator_id", piIds);
    const counts = new Map();
    (a || []).forEach(function(r) {
      if (!counts.has(r.module_student_id)) counts.set(r.module_student_id, new Set());
      counts.get(r.module_student_id).add(r.perf_indicator_id);
    });
    return msIds.filter(function(id) { return (counts.get(id) || new Set()).size === piIds.length; }).length;
  }

  async function loadLeaderPrograms(periodId) {
    if (!programSelect || !isLeaderMode()) return;
    programSelect.innerHTML = "";
    programSelect.disabled = true;
    if (!periodId || !currentUser) return;
    try {
      const sb = ensureSupabase();
      const { data: period } = await sb.from("periods").select("student_outcome_id, cycle_id").eq("id", periodId).single();
      if (!period) return;
      let assignQuery = sb.from("ra_consolidator_assignments")
        .select("program_id, program:programs(id, name)")
        .eq("consolidator_user_id", currentUser.id)
        .eq("student_outcome_id", period.student_outcome_id);
      if (period.cycle_id) assignQuery = assignQuery.eq("cycle_id", period.cycle_id);
      const { data: rows } = await assignQuery;
      if (!rows.length) {
        currentProgramId = null;
        programSelect.appendChild(new Option("Sin programas asignados", ""));
        return;
      }
      const sorted = rows.slice().sort(function (a, b) {
        const an = (a.program && a.program.name) || String(a.program_id);
        const bn = (b.program && b.program.name) || String(b.program_id);
        return an.localeCompare(bn, "es");
      });
      const previousProgramId = currentProgramId;
      sorted.forEach(function (a) {
        const prog = a.program || {};
        programSelect.appendChild(new Option(prog.name || ("Programa " + a.program_id), a.program_id));
      });
      programSelect.disabled = false;
      var defaultProgramId = String(sorted[0].program_id);
      for (var k = 0; k < sorted.length; k++) {
        if (!(await leaderProgramPeriodIsDone(sb, Number(periodId), sorted[k].program_id))) {
          defaultProgramId = String(sorted[k].program_id);
          break;
        }
      }
      const stillValid = previousProgramId && sorted.some(function (a) {
        return String(a.program_id) === String(previousProgramId);
      });
      currentProgramId = stillValid ? String(previousProgramId) : defaultProgramId;
      programSelect.value = currentProgramId;
    } catch (e) {
      console.error(e);
      programSelect.appendChild(new Option("Error al cargar programas", ""));
    }
  }

  async function loadModules(periodId) {
    if (!periodId) { renderEmpty("Selecciona un periodo."); return; }
    setStatus("Cargando..."); renderEmpty("Cargando...");
    try {
      await requireSession();
      const sb = ensureSupabase();
      if (isLeaderMode() && periodId !== TEACHER_ALL_PERIODS) {
        await loadLeaderPrograms(periodId);
        if (!currentProgramId) {
          renderEmpty("No está asignado como consolidador en este RA.");
          setStatus("Seleccione un RA donde tenga asignación de consolidador.", "info");
          return;
        }
      }
      var evalQuery = sb.from("module_ra_evaluations")
        .select("id, status, period_id, module:modules(id, course_code, course_name, group_name, program_id, module_staff(user_id, users(full_name))), period:periods(student_outcome:student_outcomes(code))");
      var cycleProgress = null;
      if (isTeacherMode()) {
        try { cycleProgress = await fetchTeacherCycleProgress(periodId); } catch (e) { console.error(e); }
      }
      if (periodId === TEACHER_ALL_PERIODS && isTeacherMode()) {
        var teacherIds = await teacherPeriodIdsInCycle(teacherAllCycleId);
        if (!teacherIds || !teacherIds.size) {
          renderModules([], periodId, cycleProgress);
          setStatus("Sin módulos asignados en este cuatrimestre.", "info");
          return;
        }
        evalQuery = evalQuery.in("period_id", Array.from(teacherIds));
      } else {
        evalQuery = evalQuery.eq("period_id", periodId);
      }
      const { data: rows, error } = await evalQuery
        .order("course_code", { foreignTable: "modules" })
        .order("group_name", { foreignTable: "modules" });
      if (error) throw error;
      let visibleRows = filterEvaluationsForRole(rows);
      if (isLeaderMode() && currentProgramId) {
        visibleRows = visibleRows.filter(function (row) {
          return row.module && String(row.module.program_id) === String(currentProgramId);
        });
      }
      const sharedPiIds = periodId === TEACHER_ALL_PERIODS ? null : await getActivePis(periodId);
      const modules = visibleRows.map(function (r) {
        const mod = r.module || {};
        const m = Object.assign({}, mod);
        m.evaluation_id = r.id;
        m.status = r.status;
        m.period_id = r.period_id;
        m.ra_code = (r.period && r.period.student_outcome && r.period.student_outcome.code) || "—";
        m.teacher = normalizeTeacher(mod);
        m.students_active = 0;
        m.students_graded = 0;
        return m;
      });
      await Promise.all(modules.map(async function (m) {
        try {
          m.students_active = await countActive(m.id);
          var piIds = sharedPiIds || await getActivePis(m.period_id);
          m.students_graded = await countGraded(m.id, piIds);
        } catch (e) { console.error(e); }
      }));
      if (!modules.length && periodId && periodId !== TEACHER_ALL_PERIODS) {
        var doneMsg = null;
        if (isTeacherMode()) {
          if (await teacherPeriodIsDone(sb, Number(periodId), currentUser.id)) {
            doneMsg = "Completaste todo en modo docente.";
          }
        } else if (isLeaderMode()) {
          var programIds = await assignedProgramIdsForPeriod(Number(periodId));
          if (await leaderPeriodIsDone(sb, Number(periodId), programIds)) {
            doneMsg = "Completaste todo en modo líder consolidador.";
          }
        }
        if (doneMsg) {
          renderEmpty("No hay tareas pendientes. " + doneMsg);
          setStatus(doneMsg, "info");
          syncTeacherXpUi([], periodId, cycleProgress);
          updatePeriodProgress([]);
          if (isLeaderMode() && currentProgramId && periodId !== TEACHER_ALL_PERIODS) await loadLeaderDashboard(periodId);
          return;
        }
      }
      renderModules(modules, periodId, cycleProgress);
      if (isLeaderMode() && currentProgramId && periodId !== TEACHER_ALL_PERIODS) await loadLeaderDashboard(periodId);
    } catch (e) { console.error(e); renderEmpty("Error al cargar."); setStatus("Error.", "error"); }
  }

  var CONSOLIDATED_LEVEL_CRITERIA = [
    { value: 1, labelEs: "Deficiente", distKey: "Deficiente", chartColor: "#dc2626" },
    { value: 2, labelEs: "Insuficiente", distKey: "Insuficiente", chartColor: "#f97316" },
    { value: 4, labelEs: "Bueno", distKey: "Bueno", chartColor: "#FFDF2D" },
    { value: 5, labelEs: "Sobresaliente", distKey: "Sobresaliente", chartColor: "#16a34a" },
  ];

  var ABET_LEVEL_TO_DIST = {
    Poor: "Deficiente",
    Inadequate: "Insuficiente",
    Adequate: "Bueno",
    Exemplary: "Sobresaliente",
  };

  var ABET_DECISION_LEGEND = [
    {
      label: "Deficiente (1)",
      standard: "Bajo",
      decision: "Establecer y verificar planes de acción correctiva",
      levelValue: 1,
    },
    {
      label: "Insuficiente (2)",
      standard: "—",
      decision: "—",
      levelValue: 2,
    },
    {
      label: "Bueno (4)",
      standard: "Medio",
      decision: "Establecer y verificar planes de acción preventiva",
      levelValue: 4,
    },
    {
      label: "Sobresaliente (5)",
      standard: "Alto",
      decision: "Establecer planes de mejora / mantener el estándar",
      levelValue: 5,
    },
  ];

  function consolidatedLevelMeta(levelValue) {
    return CONSOLIDATED_LEVEL_CRITERIA.find(function (level) {
      return level.value === Number(levelValue);
    }) || null;
  }

  function consolidatedDistPercent(count, activeCount) {
    var n = Number(count) || 0;
    if (activeCount <= 0) return 0;
    return (n / activeCount) * 100;
  }

  function formatConsolidatedDistPercent(count, activeCount) {
    return consolidatedDistPercent(count, activeCount).toFixed(2);
  }

  function initConsolidatedDist(pis) {
    var dist = {};
    pis.forEach(function (pi) {
      var key = String(pi.id);
      dist[key] = { pi_id: pi.id, pi_code: pi.code, pi_description: pi.description || "" };
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        dist[key][level.distKey] = 0;
      });
    });
    return dist;
  }

  function distributionFromAbetReport(distributionByPi) {
    var dist = {};
    var pis = [];
    Object.keys(distributionByPi || {}).sort().forEach(function (code) {
      var entry = distributionByPi[code];
      if (!entry || entry.perf_indicator_id == null) return;
      pis.push({
        id: entry.perf_indicator_id,
        code: code,
        description: entry.description || "",
      });
      var key = String(entry.perf_indicator_id);
      dist[key] = {
        pi_id: entry.perf_indicator_id,
        pi_code: code,
        pi_description: entry.description || "",
      };
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        dist[key][level.distKey] = 0;
      });
      var consolidated = entry.consolidated || {};
      Object.keys(ABET_LEVEL_TO_DIST).forEach(function (abetKey) {
        var distKey = ABET_LEVEL_TO_DIST[abetKey];
        dist[key][distKey] = (dist[key][distKey] || 0) + (Number(consolidated[abetKey]) || 0);
      });
    });
    return { dist: dist, pis: pis };
  }

  async function getActivePisFull(periodId) {
    const p = await getPeriod(periodId);
    if (!p || !p.rubric_id) return [];
    const { data, error } = await ensureSupabase()
      .from("perf_indicators")
      .select("id, code, description")
      .eq("rubric_id", p.rubric_id)
      .eq("is_active", true)
      .order("position");
    if (error) throw error;
    return data || [];
  }

  async function buildConsolidatedDistributionClient(periodId, programId) {
    const sb = ensureSupabase();
    const pis = await getActivePisFull(periodId);
    const { data: evalRows, error: evalError } = await sb
      .from("module_ra_evaluations")
      .select("module:modules(id, program_id)")
      .eq("period_id", periodId);
    if (evalError) throw evalError;

    const moduleIds = (evalRows || [])
      .filter(function (row) {
        return row.module && String(row.module.program_id) === String(programId);
      })
      .map(function (row) { return row.module.id; });

    if (!moduleIds.length) {
      return {
        dist: initConsolidatedDist(pis),
        pis: pis,
        activeStudentCount: 0,
        moduleCount: 0,
      };
    }

    const { data: msRows, error: msError } = await sb
      .from("module_students")
      .select("id, module_id")
      .in("module_id", moduleIds)
      .eq("status", "active");
    if (msError) throw msError;

    const activeRows = msRows || [];
    const msIds = activeRows.map(function (row) { return row.id; });
    const modulesWithStudents = new Set(activeRows.map(function (row) { return row.module_id; }));
    const dist = initConsolidatedDist(pis);

    if (msIds.length) {
      const { data: assessments, error: assessError } = await sb
        .from("assessments")
        .select("perf_indicator_id, level")
        .in("module_student_id", msIds);
      if (assessError) throw assessError;
      (assessments || []).forEach(function (assessment) {
        const bucket = dist[String(assessment.perf_indicator_id)];
        if (!bucket) return;
        const meta = consolidatedLevelMeta(assessment.level);
        if (meta) bucket[meta.distKey] = (bucket[meta.distKey] || 0) + 1;
      });
    }

    return {
      dist: dist,
      pis: pis,
      activeStudentCount: activeRows.length,
      moduleCount: modulesWithStudents.size,
    };
  }

  async function buildLeaderPiReportData(periodId, programId) {
    const sb = ensureSupabase();
    const pis = await getActivePisFull(periodId);
    const { data: evalRows, error: evalError } = await sb
      .from("module_ra_evaluations")
      .select("id, module:modules(id, course_code, course_name, group_name, program_id)")
      .eq("period_id", periodId);
    if (evalError) throw evalError;

    const evaluations = (evalRows || [])
      .filter(function (row) {
        return row.module && String(row.module.program_id) === String(programId);
      })
      .map(function (row) {
        return {
          evaluation_id: row.id,
          module_id: row.module.id,
          course_code: row.module.course_code,
          course_name: row.module.course_name,
          group_name: row.module.group_name,
        };
      })
      .sort(function (a, b) {
        var codeCmp = String(a.course_code || "").localeCompare(String(b.course_code || ""), "es");
        if (codeCmp !== 0) return codeCmp;
        return String(a.group_name || "").localeCompare(String(b.group_name || ""), "es");
      });

    const evalIds = evaluations.map(function (ev) { return ev.evaluation_id; });
    const teacherAnalysisByPi = {};
    const evalLabelMap = {};
    evaluations.forEach(function (ev) {
      evalLabelMap[ev.evaluation_id] = formatModuleAnalysisLabel(ev);
    });

    if (evalIds.length) {
      const { data: maRows, error: maError } = await sb
        .from("module_analysis")
        .select("module_ra_evaluation_id, perf_indicator_id, analysis_text")
        .in("module_ra_evaluation_id", evalIds);
      if (maError) throw maError;
      (maRows || []).forEach(function (row) {
        var text = row.analysis_text ? String(row.analysis_text).trim() : "";
        if (!text) return;
        var piKey = String(row.perf_indicator_id);
        if (!teacherAnalysisByPi[piKey]) teacherAnalysisByPi[piKey] = [];
        teacherAnalysisByPi[piKey].push({
          label: evalLabelMap[row.module_ra_evaluation_id] || "Módulo",
          text: text,
        });
      });
    }

    const moduleDistByPi = {};
    pis.forEach(function (pi) {
      moduleDistByPi[String(pi.id)] = [];
    });

    await Promise.all(evaluations.map(async function (ev) {
      const { data: msRows, error: msError } = await sb
        .from("module_students")
        .select("id")
        .eq("module_id", ev.module_id)
        .eq("status", "active");
      if (msError) throw msError;
      var activeCount = (msRows || []).length;
      if (activeCount <= 0) return;
      var msIds = (msRows || []).map(function (row) { return row.id; });
      var countsByPi = {};
      pis.forEach(function (pi) {
        countsByPi[String(pi.id)] = emptyLevelCounts();
      });
      if (msIds.length) {
        const { data: assessments, error: assessError } = await sb
          .from("assessments")
          .select("perf_indicator_id, level")
          .in("module_student_id", msIds);
        if (assessError) throw assessError;
        (assessments || []).forEach(function (assessment) {
          var bucket = countsByPi[String(assessment.perf_indicator_id)];
          if (!bucket) return;
          var meta = consolidatedLevelMeta(assessment.level);
          if (meta) bucket[meta.distKey] = (bucket[meta.distKey] || 0) + 1;
        });
      }
      pis.forEach(function (pi) {
        moduleDistByPi[String(pi.id)].push({
          group_label: ev.group_name || ev.course_code || "—",
          course_code: ev.course_code,
          course_name: ev.course_name,
          active_count: activeCount,
          counts: countsByPi[String(pi.id)],
        });
      });
    }));

    return {
      pis: pis,
      moduleDistByPi: moduleDistByPi,
      teacherAnalysisByPi: teacherAnalysisByPi,
    };
  }

  function appendLeaderPiDistTable(container, pi, moduleRows) {
    var totalCounts = emptyLevelCounts();
    var totalActive = 0;
    moduleRows.forEach(function (row) {
      totalActive += row.active_count;
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        totalCounts[level.distKey] += Number(row.counts[level.distKey]) || 0;
      });
    });

    var wrap = document.createElement("div");
    wrap.className = "table-wrap leader-pi-table-wrap";
    var table = document.createElement("table");
    table.className = "modules-table leader-pi-dist-table";

    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    var groupTh = document.createElement("th");
    groupTh.scope = "col";
    groupTh.textContent = "Grupo";
    headRow.appendChild(groupTh);
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "leader-pi-level-col leader-pi-level-col--" + level.value;
      th.textContent = level.labelEs + " (" + level.value + ")";
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    var body = document.createElement("tbody");
    if (!moduleRows.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = CONSOLIDATED_LEVEL_CRITERIA.length + 1;
      emptyCell.textContent = "Sin módulos con estudiantes activos en este programa.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    } else {
      moduleRows.forEach(function (row) {
        var tr = document.createElement("tr");
        var groupCell = document.createElement("td");
        groupCell.textContent = safeText(row.group_label);
        groupCell.title = safeText(row.course_name);
        tr.appendChild(groupCell);
        CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
          var td = document.createElement("td");
          var count = Number(row.counts[level.distKey]) || 0;
          td.textContent = formatLevelPercent(count, row.active_count);
          td.title = count + " de " + row.active_count + " estudiantes";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }
    table.appendChild(body);

    var foot = document.createElement("tfoot");
    var totalRow = document.createElement("tr");
    totalRow.className = "leader-pi-total-row";
    var totalLabel = document.createElement("th");
    totalLabel.scope = "row";
    totalLabel.textContent = "Total porcentaje — " + safeText(pi.code);
    totalRow.appendChild(totalLabel);
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      var td = document.createElement("td");
      var count = Number(totalCounts[level.distKey]) || 0;
      td.textContent = formatLevelPercent(count, totalActive);
      td.title = count + " de " + totalActive + " estudiantes activos";
      totalRow.appendChild(td);
    });
    foot.appendChild(totalRow);
    table.appendChild(foot);

    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function appendLeaderPiTeacherReadout(container, piKey, teacherBlocks) {
    var section = document.createElement("section");
    section.className = "leader-pi-teacher-readout";
    var heading = document.createElement("h6");
    heading.textContent = "Análisis de los docentes — " + safeText(piKey);
    section.appendChild(heading);

    if (!teacherBlocks || !teacherBlocks.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aún no hay análisis cualitativo de docentes para este indicador.";
      section.appendChild(empty);
      container.appendChild(section);
      return;
    }

    teacherBlocks.forEach(function (block) {
      var item = document.createElement("article");
      item.className = "leader-pi-teacher-block";
      var label = document.createElement("p");
      label.className = "leader-pi-teacher-label";
      label.textContent = block.label;
      var body = document.createElement("p");
      body.className = "leader-pi-teacher-text";
      body.textContent = block.text;
      item.appendChild(label);
      item.appendChild(body);
      section.appendChild(item);
    });
    container.appendChild(section);
  }

  function computePiModuleTotals(moduleRows) {
    var totalCounts = emptyLevelCounts();
    var totalActive = 0;
    (moduleRows || []).forEach(function (row) {
      totalActive += row.active_count;
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        totalCounts[level.distKey] += Number(row.counts[level.distKey]) || 0;
      });
    });
    return { totalCounts: totalCounts, totalActive: totalActive };
  }

  function buildConicGradient(totalCounts, totalActive) {
    var stops = [];
    var acc = 0;
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      var pct = consolidatedDistPercent(totalCounts[level.distKey], totalActive);
      if (pct <= 0) return;
      var next = acc + pct;
      stops.push(level.chartColor + " " + acc.toFixed(2) + "% " + next.toFixed(2) + "%");
      acc = next;
    });
    if (!stops.length) return "#e5e7eb";
    return "conic-gradient(from 180deg, " + stops.join(", ") + ")";
  }

  function appendLeaderPiCharts(container, pi, moduleRows) {
    var totals = computePiModuleTotals(moduleRows);
    var wrap = document.createElement("div");
    wrap.className = "leader-pi-charts";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "Gráficas de distribución del indicador " + safeText(pi.code));

    if (!moduleRows.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Sin datos para gráficas en este indicador.";
      wrap.appendChild(empty);
      container.appendChild(wrap);
      return;
    }

    var stackedPanel = document.createElement("div");
    stackedPanel.className = "leader-pi-stacked-chart";
    var stackedTitle = document.createElement("h6");
    stackedTitle.textContent = "Comportamiento por grupo — " + safeText(pi.code);
    stackedPanel.appendChild(stackedTitle);

    var stackedBars = document.createElement("div");
    stackedBars.className = "leader-stacked-bars";
    moduleRows.forEach(function (row) {
      var col = document.createElement("div");
      col.className = "leader-stacked-col";
      var bar = document.createElement("div");
      bar.className = "leader-stacked-bar";
      var hasSegment = false;
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        var count = Number(row.counts[level.distKey]) || 0;
        var pct = consolidatedDistPercent(count, row.active_count);
        if (pct <= 0) return;
        hasSegment = true;
        var seg = document.createElement("div");
        seg.className = "leader-stacked-segment";
        seg.style.flexBasis = pct + "%";
        seg.style.backgroundColor = level.chartColor;
        seg.title = level.labelEs + ": " + formatLevelPercent(count, row.active_count);
        bar.appendChild(seg);
      });
      if (!hasSegment) {
        var emptySeg = document.createElement("div");
        emptySeg.className = "leader-stacked-empty";
        emptySeg.textContent = "—";
        bar.appendChild(emptySeg);
      }
      col.appendChild(bar);
      var label = document.createElement("span");
      label.className = "leader-stacked-label";
      label.textContent = safeText(row.group_label);
      label.title = safeText(row.course_name);
      col.appendChild(label);
      stackedBars.appendChild(col);
    });
    stackedPanel.appendChild(stackedBars);
    wrap.appendChild(stackedPanel);

    var donutPanel = document.createElement("div");
    donutPanel.className = "leader-pi-donut-chart";
    var donutTitle = document.createElement("h6");
    donutTitle.textContent = "Desempeño total — " + safeText(pi.code);
    donutPanel.appendChild(donutTitle);

    var donutWrap = document.createElement("div");
    donutWrap.className = "leader-donut-wrap";
    var donut = document.createElement("div");
    donut.className = "leader-donut";
    donut.style.background = buildConicGradient(totals.totalCounts, totals.totalActive);
    var donutHole = document.createElement("div");
    donutHole.className = "leader-donut-hole";
    donut.appendChild(donutHole);
    donutWrap.appendChild(donut);

    var donutLegend = document.createElement("ul");
    donutLegend.className = "leader-donut-legend";
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      var count = Number(totals.totalCounts[level.distKey]) || 0;
      var item = document.createElement("li");
      var swatch = document.createElement("span");
      swatch.className = "dist-chart-swatch";
      swatch.style.backgroundColor = level.chartColor;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(
        level.labelEs + ": " + formatLevelPercent(count, totals.totalActive)
      ));
      donutLegend.appendChild(item);
    });
    donutWrap.appendChild(donutLegend);
    donutPanel.appendChild(donutWrap);
    wrap.appendChild(donutPanel);

    container.appendChild(wrap);
  }

  async function buildLeaderCoverData(periodId, programId) {
    const sb = ensureSupabase();
    const { data: periodRow, error: periodError } = await sb
      .from("periods")
      .select("id, name, student_outcomes(code, description)")
      .eq("id", periodId)
      .single();
    if (periodError) throw periodError;

    const { data: programRow, error: programError } = await sb
      .from("programs")
      .select("id, name, faculty")
      .eq("id", programId)
      .single();
    if (programError) throw programError;

    const { data: evalRows, error: evalError } = await sb
      .from("module_ra_evaluations")
      .select("id, module:modules(id, course_code, course_name, group_name, program_id, module_staff(users(full_name)))")
      .eq("period_id", periodId);
    if (evalError) throw evalError;

    const modules = [];
    const filtered = (evalRows || []).filter(function (row) {
      return row.module && String(row.module.program_id) === String(programId);
    });

    await Promise.all(filtered.map(async function (row) {
      const mod = row.module;
      const { count, error: countError } = await sb
        .from("module_students")
        .select("*", { count: "exact", head: true })
        .eq("module_id", mod.id)
        .eq("status", "active");
      if (countError) throw countError;
      var activeStudents = Number(count || 0);
      if (activeStudents <= 0) return;
      const staff = mod.module_staff || [];
      var teacherNames = staff
        .map(function (s) { return s.users && s.users.full_name; })
        .filter(Boolean)
        .join(", ");
      modules.push({
        course_code: mod.course_code,
        course_name: mod.course_name,
        group_name: mod.group_name,
        teacher_names: teacherNames || "—",
        active_students: activeStudents,
      });
    }));

    modules.sort(function (a, b) {
      var codeCmp = String(a.course_code || "").localeCompare(String(b.course_code || ""), "es");
      if (codeCmp !== 0) return codeCmp;
      return String(a.group_name || "").localeCompare(String(b.group_name || ""), "es");
    });

    var totalStudents = modules.reduce(function (sum, mod) {
      return sum + mod.active_students;
    }, 0);

    return {
      periodName: periodRow && periodRow.name,
      raCode: periodRow && periodRow.student_outcomes && periodRow.student_outcomes.code,
      raDescription: periodRow && periodRow.student_outcomes && periodRow.student_outcomes.description,
      programName: programRow && programRow.name,
      facultyName: programRow && programRow.faculty,
      leaderName: currentUser && currentUser.full_name,
      modules: modules,
      totalStudents: totalStudents,
    };
  }

  function renderLeaderCover(container, cover) {
    container.innerHTML = "";

    var banner = document.createElement("div");
    banner.className = "leader-cover-banner";
    banner.textContent = "Informe final de medición";
    container.appendChild(banner);

    var raBlock = document.createElement("div");
    raBlock.className = "leader-cover-ra";
    var raTitle = document.createElement("h4");
    raTitle.textContent = safeText(cover.raCode) + ": " + safeText(cover.raDescription);
    raBlock.appendChild(raTitle);
    container.appendChild(raBlock);

    var grid = document.createElement("div");
    grid.className = "leader-cover-grid";

    var modulesPanel = document.createElement("div");
    modulesPanel.className = "leader-cover-modules";
    var modulesWrap = document.createElement("div");
    modulesWrap.className = "table-wrap";
    var table = document.createElement("table");
    table.className = "modules-table leader-cover-table";
    table.innerHTML = "<thead><tr>"
      + "<th scope=\"col\">Curso</th>"
      + "<th scope=\"col\">Grupo</th>"
      + "<th scope=\"col\">Docente</th>"
      + "<th scope=\"col\">N° estudiantes</th>"
      + "</tr></thead>";
    var body = document.createElement("tbody");
    if (!cover.modules.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.textContent = "Sin módulos con estudiantes activos en este programa.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    } else {
      cover.modules.forEach(function (mod) {
        var tr = document.createElement("tr");
        [mod.course_name || mod.course_code, mod.group_name, mod.teacher_names, String(mod.active_students)]
          .forEach(function (value) {
            var td = document.createElement("td");
            td.textContent = safeText(value);
            tr.appendChild(td);
          });
        body.appendChild(tr);
      });
    }
    table.appendChild(body);
    var foot = document.createElement("tfoot");
    var totalRow = document.createElement("tr");
    totalRow.className = "leader-cover-total-row";
    var totalLabel = document.createElement("th");
    totalLabel.colSpan = 3;
    totalLabel.scope = "row";
    totalLabel.textContent = "Total estudiantes";
    var totalValue = document.createElement("td");
    totalValue.textContent = String(cover.totalStudents);
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);
    foot.appendChild(totalRow);
    table.appendChild(foot);
    modulesWrap.appendChild(table);
    modulesPanel.appendChild(modulesWrap);
    grid.appendChild(modulesPanel);

    var legendPanel = document.createElement("div");
    legendPanel.className = "leader-cover-legend";
    var legendTitle = document.createElement("h5");
    legendTitle.textContent = "Leyenda ABET";
    legendPanel.appendChild(legendTitle);
    var legendWrap = document.createElement("div");
    legendWrap.className = "table-wrap";
    var legendTable = document.createElement("table");
    legendTable.className = "modules-table leader-cover-legend-table";
    legendTable.innerHTML = "<thead><tr><th scope=\"col\">Nivel</th><th scope=\"col\">Estándar</th><th scope=\"col\">Decisión</th></tr></thead>";
    var legendBody = document.createElement("tbody");
    ABET_DECISION_LEGEND.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.className = "leader-cover-legend-row leader-cover-legend-row--" + row.levelValue;
      [row.label, row.standard, row.decision].forEach(function (value) {
        var td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      legendBody.appendChild(tr);
    });
    legendTable.appendChild(legendBody);
    legendWrap.appendChild(legendTable);
    legendPanel.appendChild(legendWrap);
    grid.appendChild(legendPanel);

    container.appendChild(grid);

    var context = document.createElement("p");
    context.className = "leader-cover-context muted";
    var facultyLine = cover.facultyName
      ? "Mediciones " + cover.facultyName + " — "
      : "Mediciones — ";
    context.textContent = facultyLine + "Programa " + safeText(cover.programName);
    container.appendChild(context);

    var meta = document.createElement("div");
    meta.className = "leader-cover-meta";
    meta.innerHTML = "<p><strong>Período:</strong> " + escapeHtml(safeText(cover.periodName)) + "</p>"
      + "<p><strong>Líder consolidador del RA:</strong> " + escapeHtml(safeText(cover.leaderName)) + "</p>";
    container.appendChild(meta);
  }

  async function loadLeaderCover(periodId) {
    if (!leaderReportCover) return;
    leaderReportCover.innerHTML = "<p class=\"muted\">Cargando portada del informe…</p>";
    try {
      await requireSession();
      if (!currentProgramId) {
        leaderReportCover.innerHTML = "<p class=\"muted\">Selecciona un programa en el panel del líder.</p>";
        return;
      }
      const cover = await buildLeaderCoverData(periodId, currentProgramId);
      renderLeaderCover(leaderReportCover, cover);
    } catch (e) {
      console.error(e);
      leaderReportCover.innerHTML = "<p class=\"muted\">Error al cargar la portada del informe.</p>";
    }
  }

  function leaderExportStyles() {
    return "body{font-family:system-ui,sans-serif;color:#1E2843;line-height:1.45;margin:0;padding:1.5rem;max-width:960px;margin-inline:auto}"
      + ".print-hint{background:#fefce8;border:1px solid #fde047;border-radius:8px;margin-bottom:1rem;padding:.75rem 1rem;font-size:.875rem}"
      + ".cover-banner,.pi-banner{background:#1E2843;color:#fff;font-weight:600;padding:.65rem 1rem;text-align:center;text-transform:uppercase}"
      + ".cover-ra{background:#eef2ff;border:1px solid #dbeafe;margin:0 0 1rem;padding:.875rem 1rem}"
      + ".cover-ra h1{font-size:1rem;margin:0}"
      + ".cover-grid{display:grid;gap:1rem;grid-template-columns:1fr;margin-bottom:1rem}"
      + "@media(min-width:760px){.cover-grid{grid-template-columns:1.4fr 1fr}}"
      + ".data-table{border-collapse:collapse;font-size:.8125rem;width:100%}"
      + ".data-table th,.data-table td{border:1px solid #d1d5db;padding:.35rem .5rem;text-align:left}"
      + ".data-table th{background:#f3f4f6;font-weight:600}"
      + ".data-table tfoot th,.data-table tfoot td{background:#e5e7eb;font-weight:600}"
      + ".pi-section{margin-top:2rem;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;padding-bottom:1rem}"
      + ".pi-section h2,.pi-section h3,.pi-section h4{color:#1E2843;margin:1rem 1rem .5rem;font-size:.9375rem}"
      + ".pi-desc{color:#4b5563;font-size:.875rem;margin:0 1rem .75rem}"
      + ".charts{display:grid;gap:1rem;grid-template-columns:1fr;margin:0 1rem 1rem}"
      + "@media(min-width:760px){.charts{grid-template-columns:1.5fr 1fr}}"
      + ".stack-bars{display:flex;flex-wrap:wrap;gap:.35rem;align-items:flex-end;min-height:9rem}"
      + ".stack-col{display:flex;flex:1 1 2rem;flex-direction:column;align-items:center;max-width:3.5rem;min-width:1.75rem}"
      + ".stack-bar{background:#f3f4f6;border-radius:4px 4px 0 0;display:flex;flex-direction:column-reverse;height:8rem;overflow:hidden;width:100%}"
      + ".stack-seg{flex-shrink:0;min-height:2px;width:100%}"
      + ".stack-label{font-size:.6rem;margin-top:.25rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".donut-wrap{align-items:center;display:flex;flex-wrap:wrap;gap:.75rem}"
      + ".donut{align-items:center;border-radius:50%;display:flex;height:7rem;justify-content:center;width:7rem}"
      + ".donut-hole{background:#fff;border-radius:50%;height:3.5rem;width:3.5rem}"
      + ".donut-legend{list-style:none;margin:0;padding:0;font-size:.8125rem}"
      + ".donut-legend li{align-items:center;display:flex;gap:.35rem;margin-bottom:.25rem}"
      + ".swatch{border-radius:2px;display:inline-block;height:.75rem;width:.75rem}"
      + ".teacher-block{border-left:3px solid #1E2843;margin:0 1rem .75rem;padding-left:.75rem}"
      + ".teacher-label{font-size:.8125rem;font-weight:600;margin:0 0 .25rem}"
      + ".teacher-text{font-size:.875rem;margin:0;white-space:pre-wrap}"
      + ".prose{white-space:pre-wrap;font-size:.875rem;margin:0 1rem 1rem}"
      + ".muted{color:#6b7280}"
      + "@media print{.print-hint{display:none}.page-break{page-break-before:always}}";
  }

  function exportHtmlStackedBars(moduleRows) {
    if (!moduleRows.length) return "<p class='muted'>Sin datos de grupos.</p>";
    var cols = moduleRows.map(function (row) {
      var segments = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
        var count = Number(row.counts[level.distKey]) || 0;
        var p = Math.round(consolidatedDistPercent(count, row.active_count));
        if (p <= 0) return "";
        return "<div class='stack-seg' style='flex-basis:" + p + "%;background:" + level.chartColor + "' title='" + escapeHtml(level.labelEs) + ": " + p + "%'></div>";
      }).join("");
      return "<div class='stack-col'><div class='stack-bar'>" + (segments || "—") + "</div><span class='stack-label'>" + escapeHtml(row.group_label) + "</span></div>";
    }).join("");
    return "<div class='stack-bars'>" + cols + "</div>";
  }

  function exportHtmlPiTable(pi, moduleRows) {
    var totals = computePiModuleTotals(moduleRows);
    var head = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
      return "<th>" + escapeHtml(level.labelEs) + " (" + level.value + ")</th>";
    }).join("");
    var body = moduleRows.map(function (row) {
      var cells = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
        var count = Number(row.counts[level.distKey]) || 0;
        return "<td>" + formatLevelPercent(count, row.active_count) + "</td>";
      }).join("");
      return "<tr><td>" + escapeHtml(row.group_label) + "</td>" + cells + "</tr>";
    }).join("");
    var totalCells = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
      var count = Number(totals.totalCounts[level.distKey]) || 0;
      return "<td><strong>" + formatLevelPercent(count, totals.totalActive) + "</strong></td>";
    }).join("");
    return "<table class='data-table'><thead><tr><th>Grupo</th>" + head + "</tr></thead><tbody>"
      + (body || "<tr><td colspan='5'>Sin módulos.</td></tr>")
      + "</tbody><tfoot><tr><th>Total — " + escapeHtml(pi.code) + "</th>" + totalCells + "</tr></tfoot></table>";
  }

  function buildLeaderExportHtml(cover, bundle, leaderAnalysisMap, draftMap, moduleProgress) {
    var raTitle = escapeHtml(safeText(cover.raCode)) + ": " + escapeHtml(safeText(cover.raDescription));
    var facultyLine = cover.facultyName
      ? "Mediciones " + escapeHtml(cover.facultyName) + " — Programa " + escapeHtml(safeText(cover.programName))
      : "Mediciones — Programa " + escapeHtml(safeText(cover.programName));
    var moduleRows = cover.modules.map(function (mod) {
      return "<tr><td>" + escapeHtml(mod.course_name || mod.course_code) + "</td><td>" + escapeHtml(mod.group_name)
        + "</td><td>" + escapeHtml(mod.teacher_names) + "</td><td>" + mod.active_students + "</td></tr>";
    }).join("");
    var legendRows = ABET_DECISION_LEGEND.map(function (row) {
      return "<tr><td>" + escapeHtml(row.label) + "</td><td>" + escapeHtml(row.standard) + "</td><td>" + escapeHtml(row.decision) + "</td></tr>";
    }).join("");
    var piSections = bundle.pis.map(function (pi) {
      var piKey = String(pi.id);
      var moduleDist = bundle.moduleDistByPi[piKey] || [];
      var teacherBlocks = bundle.teacherAnalysisByPi[piKey] || [];
      var totals = computePiModuleTotals(moduleDist);
      var donutBg = buildConicGradient(totals.totalCounts, totals.totalActive);
      var donutLegend = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
        var count = Number(totals.totalCounts[level.distKey]) || 0;
        return "<li><span class='swatch' style='background:" + level.chartColor + "'></span>"
          + escapeHtml(level.labelEs) + ": " + formatLevelPercent(count, totals.totalActive) + "</li>";
      }).join("");
      var teachersHtml = teacherBlocks.length
        ? teacherBlocks.map(function (block) {
          return "<article class='teacher-block'><p class='teacher-label'>" + escapeHtml(block.label)
            + "</p><p class='teacher-text'>" + escapeHtml(block.text) + "</p></article>";
        }).join("")
        : "<p class='muted' style='margin:0 1rem'>Sin análisis de docentes.</p>";
      return "<section class='pi-section page-break'><div class='pi-banner'>Reporte por indicador de desempeño</div>"
        + "<h2>" + escapeHtml(pi.code) + " — Indicador de desempeño</h2>"
        + "<p class='pi-desc'>" + escapeHtml(safeText(pi.description)) + "</p>"
        + "<h3>Medición por grupo</h3>" + exportHtmlPiTable(pi, moduleDist)
        + "<div class='charts'><div><h4>Comportamiento por grupo</h4>" + exportHtmlStackedBars(moduleDist) + "</div>"
        + "<div><h4>Desempeño total</h4><div class='donut-wrap'><div class='donut' style='background:" + donutBg + "'><div class='donut-hole'></div></div>"
        + "<ul class='donut-legend'>" + donutLegend + "</ul></div></div></div>"
        + "<h3>Análisis de los docentes</h3>" + teachersHtml
        + "<h3>Análisis del líder</h3><p class='prose'>" + escapeHtml(leaderAnalysisMap[pi.id] || "—") + "</p>"
        + "<h3>Conclusión del informe</h3><p class='prose'>" + escapeHtml(draftMap[pi.id] || "—") + "</p></section>";
    }).join("");
    return "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'><title>Informe del líder</title><style>"
      + leaderExportStyles() + "</style></head><body>"
      + "<p class='print-hint'>Para PDF: <strong>Archivo → Imprimir → Guardar como PDF</strong> (Cmd/Ctrl+P).</p>"
      + "<section><div class='cover-banner'>Informe final de medición</div>"
      + "<div class='cover-ra'><h1>" + raTitle + "</h1></div>"
      + "<div class='cover-grid'><div><table class='data-table'><thead><tr><th>Curso</th><th>Grupo</th><th>Docente</th><th>N° est.</th></tr></thead><tbody>"
      + (moduleRows || "<tr><td colspan='4'>Sin módulos.</td></tr>")
      + "</tbody><tfoot><tr><th colspan='3'>Total estudiantes</th><td><strong>" + cover.totalStudents + "</strong></td></tr></tfoot></table></div>"
      + "<div><h2 style='font-size:.875rem;margin:0 0 .5rem'>Leyenda ABET</h2><table class='data-table'><thead><tr><th>Nivel</th><th>Estándar</th><th>Decisión</th></tr></thead><tbody>"
      + legendRows + "</tbody></table></div></div>"
      + "<p class='muted'>" + facultyLine + "</p>"
      + "<p><strong>Período:</strong> " + escapeHtml(safeText(cover.periodName)) + "<br>"
      + "<strong>Líder consolidador:</strong> " + escapeHtml(safeText(cover.leaderName)) + "<br>"
      + "<strong>Módulos completados:</strong> " + moduleProgress.completed + " / " + moduleProgress.total + "</p></section>"
      + piSections + "</body></html>";
  }

  function buildLeaderExportPlainText(cover, bundle, leaderAnalysisMap, draftMap) {
    var lines = [
      "INFORME FINAL DE MEDICIÓN",
      safeText(cover.raCode) + ": " + safeText(cover.raDescription),
      "Programa: " + safeText(cover.programName),
      "Período: " + safeText(cover.periodName),
      "Líder: " + safeText(cover.leaderName),
      "Total estudiantes: " + cover.totalStudents,
      "",
    ];
    cover.modules.forEach(function (mod) {
      lines.push("- " + (mod.course_name || mod.course_code) + " | " + mod.group_name + " | " + mod.teacher_names + " | " + mod.active_students);
    });
    lines.push("");
    bundle.pis.forEach(function (pi) {
      var piKey = String(pi.id);
      lines.push("=== " + pi.code + " ===");
      lines.push(safeText(pi.description));
      (bundle.moduleDistByPi[piKey] || []).forEach(function (row) {
        var parts = CONSOLIDATED_LEVEL_CRITERIA.map(function (level) {
          return level.labelEs + ": " + formatLevelPercent(row.counts[level.distKey], row.active_count);
        });
        lines.push("  " + row.group_label + ": " + parts.join(" | "));
      });
      (bundle.teacherAnalysisByPi[piKey] || []).forEach(function (block) {
        lines.push("  " + block.label);
        lines.push("  " + block.text);
      });
      lines.push("Análisis del líder: " + (leaderAnalysisMap[pi.id] || "—"));
      lines.push("Conclusión: " + (draftMap[pi.id] || "—"));
      lines.push("");
    });
    return lines.join("\n");
  }

  function triggerFileDownload(content, mimeType, filename) {
    var blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  async function exportLeaderReportClient(format) {
    if (!currentPeriodId || !currentProgramId) {
      throw new Error("Seleccione período y programa.");
    }
    await requireSession();
    var periodId = Number(currentPeriodId);
    var programId = Number(currentProgramId);
    var cover = await buildLeaderCoverData(periodId, programId);
    var bundle = await buildLeaderPiReportData(periodId, programId);
    var sb = ensureSupabase();
    var analysesRes = await sb.from("leader_analysis")
      .select("perf_indicator_id, analysis_text")
      .eq("period_id", periodId)
      .eq("program_id", programId);
    if (analysesRes.error) throw analysesRes.error;
    var draftsRes = await sb.from("leader_report_drafts")
      .select("perf_indicator_id, conclusion_text")
      .eq("period_id", periodId)
      .eq("program_id", programId);
    if (draftsRes.error) throw draftsRes.error;
    var leaderAnalysisMap = {};
    (analysesRes.data || []).forEach(function (row) {
      leaderAnalysisMap[row.perf_indicator_id] = row.analysis_text || "";
    });
    var draftMap = {};
    (draftsRes.data || []).forEach(function (row) {
      draftMap[row.perf_indicator_id] = row.conclusion_text || "";
    });
    var moduleProgress = {
      completed: (currentModules || []).filter(function (m) { return m.status === "completed"; }).length,
      total: (currentModules || []).length,
    };
    var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    if (format === "docx") {
      triggerFileDownload(
        buildLeaderExportPlainText(cover, bundle, leaderAnalysisMap, draftMap),
        "text/plain",
        "informe-lider-" + stamp + ".txt"
      );
      return;
    }
    triggerFileDownload(
      buildLeaderExportHtml(cover, bundle, leaderAnalysisMap, draftMap, moduleProgress),
      "text/html",
      "informe-lider-" + stamp + ".html"
    );
  }

  async function exportLeaderReport(format) {
    try {
      await exportLeaderReportClient(format);
    } catch (clientErr) {
      console.warn("Export local falló, intentando edge function", clientErr);
      if (typeof RaApi === "undefined") throw clientErr;
      await RaApi.reportLeaderExport(Number(currentPeriodId), Number(currentProgramId), format);
    }
  }

  function renderConsolidatedDistributionChart(dist, pis, activeStudentCount, container) {
    var chartWrap = document.createElement("div");
    chartWrap.className = "dist-chart";
    chartWrap.setAttribute("role", "img");
    chartWrap.setAttribute("aria-label", "Gráfica de distribución consolidada por indicador de desempeño");

    var legend = document.createElement("div");
    legend.className = "dist-chart-legend";
    CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
      var item = document.createElement("span");
      item.className = "dist-chart-legend-item";
      var swatch = document.createElement("span");
      swatch.className = "dist-chart-swatch";
      swatch.style.backgroundColor = level.chartColor;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(level.labelEs));
      legend.appendChild(item);
    });
    chartWrap.appendChild(legend);

    pis.forEach(function (pi) {
      var d = dist[String(pi.id)];
      if (!d) return;
      var row = document.createElement("div");
      row.className = "dist-chart-row";
      var label = document.createElement("span");
      label.className = "dist-chart-row-label";
      label.textContent = d.pi_code || "—";
      label.title = d.pi_description || "";
      row.appendChild(label);
      var bar = document.createElement("div");
      bar.className = "dist-chart-bar";
      var hasSegment = false;
      CONSOLIDATED_LEVEL_CRITERIA.forEach(function (level) {
        var count = Number(d[level.distKey]) || 0;
        var pct = consolidatedDistPercent(count, activeStudentCount);
        if (pct <= 0) return;
        hasSegment = true;
        var seg = document.createElement("div");
        seg.className = "dist-chart-segment";
        seg.style.flexBasis = pct + "%";
        seg.style.width = pct + "%";
        seg.style.backgroundColor = level.chartColor;
        seg.title = level.labelEs + ": " + formatConsolidatedDistPercent(count, activeStudentCount) + "% (" + count + ")";
        if (pct >= 7) {
          seg.textContent = formatConsolidatedDistPercent(count, activeStudentCount) + "%";
        }
        bar.appendChild(seg);
      });
      if (!hasSegment) {
        var empty = document.createElement("div");
        empty.className = "dist-chart-empty";
        empty.textContent = "Sin calificaciones";
        bar.appendChild(empty);
      }
      row.appendChild(bar);
      chartWrap.appendChild(row);
    });

    container.appendChild(chartWrap);
  }

  function renderConsolidatedDistributionPreview(container, meta) {
    container.innerHTML = "";
    var header = document.createElement("p");
    header.className = "report-preview-heading";
    header.textContent = meta.titleLine;
    container.appendChild(header);

    var intro = document.createElement("p");
    intro.className = "muted report-preview-intro";
    intro.textContent = "Distribución consolidada — " + meta.activeStudentCount + " estudiantes activos en "
      + meta.moduleCount + " módulo(s). Misma escala que la vista del docente, sumando todos los grupos del programa.";
    container.appendChild(intro);

    if (!meta.pis.length) {
      var emptyPi = document.createElement("p");
      emptyPi.className = "muted";
      emptyPi.textContent = "Sin indicadores activos para este período.";
      container.appendChild(emptyPi);
      return;
    }

    renderConsolidatedDistributionChart(meta.dist, meta.pis, meta.activeStudentCount, container);
  }

  async function loadReportPreview(periodId) {
    if (!reportPreview) return;
    reportPreview.innerHTML = "<p class=\"muted\">Cargando distribución consolidada…</p>";
    try {
      await requireSession();
      var titleBase = selectedPeriodName();
      var raCode = "";
      var distPayload = null;
      var moduleCount = 0;

      if (typeof RaApi !== "undefined" && currentProgramId) {
        try {
          const report = await RaApi.reportAbetPreview(Number(periodId), Number(currentProgramId));
          raCode = safeText(report.student_outcome && report.student_outcome.code);
          moduleCount = (report.modules_summary || []).length;
          const activeStudentCount = (report.modules_summary || []).reduce(function (sum, mod) {
            return sum + (Number(mod.active_students) || 0);
          }, 0);
          const parsed = distributionFromAbetReport(report.distribution_by_pi || {});
          distPayload = {
            dist: parsed.dist,
            pis: parsed.pis,
            activeStudentCount: activeStudentCount,
            moduleCount: moduleCount,
          };
        } catch (apiErr) {
          console.warn("report-abet preview no disponible; consolidación local", apiErr);
        }
      }

      if (!distPayload) {
        const { data: periodRow } = await ensureSupabase()
          .from("periods")
          .select("*, student_outcomes(code)")
          .eq("id", periodId)
          .single();
        raCode = safeText(periodRow && periodRow.student_outcomes && periodRow.student_outcomes.code);
        const built = await buildConsolidatedDistributionClient(periodId, currentProgramId);
        distPayload = built;
        moduleCount = built.moduleCount;
      }

      renderConsolidatedDistributionPreview(reportPreview, {
        titleLine: titleBase + " · " + raCode,
        dist: distPayload.dist,
        pis: distPayload.pis,
        activeStudentCount: distPayload.activeStudentCount,
        moduleCount: moduleCount,
      });
    } catch (e) {
      console.error(e);
      reportPreview.innerHTML = "<p class=\"muted\">Error al cargar la distribución consolidada.</p>";
    }
  }

  function renderLeaderAnalysis(bundle, leaderAnalysisMap) {
    leaderAnalysisList.innerHTML = "";
    if (!bundle.pis.length) {
      leaderAnalysisList.innerHTML = '<p class="muted">Sin indicadores.</p>';
      return;
    }

    bundle.pis.forEach(function (pi) {
      var piKey = String(pi.id);
      var moduleRows = bundle.moduleDistByPi[piKey] || [];
      var teacherBlocks = bundle.teacherAnalysisByPi[piKey] || [];
      var leaderText = leaderAnalysisMap[pi.id] || "";

      var article = document.createElement("article");
      article.className = "leader-pi-report";
      article.id = "leader-pi-" + pi.id;

      var header = document.createElement("header");
      header.className = "leader-pi-report-header";
      var title = document.createElement("h5");
      title.textContent = safeText(pi.code) + " — Indicador de desempeño";
      var description = document.createElement("p");
      description.className = "muted leader-pi-description";
      description.textContent = safeText(pi.description);
      header.appendChild(title);
      header.appendChild(description);
      article.appendChild(header);

      var quantHeading = document.createElement("h6");
      quantHeading.className = "leader-pi-subheading";
      quantHeading.textContent = "Medición por grupo";
      article.appendChild(quantHeading);
      appendLeaderPiDistTable(article, pi, moduleRows);

      var chartsHeading = document.createElement("h6");
      chartsHeading.className = "leader-pi-subheading";
      chartsHeading.textContent = "Gráficas del indicador";
      article.appendChild(chartsHeading);
      appendLeaderPiCharts(article, pi, moduleRows);

      appendLeaderPiTeacherReadout(article, pi.code, teacherBlocks);

      var leaderSection = document.createElement("section");
      leaderSection.className = "leader-pi-leader-edit";
      var leaderLabel = document.createElement("label");
      leaderLabel.setAttribute("for", "la-" + pi.id);
      leaderLabel.textContent = "Análisis del líder";
      var leaderHint = document.createElement("p");
      leaderHint.className = "muted leader-pi-leader-hint";
      leaderHint.textContent = "Su interpretación consolidada para este indicador (editable).";
      var textarea = document.createElement("textarea");
      textarea.id = "la-" + pi.id;
      textarea.dataset.piId = pi.id;
      textarea.maxLength = 2000;
      textarea.placeholder = "Interprete el desempeño del programa en este indicador a partir de la medición y los análisis de los docentes…";
      textarea.value = leaderText;
      leaderSection.appendChild(leaderLabel);
      leaderSection.appendChild(leaderHint);
      leaderSection.appendChild(textarea);
      article.appendChild(leaderSection);

      leaderAnalysisList.appendChild(article);
    });
  }

  async function loadLeaderAnalysis(periodId) {
    leaderAnalysisList.innerHTML = '<p class="muted">Cargando...</p>';
    clearTimeout(leaderAnalysisAutosaveTimer);
    leaderAnalysisAutosaveTimer = null;
    try {
      await requireSession();
      if (!currentProgramId) {
        leaderAnalysisList.innerHTML = '<p class="muted">Selecciona un programa en el panel del líder.</p>';
        return;
      }
      const sb = ensureSupabase();
      const bundle = await buildLeaderPiReportData(periodId, currentProgramId);
      const { data: analyses } = await sb
        .from("leader_analysis")
        .select("perf_indicator_id, analysis_text")
        .eq("period_id", periodId)
        .eq("program_id", currentProgramId);
      const leaderAnalysisMap = {};
      (analyses || []).forEach(function (row) {
        leaderAnalysisMap[row.perf_indicator_id] = row.analysis_text || "";
      });
      renderLeaderAnalysis(bundle, leaderAnalysisMap);
    } catch (e) {
      console.error(e);
      leaderAnalysisList.innerHTML = '<p class="muted">Error al cargar el análisis por PI.</p>';
    }
  }

  async function loadLeaderDashboard(periodId) {
    if (!currentProgramId) return;
    await loadTracking(periodId);
    await loadLeaderCover(periodId);
    await loadReportPreview(periodId);
    await loadLeaderAnalysis(periodId);
    await loadLeaderReport(periodId);
    await updateClosePeriodButtonState(periodId);
    await loadReminderHistory(periodId);
  }

  async function loadTracking(periodId) {
    currentTrackingRows = [];
    if (!currentProgramId) return;
    try {
      await requireSession();
      const { data } = await ensureSupabase().from("module_ra_evaluations")
        .select("id, status, module:modules(id, course_name, group_name, program_id, module_staff(user_id, users(full_name)), module_students(count))")
        .eq("period_id", periodId);
      currentTrackingRows = (data || []).filter(function (r) {
        return r.module && String(r.module.program_id) === String(currentProgramId);
      }).map(function (r) {
        return {
          id: r.module.id,
          status: r.status,
          course_name: r.module.course_name,
          group_name: r.module.group_name,
          teacher: normalizeTeacher(r.module),
        };
      });
    } catch (e) { currentTrackingRows = []; }
  }

  function getAppLoginUrl() {
    return new URL("./index.html", window.location.href).href;
  }

  function progressPctFromModule(mod) {
    var active = Number(mod.students_active || 0);
    var graded = Number(mod.students_graded || 0);
    if (!active) {
      if (mod.status === "completed") return 100;
      if (mod.status === "in_progress") return 50;
      return 0;
    }
    return Math.round((graded / active) * 100);
  }

  function daysRemainingFromPeriod(period) {
    if (!period || !period.end_date) return "—";
    var end = new Date(String(period.end_date) + "T23:59:59");
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    return String(Math.max(diff, 0));
  }

  function resolveReminderTemplate(template, recipient) {
    return String(template || "")
      .replace(/\{nombre_docente\}/g, recipient.teacherName || "Docente")
      .replace(/\{modulo\}/g, recipient.moduleLabel || "—")
      .replace(/\{avance_pct\}/g, String(recipient.progressPct != null ? recipient.progressPct : 0))
      .replace(/\{dias_restantes\}/g, String(recipient.daysRemaining != null ? recipient.daysRemaining : "—"))
      .replace(/\{login_url\}/g, getAppLoginUrl());
  }

  function buildMailtoUrl(email, subject, body) {
    return "mailto:" + encodeURIComponent(email)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
  }

  function setReminderDialogStatus(message, kind) {
    if (!reminderDialogStatus) return;
    reminderDialogStatus.textContent = message || "";
    reminderDialogStatus.className = "status-message" + (kind ? " " + kind : "");
  }

  function showReminderLoadingState() {
    reminderRecipientsCache = [];
    if (reminderDialog) reminderDialog.classList.add("is-loading");
    if (reminderSelectAll) {
      reminderSelectAll.checked = false;
      reminderSelectAll.disabled = true;
    }
    if (reminderRecipientList) reminderRecipientList.innerHTML = "";
    if (reminderPreviewWrap) reminderPreviewWrap.hidden = true;
    if (reminderMailtoWrap) reminderMailtoWrap.hidden = true;
    if (reminderMailtoList) reminderMailtoList.innerHTML = "";
    if (reminderSendBtn) reminderSendBtn.disabled = true;
    setReminderDialogStatus("Cargando docentes pendientes…", "info");
  }

  function clearReminderLoadingState() {
    if (reminderDialog) reminderDialog.classList.remove("is-loading");
    if (reminderSelectAll) reminderSelectAll.disabled = false;
  }

  function selectedReminderRecipients() {
    if (!reminderRecipientList) return [];
    return Array.from(reminderRecipientList.querySelectorAll('input[type="checkbox"][data-evaluation-id]:checked'))
      .map(function (input) {
        var evaluationId = Number(input.dataset.evaluationId);
        return reminderRecipientsCache.find(function (row) { return row.evaluationId === evaluationId; });
      })
      .filter(Boolean);
  }

  function syncReminderDialogState() {
    var selected = selectedReminderRecipients();
    if (reminderSendBtn) reminderSendBtn.disabled = !selected.length;
    if (!reminderPreviewWrap || !reminderPreview) return;
    if (!selected.length || !reminderTemplate) {
      reminderPreviewWrap.hidden = true;
      return;
    }
    reminderPreviewWrap.hidden = false;
    reminderPreview.textContent = resolveReminderTemplate(reminderTemplate.value, selected[0]);
    if (reminderSelectAll && reminderRecipientsCache.length) {
      reminderSelectAll.checked = selected.length === reminderRecipientsCache.length;
      reminderSelectAll.indeterminate = selected.length > 0 && selected.length < reminderRecipientsCache.length;
    }
  }

  function renderReminderRecipients(recipients) {
    reminderRecipientsCache = recipients;
    clearReminderLoadingState();
    if (!reminderRecipientList) return;
    reminderRecipientList.innerHTML = "";
    if (!recipients.length) {
      var empty = document.createElement("li");
      empty.textContent = "No hay módulos pendientes en este programa.";
      reminderRecipientList.appendChild(empty);
      setReminderDialogStatus("Sin destinatarios pendientes.", "info");
      return;
    }
    recipients.forEach(function (row) {
      var li = document.createElement("li");
      var label = document.createElement("label");
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.evaluationId = String(row.evaluationId);
      checkbox.checked = true;
      checkbox.addEventListener("change", syncReminderDialogState);
      var text = document.createElement("span");
      text.textContent = safeText(row.teacherName) + " · " + safeText(row.moduleLabel)
        + " · " + statusLabel(row.status) + " · " + row.progressPct + "% · " + safeText(row.email);
      label.appendChild(checkbox);
      label.appendChild(text);
      li.appendChild(label);
      reminderRecipientList.appendChild(li);
    });
    if (reminderTemplate && !reminderTemplate.value.trim()) {
      reminderTemplate.value = REMINDER_TEMPLATE_DEFAULT;
    }
    setReminderDialogStatus(recipients.length + " módulo(s) pendiente(s). Revise el mensaje y confirme.", "info");
    syncReminderDialogState();
  }

  function renderReminderMailtoLinks(recipients, template) {
    if (!reminderMailtoWrap || !reminderMailtoList) return;
    reminderMailtoList.innerHTML = "";
    var periodName = selectedPeriodName();
    var subject = "Recordatorio evaluación RA — " + periodName;
    recipients.forEach(function (row) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = buildMailtoUrl(row.email, subject, resolveReminderTemplate(template, row));
      link.textContent = "Abrir correo para " + row.teacherName + " (" + row.moduleLabel + ")";
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      li.appendChild(link);
      reminderMailtoList.appendChild(li);
    });
    reminderMailtoWrap.hidden = !recipients.length;
  }

  async function buildReminderRecipients() {
    if (!currentPeriodId || !currentProgramId) return [];
    if (!currentModules.length) {
      await loadModules(currentPeriodId);
    }
    var pendingModules = currentModules.filter(function (mod) {
      return mod.status !== "completed";
    });
    if (!pendingModules.length) return [];
    var period = await getPeriod(currentPeriodId);
    var daysRemaining = daysRemainingFromPeriod(period);
    var teacherIds = [];
    pendingModules.forEach(function (mod) {
      if (mod.teacher && mod.teacher.id && teacherIds.indexOf(mod.teacher.id) < 0) {
        teacherIds.push(mod.teacher.id);
      }
    });
    var emailMap = {};
    if (teacherIds.length) {
      var usersRes = await ensureSupabase()
        .from("users")
        .select("id, email, full_name")
        .in("id", teacherIds);
      if (usersRes.error) throw usersRes.error;
      (usersRes.data || []).forEach(function (user) {
        emailMap[user.id] = user;
      });
    }
    return pendingModules.map(function (mod) {
      var teacherId = mod.teacher && mod.teacher.id;
      var user = teacherId && emailMap[teacherId];
      if (!user || !user.email) return null;
      return {
        evaluationId: mod.evaluation_id,
        userId: teacherId,
        teacherName: user.full_name || (mod.teacher && mod.teacher.full_name) || "Docente",
        email: user.email,
        courseName: mod.course_name,
        groupName: mod.group_name,
        moduleLabel: safeText(mod.course_name) + " · " + safeText(mod.group_name),
        status: mod.status,
        progressPct: progressPctFromModule(mod),
        daysRemaining: daysRemaining,
      };
    }).filter(Boolean);
  }

  async function countRecentReminderRecipients() {
    if (!currentUser) return 0;
    var since = new Date(Date.now() - REMINDER_WINDOW_MS).toISOString();
    var res = await ensureSupabase()
      .from("reminder_log")
      .select("recipient_ids")
      .eq("sent_by", currentUser.id)
      .gte("sent_at", since);
    if (res.error) throw res.error;
    return (res.data || []).reduce(function (sum, row) {
      var ids = row.recipient_ids;
      return sum + (Array.isArray(ids) ? ids.length : 0);
    }, 0);
  }

  async function loadReminderHistory(periodId) {
    if (!reminderHistoryWrap || !reminderHistoryList || !periodId) return;
    try {
      var res = await ensureSupabase()
        .from("reminder_log")
        .select("id, sent_at, recipient_ids, message_body")
        .eq("period_id", Number(periodId))
        .order("sent_at", { ascending: false })
        .limit(5);
      if (res.error) throw res.error;
      var rows = res.data || [];
      reminderHistoryList.innerHTML = "";
      if (!rows.length) {
        reminderHistoryWrap.hidden = true;
        return;
      }
      rows.forEach(function (row) {
        var li = document.createElement("li");
        var when = row.sent_at ? new Date(row.sent_at).toLocaleString("es-CO") : "—";
        var count = Array.isArray(row.recipient_ids) ? row.recipient_ids.length : 0;
        var excerpt = String(row.message_body || "").replace(/\s+/g, " ").trim().slice(0, 80);
        li.textContent = when + " · " + count + " destinatario(s) · " + excerpt;
        reminderHistoryList.appendChild(li);
      });
      reminderHistoryWrap.hidden = false;
    } catch (e) {
      console.error(e);
      reminderHistoryWrap.hidden = true;
    }
  }

  async function openReminderDialog() {
    if (!reminderDialog || !currentPeriodId || !sendReminderBtn) return;
    if (reminderDialogLoading) return;
    if (reminderDialog.open) return;
    if (!currentProgramId) {
      setStatus("Seleccione un programa antes de enviar recordatorios.", "error");
      return;
    }
    var loadToken = ++reminderLoadToken;
    reminderDialogLoading = true;
    if (actionButton()) actionButton().setLoading(sendReminderBtn, true, "Cargando…");
    showReminderLoadingState();
    if (reminderTemplate) reminderTemplate.value = REMINDER_TEMPLATE_DEFAULT;
    if (typeof reminderDialog.showModal === "function") reminderDialog.showModal();
    try {
      await requireSession();
      if (loadToken !== reminderLoadToken) return;
      var recipients = await buildReminderRecipients();
      if (loadToken !== reminderLoadToken) return;
      renderReminderRecipients(recipients);
      await loadReminderHistory(currentPeriodId);
    } catch (e) {
      console.error(e);
      if (loadToken !== reminderLoadToken) return;
      clearReminderLoadingState();
      if (typeof reminderDialog.close === "function") reminderDialog.close();
      setStatus("No se pudo preparar el envío de recordatorios.", "error");
    } finally {
      if (loadToken === reminderLoadToken) {
        reminderDialogLoading = false;
        if (actionButton()) actionButton().setLoading(sendReminderBtn, false);
      }
    }
  }

  function formatSupabaseError(error) {
    if (!error) return "";
    return String(error.message || error.details || error.hint || error).trim();
  }

  async function executeReminderSend() {
    var selected = selectedReminderRecipients();
    if (!selected.length || !currentPeriodId || !reminderTemplate) return;
    var uniqueUserIds = [];
    selected.forEach(function (row) {
      if (uniqueUserIds.indexOf(row.userId) < 0) uniqueUserIds.push(row.userId);
    });
    var sentRecently = await countRecentReminderRecipients();
    if (sentRecently + uniqueUserIds.length > REMINDER_MAX_RECIPIENTS_PER_WINDOW) {
      setReminderDialogStatus(
        "Límite de envío: máximo " + REMINDER_MAX_RECIPIENTS_PER_WINDOW
          + " docentes cada 60 segundos. Espere un momento e intente de nuevo.",
        "error"
      );
      return;
    }
    var template = reminderTemplate.value.trim() || REMINDER_TEMPLATE_DEFAULT;
    await requireSession();
    var { error: logError } = await ensureSupabase().from("reminder_log").insert({
      period_id: Number(currentPeriodId),
      sent_by: currentUser ? currentUser.id : null,
      recipient_ids: uniqueUserIds,
      message_body: template,
    });
    if (logError) {
      var denied = logError.code === "42501" || /policy|permission|denied/i.test(formatSupabaseError(logError));
      if (denied) {
        throw new Error(
          "Sin permiso para registrar recordatorios. Si es consolidador RA, aplique la migración "
          + "0021_reminder_log_consolidator_rls en Supabase."
        );
      }
      throw logError;
    }
    var auditRes = await ensureSupabase().from("security_events").insert({
      event: "reminder_sent",
      user_id: currentUser ? currentUser.id : null,
      severity: "INFO",
      detail: {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        recipient_ids: uniqueUserIds,
        module_count: selected.length,
      },
    });
    if (auditRes.error) throw auditRes.error;
    renderReminderMailtoLinks(selected, template);
    setReminderDialogStatus(
      "Registrado. Use los enlaces «Abrir correo» para enviar desde su cliente de correo.",
      "success"
    );
    setStatus("Recordatorios registrados para " + uniqueUserIds.length + " docente(s).", "success");
    await loadReminderHistory(currentPeriodId);
  }

  async function sendPendingReminders() {
    openReminderDialog();
  }

  function collectLeaderAnalysisRows() {
    return Array.from(leaderAnalysisList.querySelectorAll("textarea[data-pi-id]")).map(function (t) {
      return {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        perf_indicator_id: Number(t.dataset.piId),
        analysis_text: t.value,
        updated_by: currentUser ? currentUser.id : null,
      };
    });
  }

  async function persistLeaderAnalysis(statusMessage) {
    if (!currentPeriodId) return;
    if (!currentProgramId) { setLeaderAnalysisStatus("Selecciona un programa.", "error"); return; }
    const rows = collectLeaderAnalysisRows();
    try {
      await requireSession();
      const { error } = await ensureSupabase().from("leader_analysis").upsert(rows, { onConflict: "period_id,program_id,perf_indicator_id" });
      if (error) throw error;
      setLeaderAnalysisStatus(statusMessage || "Guardado.", "success");
    } catch(e) { setLeaderAnalysisStatus("Error.", "error"); }
  }

  async function saveLeaderAnalysis(event) {
    event.preventDefault();
    clearTimeout(leaderAnalysisAutosaveTimer);
    leaderAnalysisAutosaveTimer = null;
    if (!saveLeaderAnalysisBtn || !actionButton()) {
      await persistLeaderAnalysis("Guardado.");
      return;
    }
    await actionButton().run(saveLeaderAnalysisBtn, "Guardando…", async function () {
      await persistLeaderAnalysis("Guardado.");
    });
  }

  function renderLeaderReport(items) {
    leaderReportList.innerHTML = "";
    if (!items.length) { leaderReportList.innerHTML = '<p class="muted">Sin indicadores.</p>'; return; }
    items.forEach(function(item) {
      const b = document.createElement("div"); b.className = "analysis-item";
      b.innerHTML = '<label>' + item.pi_code + " · " + safeText(item.pi_description) + '</label><p class="muted">' + safeText(item.leader_analysis) + '</p>';
      const t = document.createElement("textarea"); t.dataset.piId = item.perf_indicator_id; t.maxLength = 3000; t.value = item.conclusion_text || "";
      b.appendChild(t); leaderReportList.appendChild(b);
    });
  }

  async function loadLeaderReport(periodId) {
    leaderReportList.innerHTML = '<p class="muted">Cargando...</p>';
    clearTimeout(leaderReportAutosaveTimer);
    leaderReportAutosaveTimer = null;
    try {
      await requireSession();
      const sb = ensureSupabase();
      const p = await getPeriod(periodId);
      let pis = [];
      if (p && p.rubric_id) {
        const { data } = await sb.from("perf_indicators").select("id, code, description").eq("rubric_id", p.rubric_id).eq("is_active", true).order("position");
        pis = data || [];
      }
      if (!currentProgramId) {
        leaderReportList.innerHTML = '<p class="muted">Selecciona un programa en el panel del líder.</p>';
        return;
      }
      const { data: la } = await sb.from("leader_analysis").select("perf_indicator_id, analysis_text").eq("period_id", periodId).eq("program_id", currentProgramId);
      const { data: dr } = await sb.from("leader_report_drafts").select("perf_indicator_id, conclusion_text").eq("period_id", periodId).eq("program_id", currentProgramId);
      const laMap = {}; (la || []).forEach(function(r) { laMap[r.perf_indicator_id] = r.analysis_text; });
      const drMap = {}; (dr || []).forEach(function(r) { drMap[r.perf_indicator_id] = r.conclusion_text; });
      renderLeaderReport(pis.map(function(pi) { return { perf_indicator_id: pi.id, pi_code: pi.code, pi_description: pi.description, leader_analysis: laMap[pi.id] || "", conclusion_text: drMap[pi.id] || "" }; }));
    } catch(e) { leaderReportList.innerHTML = '<p class="muted">Error.</p>'; }
  }

  function collectLeaderReportRows() {
    return Array.from(leaderReportList.querySelectorAll("textarea[data-pi-id]")).map(function (t) {
      return {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        perf_indicator_id: Number(t.dataset.piId),
        conclusion_text: t.value,
        updated_by: currentUser ? currentUser.id : null,
      };
    });
  }

  async function persistLeaderReport(statusMessage, refreshAfterSave) {
    if (!currentPeriodId) return;
    if (!currentProgramId) { setLeaderReportStatus("Selecciona un programa.", "error"); return; }
    const rows = collectLeaderReportRows();
    try {
      await requireSession();
      const { error } = await ensureSupabase().from("leader_report_drafts").upsert(rows, { onConflict: "period_id,program_id,perf_indicator_id" });
      if (error) throw error;
      setLeaderReportStatus(statusMessage || "Guardado.", "success");
      if (refreshAfterSave) await loadLeaderReport(currentPeriodId);
    } catch(e) { setLeaderReportStatus("Error.", "error"); }
  }

  async function saveLeaderReport(event) {
    event.preventDefault();
    clearTimeout(leaderReportAutosaveTimer);
    leaderReportAutosaveTimer = null;
    if (!saveLeaderReportBtn || !actionButton()) {
      await persistLeaderReport("Guardado.", true);
      return;
    }
    await actionButton().run(saveLeaderReportBtn, "Guardando…", async function () {
      await persistLeaderReport("Guardado.", true);
    });
  }

  async function loadPeriods() {
    setStatus("Cargando períodos...");
    try {
      await requireSession();
      const { data: periods, error } = await ensureSupabase().from("periods").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      periodSelect.innerHTML = "";
      if (!periods || !periods.length) {
        periodSelect.disabled = true;
        periodSelect.appendChild(new Option("Sin períodos", ""));
        return;
      }
      var activeCycle = await getActiveMeasurementCycle(ensureSupabase());
      var defaultPeriodId = "";

      if (isTeacherMode()) {
        var teacherIds = await teacherPeriodIds();
        if (teacherIds.size) {
          var teacherBuild = buildTeacherPeriodSelect(periods, teacherIds, activeCycle);
          defaultPeriodId = await resolveDefaultPeriodId(teacherBuild.defaultPool, "teacher");
        } else {
          periodSelect.appendChild(new Option("Sin módulos asignados", ""));
          periodSelect.disabled = true;
        }
      } else if (isLeaderMode()) {
        var leaderIds = await leaderPeriodIds();
        if (leaderIds.size) {
          var leaderBuild = buildLeaderPeriodSelect(periods, leaderIds, activeCycle);
          defaultPeriodId = await resolveDefaultPeriodId(leaderBuild.defaultPool, "leader");
        } else {
          periodSelect.appendChild(new Option("Sin RAs de consolidación", ""));
          periodSelect.disabled = true;
        }
      } else if (isAdmin()) {
        var allIds = await periodsWithModules();
        periods.forEach(function (p) { periodSelect.appendChild(new Option(p.name, p.id)); });
        periodSelect.disabled = false;
        defaultPeriodId = pickDefaultPeriodId(periods, allIds);
      } else {
        var fallbackIds = await teacherPeriodIds();
        if (!fallbackIds.size && isLeader()) fallbackIds = await periodsWithModules();
        if (fallbackIds.size) {
          defaultPeriodId = buildTeacherPeriodSelect(periods, fallbackIds, activeCycle);
          if (typeof defaultPeriodId === "object") {
            defaultPeriodId = await resolveDefaultPeriodId(defaultPeriodId.defaultPool, "teacher");
          }
        } else {
          periods.forEach(function (p) { periodSelect.appendChild(new Option(p.name, p.id)); });
          periodSelect.disabled = false;
          defaultPeriodId = pickDefaultPeriodId(periods, fallbackIds);
        }
      }

      if (defaultPeriodId) {
        periodSelect.value = defaultPeriodId;
        currentPeriodId = defaultPeriodId;
        await loadModules(defaultPeriodId);
      } else {
        currentPeriodId = "";
        renderEmpty(isLeaderMode() ? "Sin RAs de consolidación en este modo." : "Sin módulos en este modo.");
      }
    } catch (e) {
      console.error(e);
      periodSelect.innerHTML = '<option value="">Error</option>';
    }
  }

  periodSelect.addEventListener("change", function () {
    currentPeriodId = periodSelect.value;
    loadModules(periodSelect.value);
  });
  if (programSelect) {
    programSelect.addEventListener("change", function () {
      currentProgramId = programSelect.value;
      if (currentPeriodId) loadModules(currentPeriodId);
    });
  }
  viewReportBtn.addEventListener("click", async function() {
    if (!currentPeriodId || !viewReportBtn || !actionButton()) return;
    await actionButton().run(viewReportBtn, "Descargando…", async function() {
      await requireSession();
      if (typeof RaApi === "undefined") {
        setStatus("API no disponible.", "error");
        return;
      }
      await RaApi.reportAbetExport(Number(currentPeriodId), Number(currentProgramId), "xlsx");
      setStatus("Reporte ABET descargado.", "success");
    }).catch(function() {
      setStatus("Error al exportar reporte.", "error");
    });
  });
  closePeriodBtn.addEventListener("click", function() {
    openClosePeriodDialog();
  });
  if (closePeriodDialog) {
    closePeriodDialog.addEventListener("close", function() {
      if (closePeriodDialogLoading) {
        closePeriodLoadToken += 1;
        clearClosePeriodLoadingState();
        setClosePeriodButtonLoading(false);
        updateClosePeriodButtonState(currentPeriodId);
      }
    });
  }
  if (closePeriodForce) {
    closePeriodForce.addEventListener("change", syncClosePeriodConfirmState);
  }
  if (closePeriodForm) {
    closePeriodForm.addEventListener("submit", async function(event) {
      var submitter = event.submitter;
      if (!submitter || submitter.value !== "confirm") {
        closePeriodSummaryCache = null;
        return;
      }
      event.preventDefault();
      if (!closePeriodSummaryCache) return;
      if (!closePeriodConfirm || !actionButton()) return;
      await actionButton().run(closePeriodConfirm, "Cerrando…", async function () {
        setClosePeriodDialogStatus("Cerrando período…", "info");
        await requireSession();
        await executePeriodClose(!closePeriodSummaryCache.canCloseClean);
      }).catch(function (e) {
        console.error(e);
        setClosePeriodDialogStatus("Error al cerrar el período.", "error");
        syncClosePeriodConfirmState();
      });
    });
  }
  sendReminderBtn.addEventListener("click", sendPendingReminders);
  if (reminderDialog) {
    reminderDialog.addEventListener("close", function () {
      if (reminderDialogLoading) {
        reminderLoadToken += 1;
        clearReminderLoadingState();
        if (actionButton()) actionButton().setLoading(sendReminderBtn, false);
      }
    });
  }
  if (reminderSelectAll) {
    reminderSelectAll.addEventListener("change", function () {
      if (!reminderRecipientList) return;
      var checked = reminderSelectAll.checked;
      Array.from(reminderRecipientList.querySelectorAll('input[type="checkbox"][data-evaluation-id]'))
        .forEach(function (input) { input.checked = checked; });
      syncReminderDialogState();
    });
  }
  if (reminderTemplate) {
    reminderTemplate.addEventListener("input", syncReminderDialogState);
  }
  if (reminderForm) {
    reminderForm.addEventListener("submit", async function (event) {
      var submitter = event.submitter;
      if (!submitter || submitter.value !== "send") return;
      event.preventDefault();
      if (!reminderSendBtn || !actionButton()) return;
      await actionButton().run(reminderSendBtn, "Registrando…", async function () {
        await executeReminderSend();
      }).catch(function (e) {
        console.error(e);
        var detail = formatSupabaseError(e);
        setReminderDialogStatus(
          "Error al registrar los recordatorios." + (detail ? " " + detail : ""),
          "error"
        );
      });
    });
  }
  leaderAnalysisForm.addEventListener("submit", saveLeaderAnalysis);
  leaderReportForm.addEventListener("submit", saveLeaderReport);
  leaderAnalysisList.addEventListener("input", function (event) {
    var target = event.target;
    if (!target || target.tagName !== "TEXTAREA" || !target.dataset.piId) return;
    clearTimeout(leaderAnalysisAutosaveTimer);
    setLeaderAnalysisStatus("Guardando automáticamente…", "info");
    leaderAnalysisAutosaveTimer = setTimeout(function () {
      leaderAnalysisAutosaveTimer = null;
      persistLeaderAnalysis("Guardado automáticamente.");
    }, LEADER_AUTOSAVE_DELAY_MS);
  });
  leaderReportList.addEventListener("input", function (event) {
    var target = event.target;
    if (!target || target.tagName !== "TEXTAREA" || !target.dataset.piId) return;
    clearTimeout(leaderReportAutosaveTimer);
    setLeaderReportStatus("Guardando automáticamente…", "info");
    leaderReportAutosaveTimer = setTimeout(function () {
      leaderReportAutosaveTimer = null;
      persistLeaderReport("Guardado automáticamente.", false);
    }, LEADER_AUTOSAVE_DELAY_MS);
  });
  leaderReportPdfBtn.addEventListener("click", async function() {
    if (!currentPeriodId || !leaderReportPdfBtn || !actionButton()) return;
    if (!currentProgramId) {
      setLeaderReportStatus("Seleccione un programa.", "error");
      return;
    }
    await actionButton().run(leaderReportPdfBtn, "Generando…", async function() {
      setLeaderReportStatus("Generando informe…", "info");
      await requireSession();
      await exportLeaderReport("pdf");
      setLeaderReportStatus("Informe descargado. Ábralo y use Imprimir → Guardar como PDF.", "success");
    }).catch(function (e) {
      console.error(e);
      setLeaderReportStatus("Error al exportar: " + (e.message || e), "error");
    });
  });
  leaderReportDocxBtn.addEventListener("click", async function() {
    if (!currentPeriodId || !leaderReportDocxBtn || !actionButton()) return;
    if (!currentProgramId) {
      setLeaderReportStatus("Seleccione un programa.", "error");
      return;
    }
    await actionButton().run(leaderReportDocxBtn, "Generando…", async function() {
      setLeaderReportStatus("Generando texto…", "info");
      await requireSession();
      await exportLeaderReport("docx");
      setLeaderReportStatus("Informe descargado (texto plano).", "success");
    }).catch(function (e) {
      console.error(e);
      setLeaderReportStatus("Error al exportar: " + (e.message || e), "error");
    });
  });
  if (modogrillaCsvApply) {
    modogrillaCsvApply.addEventListener("click", async function () {
      var file = modogrillaCsvInput && modogrillaCsvInput.files && modogrillaCsvInput.files[0];
      if (!file) {
        setModogrillaCsvResult("Seleccione un archivo CSV.", "error");
        return;
      }
      if (!actionButton()) return;
      await actionButton().run(modogrillaCsvApply, "Procesando…", async function () {
        await requireSession();
        await applyModogrillaCsv(file);
      }).catch(function (e) {
        setModogrillaCsvResult("Error al procesar CSV: " + (e.message || e), "error");
      });
    });
  }
  if (modogrillaTeachersBody) {
    modogrillaTeachersBody.addEventListener("change", async function (e) {
      var cb = e.target;
      if (!cb || cb.type !== "checkbox" || !cb.dataset.userId) return;
      try {
        await requireSession();
        await updateTeacherGridFlag(cb.dataset.userId, cb.checked);
        setModogrillaCsvResult(cb.checked ? "ModoGrilla habilitado." : "ModoGrilla deshabilitado.", "success");
      } catch (err) {
        cb.checked = !cb.checked;
        setModogrillaCsvResult("Error al actualizar docente.", "error");
      }
    });
  }
  if (modogrillaTeacherSearch) {
    modogrillaTeacherSearch.addEventListener("input", function () {
      renderModogrillaTeachersTable(modogrillaTeacherSearch.value);
    });
  }

  if (changeRoleBtn) {
    changeRoleBtn.addEventListener("click", function () {
      var next = isLeaderMode() ? "teacher" : "leader";
      RaRoleMode.setWorkMode(next);
      workMode = next;
      currentProgramId = "";
      applyRoleChrome();
      loadPeriods();
    });
  }

  logoutBtn.addEventListener("click", async function() {
    if (!actionButton()) {
      window.location.replace("./index.html");
      return;
    }
    await actionButton().run(logoutBtn, "Cerrando sesión…", async function() {
      if (typeof RaRoleMode !== "undefined") RaRoleMode.clearWorkMode();
      await ensureSupabase().auth.signOut();
    }).catch(function () {});
    window.location.replace("./index.html");
  });

  leaderPanel.hidden = true;
  if (adminPanel) adminPanel.hidden = true;
  initLeaderTabs();
  loadUser().then(function (loaded) {
    if (!loaded) return;
    if (isAdmin()) {
      loadAdminDashboard();
      return;
    }
    loadPeriods().then(function () { currentPeriodId = periodSelect.value; });
  });
})();