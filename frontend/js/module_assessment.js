(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var evaluationId = params.get("evaluation_id");
  var legacyModuleId = params.get("module_id");
  if (!evaluationId && !legacyModuleId) {
    document.body.innerHTML = '<p style="padding:2rem">Falta evaluation_id en la URL.</p>';
    return;
  }

  var wizardSteps = Array.from(document.querySelectorAll("[data-step-target]"));
  var wizardPanels = Array.from(document.querySelectorAll("[data-step-panel]"));
  var wizardNextBtn = document.getElementById("wizard-next-btn");
  var wizardPrevBtn = document.getElementById("wizard-prev-btn");
  var summaryRa = document.getElementById("summary-ra");
  var summaryModule = document.getElementById("summary-module");
  var summaryLeader = document.getElementById("summary-leader");
  var summaryLeaderEmail = document.getElementById("summary-leader-email");
  var submitLeaderNotice = document.getElementById("submit-leader-notice");
  var submitLeaderName = document.getElementById("submit-leader-name");
  var submitLeaderEmail = document.getElementById("submit-leader-email");
  var studentsBody = document.getElementById("students-body");
  var distributionBody = document.getElementById("distribution-body");
  var analysisBody = document.getElementById("analysis-body");
  var submitModuleBtn = document.getElementById("submit-module-btn");
  var saveAssessmentsBtn = document.getElementById("save-assessments-btn");
  var saveQualitativeBtn = document.getElementById("save-qualitative-btn");
  var statusMsg = document.getElementById("assessment-status");
  var stepOrder = ["general", "grading", "distribution", "analysis", "submit"];
  var currentStepIndex = 0;

  var moduleStudents = [];
  var piRows = [];
  var activeStudentCount = 0;
  var currentModule = null;
  var currentEvaluation = null;
  var currentConsolidator = null;
  var currentRaLabel = "";

  var LEVEL_CRITERIA = [
    { dbValue: 1, labelEs: "Deficiente", distKey: "Deficiente", score: 1 },
    { dbValue: 2, labelEs: "Insuficiente", distKey: "Insuficiente", score: 2 },
    { dbValue: 3, labelEs: "Bueno", distKey: "Bueno", score: 4 },
    { dbValue: 4, labelEs: "Sobresaliente", distKey: "Sobresaliente", score: 5 },
  ];

  function levelMetaByDbValue(dbValue) {
    return LEVEL_CRITERIA.find(function (level) { return level.dbValue === Number(dbValue); }) || null;
  }

  function buildLevelSelectOptions() {
    var html = '<option value="">—</option>';
    LEVEL_CRITERIA.forEach(function (level) {
      html += '<option value="' + level.dbValue + '">' + level.labelEs + "</option>";
    });
    return html;
  }

  function assertSupabase() {
    if (typeof supabase === "undefined" || !supabase || !supabase.auth) throw new Error("Supabase no disponible.");
    return supabase;
  }

  async function requireAuthOrRedirect() {
    var sb = assertSupabase();
    var { data, error } = await sb.auth.getSession();
    if (error || !data || !data.session) { window.location.replace("./index.html"); return null; }
    return data.session;
  }

  function isAuthError(err) {
    if (!err) return false;
    if (typeof err.status === "number" && (err.status === 401 || err.status === 403)) return true;
    if (typeof err.code === "string" && (err.code === "PGRST301" || err.code === "401")) return true;
    if (err.message && (err.message.indexOf("JWT") >= 0 || err.message.indexOf("expired") >= 0)) return true;
    return false;
  }

  function redirectToLogin() { window.location.replace("./index.html"); }

  function setStatus(text, kind) {
    statusMsg.textContent = text;
    statusMsg.className = "status-message" + (kind ? " " + kind : "");
  }

  function enableActions() {
    wizardNextBtn.disabled = false;
    wizardPrevBtn.disabled = false;
    saveAssessmentsBtn.disabled = false;
    saveQualitativeBtn.disabled = false;
  }

  function showStep(stepTarget) {
    currentStepIndex = stepOrder.indexOf(stepTarget);
    wizardPanels.forEach(function (p) { p.hidden = p.dataset.stepPanel !== stepTarget; });
    wizardSteps.forEach(function (s) { s.classList.toggle("active", s.dataset.stepTarget === stepTarget); });
    wizardNextBtn.hidden = currentStepIndex >= stepOrder.length - 1;
    wizardPrevBtn.hidden = currentStepIndex <= 0;
  }

  function buildDistribution(students, pis) {
    var dist = {};
    pis.forEach(function (pi) {
      dist[pi.id] = { pi_code: pi.code, pi_description: pi.description };
      LEVEL_CRITERIA.forEach(function (level) {
        dist[pi.id][level.distKey] = 0;
      });
    });
    students.forEach(function (s) {
      (s.assessments || []).forEach(function (a) {
        var bucket = dist[a.perf_indicator_id];
        if (!bucket) return;
        var meta = levelMetaByDbValue(a.level);
        if (meta) bucket[meta.distKey] = (bucket[meta.distKey] || 0) + 1;
      });
    });
    return dist;
  }

  function buildStudentsHead() {
    var headRow = document.querySelector("#students-head tr");
    headRow.querySelectorAll(".pi-header").forEach(function (h) { h.remove(); });
    (piRows || []).forEach(function (pi) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "pi-header";
      th.title = pi.description || pi.code;
      th.textContent = pi.code;
      headRow.appendChild(th);
    });
    var emptyRow = studentsBody.querySelector("tr:only-child td[colspan]");
    if (emptyRow) emptyRow.colSpan = 2 + (piRows || []).length;
  }

  function buildMailtoLink(leader, mod, raCode) {
    if (!leader || !leader.email) return "#";
    var code = mod && mod.course_code ? mod.course_code : "";
    var group = mod && mod.group_name ? mod.group_name : "";
    var subject = "[RA Assessment] Medición completada — " + raCode + " — " + code + " — " + group;
    var body = "Estimado/a " + (leader.full_name || "líder consolidador") + ",\n\n"
      + "Completé la medición del RA " + raCode + " para el módulo " + code
      + (group ? " (grupo " + group + ")" : "") + ".\n\nSaludos.";
    return "mailto:" + encodeURIComponent(leader.email)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
  }

  function renderLeaderContact(leader, raCode, mod) {
    var name = leader && leader.full_name ? leader.full_name : "No asignado en el mapeo";
    var email = leader && leader.email ? leader.email : "";
    if (summaryRa) summaryRa.textContent = currentRaLabel || raCode || "—";
    if (summaryLeader) summaryLeader.textContent = name;
    if (summaryLeaderEmail) {
      if (email) {
        summaryLeaderEmail.innerHTML = "";
        var link = document.createElement("a");
        link.href = buildMailtoLink(leader, mod, raCode);
        link.textContent = email;
        summaryLeaderEmail.appendChild(link);
      } else {
        summaryLeaderEmail.textContent = "—";
      }
    }
    if (submitLeaderNotice) submitLeaderNotice.hidden = !leader;
    if (submitLeaderName) submitLeaderName.textContent = name;
    if (submitLeaderEmail) {
      if (email) {
        submitLeaderEmail.href = buildMailtoLink(leader, mod, raCode);
        submitLeaderEmail.textContent = email;
      } else {
        submitLeaderEmail.removeAttribute("href");
        submitLeaderEmail.textContent = "—";
      }
    }
  }

  function renderModuleSummary(mod) {
    var code = mod && mod.course_code ? mod.course_code : "";
    var name = mod && mod.course_name ? mod.course_name : "";
    var group = mod && mod.group_name ? mod.group_name : "";
    var title = code && name ? code + " — " + name : (name || code || "Módulo");
    if (group) title += " · Grupo " + group;
    title += " — " + activeStudentCount + " estudiantes activos";
    if (summaryModule) summaryModule.textContent = title;
    var so = mod && mod.period && mod.period.student_outcome;
    var raCode = so && so.code ? so.code : "";
    currentRaLabel = raCode && so && so.description
      ? raCode + " — " + so.description
      : raCode || "—";
    renderLeaderContact(currentConsolidator, raCode, mod);
  }

  async function loadConsolidatorInfo(client, mod) {
    var period = mod && mod.period;
    if (!period || !period.cycle_id || !period.student_outcome) return null;
    var programId = mod.program_id || period.student_outcome.program_id;
    if (!programId) return null;
    try {
      var res = await client.from("ra_consolidator_assignments")
        .select("consolidator:users(full_name, email)")
        .eq("cycle_id", period.cycle_id)
        .eq("program_id", programId)
        .eq("student_outcome_id", period.student_outcome.id)
        .maybeSingle();
      if (res.error || !res.data) return null;
      return res.data.consolidator || null;
    } catch (e) {
      return null;
    }
  }

  async function resolveEvaluationId(client) {
    if (evaluationId) return Number(evaluationId);
    if (!legacyModuleId) return null;
    var { data, error } = await client.from("module_ra_evaluations")
      .select("id")
      .eq("module_id", legacyModuleId)
      .order("id")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    evaluationId = String(data.id);
    return data.id;
  }

  function renderStudents(studentsData) {
    studentsBody.innerHTML = "";
    (studentsData.students || []).forEach(function (s) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + (s.full_name || "—") + "</td><td>" + (s.internal_id || "—") + "</td>";
      (piRows || []).forEach(function (pi) {
        var cell = document.createElement("td");
        var sel = document.createElement("select");
        sel.className = "level-select";
        sel.title = pi.code + ": " + (pi.description || "");
        sel.dataset.moduleStudentId = s.module_student_id;
        sel.dataset.piId = pi.id;
        sel.innerHTML = buildLevelSelectOptions();
        var existing = (s.assessments || []).find(function (a) { return a.perf_indicator_id === pi.id; });
        if (existing) sel.value = existing.level;
        cell.appendChild(sel);
        row.appendChild(cell);
      });
      studentsBody.appendChild(row);
    });
  }

  function renderDistribution(data) {
    distributionBody.innerHTML = "";
    var dist = data.distribution || {};
    var table = document.createElement("table");
    table.className = "modules-table";
    var head = document.createElement("thead");
    var headCells = "<th scope=\"col\">PI</th><th scope=\"col\">Descripción</th>";
    LEVEL_CRITERIA.forEach(function (level) {
      headCells += '<th scope="col">' + level.labelEs + "</th>";
    });
    head.innerHTML = "<tr>" + headCells + "</tr>";
    table.appendChild(head);
    var body = document.createElement("tbody");
    Object.keys(dist).forEach(function (piId) {
      var d = dist[piId];
      var cells = "<td>" + (d.pi_code || "—") + "</td><td>" + (d.pi_description || "—") + "</td>";
      LEVEL_CRITERIA.forEach(function (level) {
        cells += "<td>" + (d[level.distKey] || 0) + "</td>";
      });
      var row = document.createElement("tr");
      row.innerHTML = cells;
      body.appendChild(row);
    });
    table.appendChild(body);
    distributionBody.appendChild(table);
  }

  function renderAnalyses(data) {
    analysisBody.innerHTML = "";
    (piRows || []).forEach(function (pi) {
      var existing = (data.analyses || []).find(function (a) { return a.perf_indicator_id === pi.id; });
      var div = document.createElement("div");
      div.innerHTML = '<label>' + pi.code + " — " + (pi.description || "") + '</label>';
      var ta = document.createElement("textarea");
      ta.dataset.piId = pi.id;
      ta.maxLength = 2000;
      ta.value = existing ? existing.analysis_text || "" : "";
      div.appendChild(ta);
      analysisBody.appendChild(div);
    });
  }

  function collectAssessments() {
    return Array.from(document.querySelectorAll(".level-select")).filter(function (sel) { return sel.value !== ""; }).map(function (sel) {
      return { module_student_id: Number(sel.dataset.moduleStudentId), perf_indicator_id: Number(sel.dataset.piId), level: Number(sel.value) };
    });
  }

  function collectAnalyses() {
    return Array.from(analysisBody.querySelectorAll("textarea")).filter(function (ta) { return ta.value.trim() !== ""; }).map(function (ta) {
      return { perf_indicator_id: Number(ta.dataset.piId), analysis_text: ta.value };
    });
  }

  function allStudentsFullyGraded() {
    return Array.from(document.querySelectorAll("tr")).every(function (row) {
      var selects = row.querySelectorAll(".level-select");
      return selects.length === 0 || Array.from(selects).every(function (s) { return s.value !== ""; });
    });
  }

  function allAnalysesComplete() {
    return piRows.length === 0 || Array.from(analysisBody.querySelectorAll("textarea")).every(function (ta) { return ta.value.trim() !== ""; });
  }

  function updateWizardState() {
    saveAssessmentsBtn.disabled = false;
    saveQualitativeBtn.disabled = false;
    submitModuleBtn.disabled = !allStudentsFullyGraded() || !allAnalysesComplete();
  }

  async function loadModule() {
    setStatus("Cargando módulo...");
    try {
      var client = assertSupabase();
      var session = await requireAuthOrRedirect();
      if (!session) return;

      var resolvedId = await resolveEvaluationId(client);
      if (!resolvedId) { setStatus("Evaluación no encontrada.", "error"); return; }

      var { data: evaluation } = await client.from("module_ra_evaluations")
        .select("id, status, module:modules(*), period:periods(rubric_id, cycle_id, student_outcome:student_outcomes(id, code, description, program_id))")
        .eq("id", resolvedId)
        .single();
      if (!evaluation || !evaluation.module) { setStatus("Módulo no encontrado.", "error"); return; }

      currentEvaluation = evaluation;
      currentModule = evaluation.module;
      currentModule.period = evaluation.period || currentModule.period;
      currentConsolidator = await loadConsolidatorInfo(client, currentModule);

      var rubricId = currentModule.period && currentModule.period.rubric_id;
      var { data: pis } = await client.from("perf_indicators").select("*").eq("rubric_id", rubricId).eq("is_active", true).order("position");
      piRows = pis || [];

      buildStudentsHead();

      var moduleId = currentModule.id;
      var { data: msRows } = await client.from("module_students")
        .select("id, status, student:students(id, full_name, internal_id), assessments(perf_indicator_id, level)")
        .eq("module_id", moduleId);
      moduleStudents = (msRows || []).filter(function (r) { return r.status === "active"; });
      activeStudentCount = moduleStudents.length;

      var { data: qualRows } = await client.from("module_analysis")
        .select("perf_indicator_id, analysis_text")
        .eq("module_ra_evaluation_id", resolvedId);

      var studentsData = {
        students: moduleStudents.map(function (r) {
          return {
            module_student_id: r.id,
            status: r.status,
            full_name: (r.student && r.student.full_name) || "—",
            internal_id: (r.student && r.student.internal_id) || "—",
            assessments: (r.assessments || []).map(function (a) { return { perf_indicator_id: a.perf_indicator_id, level: a.level }; }),
          };
        }),
      };

      var dist = buildDistribution(moduleStudents.map(function (r) {
        return { assessments: (r.assessments || []).map(function (a) { return { perf_indicator_id: a.perf_indicator_id, level: a.level }; }) };
      }), piRows);

      renderModuleSummary(currentModule);
      renderStudents(studentsData);
      renderDistribution({ distribution: dist });
      renderAnalyses({ analyses: (qualRows || []).map(function (r) { return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text }; }) });
      enableActions();
      updateWizardState();
      setStatus("Datos cargados. " + activeStudentCount + " estudiantes activos.", "success");
    } catch (e) {
      if (isAuthError(e)) { redirectToLogin(); return; }
      setStatus("Error al cargar módulo: " + (e.message || e), "error");
    }
  }

  saveAssessmentsBtn.addEventListener("click", async function () {
    saveAssessmentsBtn.disabled = true;
    setStatus("Guardando calificaciones...");
    try {
      await requireAuthOrRedirect();
      var payload = collectAssessments();
      if (payload.length) {
        var { error } = await assertSupabase().from("assessments").upsert(payload, { onConflict: "module_student_id,perf_indicator_id" });
        if (error) throw error;
      }
      setStatus("Calificaciones guardadas.", "success");
      updateWizardState();
    } catch (e) { if (!isAuthError(e)) setStatus("Error: " + (e.message || e), "error"); }
    saveAssessmentsBtn.disabled = false;
  });

  saveQualitativeBtn.addEventListener("click", async function () {
    saveQualitativeBtn.disabled = true;
    setStatus("Guardando analisis...");
    try {
      await requireAuthOrRedirect();
      var evalId = currentEvaluation && currentEvaluation.id;
      var payload = collectAnalyses().map(function (a) {
        return { module_ra_evaluation_id: Number(evalId), perf_indicator_id: a.perf_indicator_id, analysis_text: a.analysis_text };
      });
      if (payload.length) {
        var { error } = await assertSupabase().from("module_analysis").upsert(payload, { onConflict: "module_ra_evaluation_id,perf_indicator_id" });
        if (error) throw error;
      }
      setStatus("Analisis guardado.", "success");
      updateWizardState();
    } catch (e) { if (!isAuthError(e)) setStatus("Error: " + (e.message || e), "error"); }
    saveQualitativeBtn.disabled = false;
  });

  submitModuleBtn.addEventListener("click", async function () {
    if (!allStudentsFullyGraded() || !allAnalysesComplete()) { setStatus("Complete calificaciones y analisis primero.", "error"); return; }
    submitModuleBtn.disabled = true;
    setStatus("Enviando módulo...");
    try {
      await requireAuthOrRedirect();
      var evalId = currentEvaluation && currentEvaluation.id;
      var { error } = await assertSupabase().from("module_ra_evaluations")
        .update({ status: "completed", submitted_at: new Date().toISOString() })
        .eq("id", evalId);
      if (error) throw error;
      setStatus("Módulo enviado.", "success");
    } catch (e) { if (!isAuthError(e)) setStatus("Error: " + (e.message || e), "error"); submitModuleBtn.disabled = false; }
  });

  studentsBody.addEventListener("change", function (e) { if (e.target.classList.contains("level-select")) updateWizardState(); });
  analysisBody.addEventListener("input", function (e) { if (e.target.tagName === "TEXTAREA") updateWizardState(); });
  wizardSteps.forEach(function (s) { s.addEventListener("click", function () { showStep(s.dataset.stepTarget); }); });
  wizardNextBtn.addEventListener("click", function () { showStep(stepOrder[Math.min(currentStepIndex + 1, stepOrder.length - 1)]); });
  wizardPrevBtn.addEventListener("click", function () { showStep(stepOrder[Math.max(currentStepIndex - 1, 0)]); });

  showStep("general");
  loadModule();
})();
