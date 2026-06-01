(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var moduleId = params.get("module_id");
  if (!moduleId) {
    document.body.innerHTML = '<p style="padding:2rem">Falta module_id en la URL.</p>';
    return;
  }

  var wizardSteps = Array.from(document.querySelectorAll("[data-step-target]"));
  var wizardPanels = Array.from(document.querySelectorAll("[data-step-panel]"));
  var wizardNextBtn = document.getElementById("wizard-next-btn");
  var wizardPrevBtn = document.getElementById("wizard-prev-btn");
  var moduleInfo = document.getElementById("module-info");
  var studentsBody = document.getElementById("students-body");
  var distributionBody = document.getElementById("distribution-body");
  var analysisBody = document.getElementById("analysis-body");
  var submitModuleBtn = document.getElementById("submit-module-btn");
  var saveAssessmentsBtn = document.getElementById("save-assessments-btn");
  var saveQualitativeBtn = document.getElementById("save-qualitative-btn");
  var statusMsg = document.getElementById("status-message");
  var stepOrder = ["general", "grading", "distribution", "analysis", "submit"];
  var currentStepIndex = 0;

  var moduleStudents = [];
  var piRows = [];
  var activeStudentCount = 0;

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
      dist[pi.id] = { pi_code: pi.code, pi_description: pi.description, Poor: 0, Inadequate: 0, Adequate: 0, Exemplary: 0 };
    });
    students.forEach(function (s) {
      (s.assessments || []).forEach(function (a) {
        var bucket = dist[a.perf_indicator_id];
        if (!bucket) return;
        var labels = { 1: "Poor", 2: "Inadequate", 3: "Adequate", 4: "Exemplary" };
        var label = labels[a.level] || "Poor";
        bucket[label] = (bucket[label] || 0) + 1;
      });
    });
    return dist;
  }

  function renderModuleSummary() {
    moduleInfo.textContent = "Modulo " + moduleId + " — " + activeStudentCount + " estudiantes activos";
  }

  function renderStudents(studentsData) {
    studentsBody.innerHTML = "";
    (studentsData.students || []).forEach(function (s) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + (s.full_name || "—") + "</td><td>" + (s.internal_id || "—") + "</td>";
      var cell = document.createElement("td");
      (piRows || []).forEach(function (pi) {
        var sel = document.createElement("select");
        sel.className = "level-select";
        sel.dataset.moduleStudentId = s.module_student_id;
        sel.dataset.piId = pi.id;
        sel.innerHTML = '<option value="">—</option><option value="1">Poor</option><option value="2">Inadequate</option><option value="3">Adequate</option><option value="4">Exemplary</option>';
        var existing = (s.assessments || []).find(function (a) { return a.perf_indicator_id === pi.id; });
        if (existing) sel.value = existing.level;
        cell.appendChild(sel);
      });
      row.appendChild(cell);
      studentsBody.appendChild(row);
    });
  }

  function renderDistribution(data) {
    distributionBody.innerHTML = "";
    var dist = data.distribution || {};
    Object.keys(dist).forEach(function (piId) {
      var d = dist[piId];
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + (d.pi_code || "—") + "</td><td>" + (d.pi_description || "—") + "</td><td>" + d.Poor + "</td><td>" + d.Inadequate + "</td><td>" + d.Adequate + "</td><td>" + d.Exemplary + "</td>";
      distributionBody.appendChild(row);
    });
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
    setStatus("Cargando modulo...");
    try {
      var client = assertSupabase();
      var session = await requireAuthOrRedirect();
      if (!session) return;

      // Load module info
      var { data: mod } = await client.from("modules").select("*, period:periods(rubric_id)").eq("id", moduleId).single();
      if (!mod) { setStatus("Modulo no encontrado.", "error"); return; }

      // Load active PIs from the rubric
      var { data: pis } = await client.from("perf_indicators").select("*").eq("rubric_id", mod.period.rubric_id).eq("is_active", true).order("position");
      piRows = pis || [];

      // Load module_students with their assessments
      var { data: msRows } = await client.from("module_students").select("id, status, student:students(id, full_name, internal_id), assessments(perf_indicator_id, level)").eq("module_id", moduleId);
      moduleStudents = (msRows || []).filter(function (r) { return r.status === "active"; });
      activeStudentCount = moduleStudents.length;

      // Load qualitative analyses
      var { data: qualRows } = await client.from("module_analysis").select("perf_indicator_id, analysis_text").eq("module_id", moduleId);

      // Shape data
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

      renderModuleSummary(studentsData);
      renderStudents(studentsData);
      renderDistribution({ distribution: dist });
      renderAnalyses({ analyses: (qualRows || []).map(function (r) { return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text }; }) });
      enableActions();
      updateWizardState();
      setStatus("Datos cargados. " + activeStudentCount + " estudiantes activos.", "success");
    } catch (e) {
      if (isAuthError(e)) { redirectToLogin(); return; }
      setStatus("Error al cargar modulo: " + (e.message || e), "error");
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
      var payload = collectAnalyses().map(function (a) { return { module_id: Number(moduleId), perf_indicator_id: a.perf_indicator_id, analysis_text: a.analysis_text }; });
      if (payload.length) {
        var { error } = await assertSupabase().from("module_analysis").upsert(payload, { onConflict: "module_id,perf_indicator_id" });
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
    setStatus("Enviando modulo...");
    try {
      await requireAuthOrRedirect();
      var { error } = await assertSupabase().from("modules").update({ status: "completed", submitted_at: new Date().toISOString() }).eq("id", moduleId);
      if (error) throw error;
      setStatus("Modulo enviado.", "success");
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