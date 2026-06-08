(function () {
  "use strict";

  var LOT_SIZE = 5;
  var SAVE_DEBOUNCE_MS = 1000;

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
  var saveQualitativeBtn = document.getElementById("save-qualitative-btn");
  var statusMsg = document.getElementById("assessment-status");
  var rubricRaTitle = document.getElementById("rubric-ra-title");
  var rubricRaDescription = document.getElementById("rubric-ra-description");
  var rubricContent = document.getElementById("rubric-content");
  var rubricScrollWrap = document.getElementById("rubric-scroll-wrap");
  var rubricLayoutScrollBtn = document.getElementById("rubric-layout-scroll");
  var rubricLayoutTabsBtn = document.getElementById("rubric-layout-tabs");
  var gradingProgress = document.getElementById("grading-progress");
  var lotPosition = document.getElementById("lot-position");
  var saveIndicator = document.getElementById("save-indicator");
  var editRosterBtn = document.getElementById("edit-roster-btn");
  var lotPrevBtn = document.getElementById("lot-prev-btn");
  var lotAdvanceBtn = document.getElementById("lot-advance-btn");
  var lotNextBtn = document.getElementById("lot-next-btn");
  var lotHint = document.getElementById("lot-hint");
  var continueAnalysisBtn = document.getElementById("continue-analysis-btn");
  var rosterBody = document.getElementById("roster-body");
  var rosterStats = document.getElementById("roster-stats");
  var rosterPdfInput = document.getElementById("roster-pdf-input");
  var rosterPreviewBtn = document.getElementById("roster-preview-btn");
  var rosterPreviewBlock = document.getElementById("roster-preview-block");
  var rosterPreviewMeta = document.getElementById("roster-preview-meta");
  var rosterPreviewTableBody = document.getElementById("roster-preview-body");
  var rosterPreviewWarnings = document.getElementById("roster-preview-warnings");
  var rosterConsentCheckbox = document.getElementById("roster-consent-checkbox");
  var rosterConfirmBtn = document.getElementById("roster-confirm-btn");
  var rosterManualToggle = document.getElementById("roster-manual-toggle");
  var rosterManualBlock = document.getElementById("roster-manual-block");
  var rosterManualDoc = document.getElementById("roster-manual-doc");
  var rosterManualName = document.getElementById("roster-manual-name");
  var rosterManualAddBtn = document.getElementById("roster-manual-add-btn");
  var rosterTableWrap = document.getElementById("roster-table-wrap");
  var rosterImportNotice = document.getElementById("roster-import-notice");
  var rosterImportNoticeMessage = document.getElementById("roster-import-notice-message");
  var rosterImportNoticeDismiss = document.getElementById("roster-import-notice-dismiss");
  var rosterExcludeDialog = document.getElementById("roster-exclude-dialog");
  var rosterExcludeForm = document.getElementById("roster-exclude-form");
  var rosterExcludeStudentName = document.getElementById("roster-exclude-student-name");
  var rosterExcludeReason = document.getElementById("roster-exclude-reason");

  var stepOrder = ["general", "roster", "grading", "analysis", "submit"];
  var currentStepIndex = 0;

  var moduleStudents = [];
  var rosterAllRows = [];
  var studentsData = { students: [] };
  var rosterPdfFile = null;
  var rosterPreviewData = null;
  var pendingExcludeMsId = null;
  var piRows = [];
  var activeStudentCount = 0;
  var currentModule = null;
  var currentEvaluation = null;
  var currentConsolidator = null;
  var currentRaLabel = "";

  var currentLotIndex = 0;
  var maxLotUnlocked = 0;
  var rubricLayoutMode = "scroll";
  var activeTabPiIndex = 0;

  var pendingUpserts = new Map();
  var saveDebounceTimer = null;
  var pendingWeightUpserts = new Map();
  var weightSaveDebounceTimer = null;
  var piWeightsValid = true;

  var LEVEL_CRITERIA = [
    { value: 1, labelEs: "Deficiente", shortAbet: "No", distKey: "Deficiente", header: "Poor / 1 / (No)" },
    { value: 2, labelEs: "Insuficiente", shortAbet: "Sí, pero", distKey: "Insuficiente", header: "Inadequate / 2 / (Sí, pero)" },
    { value: 4, labelEs: "Bueno", shortAbet: "Sí", distKey: "Bueno", header: "Adequate / 4 / (Sí)" },
    { value: 5, labelEs: "Sobresaliente", shortAbet: "Sí, aún más", distKey: "Sobresaliente", header: "Exemplary / 5 / (Sí, aún más)" },
  ];

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function levelMetaByValue(levelValue) {
    return LEVEL_CRITERIA.find(function (level) { return level.value === Number(levelValue); }) || null;
  }

  function buildSelectorLabel(level) {
    return level.labelEs + " (" + level.value + ")";
  }

  function buildLevelSelectOptions() {
    var html = '<option value="">—</option>';
    LEVEL_CRITERIA.forEach(function (level) {
      html += '<option value="' + level.value + '">' + buildSelectorLabel(level) + "</option>";
    });
    return html;
  }

  function sumPiWeights() {
    return piRows.reduce(function (sum, pi) {
      return sum + Number(pi.pi_weight != null ? pi.pi_weight : 0);
    }, 0);
  }

  function formatWeightTotal(total) {
    return Math.round(total * 100) / 100;
  }

  function validatePiWeights() {
    if (!piRows.length) {
      piWeightsValid = true;
      return true;
    }
    piWeightsValid = Math.abs(formatWeightTotal(sumPiWeights()) - 100) < 0.01;
    return piWeightsValid;
  }

  function buildWeightTotalHtml() {
    var total = formatWeightTotal(sumPiWeights());
    var valid = validatePiWeights();
    var cls = valid ? "weight-total weight-total-ok" : "weight-total weight-total-error";
    var msg = valid
      ? "Total ponderación: " + total + "%"
      : "Total ponderación: " + total + "% — debe sumar exactamente 100%";
    return '<p class="' + cls + '" role="status" aria-live="polite">' + escapeHtml(msg) + "</p>";
  }

  function buildWeightInputHtml(pi) {
    var value = pi.pi_weight != null ? pi.pi_weight : "";
    return '<input type="number" class="pi-weight-input" data-pi-id="' + pi.id + '" min="0" max="100" step="0.01" value="' + escapeHtml(String(value)) + '" aria-label="Ponderación ' + escapeHtml(pi.code) + '">';
  }

  function descriptorForPi(pi, levelValue) {
    var levels = pi.pi_levels || pi.levels || [];
    var row = levels.find(function (l) { return Number(l.level_value) === levelValue; });
    return row && row.descriptor ? row.descriptor : "—";
  }

  function totalLots() {
    return Math.max(1, Math.ceil(activeStudentCount / LOT_SIZE));
  }

  function getStudentRecord(msId) {
    return studentsData.students.find(function (s) { return s.module_student_id === msId; });
  }

  function syncAssessment(msId, piId, level) {
    var student = getStudentRecord(msId);
    if (!student) return;
    var list = student.assessments || (student.assessments = []);
    var existing = list.find(function (a) { return a.perf_indicator_id === piId; });
    if (existing) existing.level = level;
    else list.push({ perf_indicator_id: piId, level: level });
  }

  function isStudentFullyGraded(student) {
    if (!student || !piRows.length) return false;
    return piRows.every(function (pi) {
      return (student.assessments || []).some(function (a) {
        return a.perf_indicator_id === pi.id && a.level;
      });
    });
  }

  function countGradedStudents() {
    return studentsData.students.filter(isStudentFullyGraded).length;
  }

  function isCurrentLotComplete() {
    var lotStudents = getLotStudents(currentLotIndex);
    return lotStudents.length > 0 && lotStudents.every(isStudentFullyGraded);
  }

  function getLotStudents(lotIndex) {
    var start = lotIndex * LOT_SIZE;
    return studentsData.students.slice(start, start + LOT_SIZE);
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

  function setSaveIndicator(text, kind) {
    if (!saveIndicator) return;
    saveIndicator.textContent = text;
    saveIndicator.className = "save-indicator muted" + (kind ? " " + kind : "");
  }

  function enableActions() {
    wizardNextBtn.disabled = false;
    wizardPrevBtn.disabled = false;
    saveQualitativeBtn.disabled = false;
  }

  function normalizeDocumentNumber(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    return digits || String(raw || "").trim();
  }

  function rosterNoticeKey() {
    var id = evaluationId || (currentEvaluation && currentEvaluation.id) || "";
    return "ra-roster-notice-" + id;
  }

  function canEnterStep(stepTarget) {
    if (stepTarget === "grading" || stepTarget === "analysis" || stepTarget === "submit") {
      return activeStudentCount > 0;
    }
    return true;
  }

  function showRosterNotice(message, kind) {
    if (!rosterImportNotice || !rosterImportNoticeMessage) return;
    rosterImportNoticeMessage.textContent = message;
    rosterImportNotice.className = "roster-import-notice" + (kind ? " " + kind : "");
    rosterImportNotice.hidden = false;
    if (rosterTableWrap) rosterTableWrap.classList.add("is-compact");
    rosterImportNotice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function dismissRosterNotice(markSeen) {
    if (markSeen) localStorage.setItem(rosterNoticeKey(), "1");
    if (rosterImportNotice) rosterImportNotice.hidden = true;
    if (rosterTableWrap) rosterTableWrap.classList.remove("is-compact");
  }

  function maybeShowFirstRosterNotice() {
    if (activeStudentCount <= 0) return;
    if (localStorage.getItem(rosterNoticeKey())) return;
    showRosterNotice(
      "Este módulo ya tiene estudiantes en la lista. Revise la nómina antes de calificar. " +
      "Si importa un PDF, los estudiantes activos que no aparezcan en el archivo deberán excluirse manualmente.",
      "info"
    );
  }

  function resetRosterPreviewUi() {
    rosterPreviewData = null;
    if (rosterPreviewBlock) rosterPreviewBlock.hidden = true;
    if (rosterPreviewMeta) rosterPreviewMeta.innerHTML = "";
    if (rosterPreviewTableBody) rosterPreviewTableBody.innerHTML = "";
    if (rosterPreviewWarnings) rosterPreviewWarnings.innerHTML = "";
    if (rosterConsentCheckbox) rosterConsentCheckbox.checked = false;
    if (rosterConfirmBtn) rosterConfirmBtn.disabled = true;
  }

  function updateRosterConfirmState() {
    if (!rosterConfirmBtn) return;
    rosterConfirmBtn.disabled = !(
      rosterPreviewData &&
      rosterPdfFile &&
      rosterConsentCheckbox &&
      rosterConsentCheckbox.checked
    );
  }

  function renderRosterPreview(data) {
    if (!rosterPreviewBlock || !rosterPreviewMeta || !rosterPreviewTableBody) return;
    rosterPreviewBlock.hidden = false;
    rosterPreviewMeta.innerHTML =
      "<div><dt>Materia (PDF)</dt><dd>" + escapeHtml(data.pdf_materia || "—") + "</dd></div>" +
      "<div><dt>Grupo (PDF)</dt><dd>" + escapeHtml(data.pdf_group || "—") + "</dd></div>" +
      "<div><dt>Estudiantes detectados</dt><dd>" + escapeHtml(String((data.students || []).length)) + "</dd></div>";
    rosterPreviewTableBody.innerHTML = "";
    (data.students || []).forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(String(row.roster_position)) + "</td>" +
        "<td>" + escapeHtml(row.document_number || "—") + "</td>" +
        "<td>" + escapeHtml(row.full_name || "—") + "</td>";
      rosterPreviewTableBody.appendChild(tr);
    });
    if (rosterPreviewWarnings) {
      rosterPreviewWarnings.innerHTML = "";
      (data.warnings || []).forEach(function (warning) {
        var li = document.createElement("li");
        li.textContent = warning;
        rosterPreviewWarnings.appendChild(li);
      });
    }
    updateRosterConfirmState();
  }

  function renderRosterPanel() {
    if (!rosterBody) return;
    var excludedCount = rosterAllRows.filter(function (r) { return r.status === "excluded"; }).length;
    if (rosterStats) {
      rosterStats.textContent = activeStudentCount + " activos · " + excludedCount + " excluidos";
    }
    rosterBody.innerHTML = "";
    if (!rosterAllRows.length) {
      rosterBody.innerHTML = '<tr><td colspan="5">No hay estudiantes. Importe un PDF o agregue manualmente.</td></tr>';
      return;
    }
    rosterAllRows.forEach(function (row) {
      var tr = document.createElement("tr");
      var statusLabel = row.status === "excluded" ? "Excluido" : "Activo";
      var actions = "";
      if (row.status === "active") {
        actions = '<button type="button" class="btn-secondary compact roster-exclude-btn" data-ms-id="' + row.module_student_id + '">Excluir</button>';
      } else {
        actions = '<button type="button" class="btn-secondary compact roster-reactivate-btn" data-ms-id="' + row.module_student_id + '">Reactivar</button>';
      }
      tr.innerHTML =
        "<td>" + escapeHtml(String(row.roster_position || "—")) + "</td>" +
        "<td>" + escapeHtml(row.document_number || row.internal_id || "—") + "</td>" +
        "<td>" + escapeHtml(row.full_name || "—") + "</td>" +
        '<td><span class="roster-status roster-status-' + escapeHtml(row.status) + '">' + statusLabel + "</span></td>" +
        "<td>" + actions + "</td>";
      rosterBody.appendChild(tr);
    });
    rosterBody.querySelectorAll(".roster-exclude-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { openExcludeDialog(Number(btn.dataset.msId)); });
    });
    rosterBody.querySelectorAll(".roster-reactivate-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { reactivateStudent(Number(btn.dataset.msId)); });
    });
  }

  function openExcludeDialog(msId) {
    var row = rosterAllRows.find(function (r) { return r.module_student_id === msId; });
    if (!row || !rosterExcludeDialog) return;
    pendingExcludeMsId = msId;
    if (rosterExcludeStudentName) {
      rosterExcludeStudentName.textContent = (row.full_name || "Estudiante") + " — " + (row.document_number || row.internal_id || "");
    }
    if (rosterExcludeReason) rosterExcludeReason.value = "withdrew";
    rosterExcludeDialog.showModal();
  }

  async function reloadRosterData() {
    if (!currentModule) return;
    var client = assertSupabase();
    var moduleId = currentModule.id;
    var { data: msRows, error } = await client.from("module_students")
      .select("id, status, roster_position, student:students(id, full_name, internal_id, document_number), assessments(perf_indicator_id, level)")
      .eq("module_id", moduleId)
      .order("roster_position", { ascending: true })
      .order("id");
    if (error) throw error;

    rosterAllRows = (msRows || []).map(function (r) {
      return {
        module_student_id: r.id,
        status: r.status,
        roster_position: r.roster_position,
        full_name: (r.student && r.student.full_name) || "—",
        internal_id: (r.student && r.student.internal_id) || "—",
        document_number: (r.student && r.student.document_number) || (r.student && r.student.internal_id) || "—",
        student_id: r.student && r.student.id,
        assessments: (r.assessments || []).map(function (a) {
          return { perf_indicator_id: a.perf_indicator_id, level: a.level };
        }),
      };
    });

    moduleStudents = rosterAllRows.filter(function (r) { return r.status === "active"; });
    activeStudentCount = moduleStudents.length;
    studentsData = {
      students: moduleStudents.map(function (r) {
        return {
          module_student_id: r.module_student_id,
          status: r.status,
          full_name: r.full_name,
          internal_id: r.internal_id,
          assessments: r.assessments || [],
        };
      }),
    };

    currentLotIndex = Math.min(currentLotIndex, Math.max(0, totalLots() - 1));
    maxLotUnlocked = Math.min(maxLotUnlocked, Math.max(0, totalLots() - 1));

    renderModuleSummary(currentModule);
    renderRosterPanel();
    renderCurrentLot();
    updateLotChrome();
    var dist = buildDistribution(studentsData.students, piRows);
    renderDistribution({ distribution: dist });
    updateWizardState();
  }

  async function handleRosterPreview() {
    if (!rosterPdfFile || !currentModule) return;
    if (typeof RaApi === "undefined" || !RaApi.studentsImportPreview) {
      setStatus("API de importación no disponible.", "error");
      return;
    }
    rosterPreviewBtn.disabled = true;
    setStatus("Analizando PDF…");
    try {
      await requireAuthOrRedirect();
      var data = await RaApi.studentsImportPreview(currentModule.id, rosterPdfFile);
      rosterPreviewData = data;
      renderRosterPreview(data);
      setStatus("Vista previa lista. Revise y confirme la importación.", "success");
    } catch (e) {
      resetRosterPreviewUi();
      if (!isAuthError(e)) setStatus("Error en vista previa: " + (e.message || e), "error");
    }
    rosterPreviewBtn.disabled = !rosterPdfFile;
  }

  async function handleRosterConfirm() {
    if (!rosterPdfFile || !rosterPreviewData || !currentModule) return;
    if (!rosterConsentCheckbox || !rosterConsentCheckbox.checked) {
      setStatus("Debe aceptar el tratamiento de datos (Ley 1581).", "error");
      return;
    }
    if (typeof RaApi === "undefined" || !RaApi.studentsImportConfirm) {
      setStatus("API de importación no disponible.", "error");
      return;
    }
    rosterConfirmBtn.disabled = true;
    setStatus("Importando estudiantes…");
    try {
      await requireAuthOrRedirect();
      var result = await RaApi.studentsImportConfirm(currentModule.id, rosterPdfFile, true);
      await reloadRosterData();
      resetRosterPreviewUi();
      rosterPdfFile = null;
      if (rosterPdfInput) rosterPdfInput.value = "";
      if (rosterPreviewBtn) rosterPreviewBtn.disabled = true;
      var msg = "Importación completada: " + (result.imported || 0) + " nuevos, " + (result.updated || 0) + " actualizados.";
      if (result.skipped) {
        msg += " " + result.skipped + " sin cambios.";
      }
      if (result.errors && result.errors.length) {
        msg += " " + result.errors.length + " filas con error.";
        var firstErr = result.errors[0];
        if (firstErr && firstErr.error) {
          msg += " Ejemplo (fila " + (firstErr.row || "?") + "): " + firstErr.error;
        }
      }
      if (result.warnings && result.warnings.length) {
        msg += " " + result.warnings.join(" ");
      }
      showRosterNotice(msg, (result.errors && result.errors.length) ? "error" : "success");
      setStatus(msg, (result.errors && result.errors.length) ? "error" : "success");
    } catch (e) {
      if (!isAuthError(e)) setStatus("Error al importar: " + (e.message || e), "error");
    }
    updateRosterConfirmState();
  }

  async function addManualStudent() {
    if (!currentModule || !rosterManualDoc || !rosterManualName) return;
    var doc = normalizeDocumentNumber(rosterManualDoc.value);
    var name = String(rosterManualName.value || "").trim();
    if (!doc || !name) {
      setStatus("Documento y nombre completo son obligatorios.", "error");
      return;
    }
    rosterManualAddBtn.disabled = true;
    setStatus("Agregando estudiante…");
    try {
      var client = assertSupabase();
      await requireAuthOrRedirect();
      var moduleId = currentModule.id;
      var { data: maxRows } = await client.from("module_students")
        .select("roster_position")
        .eq("module_id", moduleId)
        .order("roster_position", { ascending: false })
        .limit(1);
      var nextPos = maxRows && maxRows[0] ? Number(maxRows[0].roster_position) + 1 : 1;

      var { data: existing } = await client.from("students")
        .select("id")
        .eq("document_number", doc)
        .maybeSingle();
      var studentId;
      if (existing && existing.id) {
        var { error: updErr } = await client.from("students")
          .update({ full_name: name, internal_id: doc })
          .eq("id", existing.id);
        if (updErr) throw updErr;
        studentId = existing.id;
      } else {
        var { data: created, error: insErr } = await client.from("students")
          .insert({ internal_id: doc, document_number: doc, full_name: name })
          .select("id")
          .single();
        if (insErr) throw insErr;
        studentId = created.id;
      }

      var { data: enrollment } = await client.from("module_students")
        .select("id, status")
        .eq("module_id", moduleId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (enrollment && enrollment.id) {
        var { error: enrErr } = await client.from("module_students")
          .update({ status: "active", roster_position: nextPos })
          .eq("id", enrollment.id);
        if (enrErr) throw enrErr;
      } else {
        var { error: newEnrErr } = await client.from("module_students")
          .insert({ module_id: moduleId, student_id: studentId, status: "active", roster_position: nextPos });
        if (newEnrErr) throw newEnrErr;
      }

      rosterManualDoc.value = "";
      rosterManualName.value = "";
      await reloadRosterData();
      setStatus("Estudiante agregado a la lista.", "success");
    } catch (e) {
      if (!isAuthError(e)) setStatus("Error al agregar: " + (e.message || e), "error");
    }
    rosterManualAddBtn.disabled = false;
  }

  async function excludeStudent(msId, reasonCode) {
    if (!currentModule) return;
    setStatus("Excluyendo estudiante…");
    try {
      var session = await requireAuthOrRedirect();
      if (!session) return;
      var client = assertSupabase();
      var { error: statusErr } = await client.from("module_students")
        .update({ status: "excluded" })
        .eq("id", msId);
      if (statusErr) throw statusErr;
      var { error: exclErr } = await client.from("student_exclusions")
        .insert({
          module_student_id: msId,
          reason_code: reasonCode,
          excluded_by: session.user.id,
        });
      if (exclErr) throw exclErr;
      await reloadRosterData();
      setStatus("Estudiante excluido de la evaluación.", "success");
    } catch (e) {
      if (!isAuthError(e)) setStatus("Error al excluir: " + (e.message || e), "error");
    }
  }

  async function reactivateStudent(msId) {
    if (!currentModule) return;
    setStatus("Reactivando estudiante…");
    try {
      await requireAuthOrRedirect();
      var { error } = await assertSupabase().from("module_students")
        .update({ status: "active" })
        .eq("id", msId);
      if (error) throw error;
      await reloadRosterData();
      setStatus("Estudiante reactivado.", "success");
    } catch (e) {
      if (!isAuthError(e)) setStatus("Error al reactivar: " + (e.message || e), "error");
    }
  }

  function showStep(stepTarget) {
    if (!canEnterStep(stepTarget)) {
      setStatus("Agregue al menos un estudiante activo en Lista de estudiantes antes de continuar.", "error");
      return;
    }
    currentStepIndex = stepOrder.indexOf(stepTarget);
    wizardPanels.forEach(function (p) { p.hidden = p.dataset.stepPanel !== stepTarget; });
    wizardSteps.forEach(function (s) {
      s.classList.toggle("active", s.dataset.stepTarget === stepTarget);
      s.setAttribute("aria-current", s.dataset.stepTarget === stepTarget ? "step" : "false");
    });
    wizardNextBtn.hidden = currentStepIndex >= stepOrder.length - 1;
    wizardPrevBtn.hidden = currentStepIndex <= 0;
    if (stepTarget === "roster") {
      renderRosterPanel();
      maybeShowFirstRosterNotice();
    }
    if (stepTarget === "grading") {
      renderRubricPanel();
      renderCurrentLot();
      updateLotChrome();
    }
    if (stepTarget === "analysis") {
      var dist = buildDistribution(studentsData.students, piRows);
      renderDistribution({ distribution: dist });
    }
  }

  function setRubricLayout(mode) {
    rubricLayoutMode = mode === "tabs" ? "tabs" : "scroll";
    if (rubricLayoutScrollBtn) rubricLayoutScrollBtn.setAttribute("aria-pressed", rubricLayoutMode === "scroll" ? "true" : "false");
    if (rubricLayoutTabsBtn) rubricLayoutTabsBtn.setAttribute("aria-pressed", rubricLayoutMode === "tabs" ? "true" : "false");
    renderRubricPanel();
    renderCurrentLot();
  }

  function maybeAutoFallbackToTabs() {
    if (rubricLayoutMode !== "scroll" || !rubricScrollWrap) return;
    if (rubricScrollWrap.scrollHeight > rubricScrollWrap.clientHeight + 4) {
      setRubricLayout("tabs");
      if (lotHint) lotHint.textContent = "Vista por criterio activada: la rúbrica completa no cabía en pantalla.";
    }
  }

  function buildRubricMatrixHtml(pis) {
    var head = "<thead><tr><th scope=\"col\">Criterio</th><th scope=\"col\">%</th>";
    LEVEL_CRITERIA.forEach(function (level) {
      head += '<th scope="col">' + escapeHtml(level.header) + "</th>";
    });
    head += "</tr></thead><tbody>";
    var body = "";
    pis.forEach(function (pi) {
      body += "<tr><td class=\"criterion-cell\">" + escapeHtml(pi.code) + ": " + escapeHtml(pi.description) + "</td>";
      body += '<td class="weight-cell">' + buildWeightInputHtml(pi) + "</td>";
      LEVEL_CRITERIA.forEach(function (level) {
        body += "<td>" + escapeHtml(descriptorForPi(pi, level.value)) + "</td>";
      });
      body += "</tr>";
    });
    return '<table class="rubric-matrix">' + head + body + "</tbody></table>" + buildWeightTotalHtml();
  }

  function buildRubricTabsHtml(pis) {
    if (!pis.length) return "<p class=\"muted\">Sin criterios activos.</p>";
    var tabs = '<div class="rubric-tabs" role="tablist">';
    pis.forEach(function (pi, idx) {
      tabs += '<button type="button" class="rubric-tab" role="tab" data-pi-tab="' + idx + '" aria-selected="' + (idx === activeTabPiIndex ? "true" : "false") + '">' + escapeHtml(pi.code) + "</button>";
    });
    tabs += "</div>";
    var pi = pis[activeTabPiIndex] || pis[0];
    tabs += '<table class="rubric-matrix"><thead><tr><th scope="col">Criterio</th><th scope="col">%</th>';
    LEVEL_CRITERIA.forEach(function (level) {
      tabs += '<th scope="col">' + escapeHtml(level.header) + "</th>";
    });
    tabs += "</tr></thead><tbody><tr>";
    tabs += '<td class="criterion-cell">' + escapeHtml(pi.code) + ": " + escapeHtml(pi.description) + "</td>";
    tabs += '<td class="weight-cell">' + buildWeightInputHtml(pi) + "</td>";
    LEVEL_CRITERIA.forEach(function (level) {
      tabs += "<td>" + escapeHtml(descriptorForPi(pi, level.value)) + "</td>";
    });
    tabs += "</tr></tbody></table>";
    tabs += buildWeightTotalHtml();
    tabs += '<p class="rubric-tabs-hint muted">Vista por criterio: califique <strong>todos</strong> los PIs en la tabla inferior. La columna resaltada corresponde al criterio activo.</p>';
    return tabs;
  }

  function attachPiWeightListeners() {
    if (!rubricContent) return;
    rubricContent.querySelectorAll(".pi-weight-input").forEach(function (input) {
      input.addEventListener("input", function () {
        queuePiWeightSave(input);
        updateWeightTotalDisplay();
        updateLotChrome();
      });
      input.addEventListener("change", function () {
        queuePiWeightSave(input);
        updateWeightTotalDisplay();
        updateLotChrome();
      });
    });
  }

  function updateWeightTotalDisplay() {
    if (!rubricContent) return;
    var totalEl = rubricContent.querySelector(".weight-total");
    if (!totalEl) return;
    var total = formatWeightTotal(sumPiWeights());
    var valid = validatePiWeights();
    totalEl.className = valid ? "weight-total weight-total-ok" : "weight-total weight-total-error";
    totalEl.textContent = valid
      ? "Total ponderación: " + total + "%"
      : "Total ponderación: " + total + "% — debe sumar exactamente 100%";
  }

  function queuePiWeightSave(input) {
    if (!currentEvaluation || !input) return;
    var piId = Number(input.dataset.piId);
    var weight = Number(input.value);
    if (!piId || Number.isNaN(weight)) return;
    var pi = piRows.find(function (row) { return row.id === piId; });
    if (pi) pi.pi_weight = weight;
    pendingWeightUpserts.set(String(piId), {
      module_ra_evaluation_id: currentEvaluation.id,
      perf_indicator_id: piId,
      pi_weight: weight,
      updated_at: new Date().toISOString(),
    });
    setSaveIndicator("Guardando ponderaciones…", "saving");
    clearTimeout(weightSaveDebounceTimer);
    weightSaveDebounceTimer = setTimeout(function () { flushPendingWeightSaves(false); }, SAVE_DEBOUNCE_MS);
  }

  async function flushPendingWeightSaves(force) {
    if (!pendingWeightUpserts.size) return;
    if (!validatePiWeights()) {
      setSaveIndicator("Ponderaciones deben sumar 100%", "error");
      return;
    }
    var payload = Array.from(pendingWeightUpserts.values());
    pendingWeightUpserts.clear();
    try {
      await requireAuthOrRedirect();
      var { error } = await assertSupabase()
        .from("module_ra_evaluation_pi_weights")
        .upsert(payload, { onConflict: "module_ra_evaluation_id,perf_indicator_id" });
      if (error) throw error;
      setSaveIndicator("Guardado", "saved");
      buildStudentsHead();
    } catch (e) {
      payload.forEach(function (item) {
        pendingWeightUpserts.set(String(item.perf_indicator_id), item);
      });
      if (!isAuthError(e)) setSaveIndicator("Error al guardar ponderaciones", "error");
    }
  }

  async function loadPiWeights(client, evaluationId) {
    var { data, error } = await client.from("module_ra_evaluation_pi_weights")
      .select("perf_indicator_id, pi_weight")
      .eq("module_ra_evaluation_id", evaluationId);
    if (error) throw error;
    var byPi = {};
    (data || []).forEach(function (row) {
      byPi[row.perf_indicator_id] = Number(row.pi_weight);
    });
    piRows.forEach(function (pi) {
      if (byPi[pi.id] != null) pi.pi_weight = byPi[pi.id];
      pi.default_pi_weight = pi.default_pi_weight != null ? pi.default_pi_weight : Number(pi.pi_weight);
    });
    validatePiWeights();
  }

  function renderRubricPanel() {
    if (!rubricContent) return;
    var so = currentModule && currentModule.period && currentModule.period.student_outcome;
    if (rubricRaTitle) rubricRaTitle.textContent = so && so.code ? "Rúbrica " + so.code : "Rúbrica del RA";
    if (rubricRaDescription) rubricRaDescription.textContent = so && so.description ? so.description : "";
    if (!piRows.length) {
      rubricContent.innerHTML = "<p class=\"muted\">No hay criterios activos en la rúbrica.</p>";
      return;
    }
    rubricContent.innerHTML = rubricLayoutMode === "tabs"
      ? buildRubricTabsHtml(piRows)
      : buildRubricMatrixHtml(piRows);
    attachPiWeightListeners();
    rubricContent.querySelectorAll("[data-pi-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTabPiIndex = Number(btn.dataset.piTab);
        renderRubricPanel();
        renderCurrentLot();
      });
    });
    if (rubricLayoutMode === "scroll") {
      window.requestAnimationFrame(maybeAutoFallbackToTabs);
    }
  }

  function buildStudentsHead() {
    var headRow = document.querySelector("#students-head tr");
    if (!headRow) return;
    headRow.querySelectorAll(".pi-header").forEach(function (h) { h.remove(); });
    piRows.forEach(function (pi, idx) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "pi-header";
      if (rubricLayoutMode === "tabs") {
        th.classList.add(idx === activeTabPiIndex ? "pi-header-active" : "pi-header-muted");
      }
      th.title = pi.description || pi.code;
      var weight = pi.pi_weight != null ? " (" + pi.pi_weight + "%)" : "";
      th.textContent = pi.code + weight;
      headRow.appendChild(th);
    });
  }

  function renderCurrentLot() {
    buildStudentsHead();
    studentsBody.innerHTML = "";
    var lotStudents = getLotStudents(currentLotIndex);
    if (!lotStudents.length) {
      studentsBody.innerHTML = '<tr><td colspan="' + (2 + piRows.length) + '">No hay estudiantes activos en este lote.</td></tr>';
      return;
    }
    lotStudents.forEach(function (s) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + escapeHtml(s.full_name || "—") + "</td><td>" + escapeHtml(s.internal_id || "—") + "</td>";
      piRows.forEach(function (pi, idx) {
        var cell = document.createElement("td");
        if (rubricLayoutMode === "tabs") {
          cell.classList.add(idx === activeTabPiIndex ? "pi-cell-active" : "pi-cell-muted");
        }
        var sel = document.createElement("select");
        sel.className = "level-select";
        sel.title = pi.code + ": " + (pi.description || "");
        sel.dataset.moduleStudentId = s.module_student_id;
        sel.dataset.piId = pi.id;
        sel.innerHTML = buildLevelSelectOptions();
        var existing = (s.assessments || []).find(function (a) { return a.perf_indicator_id === pi.id; });
        if (existing) sel.value = String(existing.level);
        cell.appendChild(sel);
        row.appendChild(cell);
      });
      studentsBody.appendChild(row);
    });
  }

  function updateLotChrome() {
    var graded = countGradedStudents();
    var lots = totalLots();
    if (gradingProgress) gradingProgress.textContent = "Estudiantes calificados: " + graded + " de " + activeStudentCount;
    if (lotPosition) lotPosition.textContent = "Lote " + (currentLotIndex + 1) + " de " + lots;
    if (lotPrevBtn) lotPrevBtn.disabled = currentLotIndex <= 0;
    if (lotNextBtn) lotNextBtn.disabled = currentLotIndex >= maxLotUnlocked;
    var lotComplete = isCurrentLotComplete();
    var hasMore = currentLotIndex < lots - 1;
    if (lotAdvanceBtn) {
      lotAdvanceBtn.disabled = !(piWeightsValid && lotComplete && currentLotIndex === maxLotUnlocked && hasMore);
    }
    var allGraded = allActiveStudentsFullyGraded();
    if (continueAnalysisBtn) continueAnalysisBtn.hidden = !allGraded;
    if (lotHint) {
      if (allGraded) {
        lotHint.textContent = "Todos los estudiantes activos están calificados. Puede revisar lotes anteriores o continuar al análisis.";
      } else if (lotComplete && currentLotIndex === maxLotUnlocked && hasMore) {
        lotHint.textContent = "Lote completo. Puede corregir datos o pulsar «Calificar más estudiantes».";
      } else if (lotComplete && currentLotIndex < maxLotUnlocked) {
        lotHint.textContent = "Lote ya completado. Use «Lote siguiente» o «Lote anterior» para revisar.";
      } else if (!piWeightsValid) {
        lotHint.textContent = "Ajuste las ponderaciones de cada PI hasta que sumen exactamente 100%.";
      } else if (!lotComplete) {
        lotHint.textContent = "Complete todos los criterios de cada estudiante en este lote.";
      } else {
        lotHint.textContent = "Último lote del módulo.";
      }
    }
    updateWizardState();
  }

  function queueSave(msId, piId, level) {
    pendingUpserts.set(String(msId) + "-" + String(piId), {
      module_student_id: Number(msId),
      perf_indicator_id: Number(piId),
      level: Number(level),
    });
    syncAssessment(Number(msId), Number(piId), Number(level));
    setSaveIndicator("Guardando…", "saving");
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(function () { flushPendingSaves(false); }, SAVE_DEBOUNCE_MS);
    updateLotChrome();
  }

  async function flushPendingSaves(force) {
    if (!pendingUpserts.size) return;
    var payload = Array.from(pendingUpserts.values());
    pendingUpserts.clear();
    try {
      await requireAuthOrRedirect();
      var { error } = await assertSupabase().from("assessments").upsert(payload, { onConflict: "module_student_id,perf_indicator_id" });
      if (error) throw error;
      setSaveIndicator("Guardado", "saved");
      var dist = buildDistribution(studentsData.students, piRows);
      renderDistribution({ distribution: dist });
    } catch (e) {
      payload.forEach(function (item) {
        pendingUpserts.set(String(item.module_student_id) + "-" + String(item.perf_indicator_id), item);
      });
      if (!isAuthError(e)) setSaveIndicator("Error al guardar", "error");
    }
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
        var meta = levelMetaByValue(a.level);
        if (meta) bucket[meta.distKey] = (bucket[meta.distKey] || 0) + 1;
      });
    });
    return dist;
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

  function formatDistCell(count, activeCount) {
    var n = Number(count) || 0;
    var pct = activeCount > 0 ? Math.round((n / activeCount) * 100) : 0;
    return pct + "% (" + n + ")";
  }

  function piDistributionSummary(dist, piId) {
    var d = dist[piId];
    if (!d) return "";
    return LEVEL_CRITERIA.map(function (level) {
      return level.labelEs + ": " + formatDistCell(d[level.distKey], activeStudentCount);
    }).join(" · ");
  }

  function renderDistribution(data) {
    if (!distributionBody) return;
    distributionBody.innerHTML = "";
    var dist = data.distribution || {};
    var intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = "Distribución del módulo — " + activeStudentCount + " estudiantes activos (F04b). Porcentaje primario, conteo entre paréntesis.";
    distributionBody.appendChild(intro);
    var table = document.createElement("table");
    table.className = "modules-table";
    var head = document.createElement("thead");
    var headCells = "<th scope=\"col\">PI</th>";
    LEVEL_CRITERIA.forEach(function (level) {
      headCells += '<th scope="col">' + escapeHtml(level.labelEs) + "</th>";
    });
    head.innerHTML = "<tr>" + headCells + "</tr>";
    table.appendChild(head);
    var body = document.createElement("tbody");
    Object.keys(dist).forEach(function (piId) {
      var d = dist[piId];
      var cells = "<td>" + escapeHtml(d.pi_code || "—") + "</td>";
      LEVEL_CRITERIA.forEach(function (level) {
        cells += "<td>" + formatDistCell(d[level.distKey], activeStudentCount) + "</td>";
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
    var dist = buildDistribution(studentsData.students, piRows);
    piRows.forEach(function (pi) {
      var existing = (data.analyses || []).find(function (a) { return a.perf_indicator_id === pi.id; });
      var div = document.createElement("div");
      div.className = "analysis-item";
      div.innerHTML = "<label>" + escapeHtml(pi.code) + " — " + escapeHtml(pi.description || "") + "</label>";
      var summary = document.createElement("p");
      summary.className = "muted analysis-pi-dist";
      summary.textContent = "Distribución: " + piDistributionSummary(dist, pi.id);
      div.appendChild(summary);
      var ta = document.createElement("textarea");
      ta.dataset.piId = pi.id;
      ta.maxLength = 2000;
      ta.placeholder = "Indique el análisis de los resultados encontrados en la medición de este criterio…";
      ta.value = existing ? existing.analysis_text || "" : "";
      div.appendChild(ta);
      analysisBody.appendChild(div);
    });
  }

  function collectAnalyses() {
    return Array.from(analysisBody.querySelectorAll("textarea")).filter(function (ta) { return ta.value.trim() !== ""; }).map(function (ta) {
      return { perf_indicator_id: Number(ta.dataset.piId), analysis_text: ta.value };
    });
  }

  function allActiveStudentsFullyGraded() {
    return activeStudentCount > 0 && studentsData.students.every(isStudentFullyGraded);
  }

  function allAnalysesComplete() {
    return piRows.length === 0 || Array.from(analysisBody.querySelectorAll("textarea")).every(function (ta) { return ta.value.trim() !== ""; });
  }

  function updateWizardState() {
    saveQualitativeBtn.disabled = false;
    submitModuleBtn.disabled = !piWeightsValid || !allActiveStudentsFullyGraded() || !allAnalysesComplete();
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
      var { data: pis } = await client.from("perf_indicators")
        .select("*, pi_levels(level_value, label, descriptor)")
        .eq("rubric_id", rubricId)
        .eq("is_active", true)
        .order("position");
      piRows = (pis || []).map(function (pi) {
        pi.pi_levels = pi.pi_levels || [];
        pi.default_pi_weight = Number(pi.pi_weight);
        return pi;
      });

      await loadPiWeights(client, resolvedId);

      currentLotIndex = 0;
      maxLotUnlocked = 0;

      await reloadRosterData();

      var { data: qualRows } = await client.from("module_analysis")
        .select("perf_indicator_id, analysis_text")
        .eq("module_ra_evaluation_id", resolvedId);

      renderRubricPanel();
      renderAnalyses({ analyses: (qualRows || []).map(function (r) { return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text }; }) });
      enableActions();
      updateWizardState();
      setStatus("Datos cargados. " + activeStudentCount + " estudiantes activos.", "success");
    } catch (e) {
      if (isAuthError(e)) { redirectToLogin(); return; }
      setStatus("Error al cargar módulo: " + (e.message || e), "error");
    }
  }

  if (studentsBody) {
    studentsBody.addEventListener("change", function (e) {
      if (!e.target.classList.contains("level-select")) return;
      if (!e.target.value) return;
      queueSave(e.target.dataset.moduleStudentId, e.target.dataset.piId, e.target.value);
    });
  }

  if (rubricLayoutScrollBtn) rubricLayoutScrollBtn.addEventListener("click", function () { setRubricLayout("scroll"); });
  if (rubricLayoutTabsBtn) rubricLayoutTabsBtn.addEventListener("click", function () { setRubricLayout("tabs"); });

  if (lotPrevBtn) {
    lotPrevBtn.addEventListener("click", function () {
      if (currentLotIndex <= 0) return;
      currentLotIndex -= 1;
      renderCurrentLot();
      updateLotChrome();
    });
  }

  if (lotNextBtn) {
    lotNextBtn.addEventListener("click", function () {
      if (currentLotIndex >= maxLotUnlocked) return;
      currentLotIndex += 1;
      renderCurrentLot();
      updateLotChrome();
    });
  }

  if (lotAdvanceBtn) {
    lotAdvanceBtn.addEventListener("click", async function () {
      if (!piWeightsValid || !isCurrentLotComplete() || currentLotIndex !== maxLotUnlocked) return;
      await flushPendingWeightSaves(true);
      await flushPendingSaves(true);
      if (currentLotIndex < totalLots() - 1) {
        currentLotIndex += 1;
        maxLotUnlocked = Math.max(maxLotUnlocked, currentLotIndex);
        renderCurrentLot();
        updateLotChrome();
      }
    });
  }

  if (editRosterBtn) {
    editRosterBtn.addEventListener("click", function () { showStep("roster"); });
  }

  if (rosterPdfInput) {
    rosterPdfInput.addEventListener("change", function () {
      rosterPdfFile = rosterPdfInput.files && rosterPdfInput.files[0] ? rosterPdfInput.files[0] : null;
      resetRosterPreviewUi();
      if (rosterPreviewBtn) rosterPreviewBtn.disabled = !rosterPdfFile;
    });
  }

  if (rosterPreviewBtn) {
    rosterPreviewBtn.addEventListener("click", function () { handleRosterPreview(); });
  }

  if (rosterConsentCheckbox) {
    rosterConsentCheckbox.addEventListener("change", updateRosterConfirmState);
  }

  if (rosterConfirmBtn) {
    rosterConfirmBtn.addEventListener("click", function () { handleRosterConfirm(); });
  }

  if (rosterManualToggle && rosterManualBlock) {
    rosterManualToggle.addEventListener("change", function () {
      rosterManualBlock.hidden = !rosterManualToggle.checked;
    });
  }

  if (rosterManualAddBtn) {
    rosterManualAddBtn.addEventListener("click", function () { addManualStudent(); });
  }

  if (rosterImportNoticeDismiss) {
    rosterImportNoticeDismiss.addEventListener("click", function () {
      dismissRosterNotice(true);
    });
  }

  if (rosterExcludeForm && rosterExcludeDialog) {
    rosterExcludeForm.addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (!submitter || submitter.value !== "confirm" || !pendingExcludeMsId) return;
      e.preventDefault();
      var reason = rosterExcludeReason ? rosterExcludeReason.value : "withdrew";
      rosterExcludeDialog.close();
      excludeStudent(pendingExcludeMsId, reason);
      pendingExcludeMsId = null;
    });
  }

  if (continueAnalysisBtn) {
    continueAnalysisBtn.addEventListener("click", async function () {
      if (!allActiveStudentsFullyGraded()) return;
      await flushPendingSaves(true);
      showStep("analysis");
      setStatus("Registre el análisis cualitativo por criterio.", "success");
    });
  }

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
    if (!allActiveStudentsFullyGraded() || !allAnalysesComplete()) { setStatus("Complete calificaciones y analisis primero.", "error"); return; }
    submitModuleBtn.disabled = true;
    setStatus("Enviando módulo...");
    try {
      await flushPendingSaves(true);
      await requireAuthOrRedirect();
      var evalId = currentEvaluation && currentEvaluation.id;
      var { error } = await assertSupabase().from("module_ra_evaluations")
        .update({ status: "completed", submitted_at: new Date().toISOString() })
        .eq("id", evalId);
      if (error) throw error;
      setStatus("Módulo enviado.", "success");
    } catch (e) { if (!isAuthError(e)) setStatus("Error: " + (e.message || e), "error"); submitModuleBtn.disabled = false; }
  });

  analysisBody.addEventListener("input", function (e) { if (e.target.tagName === "TEXTAREA") updateWizardState(); });
  wizardSteps.forEach(function (s) {
    s.addEventListener("click", function () { showStep(s.dataset.stepTarget); });
  });
  wizardNextBtn.addEventListener("click", function () { showStep(stepOrder[Math.min(currentStepIndex + 1, stepOrder.length - 1)]); });
  wizardPrevBtn.addEventListener("click", function () { showStep(stepOrder[Math.max(currentStepIndex - 1, 0)]); });

  showStep("general");
  loadModule();
})();
