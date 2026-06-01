(function () {
  "use strict";

  const moduleId = new URLSearchParams(window.location.search).get("module_id");
  const statusEl = document.getElementById("assessment-status");
  const studentsHead = document.getElementById("students-head");
  const studentsBody = document.getElementById("students-body");
  const analysisBody = document.getElementById("analysis-body");
  const moduleSummary = document.getElementById("module-summary");
  const distributionBody = document.getElementById("distribution-body");
  const submitReadiness = document.getElementById("submit-readiness");
  const saveAssessmentsBtn = document.getElementById("save-assessments-btn");
  const saveQualitativeBtn = document.getElementById("save-qualitative-btn");
  const submitModuleBtn = document.getElementById("submit-module-btn");
  const wizardPrevBtn = document.getElementById("wizard-prev-btn");
  const wizardNextBtn = document.getElementById("wizard-next-btn");
  const wizardSteps = Array.from(document.querySelectorAll("[data-step-target]"));
  const wizardPanels = Array.from(document.querySelectorAll("[data-step-panel]"));

  const stepOrder = ["general", "grading", "distribution", "analysis", "submit"];
  let currentStepIndex = 0;
  let activePis = [];
  let latestStudentsResponse = null;
  let latestAssessmentsResponse = null;

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = "status-message" + (kind ? " " + kind : "");
  }

  function fetchJson(path, options) {
    const requestOptions = Object.assign({ credentials: "same-origin" }, options || {});
    return fetch(path, requestOptions).then(function (response) {
      if (response.status === 401) {
        window.location.replace("/index.html");
        return Promise.reject(new Error("unauthorized"));
      }
      if (!response.ok) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          throw new Error(body.detail || "request_failed");
        });
      }
      return response.json();
    });
  }

  function renderCellText(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function renderModuleSummary(studentsResponse) {
    moduleSummary.innerHTML = "";

    [
      ["Módulo", "#" + studentsResponse.module_id],
      ["Estudiantes activos", String(studentsResponse.active_students)],
      ["Estudiantes calificados", String(studentsResponse.fully_graded_students)],
      ["Indicadores activos", String(studentsResponse.active_pi_count)],
    ].forEach(function (item) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = item[0];
      detail.textContent = item[1];
      wrapper.appendChild(term);
      wrapper.appendChild(detail);
      moduleSummary.appendChild(wrapper);
    });
  }

  function selectForLevel(moduleStudentId, piId, currentLevel) {
    const select = document.createElement("select");
    select.className = "level-select";
    select.dataset.moduleStudentId = moduleStudentId;
    select.dataset.perfIndicatorId = piId;
    select.appendChild(new Option("Sin calificar", ""));

    [1, 2, 3, 4].forEach(function (level) {
      const option = new Option(String(level), String(level));
      option.selected = Number(currentLevel) === level;
      select.appendChild(option);
    });

    return select;
  }

  function inferActivePis(studentsResponse, assessmentsResponse) {
    const byId = new Map();

    (studentsResponse.active_perf_indicators || []).forEach(function (pi) {
      byId.set(pi.id, pi.code);
    });

    studentsResponse.students.forEach(function (student) {
      student.assessments.forEach(function (assessment) {
        byId.set(assessment.perf_indicator_id, assessment.pi_code);
      });
    });

    Object.keys(assessmentsResponse.distribution || {}).forEach(function (code) {
      assessmentsResponse.students.forEach(function (student) {
        student.assessments.forEach(function (assessment) {
          if (assessment.pi_code === code) {
            byId.set(assessment.perf_indicator_id, assessment.pi_code);
          }
        });
      });
    });

    return Array.from(byId.entries()).map(function (entry) {
      return { id: entry[0], code: entry[1] };
    }).sort(function (a, b) {
      return a.code.localeCompare(b.code);
    });
  }

  function renderStudents(studentsResponse, assessmentsResponse) {
    latestStudentsResponse = studentsResponse;
    latestAssessmentsResponse = assessmentsResponse;
    activePis = inferActivePis(studentsResponse, assessmentsResponse);
    studentsHead.innerHTML = "";
    studentsBody.innerHTML = "";

    const headRow = document.createElement("tr");
    headRow.appendChild(renderCellText("Estudiante"));
    headRow.appendChild(renderCellText("Estado"));
    activePis.forEach(function (pi) {
      headRow.appendChild(renderCellText(pi.code));
    });
    studentsHead.appendChild(headRow);

    if (!studentsResponse.students.length) {
      const row = document.createElement("tr");
      const cell = renderCellText("Sin estudiantes matriculados.");
      cell.colSpan = Math.max(activePis.length + 2, 2);
      row.appendChild(cell);
      studentsBody.appendChild(row);
      return;
    }

    studentsResponse.students.forEach(function (student) {
      const row = document.createElement("tr");
      const assessmentsByPi = new Map();

      student.assessments.forEach(function (assessment) {
        assessmentsByPi.set(assessment.perf_indicator_id, assessment.level);
      });

      row.appendChild(renderCellText(student.full_name + " (" + student.internal_id + ")"));
      row.appendChild(renderCellText(student.status));

      activePis.forEach(function (pi) {
        const cell = document.createElement("td");
        cell.appendChild(selectForLevel(
          student.module_student_id,
          pi.id,
          assessmentsByPi.get(pi.id)
        ));
        row.appendChild(cell);
      });

      studentsBody.appendChild(row);
    });
  }

  function renderDistribution(assessmentsResponse) {
    distributionBody.innerHTML = "";

    if (!activePis.length) {
      distributionBody.innerHTML = '<p class="muted">Sin indicadores activos para distribuir.</p>';
      return;
    }

    activePis.forEach(function (pi) {
      const item = document.createElement("article");
      item.className = "distribution-item";
      const title = document.createElement("h4");
      title.textContent = pi.code;
      item.appendChild(title);

      const levels = (assessmentsResponse.distribution || {})[pi.code] || {};
      const list = document.createElement("dl");

      [1, 2, 3, 4].forEach(function (level) {
        const wrapper = document.createElement("div");
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = "Nivel " + level;
        detail.textContent = String(levels[String(level)] || levels[level] || 0);
        wrapper.appendChild(term);
        wrapper.appendChild(detail);
        list.appendChild(wrapper);
      });

      item.appendChild(list);
      distributionBody.appendChild(item);
    });
  }

  function renderAnalyses(qualitativeResponse) {
    const existingByPi = new Map();
    qualitativeResponse.analyses.forEach(function (item) {
      existingByPi.set(item.perf_indicator_id, item.analysis_text);
    });

    analysisBody.innerHTML = "";

    if (!activePis.length) {
      analysisBody.innerHTML = '<p class="muted">Sin indicadores activos para analizar.</p>';
      return;
    }

    activePis.forEach(function (pi) {
      const wrapper = document.createElement("div");
      wrapper.className = "analysis-item";

      const label = document.createElement("label");
      label.textContent = pi.code;

      const textarea = document.createElement("textarea");
      textarea.dataset.perfIndicatorId = pi.id;
      textarea.maxLength = 2000;
      textarea.rows = 4;
      textarea.value = existingByPi.get(pi.id) || "";

      wrapper.appendChild(label);
      wrapper.appendChild(textarea);
      analysisBody.appendChild(wrapper);
    });
  }

  function allStudentsFullyGraded() {
    const activeStudents = (latestStudentsResponse ? latestStudentsResponse.students : [])
      .filter(function (student) {
        return student.status === "active";
      });

    if (!activeStudents.length || !activePis.length) {
      return false;
    }

    return activeStudents.every(function (student) {
      return activePis.every(function (pi) {
        const selector = '.level-select[data-module-student-id="' +
          student.module_student_id + '"][data-perf-indicator-id="' + pi.id + '"]';
        const select = document.querySelector(selector);
        return Boolean(select && select.value);
      });
    });
  }

  function allAnalysesComplete() {
    if (!activePis.length) {
      return false;
    }

    return activePis.every(function (pi) {
      const textarea = analysisBody.querySelector(
        'textarea[data-perf-indicator-id="' + pi.id + '"]'
      );
      return Boolean(textarea && textarea.value.trim());
    });
  }

  function updateWizardState() {
    const gradesReady = allStudentsFullyGraded();
    const analysisReady = allAnalysesComplete();

    submitModuleBtn.disabled = !(allStudentsFullyGraded() && allAnalysesComplete());

    submitReadiness.innerHTML = "";
    [
      ["Calificaciones", gradesReady],
      ["Análisis cualitativo", analysisReady],
    ].forEach(function (item) {
      const li = document.createElement("li");
      li.className = item[1] ? "ready" : "pending";
      li.textContent = item[0] + ": " + (item[1] ? "completo" : "pendiente");
      submitReadiness.appendChild(li);
    });
  }

  function showStep(stepName) {
    const nextIndex = stepOrder.indexOf(stepName);
    if (nextIndex === -1) {
      return;
    }

    currentStepIndex = nextIndex;

    wizardPanels.forEach(function (panel) {
      panel.hidden = panel.dataset.stepPanel !== stepName;
    });

    wizardSteps.forEach(function (step) {
      const isCurrent = step.dataset.stepTarget === stepName;
      if (isCurrent) {
        step.setAttribute("aria-current", "step");
      } else {
        step.removeAttribute("aria-current");
      }
    });

    wizardPrevBtn.disabled = currentStepIndex === 0;
    wizardNextBtn.disabled = currentStepIndex === stepOrder.length - 1;
    wizardNextBtn.textContent = currentStepIndex === stepOrder.length - 2 ? "Revisar envío" : "Siguiente";
    updateWizardState();
  }

  function collectAssessments() {
    return Array.from(document.querySelectorAll(".level-select"))
      .filter(function (select) {
        return select.value !== "";
      })
      .map(function (select) {
        return {
          module_student_id: Number(select.dataset.moduleStudentId),
          perf_indicator_id: Number(select.dataset.perfIndicatorId),
          level: Number(select.value),
        };
      });
  }

  function collectAnalyses() {
    return Array.from(analysisBody.querySelectorAll("textarea"))
      .filter(function (textarea) {
        return textarea.value.trim() !== "";
      })
      .map(function (textarea) {
        return {
          perf_indicator_id: Number(textarea.dataset.perfIndicatorId),
          analysis_text: textarea.value.trim(),
        };
      });
  }

  function enableActions() {
    saveAssessmentsBtn.disabled = false;
    saveQualitativeBtn.disabled = false;
    updateWizardState();
  }

  function loadModule() {
    if (!moduleId) {
      setStatus("No se recibió module_id.", "error");
      return;
    }

    setStatus("Cargando datos del módulo…");

    Promise.all([
      fetchJson("/api/v1/modules/" + moduleId + "/students", { credentials: "same-origin" }),
      fetchJson("/api/v1/modules/" + moduleId + "/assessments", { credentials: "same-origin" }),
      fetchJson("/api/v1/modules/" + moduleId + "/qualitative", { credentials: "same-origin" }),
    ]).then(function (responses) {
      renderModuleSummary(responses[0]);
      renderStudents(responses[0], responses[1]);
      renderDistribution(responses[1]);
      renderAnalyses(responses[2]);
      enableActions();
      setStatus("Datos cargados. Estudiantes activos: " + responses[0].active_students + ".", "success");
    }).catch(function (error) {
      if (error.message !== "unauthorized") {
        setStatus("No se pudo cargar el módulo: " + error.message, "error");
      }
    });
  }

  saveAssessmentsBtn.addEventListener("click", function () {
    saveAssessmentsBtn.disabled = true;
    setStatus("Guardando calificaciones…");

    fetchJson("/api/v1/modules/" + moduleId + "/assessments", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessments: collectAssessments() }),
    }).then(function () {
      setStatus("Calificaciones guardadas.", "success");
      updateWizardState();
    }).catch(function (error) {
      if (error.message !== "unauthorized") {
        setStatus("No se pudieron guardar las calificaciones: " + error.message, "error");
      }
    }).finally(function () {
      saveAssessmentsBtn.disabled = false;
    });
  });

  saveQualitativeBtn.addEventListener("click", function () {
    saveQualitativeBtn.disabled = true;
    setStatus("Guardando análisis…");

    fetchJson("/api/v1/modules/" + moduleId + "/qualitative", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyses: collectAnalyses() }),
    }).then(function () {
      setStatus("Análisis guardado.", "success");
      updateWizardState();
    }).catch(function (error) {
      if (error.message !== "unauthorized") {
        setStatus("No se pudo guardar el análisis: " + error.message, "error");
      }
    }).finally(function () {
      saveQualitativeBtn.disabled = false;
    });
  });

  submitModuleBtn.addEventListener("click", function () {
    submitModuleBtn.disabled = true;
    setStatus("Enviando módulo…");

    fetchJson("/api/v1/modules/" + moduleId + "/submit", {
      method: "PUT",
      credentials: "same-origin",
    }).then(function () {
      setStatus("Módulo enviado.", "success");
    }).catch(function (error) {
      if (error.message !== "unauthorized") {
        setStatus("No se pudo enviar el módulo: " + error.message, "error");
      }
      submitModuleBtn.disabled = false;
    });
  });

  studentsBody.addEventListener("change", function (event) {
    if (event.target.classList.contains("level-select")) {
      updateWizardState();
    }
  });

  analysisBody.addEventListener("input", function (event) {
    if (event.target.tagName === "TEXTAREA") {
      updateWizardState();
    }
  });

  wizardSteps.forEach(function (step) {
    step.addEventListener("click", function () {
      showStep(step.dataset.stepTarget);
    });
  });

  wizardNextBtn.addEventListener("click", function () {
    showStep(stepOrder[Math.min(currentStepIndex + 1, stepOrder.length - 1)]);
  });

  wizardPrevBtn.addEventListener("click", function () {
    showStep(stepOrder[Math.max(currentStepIndex - 1, 0)]);
  });

  showStep("general");
  loadModule();
})();
