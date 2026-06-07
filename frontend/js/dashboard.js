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
  const sendReminderBtn = document.getElementById("send-reminder-btn");
  const reportPreview = document.getElementById("report-preview");
  const leaderAnalysisForm = document.getElementById("leader-analysis-form");
  const leaderAnalysisList = document.getElementById("leader-analysis-list");
  const leaderAnalysisStatus = document.getElementById("leader-analysis-status");
  const leaderReportForm = document.getElementById("leader-report-form");
  const leaderReportList = document.getElementById("leader-report-list");
  const leaderReportStatus = document.getElementById("leader-report-status");
  const leaderReportPdfBtn = document.getElementById("leader-report-pdf-btn");
  const leaderReportDocxBtn = document.getElementById("leader-report-docx-btn");
  const adminPanel = document.getElementById("admin-panel");
  const adminLines = document.getElementById("admin-lines");
  const adminStatus = document.getElementById("admin-status");
  const modulesPanel = document.getElementById("modules-panel");

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
  let currentPeriodId = "";
  let currentProgramId = "";
  let currentModules = [];
  let currentTrackingRows = [];

  const periodCache = new Map();
  const activePiCache = new Map();

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

  function safeText(value) {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
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

  function isLeader() { return currentUser && currentUser.role === "leader"; }
  function isAdmin() { return currentUser && currentUser.role === "admin"; }

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
    cell.colSpan = 7; cell.textContent = message;
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

  function renderModules(modules) {
    currentModules = modules;
    modulesBody.innerHTML = "";
    updatePeriodProgress(modules);
    if (!modules.length) {
      const message = emptyModulesMessage();
      renderEmpty(message);
      setStatus(message, "info");
      return;
    }
    modules.forEach(function(m) {
      const row = document.createElement("tr");
      const actionHref = "./assessment.html?evaluation_id=" + m.evaluation_id;
      [safeText(m.course_name), safeText(m.ra_code), safeText(m.group_name), teacherText(m), statusLabel(m.status), progressText(m)]
        .forEach(function(t) { const c = document.createElement("td"); c.textContent = t; row.appendChild(c); });
      const ac = document.createElement("td"), a = document.createElement("a");
      a.className = "table-action"; a.href = actionHref;
      a.textContent = isLeader() ? "Revisar" : "Calificar";
      ac.appendChild(a); row.appendChild(ac);
      modulesBody.appendChild(row);
    });
    setStatus("Módulos cargados: " + modules.length + ".", "success");
  }

  async function teacherPeriodIds() {
    if (!currentUser || currentUser.role !== "teacher") return null;
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
    if (periodIdsWithData && periodIdsWithData.size) {
      const match = periods.find(function (p) { return periodIdsWithData.has(String(p.id)); });
      if (match) return String(match.id);
    }
    return String(periods[0].id);
  }

  function filterEvaluationsForRole(rows) {
    if (!currentUser || currentUser.role !== "teacher") return rows || [];
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
      welcomeMsg.textContent = "Hola, " + safeText(profile.full_name) + " (" + safeText(profile.role) + ")";
      var admin = isAdmin();
      if (adminPanel) adminPanel.hidden = !admin;
      if (modulesPanel) modulesPanel.hidden = admin;
      leaderPanel.hidden = !isLeader() || admin;
      leaderReportPdfBtn.hidden = !isLeader() || admin;
      leaderReportDocxBtn.hidden = !isLeader() || admin;
      if (programSelect) programSelect.hidden = !isLeader() || admin;
      if (admin && document.getElementById("dashboard-title")) {
        document.getElementById("dashboard-title").textContent = "Líder de medición";
      }
      return true;
    } catch (e) { console.error(e); welcomeMsg.textContent = "No se pudo cargar."; return false; }
  }

  async function getPeriod(id) {
    if (periodCache.has(id)) return periodCache.get(id);
    const { data, error } = await ensureSupabase().from("periods").select("id, rubric_id").eq("id", id).single();
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
    if (!programSelect || !isLeader()) return;
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
        programSelect.appendChild(new Option("Sin programas asignados", ""));
        return;
      }
      rows.forEach(function (a) {
        const prog = a.program || {};
        programSelect.appendChild(new Option(prog.name || ("Programa " + a.program_id), a.program_id));
      });
      programSelect.disabled = false;
      currentProgramId = String(rows[0].program_id);
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
      if (isLeader()) await loadLeaderPrograms(periodId);
      const { data: rows, error } = await sb.from("module_ra_evaluations")
        .select("id, status, period_id, module:modules(id, course_code, course_name, group_name, program_id, module_staff(user_id, users(full_name))), period:periods(student_outcome:student_outcomes(code))")
        .eq("period_id", periodId)
        .order("course_code", { foreignTable: "modules" })
        .order("group_name", { foreignTable: "modules" });
      if (error) throw error;
      let visibleRows = filterEvaluationsForRole(rows);
      if (isLeader() && currentProgramId) {
        visibleRows = visibleRows.filter(function (row) {
          return row.module && String(row.module.program_id) === String(currentProgramId);
        });
      }
      const piIds = await getActivePis(periodId);
      const modules = visibleRows.map(function (r) {
        const mod = r.module || {};
        const m = Object.assign({}, mod);
        m.evaluation_id = r.id;
        m.status = r.status;
        m.ra_code = (r.period && r.period.student_outcome && r.period.student_outcome.code) || "—";
        m.teacher = normalizeTeacher(mod);
        m.students_active = 0;
        m.students_graded = 0;
        return m;
      });
      await Promise.all(modules.map(async function (m) {
        try {
          m.students_active = await countActive(m.id);
          m.students_graded = await countGraded(m.id, piIds);
        } catch (e) { console.error(e); }
      }));
      renderModules(modules);
      if (isLeader() && currentProgramId) await loadLeaderDashboard(periodId);
    } catch (e) { console.error(e); renderEmpty("Error al cargar."); setStatus("Error.", "error"); }
  }

  async function loadReportPreview(periodId) {
    reportPreview.textContent = "Cargando...";
    try {
      await requireSession();
      if (typeof RaApi !== "undefined") {
        const report = await RaApi.reportAbetPreview(Number(periodId));
        const moduleCount = (report.modules_summary || []).length;
        reportPreview.textContent =
          selectedPeriodName() + " · " + safeText(report.student_outcome && report.student_outcome.code) +
          " · " + moduleCount + " módulos con estudiantes activos";
        return;
      }
      const { data: p } = await ensureSupabase().from("periods").select("*, student_outcomes(code)").eq("id", periodId).single();
      reportPreview.textContent = selectedPeriodName() + " · " + safeText(p && p.student_outcomes && p.student_outcomes.code);
    } catch(e) { reportPreview.textContent = "Error al cargar reporte."; }
  }

  function mergeAnalysis(actionPlanData, leaderAnalysisData) {
    const saved = {};
    (leaderAnalysisData.analyses || []).forEach(function(a) { saved[a.perf_indicator_id] = a.analysis_text; });
    return (actionPlanData.plans || []).map(function(plan) {
      return { perf_indicator_id: plan.perf_indicator_id, pi_code: plan.pi_code, standard: plan.standard, suggested_action_type: plan.suggested_action_type, analysis_text: saved[plan.perf_indicator_id] || "" };
    });
  }

  function renderLeaderAnalysis(items) {
    leaderAnalysisList.innerHTML = "";
    if (!items.length) { leaderAnalysisList.innerHTML = '<p class="muted">Sin indicadores.</p>'; return; }
    items.forEach(function(item) {
      const b = document.createElement("div"); b.className = "analysis-item";
      const l = document.createElement("label"); l.setAttribute("for", "la-" + item.perf_indicator_id);
      l.textContent = item.pi_code + " · " + safeText(item.standard) + " · " + safeText(item.suggested_action_type);
      const t = document.createElement("textarea"); t.id = "la-" + item.perf_indicator_id;
      t.dataset.piId = item.perf_indicator_id; t.maxLength = 2000; t.value = item.analysis_text;
      b.appendChild(l); b.appendChild(t); leaderAnalysisList.appendChild(b);
    });
  }

  async function loadLeaderAnalysis(periodId) {
    leaderAnalysisList.innerHTML = '<p class="muted">Cargando...</p>';
    try {
      await requireSession();
      const sb = ensureSupabase();
      const p = await getPeriod(periodId);
      let pis = [];
      if (p && p.rubric_id) {
        const { data } = await sb.from("perf_indicators").select("id, code").eq("rubric_id", p.rubric_id).eq("is_active", true).order("position");
        pis = data || [];
      }
      if (!currentProgramId) {
        leaderAnalysisList.innerHTML = '<p class="muted">Selecciona un programa en el panel del líder.</p>';
        return;
      }
      const { data: plans } = await sb.from("action_plans").select("perf_indicator_id, action_type, perf_indicators(code)").eq("period_id", periodId).eq("program_id", currentProgramId);
      const { data: analyses } = await sb.from("leader_analysis").select("perf_indicator_id, analysis_text").eq("period_id", periodId).eq("program_id", currentProgramId);
      const planMap = {}; (plans || []).forEach(function(r) { planMap[r.perf_indicator_id] = r; });
      const items = mergeAnalysis(
        { plans: pis.map(function(pi) { const ex = planMap[pi.id]; return { perf_indicator_id: pi.id, pi_code: pi.code, standard: "—", suggested_action_type: (ex && ex.action_type) || "preventive" }; }) },
        { analyses: (analyses || []).map(function(r) { return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text }; }) }
      );
      renderLeaderAnalysis(items);
    } catch(e) { leaderAnalysisList.innerHTML = '<p class="muted">Error.</p>'; }
  }

  async function loadLeaderDashboard(periodId) {
    if (!currentProgramId) return;
    await loadTracking(periodId);
    await loadReportPreview(periodId);
    await loadLeaderAnalysis(periodId);
    await loadLeaderReport(periodId);
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

  function pendingIds() {
    const seen = {}; const ids = [];
    currentTrackingRows.forEach(function(r) { if (!r.teacher || r.status === "completed" || seen[r.teacher.id]) return; seen[r.teacher.id] = true; ids.push(r.teacher.id); });
    return ids.slice(0, 15);
  }

  async function sendPendingReminders() {
    if (!currentPeriodId) return;
    if (!currentTrackingRows.length) await loadTracking(currentPeriodId);
    const ids = pendingIds();
    if (!ids.length) { setStatus("Sin pendientes.", "info"); return; }
    try {
      await requireSession();
      const { error } = await ensureSupabase().from("reminder_log").insert({ period_id: Number(currentPeriodId), sent_by: currentUser ? currentUser.id : null, recipient_ids: ids, message_body: "Recordatorio de evaluacion." });
      if (error) throw error;
      setStatus("Recordatorios registrados: " + ids.length, "success");
    } catch(e) { setStatus("Error.", "error"); }
  }

  async function saveLeaderAnalysis(event) {
    event.preventDefault();
    if (!currentPeriodId) return;
    if (!currentProgramId) { setLeaderAnalysisStatus("Selecciona un programa.", "error"); return; }
    const rows = Array.from(leaderAnalysisList.querySelectorAll("textarea[data-pi-id]")).map(function (t) {
      return {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        perf_indicator_id: Number(t.dataset.piId),
        analysis_text: t.value,
        updated_by: currentUser ? currentUser.id : null,
      };
    });
    try {
      await requireSession();
      const { error } = await ensureSupabase().from("leader_analysis").upsert(rows, { onConflict: "period_id,program_id,perf_indicator_id" });
      if (error) throw error;
      setLeaderAnalysisStatus("Guardado.", "success");
    } catch(e) { setLeaderAnalysisStatus("Error.", "error"); }
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

  async function saveLeaderReport(event) {
    event.preventDefault();
    if (!currentPeriodId) return;
    if (!currentProgramId) { setLeaderReportStatus("Selecciona un programa.", "error"); return; }
    const rows = Array.from(leaderReportList.querySelectorAll("textarea[data-pi-id]")).map(function (t) {
      return {
        period_id: Number(currentPeriodId),
        program_id: Number(currentProgramId),
        perf_indicator_id: Number(t.dataset.piId),
        conclusion_text: t.value,
        updated_by: currentUser ? currentUser.id : null,
      };
    });
    try {
      await requireSession();
      const { error } = await ensureSupabase().from("leader_report_drafts").upsert(rows, { onConflict: "period_id,program_id,perf_indicator_id" });
      if (error) throw error;
      setLeaderReportStatus("Guardado.", "success");
      await loadLeaderReport(currentPeriodId);
    } catch(e) { setLeaderReportStatus("Error.", "error"); }
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
      periods.forEach(function (p) { periodSelect.appendChild(new Option(p.name, p.id)); });
      periodSelect.disabled = false;
      let periodIdsWithData = await teacherPeriodIds();
      if (!periodIdsWithData && currentUser && (currentUser.role === "leader" || currentUser.role === "admin")) {
        periodIdsWithData = await periodsWithModules();
      }
      const defaultPeriodId = pickDefaultPeriodId(periods, periodIdsWithData);
      periodSelect.value = defaultPeriodId;
      currentPeriodId = defaultPeriodId;
      await loadModules(defaultPeriodId);
    } catch (e) { periodSelect.innerHTML = '<option value="">Error</option>'; }
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
    if (!currentPeriodId) return;
    try {
      await requireSession();
      if (typeof RaApi === "undefined") { setStatus("API no disponible.", "error"); return; }
      await RaApi.reportAbetExport(Number(currentPeriodId), "xlsx");
      setStatus("Reporte ABET descargado.", "success");
    } catch (e) {
      setStatus("Error al exportar reporte.", "error");
    }
  });
  closePeriodBtn.addEventListener("click", async function() {
    if (!currentPeriodId) return;
    if ((currentModules || []).some(function(m) { return m.status !== "completed"; })) { setStatus("Modulos pendientes.", "error"); return; }
    try { await requireSession(); const { error } = await ensureSupabase().from("periods").update({ status: "closed" }).eq("id", currentPeriodId); if (error) throw error; setStatus("Cerrado.", "success"); await loadPeriods(); } catch(e) { setStatus("Error.", "error"); }
  });
  sendReminderBtn.addEventListener("click", sendPendingReminders);
  leaderAnalysisForm.addEventListener("submit", saveLeaderAnalysis);
  leaderReportForm.addEventListener("submit", saveLeaderReport);
  leaderReportPdfBtn.addEventListener("click", async function() {
    if (!currentPeriodId) return;
    try {
      await requireSession();
      await RaApi.reportLeaderExport(Number(currentPeriodId), "pdf");
      setLeaderReportStatus("Informe PDF descargado.", "success");
    } catch (e) {
      setLeaderReportStatus("Error al exportar PDF.", "error");
    }
  });
  leaderReportDocxBtn.addEventListener("click", async function() {
    if (!currentPeriodId) return;
    try {
      await requireSession();
      await RaApi.reportLeaderExport(Number(currentPeriodId), "docx");
      setLeaderReportStatus("Informe DOCX descargado.", "success");
    } catch (e) {
      setLeaderReportStatus("Error al exportar DOCX.", "error");
    }
  });
  logoutBtn.addEventListener("click", async function() { try { await ensureSupabase().auth.signOut(); } catch(e) {} window.location.replace("./index.html"); });

  leaderPanel.hidden = true;
  if (adminPanel) adminPanel.hidden = true;
  loadUser().then(function (loaded) {
    if (!loaded) return;
    if (isAdmin()) {
      loadAdminDashboard();
      return;
    }
    loadPeriods().then(function () { currentPeriodId = periodSelect.value; });
  });
})();