(function () {
  "use strict";

  var SAVE_DEBOUNCE_MS = 1000;

  var params = new URLSearchParams(window.location.search);
  var evaluationId = params.get("evaluation_id");
  var legacyModuleId = params.get("module_id");
  var reviewMode = params.get("mode") === "review";
  if (!evaluationId && !legacyModuleId) {
    document.body.innerHTML = '<p style="padding:2rem">Falta evaluation_id en la URL.</p>';
    return;
  }

  var wizardSteps = Array.from(document.querySelectorAll("[data-step-target]"));
  var wizardPanels = Array.from(document.querySelectorAll("[data-step-panel]"));
  var wizardNextBtn = document.getElementById("wizard-next-btn");
  var wizardPrevBtn = document.getElementById("wizard-prev-btn");
  var wizardActions = document.getElementById("wizard-actions");
  var gradingToolbarZone = document.getElementById("grading-toolbar-zone");
  var gradingToolbarPanel = document.getElementById("grading-toolbar-panel");
  var gradingToolbarToggle = document.getElementById("grading-toolbar-toggle");
  var gradingViewport = document.querySelector(".grading-viewport");
  var summaryRa = document.getElementById("summary-ra");
  var summaryModule = document.getElementById("summary-module");
  var summaryLeader = document.getElementById("summary-leader");
  var summaryLeaderEmail = document.getElementById("summary-leader-email");
  var summaryTeacherBlock = document.getElementById("summary-teacher-block");
  var summaryTeacher = document.getElementById("summary-teacher");
  var summaryStatusBlock = document.getElementById("summary-status-block");
  var summaryEvalStatus = document.getElementById("summary-eval-status");
  var reviewModeBanner = document.getElementById("review-mode-banner");
  var leaderContactHint = document.getElementById("leader-contact-hint");
  var submitLeaderNotice = document.getElementById("submit-leader-notice");
  var submitLeaderName = document.getElementById("submit-leader-name");
  var submitLeaderEmail = document.getElementById("submit-leader-email");
  var studentsBody = document.getElementById("students-body");
  var distributionBody = document.getElementById("distribution-body");
  var quantitativePiSummaries = document.getElementById("quantitative-pi-summaries");
  var analysisBody = document.getElementById("analysis-body");
  var moduleQualitativeSection = document.getElementById("module-qualitative-section");
  var conclusionsText = document.getElementById("conclusions-text");
  var recommendationsText = document.getElementById("recommendations-text");
  var preventiveMeasuresText = document.getElementById("preventive-measures-text");
  var correctiveMeasuresText = document.getElementById("corrective-measures-text");
  var improvementPlanText = document.getElementById("improvement-plan-text");
  var submitModuleBtn = document.getElementById("submit-module-btn");
  var qualitativeSaveIndicator = document.getElementById("qualitative-save-indicator");
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
  var captureRubricTitle = document.getElementById("capture-rubric-title");
  var btnNextStudent = document.getElementById("btn-next-student");
  var btnPrevStudent = document.getElementById("btn-prev-student");
  var gridPendingOnly = document.getElementById("grid-pending-only");
  var gradingProgress = document.getElementById("grading-progress");
  var saveIndicator = document.getElementById("save-indicator");
  var editRosterBtn = document.getElementById("edit-roster-btn");
  var captureHint = document.getElementById("capture-hint");
  var gridCaptureHint = document.getElementById("grid-capture-hint");
  var continueAnalysisBtn = document.getElementById("continue-analysis-btn");
  var continueQualitativeBtn = document.getElementById("continue-qualitative-btn");
  var readinessGrading = document.getElementById("readiness-grading");
  var readinessAnalysis = document.getElementById("readiness-analysis");
  var submitCelebration = document.getElementById("submit-celebration");
  var celebrationBubbles = document.getElementById("celebration-bubbles");
  var celebrationXpEarned = document.getElementById("celebration-xp-earned");
  var celebrationXpTotal = document.getElementById("celebration-xp-total");
  var celebrationFollowup = document.getElementById("celebration-followup");
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
  var qualitativeData = { analyses: [], module: {} };
  var activeStudentCount = 0;
  var currentModule = null;
  var currentEvaluation = null;
  var currentConsolidator = null;
  var currentRaLabel = "";

  var gradingSubStep = "weights";
  var analysisSubStep = "quantitative";
  var analysisSubstepBtns = Array.from(document.querySelectorAll("[data-analysis-sub]"));
  var analysisSubpanels = Array.from(document.querySelectorAll("[data-analysis-panel]"));
  var captureViewMode = "student_card";
  var currentUserGridEnabled = false;
  var currentStudentIndex = 0;

  var pendingUpserts = new Map();
  var saveDebounceTimer = null;
  var pendingWeightUpserts = new Map();
  var weightSaveDebounceTimer = null;
  var qualitativeSaveDebounceTimer = null;
  var qualitativeSaveQueued = false;
  var piWeightsValid = true;

  var LEVEL_CRITERIA = [
    { value: 1, labelEs: "Deficiente", distKey: "Deficiente", chartColor: "#dc2626" },
    { value: 2, labelEs: "Insuficiente", distKey: "Insuficiente", chartColor: "#f97316" },
    { value: 4, labelEs: "Bueno", distKey: "Bueno", chartColor: "#FFDF2D" },
    { value: 5, labelEs: "Sobresaliente", distKey: "Sobresaliente", chartColor: "#16a34a" },
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
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.className = "wizard-footer-status" + (kind ? " " + kind : "");
  }

  function setQualitativeSaveIndicator(text, kind) {
    if (!qualitativeSaveIndicator) return;
    qualitativeSaveIndicator.textContent = text;
    qualitativeSaveIndicator.className = "qualitative-save-indicator"
      + (kind ? " " + kind : "") + (kind ? "" : " muted");
  }

  function evaluationStatusLabel(status) {
    if (status === "completed") return "Completado";
    if (status === "in_progress") return "En progreso";
    return "Pendiente";
  }

  function isNavigationControl(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains("back-link")) return true;
    if (el.id === "wizard-prev-btn" || el.id === "wizard-next-btn") return true;
    if (el.id === "roster-import-notice-dismiss") return true;
    if (el.dataset && (el.dataset.stepTarget || el.dataset.gradingSub || el.dataset.analysisSub)) return true;
    return false;
  }

  function disableEditingControls() {
    document.querySelectorAll("input, textarea, select, button").forEach(function (el) {
      if (isNavigationControl(el)) return;
      if (el.closest(".wizard-steps")) return;
      el.disabled = true;
      if (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "radio" && el.type !== "checkbox")) {
        el.readOnly = true;
      }
    });
    document.querySelectorAll(".level-radio").forEach(function (radio) {
      radio.disabled = true;
    });
  }

  function renderReviewSummaryExtras() {
    var staff = (currentModule && currentModule.module_staff) || [];
    var teacher = staff[0] && staff[0].users;
    if (summaryTeacherBlock) summaryTeacherBlock.hidden = false;
    if (summaryTeacher) {
      summaryTeacher.textContent = teacher
        ? (teacher.full_name || "—") + (teacher.email ? " (" + teacher.email + ")" : "")
        : "Sin docente asignado";
    }
    if (summaryStatusBlock) summaryStatusBlock.hidden = false;
    if (summaryEvalStatus) {
      summaryEvalStatus.textContent = evaluationStatusLabel(currentEvaluation && currentEvaluation.status);
    }
    if (leaderContactHint) {
      leaderContactHint.textContent = "Revisión del envío del docente. No puede modificar calificaciones ni análisis desde esta vista.";
    }
  }

  function applyReviewModeChrome() {
    document.body.classList.add("assessment-review-mode");
    if (reviewModeBanner) reviewModeBanner.hidden = false;
    var brandTitle = document.querySelector(".assessment-header-brand h1");
    if (brandTitle) brandTitle.textContent = "Revisión de módulo";
    var headerTitle = document.getElementById("assessment-title");
    if (headerTitle) headerTitle.textContent = "Revisión del envío del docente";
    document.title = "Revisión de módulo — RA Assessment";
    if (submitModuleBtn) submitModuleBtn.hidden = true;
    renderReviewSummaryExtras();
    disableEditingControls();
  }

  async function verifyReviewAccess(client, userId, evaluation) {
    var mod = evaluation.module || {};
    var period = evaluation.period || mod.period || {};
    var so = period.student_outcome || {};
    var programId = mod.program_id;
    var soId = so.id;
    var cycleId = period.cycle_id;
    if (!programId || !soId) return false;

    var profileRes = await client.from("users").select("role").eq("id", userId).maybeSingle();
    var role = profileRes.data && profileRes.data.role;
    if (role === "admin" || role === "leader") return true;

    var query = client.from("ra_consolidator_assignments")
      .select("id", { count: "exact", head: true })
      .eq("consolidator_user_id", userId)
      .eq("program_id", programId)
      .eq("student_outcome_id", soId);
    if (cycleId) query = query.eq("cycle_id", cycleId);
    var res = await query;
    return !res.error && Number(res.count || 0) > 0;
  }

  function setSaveIndicator(text, kind) {
    if (!saveIndicator) return;
    saveIndicator.textContent = text;
    saveIndicator.className = "save-indicator muted" + (kind ? " " + kind : "");
  }

  function enableActions() {
    wizardNextBtn.disabled = false;
    wizardPrevBtn.disabled = false;
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
    if (stepOrder[currentStepIndex] === "analysis" && analysisSubStep === "qualitative") {
      flushQualitativeSave(true);
    }
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
    wizardPrevBtn.hidden = currentStepIndex <= 0;
    updateWizardNavLabels();
    updateWizardChrome();
    if (stepTarget === "roster") {
      renderRosterPanel();
      maybeShowFirstRosterNotice();
    }
    if (stepTarget === "grading") {
      showGradingSubStep(gradingSubStep);
    }
    if (stepTarget === "analysis") {
      showAnalysisSubStep(analysisSubStep);
    }
    if (stepTarget === "submit") {
      if (analysisBody && piRows.length && analysisBody.querySelectorAll(".analysis-item").length !== piRows.length) {
        renderAnalyses({ analyses: qualitativeData.analyses || [] });
        applyModuleQualitativeFields(qualitativeData.module || {});
      }
      updateWizardState();
    }
  }

  function canEnterAnalysisSub(sub) {
    if (sub === "quantitative") return allActiveStudentsFullyGraded();
    if (sub === "qualitative") return allActiveStudentsFullyGraded();
    return false;
  }

  function showAnalysisSubStep(sub) {
    if (!canEnterAnalysisSub(sub)) {
      setStatus("Complete las calificaciones de todos los estudiantes activos antes del análisis.", "error");
      return;
    }
    analysisSubStep = sub;
    analysisSubpanels.forEach(function (p) { p.hidden = p.dataset.analysisPanel !== sub; });
    analysisSubstepBtns.forEach(function (btn) {
      var active = btn.dataset.analysisSub === sub;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "step" : "false");
    });
    if (sub === "quantitative") {
      var dist = buildDistribution(studentsData.students, piRows);
      renderDistribution({ distribution: dist });
    }
    if (sub === "qualitative") {
      renderAnalyses({ analyses: qualitativeData.analyses || [] });
      applyModuleQualitativeFields(qualitativeData.module || {});
    }
    updateWizardNavLabels();
    updateWizardChrome();
  }

  function tryAdvanceAnalysisSubStep() {
    if (analysisSubStep === "quantitative") {
      showAnalysisSubStep("qualitative");
      return false;
    }
    return true;
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
      setGradingToolbarCollapsed(true);
    } else {
      setGradingToolbarCollapsed(false);
    }
    updateWizardNavLabels();
    updateWizardChrome();
  }

  function updateWizardNavLabels() {
    if (!wizardPrevBtn) return;
    if (stepOrder[currentStepIndex] === "grading") {
      if (gradingSubStep === "capture") wizardPrevBtn.textContent = "Regresa a 3b Rúbrica";
      else if (gradingSubStep === "rubric") wizardPrevBtn.textContent = "Regresa a 3a Ponderación";
      else wizardPrevBtn.textContent = "Anterior";
    } else if (stepOrder[currentStepIndex] === "analysis") {
      if (analysisSubStep === "qualitative") wizardPrevBtn.textContent = "Regresa a 4a Cuantitativo";
      else wizardPrevBtn.textContent = "Anterior";
    } else {
      wizardPrevBtn.textContent = "Anterior";
    }
  }

  function setGradingToolbarCollapsed(collapsed) {
    if (!gradingToolbarPanel || !gradingToolbarToggle) return;
    var inCapture = stepOrder[currentStepIndex] === "grading" && gradingSubStep === "capture";
    gradingToolbarPanel.classList.toggle("is-collapsed", collapsed);
    gradingToolbarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (gradingToolbarZone) gradingToolbarZone.hidden = collapsed && inCapture;
    if (gradingViewport) {
      gradingViewport.classList.toggle("grading-viewport--focus", collapsed && inCapture);
    }
  }

  function updateWizardChrome() {
    var inCapture = stepOrder[currentStepIndex] === "grading" && gradingSubStep === "capture";
    if (wizardActions) wizardActions.hidden = inCapture;
    if (wizardNextBtn) {
      wizardNextBtn.hidden = inCapture || currentStepIndex >= stepOrder.length - 1;
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

  function formatRaOutcomeLabel(so) {
    if (!so) return "";
    var code = so.code || "";
    var match = code.match(/^RA(\d+)$/i);
    if (match) return "Resultado de Aprendizaje " + match[1];
    return code;
  }

  function renderGradingHeader() {
    var so = currentModule && currentModule.period && currentModule.period.student_outcome;
    if (rubricRaTitle) rubricRaTitle.textContent = so && so.code ? "Rúbrica " + so.code : "Rúbrica del RA";
    if (rubricRaDescription) rubricRaDescription.textContent = formatRaOutcomeLabel(so);
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

  function createLevelRadio(student, pi, level, selected) {
    var input = document.createElement("input");
    input.type = "radio";
    input.className = "level-radio";
    input.name = "level-" + student.module_student_id + "-" + pi.id;
    input.value = String(level.value);
    input.dataset.moduleStudentId = String(student.module_student_id);
    input.dataset.piId = String(pi.id);
    input.setAttribute("aria-label", buildLevelColumnLabel(level) + " — " + pi.code);
    if (selected === level.value) input.checked = true;
    return input;
  }

  function buildStudentGradingMatrix(student) {
    var table = document.createElement("table");
    table.className = "rubric-matrix student-grading-matrix";
    var colgroup = document.createElement("colgroup");
    var colCrit = document.createElement("col");
    colCrit.className = "col-criterion";
    colgroup.appendChild(colCrit);
    LEVEL_CRITERIA.forEach(function () {
      var colLevel = document.createElement("col");
      colLevel.className = "col-level";
      colgroup.appendChild(colLevel);
    });
    table.appendChild(colgroup);
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var thCrit = document.createElement("th");
    thCrit.scope = "col";
    thCrit.textContent = "Criterio";
    headRow.appendChild(thCrit);
    LEVEL_CRITERIA.forEach(function (level) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = buildLevelColumnLabel(level);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    piRows.forEach(function (pi) {
      var tr = document.createElement("tr");
      var tdCrit = document.createElement("td");
      tdCrit.className = "criterion-cell";
      var critHtml = "<strong>" + escapeHtml(pi.code) + ":</strong>";
      if (pi.pi_weight != null && pi.pi_weight !== "") {
        critHtml += ' <span class="pi-weight-badge pi-weight-badge--inline">' + escapeHtml(String(pi.pi_weight)) + " %</span>";
      }
      critHtml += " " + escapeHtml(pi.description || "");
      tdCrit.innerHTML = critHtml;
      tr.appendChild(tdCrit);
      var selected = getExistingLevel(student, pi);
      LEVEL_CRITERIA.forEach(function (level) {
        var td = document.createElement("td");
        td.className = "student-pi-level-cell";
        var label = document.createElement("label");
        label.className = "student-pi-level-option";
        if (selected === level.value) label.classList.add("is-selected");
        var input = createLevelRadio(student, pi, level, selected);
        label.appendChild(input);
        var desc = document.createElement("span");
        desc.className = "student-pi-descriptor";
        desc.textContent = descriptorForPi(pi, level.value);
        label.appendChild(desc);
        td.appendChild(label);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
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
      var input = createLevelRadio(student, pi, level, selected);
      label.appendChild(input);
      label.appendChild(document.createTextNode(buildLevelColumnLabel(level)));
      fieldset.appendChild(label);
    });
    return fieldset;
  }

  function updateStudentNavButtons() {
    if (btnPrevStudent) btnPrevStudent.disabled = currentStudentIndex <= 0;
    if (btnNextStudent) btnNextStudent.disabled = currentStudentIndex >= activeStudentCount - 1;
  }

  function renderStudentCard() {
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
    if (captureRubricTitle && rubricRaTitle) {
      captureRubricTitle.textContent = rubricRaTitle.textContent;
    }
    studentCardPis.innerHTML = "";
    studentCardPis.appendChild(buildStudentGradingMatrix(student));
    updateStudentNavButtons();
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

  function goToNextStudent() {
    if (currentStudentIndex >= activeStudentCount - 1) return;
    currentStudentIndex += 1;
    renderStudentCard();
    updateCaptureChrome();
  }

  function goToPrevStudent() {
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

  function setCaptureHintText(text) {
    if (captureHint) captureHint.textContent = text;
    if (gridCaptureHint) gridCaptureHint.textContent = text;
  }

  function updateCaptureChrome() {
    var graded = countGradedStudents();
    if (gradingProgress) gradingProgress.textContent = "Estudiantes calificados: " + graded + " de " + activeStudentCount;
    var allGraded = allActiveStudentsFullyGraded();
    if (continueAnalysisBtn) continueAnalysisBtn.hidden = !allGraded;
    if (allGraded) {
      setCaptureHintText("Todos los estudiantes activos están calificados. Puede continuar al análisis cuantitativo.");
    } else if (effectiveCaptureViewMode() === "student_card") {
      setCaptureHintText("Complete los cuatro criterios del estudiante activo.");
    } else {
      setCaptureHintText("Complete todos los criterios de cada estudiante visible.");
    }
    updateWizardState();
  }

  function queueSave(msId, piId, level) {
    if (reviewMode) return;
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
    if (reviewMode) return;
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
      if (effectiveCaptureViewMode() === "grid") renderGridView();
    } catch (e) {
      payload.forEach(function (item) {
        pendingUpserts.set(String(item.module_student_id) + "-" + String(item.perf_indicator_id), item);
      });
      if (!isAuthError(e)) setSaveIndicator("Error al guardar", "error");
    }
  }

  function distributionKey(piId) {
    return String(piId);
  }

  function buildDistribution(students, pis) {
    var dist = {};
    pis.forEach(function (pi) {
      var key = distributionKey(pi.id);
      dist[key] = { pi_id: pi.id, pi_code: pi.code, pi_description: pi.description };
      LEVEL_CRITERIA.forEach(function (level) {
        dist[key][level.distKey] = 0;
      });
    });
    students.forEach(function (s) {
      (s.assessments || []).forEach(function (a) {
        var bucket = dist[distributionKey(a.perf_indicator_id)];
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

  function exactDistPercent(count, activeCount) {
    var n = Number(count) || 0;
    if (activeCount <= 0) return 0;
    return (n / activeCount) * 100;
  }

  function formatDistPercent(count, activeCount) {
    return exactDistPercent(count, activeCount).toFixed(2);
  }

  function formatDistCell(count, activeCount) {
    var n = Number(count) || 0;
    return formatDistPercent(n, activeCount) + "% (" + n + ")";
  }

  function piDistributionSummary(dist, piId) {
    var d = dist[distributionKey(piId)];
    if (!d) return "";
    return LEVEL_CRITERIA.map(function (level) {
      return level.labelEs + ": " + formatDistCell(d[level.distKey], activeStudentCount);
    }).join(" · ");
  }

  function suggestStandardAndAction(dist, piId) {
    var d = dist[distributionKey(piId)];
    if (!d || activeStudentCount <= 0) {
      return { standard: "Medium", standardEs: "Medio", actionType: "preventive" };
    }
    var counts = LEVEL_CRITERIA.map(function (level) {
      return { level: level.value, count: Number(d[level.distKey]) || 0 };
    });
    var maxCount = Math.max.apply(null, counts.map(function (c) { return c.count; }));
    if (maxCount <= 0) {
      return { standard: "Medium", standardEs: "Medio", actionType: "preventive" };
    }
    var majorityLevel = counts.filter(function (c) { return c.count === maxCount; })
      .sort(function (a, b) { return a.level - b.level; })[0].level;
    if (majorityLevel === 1) {
      return { standard: "Low", standardEs: "Bajo", actionType: "corrective" };
    }
    if (majorityLevel === 2) {
      return { standard: "Low", standardEs: "Bajo", actionType: "preventive" };
    }
    if (majorityLevel === 4) {
      return { standard: "Medium", standardEs: "Medio", actionType: "preventive" };
    }
    return { standard: "High", standardEs: "Alto", actionType: "improvement" };
  }

  function actionTypeLabel(value) {
    if (value === "corrective") return "Acciones correctivas";
    if (value === "preventive") return "Acciones preventivas";
    if (value === "improvement") return "Plan de mejora / mantenimiento";
    return value;
  }

  function renderQuantitativePiSummaries(dist) {
    if (!quantitativePiSummaries) return;
    quantitativePiSummaries.innerHTML = "";
    var heading = document.createElement("h4");
    heading.className = "quantitative-pi-heading";
    heading.textContent = "Resumen por indicador";
    quantitativePiSummaries.appendChild(heading);
    piRows.forEach(function (pi) {
      var suggestion = suggestStandardAndAction(dist, pi.id);
      var card = document.createElement("article");
      card.className = "quantitative-pi-card";
      card.innerHTML = "<h5>" + escapeHtml(pi.code) + " — " + escapeHtml(pi.description || "") + "</h5>";
      var distLine = document.createElement("p");
      distLine.className = "muted";
      distLine.textContent = piDistributionSummary(dist, pi.id);
      card.appendChild(distLine);
      var meta = document.createElement("p");
      meta.className = "analysis-pi-meta";
      meta.innerHTML = '<span class="analysis-standard-badge">Estándar: ' + escapeHtml(suggestion.standardEs)
        + '</span> <span class="analysis-action-hint">Acción sugerida: ' + escapeHtml(actionTypeLabel(suggestion.actionType)) + "</span>";
      card.appendChild(meta);
      quantitativePiSummaries.appendChild(card);
    });
  }

  function renderDistributionChart(dist, container) {
    var chartWrap = document.createElement("div");
    chartWrap.className = "dist-chart";
    chartWrap.setAttribute("role", "img");
    chartWrap.setAttribute("aria-label", "Gráfica de distribución por indicador de desempeño");

    var legend = document.createElement("div");
    legend.className = "dist-chart-legend";
    LEVEL_CRITERIA.forEach(function (level) {
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

    piRows.forEach(function (pi) {
      var d = dist[distributionKey(pi.id)];
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
      LEVEL_CRITERIA.forEach(function (level) {
        var count = Number(d[level.distKey]) || 0;
        var pct = exactDistPercent(count, activeStudentCount);
        if (pct <= 0) return;
        hasSegment = true;
        var seg = document.createElement("div");
        seg.className = "dist-chart-segment";
        seg.style.flexBasis = pct + "%";
        seg.style.width = pct + "%";
        seg.style.backgroundColor = level.chartColor;
        seg.title = level.labelEs + ": " + formatDistCell(count, activeStudentCount);
        if (pct >= 7) {
          seg.textContent = formatDistPercent(count, activeStudentCount) + "%";
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

  function renderDistribution(data) {
    if (!distributionBody) return;
    distributionBody.innerHTML = "";
    var dist = data.distribution || {};
    var intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = "Resumen del módulo — " + activeStudentCount + " estudiantes activos. "
      + "Cada valor muestra el porcentaje (dos decimales) y, entre paréntesis, cuántos estudiantes obtuvieron ese nivel.";
    distributionBody.appendChild(intro);
    renderDistributionChart(dist, distributionBody);
    var table = document.createElement("table");
    table.className = "modules-table";
    var head = document.createElement("thead");
    var headCells = "<th scope=\"col\">PI</th>";
    LEVEL_CRITERIA.forEach(function (level) {
      headCells += '<th scope="col">' + escapeHtml(level.labelEs) + "</th>";
    });
    headCells += '<th scope="col">Estándar</th><th scope="col">Acción sugerida</th>';
    head.innerHTML = "<tr>" + headCells + "</tr>";
    table.appendChild(head);
    var body = document.createElement("tbody");
    piRows.forEach(function (pi) {
      var d = dist[distributionKey(pi.id)];
      if (!d) return;
      var suggestion = suggestStandardAndAction(dist, pi.id);
      var cells = "<td>" + escapeHtml(d.pi_code || "—") + "</td>";
      LEVEL_CRITERIA.forEach(function (level) {
        cells += "<td>" + formatDistCell(d[level.distKey], activeStudentCount) + "</td>";
      });
      cells += "<td>" + escapeHtml(suggestion.standardEs) + "</td>";
      cells += "<td>" + escapeHtml(actionTypeLabel(suggestion.actionType)) + "</td>";
      var row = document.createElement("tr");
      row.innerHTML = cells;
      body.appendChild(row);
    });
    table.appendChild(body);
    distributionBody.appendChild(table);
    renderQuantitativePiSummaries(dist);
  }

  function applyModuleQualitativeFields(moduleFields) {
    if (conclusionsText) conclusionsText.value = moduleFields.conclusions_text || "";
    if (recommendationsText) recommendationsText.value = moduleFields.recommendations_text || "";
    if (preventiveMeasuresText) preventiveMeasuresText.value = moduleFields.preventive_measures_text || "";
    if (correctiveMeasuresText) correctiveMeasuresText.value = moduleFields.corrective_measures_text || "";
    if (improvementPlanText) improvementPlanText.value = moduleFields.improvement_plan_text || "";
  }

  function collectModuleQualitativeFields() {
    return {
      conclusions_text: conclusionsText ? conclusionsText.value.trim() : "",
      recommendations_text: recommendationsText ? recommendationsText.value.trim() : "",
      preventive_measures_text: preventiveMeasuresText ? preventiveMeasuresText.value.trim() : "",
      corrective_measures_text: correctiveMeasuresText ? correctiveMeasuresText.value.trim() : "",
      improvement_plan_text: improvementPlanText ? improvementPlanText.value.trim() : "",
    };
  }

  function moduleQualitativeFieldsComplete() {
    var fields = collectModuleQualitativeFields();
    return Object.keys(fields).every(function (key) { return fields[key] !== ""; });
  }

  function renderAnalyses(data) {
    if (!analysisBody) return;
    analysisBody.innerHTML = "";
    var dist = buildDistribution(studentsData.students, piRows);
    piRows.forEach(function (pi) {
      var existing = (data.analyses || []).find(function (a) { return a.perf_indicator_id === pi.id; });
      var div = document.createElement("div");
      div.className = "analysis-item";
      div.dataset.piId = pi.id;
      div.innerHTML = "<label>" + escapeHtml(pi.code) + " — " + escapeHtml(pi.description || "") + "</label>";

      var hint = document.createElement("p");
      hint.className = "muted analysis-pi-dist";
      hint.textContent = "Referencia cuantitativa (4a): " + piDistributionSummary(dist, pi.id);
      div.appendChild(hint);

      var analysisLabel = document.createElement("label");
      analysisLabel.className = "analysis-field-label";
      analysisLabel.textContent = "Análisis del indicador";
      div.appendChild(analysisLabel);
      var analysisTa = document.createElement("textarea");
      analysisTa.dataset.field = "analysis";
      analysisTa.maxLength = 2000;
      analysisTa.placeholder = "Interprete el desempeño del grupo en este indicador: niveles alcanzados, fortalezas, brechas y ajustes pedagógicos sugeridos para este criterio…";
      analysisTa.value = existing ? existing.analysis_text || "" : "";
      div.appendChild(analysisTa);

      analysisBody.appendChild(div);
    });
  }

  function collectAnalyses() {
    if (!analysisBody) return [];
    return Array.from(analysisBody.querySelectorAll(".analysis-item")).map(function (item) {
      var piId = Number(item.dataset.piId);
      var analysisTa = item.querySelector('textarea[data-field="analysis"]');
      return {
        perf_indicator_id: piId,
        analysis_text: analysisTa ? analysisTa.value.trim() : "",
      };
    }).filter(function (a) { return a.analysis_text; });
  }

  function allActiveStudentsFullyGraded() {
    return activeStudentCount > 0 && studentsData.students.every(isStudentFullyGraded);
  }

  function allAnalysesComplete() {
    if (piRows.length === 0) return moduleQualitativeFieldsComplete();
    var items = analysisBody ? Array.from(analysisBody.querySelectorAll(".analysis-item")) : [];
    if (items.length !== piRows.length) return false;
    var piComplete = items.every(function (item) {
      var analysisTa = item.querySelector('textarea[data-field="analysis"]');
      return analysisTa && analysisTa.value.trim() !== "";
    });
    return piComplete && moduleQualitativeFieldsComplete();
  }

  function computeXpProgress(completed, total) {
    var safeTotal = total > 0 ? total : 1;
    var safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
    var cumulative = Math.round((safeCompleted / safeTotal) * 100);
    var previous = Math.round(((safeCompleted - 1) / safeTotal) * 100);
    var earned = Math.max(cumulative - previous, 0);
    if (safeCompleted === safeTotal) cumulative = 100;
    return { earned: earned, cumulative: cumulative, allComplete: safeCompleted === safeTotal };
  }

  async function teacherEvaluationProgress(client, userId, cycleId) {
    var staffRes = await client.from("module_staff").select("module_id").eq("user_id", userId);
    if (staffRes.error) throw staffRes.error;
    var moduleIds = [];
    (staffRes.data || []).forEach(function (row) {
      if (row.module_id != null) moduleIds.push(row.module_id);
    });
    if (!moduleIds.length) return { total: 1, completed: 1 };
    var evalRes = await client.from("module_ra_evaluations")
      .select("id, status, period:periods(cycle_id)")
      .in("module_id", moduleIds);
    if (evalRes.error) throw evalRes.error;
    var rows = (evalRes.data || []).filter(function (row) {
      return !cycleId || (row.period && row.period.cycle_id === cycleId);
    });
    if (!rows.length) return { total: 1, completed: 1 };
    return {
      total: rows.length,
      completed: rows.filter(function (row) { return row.status === "completed"; }).length,
    };
  }

  function launchCelebrationBubbles() {
    if (!celebrationBubbles) return;
    celebrationBubbles.innerHTML = "";
    var icons = ["🎉", "✨", "🎊", "⭐", "🏆", "💫"];
    for (var i = 0; i < 28; i++) {
      var bubble = document.createElement("span");
      bubble.className = "celebration-bubble";
      bubble.textContent = icons[i % icons.length];
      bubble.style.left = (8 + Math.random() * 84) + "%";
      bubble.style.animationDelay = (Math.random() * 0.9) + "s";
      bubble.style.animationDuration = (2.2 + Math.random() * 1.6) + "s";
      celebrationBubbles.appendChild(bubble);
    }
  }

  function showSubmitCelebration(xpEarned, xpCumulative, allComplete) {
    if (!submitCelebration) return;
    launchCelebrationBubbles();
    if (celebrationXpEarned) celebrationXpEarned.textContent = "+" + xpEarned + " XP";
    if (celebrationXpTotal) celebrationXpTotal.textContent = String(xpCumulative);
    if (celebrationFollowup) {
      celebrationFollowup.textContent = allComplete
        ? "¡Felicitaciones! Completó todos sus módulos del cuatrimestre y alcanzó 100 XP."
        : "Siga con los módulos pendientes en su panel para llegar a 100 XP.";
    }
    submitCelebration.hidden = false;
    submitCelebration.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderSubmitReadiness() {
    if (!readinessGrading || !readinessAnalysis) return;
    var graded = allActiveStudentsFullyGraded();
    var analysisDone = allAnalysesComplete();
    readinessGrading.className = graded ? "ready" : "pending";
    readinessGrading.textContent = graded ? "Calificaciones: completo" : "Calificaciones: pendiente";
    readinessAnalysis.className = analysisDone ? "ready" : "pending";
    readinessAnalysis.textContent = analysisDone ? "Análisis (4a y 4b): completo" : "Análisis (4a y 4b): pendiente";
  }

  function queueQualitativeSave() {
    if (reviewMode) return;
    qualitativeSaveQueued = true;
    setQualitativeSaveIndicator("Guardando análisis…", "saving");
    clearTimeout(qualitativeSaveDebounceTimer);
    qualitativeSaveDebounceTimer = setTimeout(function () {
      flushQualitativeSave(false);
    }, SAVE_DEBOUNCE_MS);
    updateWizardState();
  }

  async function flushQualitativeSave(force) {
    if (reviewMode) return;
    if (!qualitativeSaveQueued && !force) return;
    var evalId = currentEvaluation && currentEvaluation.id;
    if (!evalId) return;
    qualitativeSaveQueued = false;
    clearTimeout(qualitativeSaveDebounceTimer);
    try {
      await requireAuthOrRedirect();
      var client = assertSupabase();
      var payload = collectAnalyses().map(function (a) {
        return {
          module_ra_evaluation_id: Number(evalId),
          perf_indicator_id: a.perf_indicator_id,
          analysis_text: a.analysis_text,
        };
      });
      if (payload.length) {
        var upsertResult = await client.from("module_analysis").upsert(payload, { onConflict: "module_ra_evaluation_id,perf_indicator_id" });
        if (upsertResult.error) throw upsertResult.error;
        qualitativeData.analyses = collectAnalyses();
      }
      var moduleFields = collectModuleQualitativeFields();
      var hasModuleContent = Object.keys(moduleFields).some(function (key) { return moduleFields[key]; });
      if (hasModuleContent || force) {
        var updateResult = await client.from("module_ra_evaluations").update(moduleFields).eq("id", evalId);
        if (updateResult.error && /(conclusions|recommendations|preventive|corrective|improvement)/i.test(updateResult.error.message || "")) {
          setQualitativeSaveIndicator("Migración 0020 pendiente en Supabase", "error");
          return;
        }
        if (updateResult.error) throw updateResult.error;
        qualitativeData.module = moduleFields;
      }
      setQualitativeSaveIndicator("Análisis guardado", "success");
      updateWizardState();
    } catch (e) {
      qualitativeSaveQueued = true;
      if (!isAuthError(e)) setQualitativeSaveIndicator("Error al guardar", "error");
    }
  }

  function updateWizardState() {
    renderSubmitReadiness();
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

      var evalResult = await client.from("module_ra_evaluations")
        .select("id, status, grading_view_mode, conclusions_text, recommendations_text, preventive_measures_text, corrective_measures_text, improvement_plan_text, module:modules(*, module_staff(users(full_name, email))), period:periods(rubric_id, cycle_id, student_outcome:student_outcomes(id, code, description, program_id))")
        .eq("id", resolvedId)
        .single();
      if (evalResult.error) {
        evalResult = await client.from("module_ra_evaluations")
          .select("id, status, grading_view_mode, module:modules(*, module_staff(users(full_name, email))), period:periods(rubric_id, cycle_id, student_outcome:student_outcomes(id, code, description, program_id))")
          .eq("id", resolvedId)
          .single();
      }
      var evaluation = evalResult.data;
      if (!evaluation || !evaluation.module) { setStatus("Módulo no encontrado.", "error"); return; }

      if (reviewMode) {
        var canReview = await verifyReviewAccess(client, session.user.id, evaluation);
        if (!canReview) {
          setStatus("No tiene permiso para revisar este módulo.", "error");
          return;
        }
      }

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

      var qualResult = await client.from("module_analysis")
        .select("perf_indicator_id, analysis_text")
        .eq("module_ra_evaluation_id", resolvedId);
      var qualRows = qualResult.data;

      qualitativeData.analyses = (qualRows || []).map(function (r) {
        return { perf_indicator_id: r.perf_indicator_id, analysis_text: r.analysis_text };
      });
      qualitativeData.module = {
        conclusions_text: evaluation.conclusions_text || "",
        recommendations_text: evaluation.recommendations_text || "",
        preventive_measures_text: evaluation.preventive_measures_text || "",
        corrective_measures_text: evaluation.corrective_measures_text || "",
        improvement_plan_text: evaluation.improvement_plan_text || "",
      };

      renderGradingHeader();
      renderWeightsPanel();
      renderRubricReviewPanel();
      showGradingSubStep("weights");
      analysisSubStep = "quantitative";
      applyModuleQualitativeFields(qualitativeData.module);
      renderAnalyses({ analyses: qualitativeData.analyses });
      enableActions();
      updateWizardState();
      if (reviewMode) {
        applyReviewModeChrome();
        setStatus("Revisión cargada. " + activeStudentCount + " estudiantes activos.", "success");
      } else {
        setStatus("Datos cargados. " + activeStudentCount + " estudiantes activos.", "success");
      }
    } catch (e) {
      if (isAuthError(e)) { redirectToLogin(); return; }
      setStatus("Error al cargar módulo: " + (e.message || e), "error");
    }
  }

  function syncStudentLevelOptionStyles(input) {
    if (!input || !input.classList || !input.classList.contains("level-radio")) return;
    var row = input.closest("tr");
    if (!row) return;
    row.querySelectorAll(".student-pi-level-option").forEach(function (opt) {
      var radio = opt.querySelector(".level-radio");
      opt.classList.toggle("is-selected", !!(radio && radio.checked));
    });
  }

  function handleLevelCaptureChange(e) {
    var input = e.target;
    if (!input.classList || (!input.classList.contains("level-radio") && !input.classList.contains("level-select"))) return;
    if (!input.value) return;
    if (input.type === "radio" && !input.checked) return;
    syncStudentLevelOptionStyles(input);
    queueSave(input.dataset.moduleStudentId, input.dataset.piId, input.value);
  }

  if (studentsBody) studentsBody.addEventListener("change", handleLevelCaptureChange);
  if (studentCardPis) studentCardPis.addEventListener("change", handleLevelCaptureChange);

  gradingSubstepBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { showGradingSubStep(btn.dataset.gradingSub); });
  });

  analysisSubstepBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (stepOrder[currentStepIndex] !== "analysis") showStep("analysis");
      showAnalysisSubStep(btn.dataset.analysisSub);
    });
  });

  if (gradingToolbarToggle) {
    gradingToolbarToggle.addEventListener("click", function () {
      var collapsed = !gradingToolbarPanel.classList.contains("is-collapsed");
      setGradingToolbarCollapsed(collapsed);
    });
  }

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

  if (btnNextStudent) btnNextStudent.addEventListener("click", function () { goToNextStudent(); });
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
      analysisSubStep = "quantitative";
      showStep("analysis");
      setStatus("Revise la distribución por indicador (4a) antes del análisis cualitativo.", "success");
    });
  }

  if (continueQualitativeBtn) {
    continueQualitativeBtn.addEventListener("click", function () {
      if (!allActiveStudentsFullyGraded()) {
        setStatus("Complete las calificaciones de todos los estudiantes activos primero.", "error");
        return;
      }
      if (stepOrder[currentStepIndex] !== "analysis") showStep("analysis");
      showAnalysisSubStep("qualitative");
      setStatus("Registre el análisis por indicador y las conclusiones del módulo (4b).", "success");
    });
  }

  submitModuleBtn.addEventListener("click", async function () {
    if (reviewMode) return;
    if (!allActiveStudentsFullyGraded() || !allAnalysesComplete()) { setStatus("Complete calificaciones y analisis primero.", "error"); return; }
    submitModuleBtn.disabled = true;
    setStatus("Enviando módulo...");
    if (submitCelebration) submitCelebration.hidden = true;
    try {
      await flushPendingSaves(true);
      await flushQualitativeSave(true);
      var session = await requireAuthOrRedirect();
      if (!session) return;
      var client = assertSupabase();
      var evalId = currentEvaluation && currentEvaluation.id;
      var cycleId = currentModule && currentModule.period && currentModule.period.cycle_id;
      var { error } = await client.from("module_ra_evaluations")
        .update({ status: "completed", submitted_at: new Date().toISOString() })
        .eq("id", evalId);
      if (error) throw error;
      if (currentEvaluation) currentEvaluation.status = "completed";
      showStep("submit");
      renderSubmitReadiness();
      var progress = await teacherEvaluationProgress(client, session.user.id, cycleId);
      var xp = computeXpProgress(progress.completed, progress.total);
      setStatus("", "");
      submitModuleBtn.textContent = "Módulo enviado";
      showSubmitCelebration(xp.earned, xp.cumulative, xp.allComplete);
    } catch (e) {
      if (!isAuthError(e)) setStatus("Error: " + (e.message || e), "error");
      submitModuleBtn.disabled = false;
    }
  });

  if (analysisBody) {
    analysisBody.addEventListener("input", function (e) {
      if (e.target.tagName === "TEXTAREA") queueQualitativeSave();
    });
  }
  if (moduleQualitativeSection) {
    moduleQualitativeSection.addEventListener("input", function (e) {
      if (e.target.tagName === "TEXTAREA") queueQualitativeSave();
    });
  }
  wizardSteps.forEach(function (s) {
    s.addEventListener("click", function () { showStep(s.dataset.stepTarget); });
  });
  wizardNextBtn.addEventListener("click", function () {
    if (stepOrder[currentStepIndex] === "grading" && !tryAdvanceGradingSubStep()) return;
    if (stepOrder[currentStepIndex] === "analysis" && !tryAdvanceAnalysisSubStep()) return;
    showStep(stepOrder[Math.min(currentStepIndex + 1, stepOrder.length - 1)]);
  });

  wizardPrevBtn.addEventListener("click", function () {
    if (stepOrder[currentStepIndex] === "grading") {
      if (gradingSubStep === "capture") { showGradingSubStep("rubric"); return; }
      if (gradingSubStep === "rubric") { showGradingSubStep("weights"); return; }
    }
    if (stepOrder[currentStepIndex] === "analysis") {
      if (analysisSubStep === "qualitative") { showAnalysisSubStep("quantitative"); return; }
    }
    showStep(stepOrder[Math.max(currentStepIndex - 1, 0)]);
  });

  showStep("general");
  loadModule();
})();
