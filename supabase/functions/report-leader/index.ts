import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCaller, requireLeaderAccess, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function buildLeaderReport(periodId: number, programId: number) {
  const db = serviceClient();

  const { data: program } = await db
    .from("programs")
    .select("id, name")
    .eq("id", programId)
    .single();
  if (!program) throw new Error("Program not found");

  const { data: period } = await db
    .from("periods")
    .select(
      "id, name, rubric_id, student_outcome:student_outcomes(code, description)",
    )
    .eq("id", periodId)
    .single();
  if (!period) throw new Error("Period not found");

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

  const { data: evaluations } = await db
    .from("module_ra_evaluations")
    .select("status, module:modules!inner(program_id)")
    .eq("period_id", periodId)
    .eq("modules.program_id", programId);

  const moduleTotal = evaluations?.length ?? 0;
  const moduleCompleted = (evaluations ?? []).filter(
    (row) => row.status === "completed",
  ).length;

  const laMap = new Map(
    (analyses ?? []).map((r) => [r.perf_indicator_id, r.analysis_text]),
  );
  const drMap = new Map(
    (drafts ?? []).map((r) => [r.perf_indicator_id, r.conclusion_text]),
  );

  const studentOutcome = period.student_outcome as
    | { code: string; description: string }
    | null;

  return {
    period,
    program,
    student_outcome: studentOutcome,
    module_progress: { completed: moduleCompleted, total: moduleTotal },
    items: pis.map((pi) => ({
      perf_indicator_id: pi.id,
      pi_code: pi.code,
      pi_description: pi.description,
      leader_analysis: laMap.get(pi.id) ?? "",
      conclusion_text: drMap.get(pi.id) ?? "",
    })),
  };
}

function renderHtml(
  report: Awaited<ReturnType<typeof buildLeaderReport>>,
): string {
  const raLabel = report.student_outcome
    ? `${report.student_outcome.code} — ${report.student_outcome.description}`
    : "—";
  const progress = report.module_progress;
  const progressPct = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const parts = [
    "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>",
    "<title>Informe del líder</title>",
    "<style>",
    "body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;line-height:1.5;color:#111}",
    "h1{font-size:1.5rem;border-bottom:2px solid #333;padding-bottom:.5rem}",
    ".meta{color:#444;margin-bottom:1.5rem}",
    "h2{font-size:1.1rem;margin-top:1.5rem;color:#222}",
    ".pi-desc{color:#555;font-style:italic}",
    ".block{margin:.75rem 0}",
    "@media print{body{margin:1cm}}",
    "</style></head><body>",
    `<h1>Informe del líder consolidador</h1>`,
    `<div class='meta'>`,
    `<p><strong>Programa:</strong> ${escapeHtml(report.program.name)}</p>`,
    `<p><strong>Período:</strong> ${escapeHtml(report.period.name)}</p>`,
    `<p><strong>Resultado de aprendizaje:</strong> ${escapeHtml(raLabel)}</p>`,
    `<p><strong>Módulos evaluados:</strong> ${progress.completed} / ${progress.total} (${progressPct}%)</p>`,
    `</div>`,
  ];

  for (const item of report.items) {
    parts.push(`<h2>${escapeHtml(item.pi_code)}</h2>`);
    parts.push(
      `<p class='pi-desc'>${escapeHtml(item.pi_description)}</p>`,
    );
    parts.push(
      `<div class='block'><strong>Análisis del líder:</strong><p>${escapeHtml(item.leader_analysis || "—")}</p></div>`,
    );
    parts.push(
      `<div class='block'><strong>Conclusión:</strong><p>${escapeHtml(item.conclusion_text || "—")}</p></div>`,
    );
  }

  parts.push("</body></html>");
  return parts.join("");
}

function renderDocxLike(
  report: Awaited<ReturnType<typeof buildLeaderReport>>,
): string {
  const raLabel = report.student_outcome
    ? `${report.student_outcome.code} — ${report.student_outcome.description}`
    : "—";
  const progress = report.module_progress;
  const lines = [
    "Informe del líder consolidador",
    `Programa: ${report.program.name}`,
    `Período: ${report.period.name}`,
    `Resultado de aprendizaje: ${raLabel}`,
    `Módulos evaluados: ${progress.completed} / ${progress.total}`,
    "",
  ];
  for (const item of report.items) {
    lines.push(`${item.pi_code} — ${item.pi_description}`);
    lines.push(`Análisis del líder: ${item.leader_analysis || "—"}`);
    lines.push(`Conclusión: ${item.conclusion_text || "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function exportFilename(
  periodId: number,
  programId: number,
  format: string,
): string {
  const ext = format === "docx" ? "txt" : "html";
  return `informe-lider-p${periodId}-prog${programId}.${ext}`;
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

    const report = await buildLeaderReport(periodId, programId);

    if (format === "json") return jsonResponse(report);

    const filename = exportFilename(periodId, programId, format);

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
