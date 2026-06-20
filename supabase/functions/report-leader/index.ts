import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCaller, requireLeaderAccess, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

const LEVEL_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Inadequate",
  4: "Adequate",
  5: "Exemplary",
};

const LEVELS = [
  { abet: "Poor", label: "Deficiente", value: 1, color: "#dc2626" },
  { abet: "Inadequate", label: "Insuficiente", value: 2, color: "#f97316" },
  { abet: "Adequate", label: "Bueno", value: 4, color: "#FFDF2D" },
  { abet: "Exemplary", label: "Sobresaliente", value: 5, color: "#16a34a" },
];

const ABET_LEGEND = [
  { label: "Deficiente (1)", standard: "Bajo", decision: "Establecer y verificar planes de acción correctiva", value: 1 },
  { label: "Insuficiente (2)", standard: "—", decision: "—", value: 2 },
  { label: "Bueno (4)", standard: "Medio", decision: "Establecer y verificar planes de acción preventiva", value: 4 },
  { label: "Sobresaliente (5)", standard: "Alto", decision: "Establecer planes de mejora / mantener el estándar", value: 5 },
];

type ModuleRow = {
  evaluation_id: number;
  module_id: number;
  course_code: string;
  course_name: string;
  group_name: string;
  teacher_names: string;
  active_students: number;
};

type ModuleDistRow = {
  group_name: string;
  course_name: string;
  active_students: number;
  distribution: Record<string, number>;
};

type TeacherAnalysis = { label: string; text: string };

type PiReportItem = {
  perf_indicator_id: number;
  pi_code: string;
  pi_description: string;
  by_module: ModuleDistRow[];
  consolidated: Record<string, number>;
  teacher_analyses: TeacherAnalysis[];
  leader_analysis: string;
  conclusion_text: string;
};

