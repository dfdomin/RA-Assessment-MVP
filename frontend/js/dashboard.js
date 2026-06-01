(function () {
  "use strict";

  const welcomeMsg = document.getElementById("welcome-msg");
  const logoutBtn = document.getElementById("logout-btn");
  const periodSelect = document.getElementById("period-select");
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

  let currentUser = null;
  let currentPeriodId = "";
  let currentModules = [];
  let currentTrackingRows = [];

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
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return String(value);
  }

  function statusLabel(status) {
    const labels = {
      pending: "Pendiente",
      in_progress: "En progreso",
      completed: "Completado",
    };
    return labels[status] || safeText(status);
  }

  function progressText(moduleItem) {
    const active = Number(moduleItem.students_active || 0);
    const graded = Number(moduleItem.students_graded || 0);
    const pending = Math.max(active - graded, 0);
    return "Activos: " + active + " | Calificados: " + graded + " | Pendientes: " + pending;
  }

  function teacherText(moduleItem) {
    if (!moduleItem.teacher) {
      return "Sin docente";
    }
    return moduleItem.teacher.full_name;
  }

  function isLeader() {
    return currentUser && currentUser.role === "leader";
  }

  function selectedPeriodName() {
    const option = periodSelect.options[periodSelect.selectedIndex];
    return option ? option.textContent : "período seleccionado";
  }

  function renderEmpty(message) {
    modulesBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.appendChild(cell);
    modulesBody.appendChild(row);
  }

  function updatePeriodProgress(modules) {
    const total = modules.length;
    const completed = modules.filter(function (moduleItem) {
      return moduleItem.status === "completed";
    }).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    periodProgressText.textContent = completed + " de " + total + " (" + percent + "%)";
    periodProgressBar.style.width = percent + "%";
  }

  function renderModules(modules) {
    currentModules = modules;
    modulesBody.innerHTML = "";
    updatePeriodProgress(modules);

    if (!modules.length) {
      renderEmpty("Sin módulos asignados para este período.");
      setStatus("Sin módulos asignados.", "info");
      return;
    }

    modules.forEach(function (moduleItem) {
      const row = document.createElement("tr");
      const actionHref = "/assessment.html?module_id=" + moduleItem.id;
      const cells = [
        safeText(moduleItem.course_name),
        safeText(moduleItem.group_name),
        teacherText(moduleItem),
        statusLabel(moduleItem.status),
        progressText(moduleItem),
      ];

      cells.forEach(function (text) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
      });

      const actionCell = document.createElement("td");
      const action = document.createElement("a");
      action.className = "table-action";
      action.href = actionHref;
      action.textContent = isLeader() ? "Revisar" : "Calificar";
      actionCell.appendChild(action);
      row.appendChild(actionCell);

      modulesBody.appendChild(row);
    });

    setStatus("Módulos cargados: " + modules.length + ".", "success");
  }

  async function loadUser() {
    try {
      const res = await fetch("/api/v1/me", { credentials: "same-origin" });
      if (res.status === 401) {
        window.location.replace("/index.html");
        return false;
      }
      if (!res.ok) {
        welcomeMsg.textContent = "No se pudo cargar la información.";
        return false;
      }
      const data = await res.json();
      currentUser = data;
      welcomeMsg.textContent = "Hola, " + data.full_name + " (" + data.role + ")";
      if (isLeader()) {
        leaderPanel.hidden = false;
      }
      return true;
    } catch (_) {
      welcomeMsg.textContent = "No se pudo cargar la información.";
      return false;
    }
  }

  async function loadModules(periodId) {
    if (!periodId) {
      renderEmpty("Selecciona un período para cargar módulos.");
      setStatus("Selecciona un período.", "info");
      return;
    }

    setStatus("Cargando módulos…");
    renderEmpty("Cargando módulos…");

    try {
      const response = await fetch("/api/v1/periods/" + periodId + "/modules", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        renderEmpty("No se pudieron cargar los módulos.");
        setStatus("No se pudieron cargar los módulos.", "error");
        return;
      }

      renderModules(await response.json());
      if (isLeader()) {
        await loadLeaderDashboard(periodId);
      }
    } catch (_) {
      renderEmpty("No se pudieron cargar los módulos.");
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  async function loadReportPreview(periodId) {
    reportPreview.textContent = "Cargando resumen ejecutivo…";

    try {
      const response = await fetch("/api/v1/periods/" + periodId + "/report/preview", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        reportPreview.textContent = "No se pudo cargar el reporte.";
        return;
      }

      const report = await response.json();
      const distributionCount = Object.keys(report.distribution_by_pi || {}).length;
      reportPreview.textContent =
        selectedPeriodName() +
        " · " +
        safeText(report.student_outcome && report.student_outcome.code) +
        " · PIs con distribución: " +
        distributionCount;
    } catch (_) {
      reportPreview.textContent = "No se pudo conectar con el servidor.";
    }
  }

  function mergeAnalysisItems(actionPlanData, leaderAnalysisData) {
    const saved = {};
    (leaderAnalysisData.analyses || []).forEach(function (item) {
      saved[item.perf_indicator_id] = item.analysis_text;
    });

    return (actionPlanData.plans || []).map(function (plan) {
      return {
        perf_indicator_id: plan.perf_indicator_id,
        pi_code: plan.pi_code,
        standard: plan.standard,
        suggested_action_type: plan.suggested_action_type,
        analysis_text: saved[plan.perf_indicator_id] || "",
      };
    });
  }

  function renderLeaderAnalysis(items) {
    leaderAnalysisList.innerHTML = "";

    if (!items.length) {
      leaderAnalysisList.innerHTML = '<p class="muted">Sin indicadores activos para este período.</p>';
      return;
    }

    items.forEach(function (item) {
      const block = document.createElement("div");
      block.className = "analysis-item";

      const label = document.createElement("label");
      label.setAttribute("for", "leader-analysis-" + item.perf_indicator_id);
      label.textContent =
        item.pi_code +
        " · Estándar " +
        safeText(item.standard) +
        " · Acción sugerida " +
        safeText(item.suggested_action_type);

      const textarea = document.createElement("textarea");
      textarea.id = "leader-analysis-" + item.perf_indicator_id;
      textarea.dataset.piId = item.perf_indicator_id;
      textarea.maxLength = 2000;
      textarea.value = item.analysis_text;
      textarea.placeholder = "Escribe el análisis consolidado para este PI.";

      block.appendChild(label);
      block.appendChild(textarea);
      leaderAnalysisList.appendChild(block);
    });
  }

  async function loadLeaderAnalysis(periodId) {
    leaderAnalysisList.innerHTML = '<p class="muted">Cargando indicadores…</p>';
    setLeaderAnalysisStatus("");

    try {
      const actionPlanResponse = await fetch("/api/v1/periods/" + periodId + "/action-plan", {
        credentials: "same-origin",
      });
      const analysisResponse = await fetch("/api/v1/periods/" + periodId + "/leader-analysis", {
        credentials: "same-origin",
      });

      if (actionPlanResponse.status === 401 || analysisResponse.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!actionPlanResponse.ok || !analysisResponse.ok) {
        leaderAnalysisList.innerHTML = '<p class="muted">No se pudo cargar el análisis.</p>';
        return;
      }

      const items = mergeAnalysisItems(
        await actionPlanResponse.json(),
        await analysisResponse.json()
      );
      renderLeaderAnalysis(items);
    } catch (_) {
      leaderAnalysisList.innerHTML = '<p class="muted">No se pudo conectar con el servidor.</p>';
    }
  }

  async function loadLeaderDashboard(periodId) {
    await loadTracking(periodId);
    await loadReportPreview(periodId);
    await loadLeaderAnalysis(periodId);
    await loadLeaderReport(periodId);
  }

  async function loadTracking(periodId) {
    currentTrackingRows = [];

    try {
      const response = await fetch("/api/v1/periods/" + periodId + "/tracking", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (response.ok) {
        currentTrackingRows = await response.json();
      }
    } catch (_) {
      currentTrackingRows = [];
    }
  }

  function pendingReminderRecipientIds() {
    const seen = {};
    const ids = [];
    currentTrackingRows.forEach(function (row) {
      if (!row.teacher || row.status === "completed" || seen[row.teacher.id]) {
        return;
      }
      seen[row.teacher.id] = true;
      ids.push(row.teacher.id);
    });
    return ids.slice(0, 15);
  }

  async function sendPendingReminders() {
    if (!currentPeriodId) {
      return;
    }

    if (!currentTrackingRows.length) {
      await loadTracking(currentPeriodId);
    }

    const recipientIds = pendingReminderRecipientIds();
    if (!recipientIds.length) {
      setStatus("No hay docentes pendientes para recordar.", "info");
      return;
    }

    const messageBody =
      "Hola {nombre_docente}, te recordamos completar la evaluación del módulo {modulo}. " +
      "Avance actual: {avance_pct}%. Días restantes: {dias_restantes}. Ingresa por {login_url}.";

    setStatus("Preparando recordatorios…");

    try {
      const previewParams = new URLSearchParams({
        recipient_ids: recipientIds.join(","),
        message_body: messageBody,
      });
      const previewUrl = "/api/v1/periods/" + currentPeriodId + "/reminders/preview";
      const previewResponse = await fetch(
        previewUrl + "?" + previewParams.toString(),
        { credentials: "same-origin" }
      );

      if (previewResponse.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!previewResponse.ok) {
        setStatus("No se pudo previsualizar el recordatorio.", "error");
        return;
      }

      const response = await fetch("/api/v1/periods/" + currentPeriodId + "/reminders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_ids: recipientIds,
          message_body: messageBody,
        }),
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (response.status === 429) {
        setStatus("Límite de recordatorios alcanzado. Intenta de nuevo en un minuto.", "error");
        return;
      }

      if (!response.ok) {
        setStatus("No se pudieron enviar los recordatorios.", "error");
        return;
      }

      const data = await response.json();
      setStatus("Se enviaron " + data.sent + " recordatorios correctamente.", "success");
    } catch (_) {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  async function saveLeaderAnalysis(event) {
    event.preventDefault();
    if (!currentPeriodId) {
      return;
    }

    const analyses = Array.from(leaderAnalysisList.querySelectorAll("textarea[data-pi-id]"))
      .map(function (textarea) {
        return {
          perf_indicator_id: Number(textarea.dataset.piId),
          analysis_text: textarea.value,
        };
      });

    setLeaderAnalysisStatus("Guardando análisis del líder…");

    try {
      const response = await fetch("/api/v1/periods/" + currentPeriodId + "/leader-analysis", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyses: analyses }),
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        setLeaderAnalysisStatus("No se pudo guardar el análisis del líder.", "error");
        return;
      }

      setLeaderAnalysisStatus("Análisis del líder guardado.", "success");
    } catch (_) {
      setLeaderAnalysisStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  function renderLeaderReport(items) {
    leaderReportList.innerHTML = "";

    if (!items.length) {
      leaderReportList.innerHTML = '<p class="muted">Sin indicadores activos para este informe.</p>';
      return;
    }

    items.forEach(function (item) {
      const block = document.createElement("div");
      block.className = "analysis-item";

      const label = document.createElement("label");
      label.setAttribute("for", "leader-report-" + item.perf_indicator_id);
      label.textContent = item.pi_code + " · " + safeText(item.pi_description);

      const helper = document.createElement("p");
      helper.className = "muted";
      helper.textContent = "Síntesis: " + safeText(item.leader_analysis);

      const textarea = document.createElement("textarea");
      textarea.id = "leader-report-" + item.perf_indicator_id;
      textarea.dataset.piId = item.perf_indicator_id;
      textarea.maxLength = 3000;
      textarea.value = item.conclusion_text || "";
      textarea.placeholder = "Escriba las conclusiones consolidadas para este PI...";

      block.appendChild(label);
      block.appendChild(helper);
      block.appendChild(textarea);
      leaderReportList.appendChild(block);
    });
  }

  async function loadLeaderReport(periodId) {
    leaderReportList.innerHTML = '<p class="muted">Cargando informe…</p>';
    setLeaderReportStatus("");

    try {
      const response = await fetch("/api/v1/periods/" + periodId + "/leader-report", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        leaderReportList.innerHTML = '<p class="muted">No se pudo cargar el informe.</p>';
        return;
      }

      const data = await response.json();
      renderLeaderReport(data.items || []);
    } catch (_) {
      leaderReportList.innerHTML = '<p class="muted">No se pudo conectar con el servidor.</p>';
    }
  }

  async function saveLeaderReport(event) {
    event.preventDefault();
    if (!currentPeriodId) {
      return;
    }

    const conclusions = Array.from(leaderReportList.querySelectorAll("textarea[data-pi-id]"))
      .map(function (textarea) {
        return {
          perf_indicator_id: Number(textarea.dataset.piId),
          conclusion_text: textarea.value,
        };
      });

    setLeaderReportStatus("Guardando informe del líder…");

    try {
      const response = await fetch("/api/v1/periods/" + currentPeriodId + "/leader-report", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conclusions: conclusions }),
      });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        setLeaderReportStatus("No se pudo guardar el informe del líder.", "error");
        return;
      }

      const data = await response.json();
      renderLeaderReport(data.items || []);
      setLeaderReportStatus("Informe del líder guardado.", "success");
    } catch (_) {
      setLeaderReportStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  function downloadLeaderReportPdf() {
    if (!currentPeriodId) {
      return;
    }
    window.location.href = "/api/v1/periods/" + currentPeriodId + "/leader-report/pdf";
  }

  function downloadLeaderReportDocx() {
    if (!currentPeriodId) {
      return;
    }
    window.location.href = "/api/v1/periods/" + currentPeriodId + "/leader-report/docx";
  }

  async function loadPeriods() {
    setStatus("Cargando períodos…");

    try {
      const response = await fetch("/api/v1/periods", { credentials: "same-origin" });

      if (response.status === 401) {
        window.location.replace("/index.html");
        return;
      }

      if (!response.ok) {
        periodSelect.innerHTML = '<option value="">Sin períodos disponibles</option>';
        setStatus("No se pudieron cargar los períodos.", "error");
        return;
      }

      const periods = await response.json();
      periodSelect.innerHTML = "";

      if (!periods.length) {
        periodSelect.disabled = true;
        periodSelect.appendChild(new Option("Sin períodos disponibles", ""));
        renderEmpty("Sin períodos disponibles.");
        setStatus("Sin períodos disponibles.", "info");
        return;
      }

      periods.forEach(function (period) {
        periodSelect.appendChild(new Option(period.name, period.id));
      });

      periodSelect.disabled = false;
      await loadModules(periodSelect.value);
    } catch (_) {
      periodSelect.innerHTML = '<option value="">Error al cargar períodos</option>';
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  periodSelect.addEventListener("change", function () {
    currentPeriodId = periodSelect.value;
    loadModules(periodSelect.value);
  });

  viewReportBtn.addEventListener("click", function () {
    if (currentPeriodId) {
      window.location.href = "/api/v1/periods/" + currentPeriodId + "/report/preview";
    }
  });

  closePeriodBtn.addEventListener("click", async function () {
    const periodId = currentPeriodId;
    if (!periodId) {
      return;
    }

    setStatus("Cerrando período…");
    try {
      const response = await fetch("/api/v1/periods/" + periodId + "/close", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      if (response.ok) {
        setStatus("Período cerrado.", "success");
        await loadPeriods();
      } else if (response.status === 409) {
        setStatus("Hay módulos pendientes; revisa el avance antes de cerrar.", "error");
      } else {
        setStatus("No se pudo cerrar el período.", "error");
      }
    } catch (_) {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  });

  sendReminderBtn.addEventListener("click", sendPendingReminders);

  leaderAnalysisForm.addEventListener("submit", saveLeaderAnalysis);
  leaderReportForm.addEventListener("submit", saveLeaderReport);
  leaderReportPdfBtn.addEventListener("click", downloadLeaderReportPdf);
  leaderReportDocxBtn.addEventListener("click", downloadLeaderReportDocx);

  logoutBtn.addEventListener("click", async function () {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/index.html");
  });

  loadUser().then(function (loaded) {
    if (loaded) {
      loadPeriods().then(function () {
        currentPeriodId = periodSelect.value;
      });
    }
  });
})();
