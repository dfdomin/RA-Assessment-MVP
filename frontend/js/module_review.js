(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var evaluationId = params.get("evaluation_id");
  var bannerEl = document.getElementById("review-status-banner");
  var statusEl = document.getElementById("review-status");

  var LEVEL_CRITERIA = [
    { value: 1, labelEs: "Deficiente", distKey: "deficient" },
    { value: 2, labelEs: "Básico", distKey: "basic" },
    { value: 3, labelEs: "Competente", distKey: "competent" },
    { value: 4, labelEs: "Sobresaliente", distKey: "outstanding" },
  ];

  if (!evaluationId) {
    document.body.innerHTML = '<p style="padding:2rem">Falta evaluation_id en la URL.</p>';
    return;
  }

  function assertSupabase() {
    if (typeof supabase === "undefined" || !supabase) throw new Error("Supabase no disponible.");
    return supabase;
  }

  async function requireAuthOrRedirect() {
    var sb = assertSupabase();
    var res = await sb.auth.getSession();
    if (!res.data || !res.data.session) {
      window.location.replace("./index.html");
      return null;
    }
    return res.data.session;
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

  function safeText(v) {
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusLabel(status) {
    var labels = { pending: "Pendiente", in_progress: "En progreso", completed: "Completado" };
    return labels[status] || safeText(status);
  }

  function levelMetaByValue(levelValue) {
    return LEVEL_CRITERIA.find(function (l) { return l.value === Number(levelValue); }) || null;
  }

  function distributionKey(piId) {
    return "pi_" + piId;
  }

  function buildDistribution(students, pis) {
    var dist = {};
    pis.forEach(function (pi) {
      var key = distributionKey(pi.id);
      dist[key] = { pi_id: pi.id, pi_code: pi.code };
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

  function formatDistPercent(count, active) {
    if (!active) return "0.00";
    return ((Number(count) || 0) / active * 100).toFixed(2);
  }

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "status-message" + (kind ? " " + kind : "");
  }

  function setBanner(status) {
    if (!bannerEl) return;
    var messages = {
      pending: "El docente aún no ha enviado este módulo. Lo que ves es borrador o está vacío.",
      in_progress: "El docente está trabajando en este módulo; aún no ha enviado.",
      completed: "Módulo enviado por el docente — solo lectura.",
    };
    bannerEl.textContent = messages[status] || "Revisión de supervisión — solo lectura.";
    bannerEl.hidden = false;
    bannerEl.className = "module-review-banner module-review-banner--" + (status || "pending");
  }

  function renderSummary(ctx) {
    var body = document.getElementById("review-summary-body");
    if (!body) return;
    var rows = [
      ["Curso", safeText(ctx.courseName) + " (" + safeText(ctx.courseCode) + ")"],
      ["Grupo", safeText(ctx.groupName)],
      ["RA", safeText(ctx.raCode)],
      ["Programa", safeText(ctx.programName)],
      ["Cuatrimestre", safeText(ctx.cycleName)],
      ["Docente evaluador", safeText(ctx.teacherName)],
      ["Estado del envío", statusLabel(ctx.status)],
      ["Progreso", "Activos: " + ctx.activeCount + " | Calificados: " + ctx.gradedCount],
    ];
    body.innerHTML = rows.map(function (pair) {
      return "<dt>" + escapeHtml(pair[0]) + "</dt><dd>" + escapeHtml(pair[1]) + "</dd>";
    }).join("");
  }

  function renderWeights(piRows, weightMap) {
    var root = document.getElementById("review-weights-body");
    if (!root) return;
    if (!piRows.length) {
      root.innerHTML = '<p class="muted">Sin registrar</p>';
      return;
    }
    var hasAnyWeight = piRows.some(function (pi) { return weightMap[pi.id] != null; });
    if (!hasAnyWeight) {
      root.innerHTML = '<p class="muted">Sin registrar</p>';
      return;
    }
    var html = '<div class="table-wrap"><table class="modules-table"><thead><tr><th>PI</th><th>Peso %</th></tr></thead><tbody>';
    piRows.forEach(function (pi) {
      var w = weightMap[pi.id];
      html += "<tr><td>" + escapeHtml(pi.code) + "</td><td>" + (w != null ? w + "%" : "Sin registrar") + "</td></tr>";
    });
    root.innerHTML = html + "</tbody></table></div>";
  }

  function renderRoster(rows) {
    var root = document.getElementById("review-roster-body");
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = '<p class="muted">Sin lista cargada</p>';
      return;
    }
    var html = '<div class="table-wrap"><table class="modules-table"><thead><tr><th>Código</th><th>Nombre</th><th>Estado</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += "<tr><td>" + escapeHtml(r.internal_id) + "</td><td>" + escapeHtml(r.full_name) + "</td><td>" + escapeHtml(r.statusLabel) + "</td></tr>";
    });
    root.innerHTML = html + "</tbody></table></div>";
  }

  function renderGrades(piRows, students, activeCount) {
    var root = document.getElementById("review-grades-body");
    if (!root) return;
    if (!students.length || !piRows.length) {
      root.innerHTML = '<p class="muted">Sin calificaciones registradas</p>';
      return;
    }
    var hasGrades = students.some(function (s) { return s.assessments && s.assessments.length; });
    if (!hasGrades) {
      root.innerHTML = '<p class="muted">Sin calificaciones registradas</p>';
      return;
    }
    var dist = buildDistribution(students, piRows);
    var html = "";
    piRows.forEach(function (pi) {
      var d = dist[distributionKey(pi.id)] || {};
      var parts = LEVEL_CRITERIA.map(function (level) {
        var n = Number(d[level.distKey]) || 0;
        return level.labelEs + ": " + formatDistPercent(n, activeCount) + "% (" + n + ")";
      });
      html += '<article class="module-review-pi-block"><h3>' + escapeHtml(pi.code) + "</h3><p class=\"muted\">" + escapeHtml(parts.join(" · ")) + "</p></article>";
    });
    root.innerHTML = html;
  }

  function renderAnalysis(piRows, analysisMap, moduleFields) {
    var root = document.getElementById("review-analysis-body");
    if (!root) return;
    var hasPi = piRows.some(function (pi) { return analysisMap[pi.id]; });
    var hasModule = Object.keys(moduleFields).some(function (k) { return moduleFields[k]; });
    if (!hasPi && !hasModule) {
      root.innerHTML = '<p class="muted">Sin análisis del docente</p>';
      return;
    }
    var html = "";
    piRows.forEach(function (pi) {
      var text = analysisMap[pi.id];
      if (!text) return;
      html += '<article class="module-review-pi-block"><h3>' + escapeHtml(pi.code) + '</h3><p class="module-review-text">' + escapeHtml(text) + "</p></article>";
    });
    var moduleLabels = {
      conclusions_text: "Conclusiones",
      recommendations_text: "Recomendaciones",
      preventive_measures_text: "Medidas preventivas",
      corrective_measures_text: "Medidas correctivas",
      improvement_plan_text: "Plan de mejora",
    };
    Object.keys(moduleLabels).forEach(function (key) {
      if (!moduleFields[key]) return;
      html += '<article class="module-review-pi-block"><h3>' + escapeHtml(moduleLabels[key]) + '</h3><p class="module-review-text">' + escapeHtml(moduleFields[key]) + "</p></article>";
    });
    root.innerHTML = html;
  }

  async function loadEvaluation(client) {
    var res = await client.from("module_ra_evaluations")
      .select("id, status, conclusions_text, recommendations_text, preventive_measures_text, corrective_measures_text, improvement_plan_text, module:modules(id, course_code, course_name, group_name, program_id, program:programs(name), module_staff(users(full_name))), period:periods(id, rubric_id, cycle_id, cycle:measurement_cycles(name, code), student_outcome:student_outcomes(id, code, description)))")
      .eq("id", Number(evaluationId))
      .single();
    if (res.error || !res.data || !res.data.module) throw new Error("Módulo no encontrado.");
    return res.data;
  }

  async function countGraded(client, moduleId, piIds) {
    if (!piIds.length) return 0;
    var msRes = await client.from("module_students").select("id").eq("module_id", moduleId).eq("status", "active");
    var ms = msRes.data || [];
    if (!ms.length) return 0;
    var msIds = ms.map(function (r) { return r.id; });
    var aRes = await client.from("assessments").select("module_student_id, perf_indicator_id").in("module_student_id", msIds).in("perf_indicator_id", piIds);
    var counts = new Map();
    (aRes.data || []).forEach(function (r) {
      if (!counts.has(r.module_student_id)) counts.set(r.module_student_id, new Set());
      counts.get(r.module_student_id).add(r.perf_indicator_id);
    });
    return msIds.filter(function (id) {
      return (counts.get(id) || new Set()).size === piIds.length;
    }).length;
  }

  async function renderReviewPage() {
    setStatus("Cargando…");
    var session = await requireAuthOrRedirect();
    if (!session) return;
    var client = assertSupabase();
    var evaluation = await loadEvaluation(client);
    var canReview = await verifyReviewAccess(client, session.user.id, evaluation);
    if (!canReview) {
      setStatus("No tiene permiso para revisar este módulo.", "error");
      return;
    }

    var mod = evaluation.module;
    var period = evaluation.period || {};
    var pisRes = await client.from("perf_indicators")
      .select("id, code, description, position")
      .eq("rubric_id", period.rubric_id)
      .eq("is_active", true)
      .order("position");
    var piRows = pisRes.data || [];
    var piIds = piRows.map(function (p) { return p.id; });

    var activeRes = await client.from("module_students")
      .select("id", { count: "exact", head: true })
      .eq("module_id", mod.id)
      .eq("status", "active");
    var activeCount = Number(activeRes.count || 0);
    var gradedCount = await countGraded(client, mod.id, piIds);
    var teacher = (mod.module_staff && mod.module_staff[0] && mod.module_staff[0].users) || null;

    setBanner(evaluation.status);
    renderSummary({
      courseName: mod.course_name,
      courseCode: mod.course_code,
      groupName: mod.group_name,
      raCode: period.student_outcome && period.student_outcome.code,
      programName: mod.program && mod.program.name,
      cycleName: period.cycle && (period.cycle.name || period.cycle.code),
      teacherName: teacher && teacher.full_name,
      status: evaluation.status,
      activeCount: activeCount,
      gradedCount: gradedCount,
    });

    var weightsRes = await client.from("module_ra_evaluation_pi_weights")
      .select("perf_indicator_id, weight_percent")
      .eq("module_ra_evaluation_id", evaluation.id);
    var weightMap = {};
    (weightsRes.data || []).forEach(function (r) {
      weightMap[r.perf_indicator_id] = r.weight_percent;
    });

    var rosterRes = await client.from("module_students")
      .select("status, student:students(full_name, internal_id)")
      .eq("module_id", mod.id)
      .order("roster_position", { ascending: true })
      .order("id");
    var rosterRows = (rosterRes.data || []).map(function (r) {
      return {
        internal_id: (r.student && r.student.internal_id) || "—",
        full_name: (r.student && r.student.full_name) || "—",
        statusLabel: r.status === "excluded" ? "Excluido" : "Activo",
      };
    });

    var studentsRes = await client.from("module_students")
      .select("id, status, student:students(full_name), assessments(perf_indicator_id, level)")
      .eq("module_id", mod.id)
      .eq("status", "active");
    var students = studentsRes.data || [];

    var analysisRes = await client.from("module_analysis")
      .select("perf_indicator_id, analysis_text")
      .eq("module_ra_evaluation_id", evaluation.id);
    var analysisMap = {};
    (analysisRes.data || []).forEach(function (r) {
      analysisMap[r.perf_indicator_id] = r.analysis_text;
    });

    renderWeights(piRows, weightMap);
    renderRoster(rosterRows);
    renderGrades(piRows, students, activeCount);
    renderAnalysis(piRows, analysisMap, {
      conclusions_text: evaluation.conclusions_text,
      recommendations_text: evaluation.recommendations_text,
      preventive_measures_text: evaluation.preventive_measures_text,
      corrective_measures_text: evaluation.corrective_measures_text,
      improvement_plan_text: evaluation.improvement_plan_text,
    });

    setStatus("Revisión cargada.", "success");
  }

  renderReviewPage().catch(function (e) {
    console.error(e);
    setStatus("Error al cargar la revisión.", "error");
  });
})();