type LeaderReportPayload = {
  period: { id: number; name: string };
  program: { id: number; name: string; faculty: string | null };
  student_outcome: { code: string | null; description: string | null };
  leader_name: string;
  modules_summary: ModuleRow[];
  total_students: number;
  module_progress: { completed: number; total: number };
  items: PiReportItem[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function moduleLabel(row: ModuleRow): string {
  const code = row.course_code || "—";
  const name = row.course_name ? row.course_name.trim() : "";
  return name ? `« ${code} ${name} »` : `« ${code} »`;
}

async function buildLeaderReport(
  periodId: number,
  programId: number,
  leaderUserId: string,
): Promise<LeaderReportPayload> {
  const db = serviceClient();

  const { data: program } = await db
    .from("programs")
    .select("id, name, faculty")
    .eq("id", programId)
    .single();
  if (!program) throw new Error("Program not found");

  const { data: period } = await db
    .from("periods")
    .select("id, name, rubric_id, student_outcomes(code, description)")
    .eq("id", periodId)
    .single();
  if (!period) throw new Error("Period not found");

  const { data: leaderUser } = await db
    .from("users")
    .select("full_name")
    .eq("id", leaderUserId)
    .maybeSingle();

  let pis: Array<{ id: number; code: string; description: string }> = [];
  if (period.rubric_id) {
    const { data } = await db
      .from("perf_indicators")
      .select("id, code, description")
      .eq("rubric_id", period.rubric_id)
      .eq("is_active", true)
      .order("position");
    pis = data ?? [];
  }

  const { data: evalRows } = await db
    .from("module_ra_evaluations")
    .select(
      "id, status, module:modules(id, course_code, course_name, group_name, program_id, module_staff(user_id, users(full_name)))",
    )
    .eq("period_id", periodId);

  const modulesSummary: ModuleRow[] = [];
  const moduleEvals: Array<ModuleRow & { status: string }> = [];

  for (const row of evalRows ?? []) {
    const mod = row.module as Record<string, unknown> | null;
    if (!mod || Number(mod.program_id) !== programId) continue;

    const { count: activeCount } = await db
      .from("module_students")
      .select("*", { count: "exact", head: true })
      .eq("module_id", mod.id)
      .eq("status", "active");

    const staff = (mod.module_staff as Array<Record<string, unknown>>) ?? [];
    const teacherNames = staff
      .map((s) => (s.users as Record<string, string>)?.full_name)
      .filter(Boolean)
      .join(", ");

    const moduleRow: ModuleRow = {
      evaluation_id: Number(row.id),
      module_id: Number(mod.id),
      course_code: String(mod.course_code ?? ""),
      course_name: String(mod.course_name ?? ""),
      group_name: String(mod.group_name ?? ""),
      teacher_names: teacherNames || "—",
      active_students: Number(activeCount ?? 0),
    };

    moduleEvals.push({ ...moduleRow, status: String(row.status) });
    if (moduleRow.active_students > 0) modulesSummary.push(moduleRow);
  }

  modulesSummary.sort((a, b) => {
    const codeCmp = a.course_code.localeCompare(b.course_code, "es");
    if (codeCmp !== 0) return codeCmp;
    return a.group_name.localeCompare(b.group_name, "es");
  });

  const evalIds = moduleEvals.map((m) => m.evaluation_id);
  const evalLabelMap = new Map(
    moduleEvals.map((m) => [m.evaluation_id, moduleLabel(m)]),
  );

  const teacherByPi = new Map<number, TeacherAnalysis[]>();
  if (evalIds.length) {
    const { data: maRows } = await db
      .from("module_analysis")
      .select("module_ra_evaluation_id, perf_indicator_id, analysis_text")
      .in("module_ra_evaluation_id", evalIds);
    for (const row of maRows ?? []) {
      const text = row.analysis_text ? String(row.analysis_text).trim() : "";
      if (!text) continue;
      const piId = Number(row.perf_indicator_id);
      if (!teacherByPi.has(piId)) teacherByPi.set(piId, []);
      teacherByPi.get(piId)!.push({
        label: evalLabelMap.get(Number(row.module_ra_evaluation_id)) ?? "Módulo",
        text,
      });
    }
  }

  const { data: analyses } = await db
    .from("leader_analysis")
    .select("perf_indicator_id, analysis_text")
    .eq("period_id", periodId)
    .eq("program_id", programId);
  const { data: drafts } = await db
    .from("leader_report_drafts")
    .select("perf_indicator_id, conclusion_text")
    .eq("period_id", periodId)
    .eq("program_id", programId);

  const laMap = new Map(
    (analyses ?? []).map((r) => [r.perf_indicator_id, r.analysis_text ?? ""]),
  );
  const drMap = new Map(
    (drafts ?? []).map((r) => [r.perf_indicator_id, r.conclusion_text ?? ""]),
  );

  const moduleTotal = moduleEvals.length;
  const moduleCompleted = moduleEvals.filter((m) => m.status === "completed").length;

  const items: PiReportItem[] = [];

  for (const pi of pis) {
    const consolidated: Record<string, number> = {
      Poor: 0,
      Inadequate: 0,
      Adequate: 0,
      Exemplary: 0,
    };
    const byModule: ModuleDistRow[] = [];

    for (const mod of modulesSummary) {
      const { data: msRows } = await db
        .from("module_students")
        .select("id")
        .eq("module_id", mod.module_id)
        .eq("status", "active");
      const msIds = (msRows ?? []).map((r) => r.id);
      const dist: Record<string, number> = {
        Poor: 0,
        Inadequate: 0,
        Adequate: 0,
        Exemplary: 0,
      };
      if (msIds.length) {
        const { data: assessments } = await db
          .from("assessments")
          .select("level")
          .eq("perf_indicator_id", pi.id)
          .in("module_student_id", msIds);
        for (const a of assessments ?? []) {
          const label = LEVEL_LABELS[a.level as number];
          if (label && label in dist) {
            dist[label]++;
            consolidated[label]++;
          }
        }
      }
      byModule.push({
        group_name: mod.group_name,
        course_name: mod.course_name,
        active_students: mod.active_students,
        distribution: dist,
      });
    }

    items.push({
      perf_indicator_id: pi.id,
      pi_code: pi.code,
      pi_description: pi.description,
      by_module: byModule,
      consolidated,
      teacher_analyses: teacherByPi.get(pi.id) ?? [],
      leader_analysis: laMap.get(pi.id) ?? "",
      conclusion_text: drMap.get(pi.id) ?? "",
    });
  }

  const so = period.student_outcomes as
    | { code: string; description: string }
    | null;

  return {
    period: { id: period.id, name: period.name },
    program: {
      id: program.id,
      name: program.name,
      faculty: program.faculty ?? null,
    },
    student_outcome: {
      code: so?.code ?? null,
      description: so?.description ?? null,
    },
    leader_name: leaderUser?.full_name ?? "—",
    modules_summary: modulesSummary,
    total_students: modulesSummary.reduce((sum, m) => sum + m.active_students, 0),
    module_progress: { completed: moduleCompleted, total: moduleTotal },
    items,
  };
}

function buildConicGradient(consolidated: Record<string, number>, totalActive: number): string {
  const stops: string[] = [];
  let acc = 0;
  for (const level of LEVELS) {
    const count = consolidated[level.abet] ?? 0;
    const p = pct(count, totalActive);
    if (p <= 0) continue;
    const next = acc + p;
    stops.push(`${level.color} ${acc}% ${next}%`);
    acc = next;
  }
  return stops.length ? `conic-gradient(from 180deg, ${stops.join(", ")})` : "#e5e7eb";
}

function renderStackedBars(byModule: ModuleDistRow[]): string {
  if (!byModule.length) {
    return "<p class='muted'>Sin datos de grupos.</p>";
  }
  const cols = byModule.map((row) => {
    const segments = LEVELS.map((level) => {
      const count = row.distribution[level.abet] ?? 0;
      const p = pct(count, row.active_students);
      if (p <= 0) return "";
      return `<div class='stack-seg' style='flex-basis:${p}%;background:${level.color}' title='${escapeHtml(level.label)}: ${p}%'></div>`;
    }).join("");
    return `<div class='stack-col'><div class='stack-bar'>${segments || "<div class='stack-empty'>—</div>"}</div><span class='stack-label'>${escapeHtml(row.group_name)}</span></div>`;
  }).join("");
  return `<div class='stack-bars'>${cols}</div>`;
}

function renderPiTable(item: PiReportItem): string {
  let totalActive = 0;
  const totals: Record<string, number> = {
    Poor: 0,
    Inadequate: 0,
    Adequate: 0,
    Exemplary: 0,
  };
  for (const row of item.by_module) {
    totalActive += row.active_students;
    for (const level of LEVELS) {
      totals[level.abet] += row.distribution[level.abet] ?? 0;
    }
  }

  const head = LEVELS.map((l) =>
    `<th class='lvl-${l.value}'>${escapeHtml(l.label)} (${l.value})</th>`
  ).join("");

  const body = item.by_module.map((row) => {
    const cells = LEVELS.map((l) => {
      const count = row.distribution[l.abet] ?? 0;
      return `<td>${pct(count, row.active_students)}%</td>`;
    }).join("");
    return `<tr><td>${escapeHtml(row.group_name)}</td>${cells}</tr>`;
  }).join("");

  const totalCells = LEVELS.map((l) =>
    `<td><strong>${pct(totals[l.abet], totalActive)}%</strong></td>`
  ).join("");

  return `<table class='data-table'><thead><tr><th>Grupo</th>${head}</tr></thead><tbody>${body || "<tr><td colspan='5'>Sin módulos con estudiantes activos.</td></tr>"}</tbody><tfoot><tr><th>Total — ${escapeHtml(item.pi_code)}</th>${totalCells}</tr></tfoot></table>`;
}

function renderTeacherBlock(analyses: TeacherAnalysis[]): string {
  if (!analyses.length) {
    return "<p class='muted'>Sin análisis cualitativo de docentes para este indicador.</p>";
  }
  return analyses.map((a) =>
    `<article class='teacher-block'><p class='teacher-label'>${escapeHtml(a.label)}</p><p class='teacher-text'>${escapeHtml(a.text)}</p></article>`
  ).join("");
}

function renderHtml(report: LeaderReportPayload): string {
  const raTitle = report.student_outcome.code
    ? `${report.student_outcome.code}: ${report.student_outcome.description ?? ""}`
    : "—";
  const facultyLine = report.program.faculty
    ? `Mediciones ${report.program.faculty} — Programa ${report.program.name}`
    : `Mediciones — Programa ${report.program.name}`;

  const moduleRows = report.modules_summary.map((m) =>
    `<tr><td>${escapeHtml(m.course_name || m.course_code)}</td><td>${escapeHtml(m.group_name)}</td><td>${escapeHtml(m.teacher_names)}</td><td>${m.active_students}</td></tr>`
  ).join("");

  const legendRows = ABET_LEGEND.map((row) =>
    `<tr class='legend-${row.value}'><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.standard)}</td><td>${escapeHtml(row.decision)}</td></tr>`
  ).join("");

  const piSections = report.items.map((item) => {
    let totalActive = 0;
    for (const row of item.by_module) totalActive += row.active_students;
    const donutBg = buildConicGradient(item.consolidated, totalActive);
    const donutLegend = LEVELS.map((l) => {
      const count = item.consolidated[l.abet] ?? 0;
      return `<li><span class='swatch' style='background:${l.color}'></span>${escapeHtml(l.label)}: ${pct(count, totalActive)}%</li>`;
    }).join("");

    return `<section class='pi-section page-break'>
      <div class='pi-banner'>Reporte por indicador de desempeño</div>
      <h2>${escapeHtml(item.pi_code)} — Indicador de desempeño</h2>
      <p class='pi-desc'>${escapeHtml(item.pi_description)}</p>
      <h3>Medición por grupo</h3>
      ${renderPiTable(item)}
      <div class='charts'>
        <div class='chart-panel'><h4>Comportamiento por grupo</h4>${renderStackedBars(item.by_module)}</div>
        <div class='chart-panel'><h4>Desempeño total</h4><div class='donut-wrap'><div class='donut' style='background:${donutBg}'><div class='donut-hole'></div></div><ul class='donut-legend'>${donutLegend}</ul></div></div>
      </div>
      <h3>Análisis de los docentes</h3>
      ${renderTeacherBlock(item.teacher_analyses)}
      <h3>Análisis del líder</h3>
      <p class='prose'>${escapeHtml(item.leader_analysis || "—")}</p>
      <h3>Conclusión del informe</h3>
      <p class='prose'>${escapeHtml(item.conclusion_text || "—")}</p>
    </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang='es'>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width, initial-scale=1'>
<title>Informe del líder — ${escapeHtml(report.program.name)} — ${escapeHtml(report.period.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", system-ui, sans-serif; color: #1E2843; line-height: 1.45; margin: 0; padding: 1.5rem; max-width: 960px; margin-inline: auto; }
  .print-hint { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; margin-bottom: 1rem; padding: 0.75rem 1rem; font-size: 0.875rem; }
  .cover-banner, .pi-banner { background: #1E2843; color: #fff; font-weight: 600; letter-spacing: 0.03em; padding: 0.65rem 1rem; text-align: center; text-transform: uppercase; }
  .cover-ra { background: #eef2ff; border: 1px solid #dbeafe; margin: 0 0 1rem; padding: 0.875rem 1rem; }
  .cover-ra h1 { font-size: 1rem; margin: 0; }
  .cover-grid { display: grid; gap: 1rem; grid-template-columns: 1fr; margin-bottom: 1rem; }
  @media (min-width: 760px) { .cover-grid { grid-template-columns: 1.4fr 1fr; } }
  .data-table { border-collapse: collapse; font-size: 0.8125rem; width: 100%; }
  .data-table th, .data-table td { border: 1px solid #d1d5db; padding: 0.35rem 0.5rem; text-align: left; }
  .data-table th { background: #f3f4f6; font-weight: 600; }
  .data-table tfoot th, .data-table tfoot td { background: #e5e7eb; font-weight: 600; }
  .lvl-1 { background: #fef2f2; } .lvl-2 { background: #fff7ed; } .lvl-4 { background: #fefce8; } .lvl-5 { background: #f0fdf4; }
  .legend-1 td:first-child { background: #fef2f2; } .legend-2 td:first-child { background: #fff7ed; }
  .legend-4 td:first-child { background: #fefce8; } .legend-5 td:first-child { background: #f0fdf4; }
  .cover-meta { font-size: 0.875rem; margin-top: 0.75rem; }
  .cover-meta p { margin: 0.25rem 0; }
  .muted { color: #6b7280; }
  .pi-section { margin-top: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; padding-bottom: 1rem; }
  .pi-section h2, .pi-section h3, .pi-section h4 { color: #1E2843; margin: 1rem 1rem 0.5rem; font-size: 0.9375rem; }
  .pi-desc { color: #4b5563; font-size: 0.875rem; margin: 0 1rem 0.75rem; }
  .pi-section .data-table, .charts, .teacher-block, .prose { margin-inline: 1rem; }
  .charts { display: grid; gap: 1rem; grid-template-columns: 1fr; margin-bottom: 1rem; }
  @media (min-width: 760px) { .charts { grid-template-columns: 1.5fr 1fr; } }
  .chart-panel h4 { margin: 0 0 0.5rem; font-size: 0.8125rem; }
  .stack-bars { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: flex-end; min-height: 9rem; }
  .stack-col { display: flex; flex: 1 1 2rem; flex-direction: column; align-items: center; max-width: 3.5rem; min-width: 1.75rem; }
  .stack-bar { background: #f3f4f6; border-radius: 4px 4px 0 0; display: flex; flex-direction: column-reverse; height: 8rem; overflow: hidden; width: 100%; }
  .stack-seg { flex-shrink: 0; min-height: 2px; width: 100%; }
  .stack-empty { color: #9ca3af; font-size: 0.7rem; text-align: center; padding: 0.5rem 0; }
  .stack-label { font-size: 0.6rem; margin-top: 0.25rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .donut-wrap { align-items: center; display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .donut { align-items: center; border-radius: 50%; display: flex; height: 7rem; justify-content: center; width: 7rem; }
  .donut-hole { background: #fff; border-radius: 50%; height: 3.5rem; width: 3.5rem; }
  .donut-legend { list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; }
  .donut-legend li { align-items: center; display: flex; gap: 0.35rem; margin-bottom: 0.25rem; }
  .swatch { border-radius: 2px; display: inline-block; height: 0.75rem; width: 0.75rem; }
  .teacher-block { border-left: 3px solid #1E2843; margin-bottom: 0.75rem; padding-left: 0.75rem; }
  .teacher-label { font-size: 0.8125rem; font-weight: 600; margin: 0 0 0.25rem; }
  .teacher-text { font-size: 0.875rem; margin: 0; white-space: pre-wrap; }
  .prose { white-space: pre-wrap; font-size: 0.875rem; }
  @media print {
    .print-hint { display: none; }
    body { padding: 0.5cm; }
    .page-break { page-break-before: always; }
    .pi-section { break-inside: avoid-page; }
  }
</style>
</head>
<body>
  <p class='print-hint'>Para guardar como PDF: use <strong>Archivo → Imprimir → Guardar como PDF</strong> (o Ctrl/Cmd+P).</p>
  <section class='cover'>
    <div class='cover-banner'>Informe final de medición</div>
    <div class='cover-ra'><h1>${escapeHtml(raTitle)}</h1></div>
    <div class='cover-grid'>
      <div>
        <table class='data-table'>
          <thead><tr><th>Curso</th><th>Grupo</th><th>Docente</th><th>N° est.</th></tr></thead>
          <tbody>${moduleRows || "<tr><td colspan='4'>Sin módulos.</td></tr>"}</tbody>
          <tfoot><tr><th colspan='3'>Total estudiantes</th><td><strong>${report.total_students}</strong></td></tr></tfoot>
        </table>
      </div>
      <div>
        <h2 style='font-size:0.875rem;margin:0 0 0.5rem;'>Leyenda ABET</h2>
        <table class='data-table'><thead><tr><th>Nivel</th><th>Estándar</th><th>Decisión</th></tr></thead><tbody>${legendRows}</tbody></table>
      </div>
    </div>
    <p class='muted'>${escapeHtml(facultyLine)}</p>
    <div class='cover-meta'>
      <p><strong>Período:</strong> ${escapeHtml(report.period.name)}</p>
      <p><strong>Líder consolidador del RA:</strong> ${escapeHtml(report.leader_name)}</p>
      <p><strong>Módulos completados:</strong> ${report.module_progress.completed} / ${report.module_progress.total}</p>
    </div>
  </section>
  ${piSections}
</body>
</html>`;
}

function renderDocxLike(report: LeaderReportPayload): string {
  const lines = [
    "INFORME FINAL DE MEDICIÓN",
    `${report.student_outcome.code ?? "RA"}: ${report.student_outcome.description ?? ""}`,
    `Programa: ${report.program.name}`,
    `Período: ${report.period.name}`,
    `Líder: ${report.leader_name}`,
    `Total estudiantes: ${report.total_students}`,
    "",
    "MÓDULOS",
  ];
  for (const m of report.modules_summary) {
    lines.push(
      `- ${m.course_name || m.course_code} | ${m.group_name} | ${m.teacher_names} | ${m.active_students} estudiantes`,
    );
  }
  lines.push("");
  for (const item of report.items) {
    lines.push(`=== ${item.pi_code} ===`);
    lines.push(item.pi_description);
    lines.push("");
    lines.push("Medición por grupo:");
    for (const row of item.by_module) {
      const parts = LEVELS.map((l) => {
        const count = row.distribution[l.abet] ?? 0;
        return `${l.label}: ${pct(count, row.active_students)}%`;
      });
      lines.push(`  ${row.group_name}: ${parts.join(" | ")}`);
    }
    lines.push("");
    lines.push("Análisis docentes:");
    if (!item.teacher_analyses.length) lines.push("  (sin análisis)");
    for (const t of item.teacher_analyses) {
      lines.push(`  ${t.label}`);
      lines.push(`  ${t.text}`);
    }
    lines.push("");
    lines.push(`Análisis del líder: ${item.leader_analysis || "—"}`);
    lines.push(`Conclusión: ${item.conclusion_text || "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function exportFilename(
  periodName: string,
  format: string,
): string {
  const safe = periodName.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  if (format === "docx") return `informe-lider-${safe}-${stamp}.txt`;
  return `informe-lider-${safe}-${stamp}.html`;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, error } = await getCaller(req);
    if (error || !user) {
      return jsonResponse({ error: error ?? "Unauthorized" }, 401);
    }

    const body = await req.json();
    const periodId = Number(body.period_id);
    const programId = Number(body.program_id);
    const format = String(body.format ?? "json");
    if (!periodId) return jsonResponse({ error: "period_id required" }, 400);
    if (!programId) return jsonResponse({ error: "program_id required" }, 400);

    const forbidden = await requireLeaderAccess(user, programId, periodId);
    if (forbidden) return jsonResponse({ error: forbidden }, 403);

    const report = await buildLeaderReport(periodId, programId, user.id);

    if (format === "json") return jsonResponse(report);

    const filename = exportFilename(report.period.name, format);

    if (format === "pdf") {
      return new Response(renderHtml(report), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "docx") {
      return new Response(renderDocxLike(report), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return jsonResponse({ error: "Invalid format" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
