(function () {
  "use strict";

  var SAVE_DEBOUNCE_MS = 1000;
  var ADVANCE_COUNTDOWN_SEC = 3;

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
  var gradingWeightsContent = document.getElementById("grading-weights-content");
  var gradingRubricContent = document.getElementById("grading-rubric-content");
  var weightsRecalcNotice = document.getElementById("weights-recalc-notice");
  var rubricReviewAck = document.getElementById("rubric-review-ack");
  var gradingSubstepBtns = Array.from(document.querySelectorAll("[data-grading-sub]"));
  var gradingSubpanels = Array.from(document.querySelectorAll("[data-grading-panel]"));
  var viewModePicker = document.getElementById("view-mode-picker");
  var studentCardView = document.getElementById("student-card-view");
  var gridView = document.getElementById("grid-view");
  var studentPosition = document.getElementById("student-position");
  var studentCardName = document.getElementById("student-card-name");
  var studentCardDoc = document.getElementById("student-card-doc");
  var studentCardPis = document.getElementById("student-card-pis");
  var advanceCountdown = document.getElementById("advance-countdown");
  var advanceCountdownText = document.getElementById("advance-countdown-text");
  var btnStayHere = document.getElementById("btn-stay-here");
  var btnNextStudent = document.getElementById("btn-next-student");
  var btnPrevStudent = document.getElementById("btn-prev-student");
  var gridPendingOnly = document.getElementById("grid-pending-only");
  var gradingProgress = document.getElementById("grading-progress");
  var saveIndicator = document.getElementById("save-indicator");
  var editRosterBtn = document.getElementById("edit-roster-btn");
  var captureHint = document.getElementById("capture-hint");
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

  var gradingSubStep = "weights";
  var captureViewMode = "student_card";
  var currentUserGridEnabled = false;
  var currentStudentIndex = 0;
  var advanceCountdownTimer = null;
  var advanceCountdownValue = 0;

  var pendingUpserts = new Map();
  var saveDebounceTimer = null;
  var pendingWeightUpserts = new Map();
  var weightSaveDebounceTimer = null;
  var piWeightsValid = true;

  var LEVEL_CRITERIA = [
    { value: 1, labelEs: "Deficiente", distKey: "Deficiente" },
    { value: 2, labelEs: "Insuficiente", distKey: "Insuficiente" },
    { value: 4, labelEs: "Bueno", distKey: "Bueno" },
    { value: 5, labelEs: "Sobresaliente", distKey: "Sobresaliente" },
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

  function buildLevelColumnLabel(level) {
    return level.labelEs + " (" + level.value + ")";
  }

  function buildSelectorLabel(level) {
    return buildLevelColumnLabel(level);
  }

  function piWeightIsSet(pi) {
    return pi.pi_weight != null && pi.pi_weight !== "" && !Number.isNaN(Number(pi.pi_weight));
  }

  function sumPiWeights() {
    return piRows.reduce(function (sum, pi) {
      return sum + (piWeightIsSet(pi) ? Number(pi.pi_weight) : 0);
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
    var allSet = piRows.every(piWeightIsSet);
    piWeightsValid = allSet && Math.abs(formatWeightTotal(sumPiWeights()) - 100) < 0.01;
    return piWeightsValid;
  }

  function buildWeightTotalHtml() {
    var total = formatWeightTotal(sumPiWeights());
    var allSet = piRows.every(piWeightIsSet);
    var valid = allSet && Math.abs(total - 100) < 0.01;
    var cls = valid ? "weight-total weight-total-ok" : "weight-total weight-total-error";
    var msg;
    if (!allSet) {
      msg = "Ingrese el % de cada criterio. Total actual: " + total + "%";
    } else if (valid) {
      msg = "Total ponderación: " + total + "%";
    } else {
      msg = "Total ponderación: " + total + "% — debe sumar exactamente 100%";
    }
    return '<p class="' + cls + '" role="status" aria-live="polite">' + escapeHtml(msg) + "</p>";
  }

  function buildWeightInputHtml(pi) {
    var valueAttr = piWeightIsSet(pi) ? ' value="' + escapeHtml(String(pi.pi_weight)) + '"' : "";
    return '<input type="number" class="pi-weight-input" data-pi-id="' + pi.id + '" min="0" max="100" step="0.01"' + valueAttr + ' placeholder="%" aria-label="Ponderación ' + escapeHtml(pi.code) + '">';
  }

  function descriptorForPi(pi, levelValue) {
    var levels = pi.pi_levels || pi.levels || [];
    var row = levels.find(function (l) { return Number(l.level_value) === levelValue; });
    return row && row.descriptor ? row.descriptor : "—";
  }

  function getStudentRecord(msId) {
    return studentsData.students.find(function (s) { return s.module_student_id === msId; });
  }

  function getCurrentStudent() {
    return studentsData.students[currentStudentIndex] || null;
  }

  function hasAnyAssessment() {
    return studentsData.students.some(function (s) {
      return (s.assessments || []).some(function (a) { return a.level; });
    });
  }

  function findFirstPendingStudentIndex() {
    var idx = studentsData.students.findIndex(function (s) { return !isStudentFullyGraded(s); });
    return idx >= 0 ? idx : 0;
  }

  function findNextPendingStudentIndex(fromIndex) {
    var students = studentsData.students;
    var i;
    for (i = fromIndex + 1; i < students.length; i++) {
      if (!isStudentFullyGraded(students[i])) return i;
    }
    for (i = 0; i < fromIndex; i++) {
      if (!isStudentFullyGraded(students[i])) return i;
    }
    return -1;
  }

  function isViewModeLocked() {
    return !!(currentEvaluation && currentEvaluation.grading_view_mode);
  }

  function effectiveCaptureViewMode() {
    if (isViewModeLocked()) return currentEvaluation.grading_view_mode;
    return captureViewMode;
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

    currentStudentIndex = Math.min(currentStudentIndex, Math.max(0, activeStudentCount - 1));

    renderModuleSummary(currentModule);
    renderRosterPanel();
    if (gradingSubStep === "capture") renderCaptureView();
    updateCaptureChrome();
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
      showGradingSubStep(gradingSubStep);
    }
    if (stepTarget === "analysis") {
      var dist = buildDistribution(studentsData.students, piRows);
      renderDistribution({ distribution: dist });
    }
  }

  function canEnterGradingSub(sub) {
    if (sub === "weights") return true;
    if (sub === "rubric") return piWeightsValid;
    if (sub === "capture") return piWeightsValid && rubricReviewAck && rubricReviewAck.checked;
    return false;
  }

  function showGradingSubStep(sub) {
    if (!canEnterGradingSub(sub)) {
      if (sub === "rubric" && !piWeightsValid) {
        setStatus("Ajuste las ponderaciones hasta sumar 100% antes de continuar.", "error");
      } else if (sub === "capture") {
        setStatus("Revise la rúbrica y confirme que leyó los criterios.", "error");
      }
      return;
    }
    gradingSubStep = sub;
    gradingSubpanels.forEach(function (p) { p.hidden = p.dataset.gradingPanel !== sub; });
    gradingSubstepBtns.forEach(function (btn) {
      var active = btn.dataset.gradingSub === sub;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "step" : "false");
    });
    if (weightsRecalcNotice) weightsRecalcNotice.hidden = !(sub === "weights" && hasAnyAssessment());
    if (sub === "weights") renderWeightsPanel();
    if (sub === "rubric") renderRubricReviewPanel();
    if (sub === "capture") {
      currentStudentIndex = findFirstPendingStudentIndex();
      renderCaptureView();
      updateCaptureChrome();
    }
  }

  function tryAdvanceGradingSubStep() {
    if (gradingSubStep === "weights") {
      if (!piWeightsValid) {
        setStatus("La suma de ponderaciones debe ser exactamente 100%.", "error");
        return false;
      }
      showGradingSubStep("rubric");
      return false;
    }
    if (gradingSubStep === "rubric") {
      if (!rubricReviewAck || !rubricReviewAck.checked) {
        setStatus("Confirme que revisó los criterios de desempeño.", "error");
        return false;
      }
      showGradingSubStep("capture");
      return false;
    }
    return true;
  }

  function buildWeightsTableHtml(pis) {
    var head = "<thead><tr><th scope=\"col\">Criterio</th><th scope=\"col\">%</th></tr></thead><tbody>";
    var body = "";
    pis.forEach(function (pi) {
      body += "<tr><td class=\"criterion-cell\">" + escapeHtml(pi.code) + ": " + escapeHtml(pi.description) + "</td>";
      body += '<td class="weight-cell">' + buildWeightInputHtml(pi) + "</td></tr>";
    });
    return '<table class="rubric-matrix weights-matrix">' + head + body + "</tbody></table>" + buildWeightTotalHtml();
  }

  function buildRubricReadOnlyHtml(pis) {
    var head = "<thead><tr><th scope=\"col\">Criterio</th><th scope=\"col\">%</th>";
    LEVEL_CRITERIA.forEach(function (level) {
      head += '<th scope="col">' + escapeHtml(buildLevelColumnLabel(level)) + "</th>";
    });
    head += "</tr></thead><tbody>";
    var body = "";
    pis.forEach(function (pi) {
      body += "<tr><td class=\"criterion-cell\">" + escapeHtml(pi.code) + ": " + escapeHtml(pi.description) + "</td>";
      body += '<td class="weight-cell">' + escapeHtml(String(pi.pi_weight != null ? pi.pi_weight : "")) + "</td>";
      LEVEL_CRITERIA.forEach(function (level) {
        body += "<td>" + escapeHtml(descriptorForPi(pi, level.value)) + "</td>";
      });
      body += "</tr>";
    });
    return '<table class="rubric-matrix">' + head + body + "</tbody></table>";
  }

  function attachPiWeightListeners(root) {
    if (!root) return;
    root.querySelectorAll(".pi-weight-input").forEach(function (input) {
      input.addEventListener("input", function () {
        queuePiWeightSave(input);
        updateWeightTotalDisplay(root);
        updateCaptureChrome();
      });
      input.addEventListener("change", function () {
        queuePiWeightSave(input);
        updateWeightTotalDisplay(root);
        updateCaptureChrome();
      });
    });
  }

  function updateWeightTotalDisplay(root) {
    if (!root) return;
    var totalEl = root.querySelector(".weight-total");
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
    var raw = (input.value || "").trim();
    if (!piId) return;
    var pi = piRows.find(function (row) { return row.id === piId; });
    if (!raw) {
      if (pi) pi.pi_weight = null;
      updateWeightTotalDisplay(input.closest(".grading-subpanel") || gradingWeightsContent);
      return;
    }
    var weight = Number(raw);
    if (Number.isNaN(weight)) return;
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
      if (effectiveCaptureViewMode() === "grid") buildStudentsHead();
      renderStudentCard();
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
      pi.pi_weight = byPi[pi.id] != null ? byPi[pi.id] : null;
    });
    validatePiWeights();
  }

  function renderGradingHeader() {
    var so = currentModule && currentModule.period && currentModule.period.student_outcome;
    if (rubricRaTitle) rubricRaTitle.textContent = so && so.code ? "Rúbrica " + so.code : "Rúbrica del RA";
    if (rubricRaDescription) {
      rubricRaDescription.textContent = so && so.description ? so.description : "";
    }
  }

  function renderWeightsPanel() {
    if (!gradingWeightsContent) return;
    renderGradingHeader();
    if (!piRows.length) {
      gradingWeightsContent.innerHTML = "<p class=\"muted\">No hay criterios activos.</p>";
      return;
    }
    gradingWeightsContent.innerHTML = buildWeightsTableHtml(piRows);
    attachPiWeightListeners(gradingWeightsContent);
  }

  function renderRubricReviewPanel() {
    if (!gradingRubricContent) return;
    renderGradingHeader();
    if (!piRows.length) {
      gradingRubricContent.innerHTML = "<p class=\"muted\">No hay criterios activos.</p>";
      return;
    }
    gradingRubricContent.innerHTML = buildRubricReadOnlyHtml(piRows);
  }

  function renderCaptureView() {
    var mode = effectiveCaptureViewMode();
    if (viewModePicker) viewModePicker.hidden = !currentUserGridEnabled || isViewModeLocked();
    if (!isViewModeLocked() && viewModePicker) {
      var radios = viewModePicker.querySelectorAll('input[name="capture-view-mode"]');
      radios.forEach(function (r) { r.checked = r.value === captureViewMode; });
      radios.forEach(function (r) { r.disabled = isViewModeLocked(); });
    }
    if (studentCardView) studentCardView.hidden = mode !== "student_card";
    if (gridView) gridView.hidden = mode !== "grid";
    if (mode === "student_card") renderStudentCard();
    else renderGridView();
  }

  function buildStudentsHead() {
    var headRow = document.querySelector("#students-head tr");
    if (!headRow) return;
    headRow.querySelectorAll(".pi-header").forEach(function (h) { h.remove(); });
    piRows.forEach(function (pi) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "pi-header";
      th.title = pi.description || pi.code;
      var weight = pi.pi_weight != null ? " (" + pi.pi_weight + "%)" : "";
      th.textContent = pi.code + weight;
      headRow.appendChild(th);
    });
  }

  function getExistingLevel(student, pi) {
    var existing = (student.assessments || []).find(function (a) { return a.perf_indicator_id === pi.id; });
    return existing ? Number(existing.level) : null;
  }

  function createLevelRadioGroup(student, pi, compact) {
    var fieldset = document.createElement("fieldset");
    fieldset.className = "level-radio-group" + (compact ? " level-radio-group--compact" : "");
    fieldset.setAttribute("role", "radiogroup");
    fieldset.setAttribute("aria-label", "Nivel " + pi.code);
    var selected = getExistingLevel(student, pi);
    LEVEL_CRITERIA.forEach(function (level) {
      var label = document.createElement("label");
      label.className = "level-radio-label";
      var input = document.createElement("input");
      input.type = "radio";
      input.className = "level-radio";
      input.name = "level-" + student.module_student_id + "-" + pi.id;
      input.value = String(level.value);
      input.dataset.moduleStudentId = String(student.module_student_id);
      input.dataset.piId = String(pi.id);
      if (selected === level.value) input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(buildLevelColumnLabel(level)));
      fieldset.appendChild(label);
    });
    return fieldset;
  }

  function renderStudentCard() {
    cancelAdvanceCountdown();
    var student = getCurrentStudent();
    if (!studentCardPis || !student) return;
    if (studentPosition) {
      studentPosition.textContent = "Estudiante " + (currentStudentIndex + 1) + " de " + activeStudentCount;
    }
    if (studentCardName) studentCardName.textContent = student.full_name || "—";
    if (studentCardDoc) {
      studentCardDoc.textContent = student.internal_id ? "Doc. " + student.internal_id : "";
      studentCardDoc.hidden = !student.internal_id;
    }
    studentCardPis.innerHTML = "";
    piRows.forEach(function (pi) {
      var block = document.createElement("section");
      block.className = "student-pi-block";
      var title = document.createElement("h5");
      title.className = "student-pi-title";
      title.textContent = pi.code + " · " + (pi.description || "") + " · " + (pi.pi_weight != null ? pi.pi_weight : "") + "%";
      block.appendChild(title);
      var table = document.createElement("table");
      table.className = "rubric-matrix student-pi-matrix";
      var head = "<thead><tr>";
      LEVEL_CRITERIA.forEach(function (level) { head += '<th scope="col">' + escapeHtml(buildLevelColumnLabel(level)) + "</th>"; });
      head += "</tr></thead><tbody><tr>";
      LEVEL_CRITERIA.forEach(function (level) {
        head += "<td>" + escapeHtml(descriptorForPi(pi, level.value)) + "</td>";
      });
      head += "</tr></tbody>";
      table.innerHTML = head;
      block.appendChild(table);
      block.appendChild(createLevelRadioGroup(student, pi, false));
      studentCardPis.appendChild(block);
    });
    if (btnPrevStudent) btnPrevStudent.disabled = currentStudentIndex <= 0;
    if (btnNextStudent) btnNextStudent.hidden = true;
    if (advanceCountdown) advanceCountdown.hidden = true;
  }

  function renderGridView() {
    buildStudentsHead();
    if (!studentsBody) return;
    studentsBody.innerHTML = "";
    var pendingOnly = gridPendingOnly && gridPendingOnly.checked;
    var visible = studentsData.students.filter(function (s) {
      return !pendingOnly || !isStudentFullyGraded(s);
    });
    if (!visible.length) {
      studentsBody.innerHTML = '<tr><td colspan="' + (2 + piRows.length) + '">No hay estudiantes pendientes.</td></tr>';
      return;
    }
    visible.forEach(function (s) {
      var row = document.createElement("tr");
      row.innerHTML = "<td>" + escapeHtml(s.full_name || "—") + "</td><td>" + escapeHtml(s.internal_id || "—") + "</td>";
      piRows.forEach(function (pi) {
        var cell = document.createElement("td");
        cell.className = "pi-grade-cell";
        cell.appendChild(createLevelRadioGroup(s, pi, true));
        row.appendChild(cell);
      });
      studentsBody.appendChild(row);
    });
  }

  function cancelAdvanceCountdown() {
    if (advanceCountdownTimer) {
      clearInterval(advanceCountdownTimer);
      advanceCountdownTimer = null;
    }
    advanceCountdownValue = 0;
  }

  function maybeStartAdvanceCountdown() {
    var student = getCurrentStudent();
    if (!student || !isStudentFullyGraded(student)) return;
    if (!advanceCountdown || !advanceCountdownText) return;
    cancelAdvanceCountdown();
    advanceCountdown.hidden = false;
    if (btnNextStudent) btnNextStudent.hidden = true;
    advanceCountdownValue = ADVANCE_COUNTDOWN_SEC;
    advanceCountdownText.textContent = "Siguiente estudiante en " + advanceCountdownValue + " s…";
    advanceCountdownTimer = setInterval(function () {
      advanceCountdownValue -= 1;
      if (advanceCountdownValue <= 0) {
        cancelAdvanceCountdown();
        goToNextPendingStudent();
        return;
      }
      advanceCountdownText.textContent = "Siguiente estudiante en " + advanceCountdownValue + " s…";
    }, 1000);
  }

  function goToNextPendingStudent() {
    cancelAdvanceCountdown();
    var next = findNextPendingStudentIndex(currentStudentIndex);
    if (next < 0 || allActiveStudentsFullyGraded()) {
      if (advanceCountdown) advanceCountdown.hidden = true;
      updateCaptureChrome();
      return;
    }
    currentStudentIndex = next;
    renderStudentCard();
    updateCaptureChrome();
  }

  function goToPrevStudent() {
    cancelAdvanceCountdown();
    if (currentStudentIndex <= 0) return;
    currentStudentIndex -= 1;
    renderStudentCard();
    updateCaptureChrome();
  }

  async function lockCaptureViewModeIfNeeded() {
    if (!currentEvaluation || currentEvaluation.grading_view_mode) return;
    var mode = captureViewMode;
    try {
      var { error } = await assertSupabase().from("module_ra_evaluations")
        .update({ grading_view_mode: mode })
        .eq("id", currentEvaluation.id);
      if (error) throw error;
      currentEvaluation.grading_view_mode = mode;
      if (viewModePicker) viewModePicker.hidden = true;
    } catch (e) {
      if (!isAuthError(e)) setSaveIndicator("Error al fijar modo de vista", "error");
    }
  }

  function updateCaptureChrome() {
    var graded = countGradedStudents();
    if (gradingProgress) gradingProgress.textContent = "Estudiantes calificados: " + graded + " de " + activeStudentCount;
    var allGraded = allActiveStudentsFullyGraded();
    if (continueAnalysisBtn) continueAnalysisBtn.hidden = !allGraded;
    if (captureHint) {
      if (allGraded) {
        captureHint.textContent = "Todos los estudiantes activos están calificados. Puede continuar al análisis.";
      } else if (effectiveCaptureViewMode() === "student_card") {
        captureHint.textContent = "Complete los cuatro criterios del estudiante activo.";
      } else {
        captureHint.textContent = "Complete todos los criterios de cada estudiante visible.";
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
    updateCaptureChrome();
  }

  async function flushPendingSaves(force) {
    if (!pendingUpserts.size) return;
    var payload = Array.from(pendingUpserts.values());
    pendingUpserts.clear();
    try {
      await requireAuthOrRedirect();
      var { error } = await assertSupabase().from("assessments").upsert(payload, { onConflict: "module_student_id,perf_indicator_id" });
      if (error) throw error;
      if (!currentEvaluation.grading_view_mode) await lockCaptureViewModeIfNeeded();
      setSaveIndicator("Guardado", "saved");
      var dist = buildDistribution(studentsData.students, piRows);
      renderDistribution({ distribution: dist });
      if (effectiveCaptureViewMode() === "student_card") maybeStartAdvanceCountdown();
      else if (effectiveCaptureViewMode() === "grid") renderGridView();
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
        .select("id, status, grading_view_mode, module:modules(*), period:periods(rubric_id, cycle_id, student_outcome:student_outcomes(id, code, description, program_id))")
        .eq("id", resolvedId)
        .single();
      if (!evaluation || !evaluation.module) { setStatus("Módulo no encontrado.", "error"); return; }

      var { data: profile } = await client.from("users")
        .select("grid_grading_enabled")
        .eq("id", session.user.id)
        .single();
      currentUserGridEnabled = !!(profile && profile.grid_grading_enabled);
      captureViewMode = evaluation.grading_view_mode || "student_card";
      gradingSubStep = "weights";

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
        pi.pi_weight = null;
        return pi;
      });

      await loadPiWeights(client, resolvedId);

      await reloadRosterData();

      var { data: qualRows } = await client.from("module_analysis")
        .select("perf_indicator_id, analysis_text")
        .eq("module_ra_evaluation_id", resolvedId);

      renderGradingHeader();
      renderWeightsPanel();
      renderRubricReviewPanel();
      showGradingSubStep("weights");
      renderAnalyses({ analyses: (qualRows || []).map(function (r) { return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text }; }) });
      enableActions();
      updateWizardState();
      setStatus("Datos cargados. " + activeStudentCount + " estudiantes activos.", "success");
    } catch (e) {
      if (isAuthError(e)) { redirectToLogin(); return; }
      setStatus("Error al cargar módulo: " + (e.message || e), "error");
    }
  }

  function handleLevelCaptureChange(e) {
    var input = e.target;
    if (!input.classList || (!input.classList.contains("level-radio") && !input.classList.contains("level-select"))) return;
    if (!input.value) return;
    if (input.type === "radio" && !input.checked) return;
    cancelAdvanceCountdown();
    queueSave(input.dataset.moduleStudentId, input.dataset.piId, input.value);
  }

  if (studentsBody) studentsBody.addEventListener("change", handleLevelCaptureChange);
  if (studentCardPis) studentCardPis.addEventListener("change", handleLevelCaptureChange);

  gradingSubstepBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { showGradingSubStep(btn.dataset.gradingSub); });
  });

  if (viewModePicker) {
    viewModePicker.addEventListener("change", function (e) {
      if (!e.target.name || e.target.name !== "capture-view-mode" || isViewModeLocked()) return;
      captureViewMode = e.target.value === "grid" ? "grid" : "student_card";
      renderCaptureView();
      updateCaptureChrome();
    });
  }

  if (gridPendingOnly) {
    gridPendingOnly.addEventListener("change", function () { renderGridView(); });
  }

  if (btnStayHere) {
    btnStayHere.addEventListener("click", function () {
      cancelAdvanceCountdown();
      if (advanceCountdown) advanceCountdown.hidden = true;
      if (btnNextStudent) btnNextStudent.hidden = false;
    });
  }

  if (btnNextStudent) btnNextStudent.addEventListener("click", function () { goToNextPendingStudent(); });
  if (btnPrevStudent) btnPrevStudent.addEventListener("click", function () { goToPrevStudent(); });

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
  wizardNextBtn.addEventListener("click", function () {
    if (stepOrder[currentStepIndex] === "grading" && !tryAdvanceGradingSubStep()) return;
    showStep(stepOrder[Math.min(currentStepIndex + 1, stepOrder.length - 1)]);
  });

  wizardPrevBtn.addEventListener("click", function () {
    if (stepOrder[currentStepIndex] === "grading") {
      if (gradingSubStep === "capture") { showGradingSubStep("rubric"); return; }
      if (gradingSubStep === "rubric") { showGradingSubStep("weights"); return; }
    }
    showStep(stepOrder[Math.max(currentStepIndex - 1, 0)]);
  });

  showStep("general");
  loadModule();
})();
