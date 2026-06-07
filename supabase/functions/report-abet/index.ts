import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { getCaller, requireRole, serviceClient } from "../_shared/auth.ts";
import { safeCellValue } from "../_shared/sanitize.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

const LEVEL_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Inadequate",
  3: "Adequate",
  4: "Exemplary",
};

type ReportPayload = {
  period: Record<string, unknown>;
  student_outcome: Record<string, unknown>;
  modules_summary: Array<Record<string, unknown>>;
  distribution_by_pi: Record<string, unknown>;
};

async function buildReportData(periodId: number): Promise<ReportPayload> {
  const db = serviceClient();

  const { data: period, error: periodError } = await db
    .from("periods")
    .select("*, student_outcomes(id, code, description)")
    .eq("id", periodId)
    .single();
  if (periodError || !period) throw new Error("Period not found");

  const { data: modules } = await db
    .from("modules")
    .select("id, course_code, course_name, group_name, module_staff(user_id, users(full_name))")
    .eq("period_id", periodId);

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

  const modulesSummary = [];
  const distributionByPi: Record<string, unknown> = {};

  for (const pi of pis) {
    distributionByPi[pi.code] = {
      perf_indicator_id: pi.id,
      description: pi.description,
      consolidated: { Poor: 0, Inadequate: 0, Adequate: 0, Exemplary: 0 },
      by_module: [],
    };
  }

  for (const mod of modules ?? []) {
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

    if ((activeCount ?? 0) > 0) {
      modulesSummary.push({
        module_id: mod.id,
        course_code: mod.course_code,
        course_name: mod.course_name,
        group_name: mod.group_name,
        teacher_names: teacherNames,
        active_students: activeCount,
      });
    }

    const { data: msRows } = await db
      .from("module_students")
      .select("id")
      .eq("module_id", mod.id)
      .eq("status", "active");
    const msIds = (msRows ?? []).map((r) => r.id);
    if (!msIds.length) continue;

    const { data: assessments } = await db
      .from("assessments")
      .select("perf_indicator_id, level")
      .in("module_student_id", msIds);

    const perPi: Record<number, Record<string, number>> = {};
    for (const pi of pis) {
      perPi[pi.id] = { Poor: 0, Inadequate: 0, Adequate: 0, Exemplary: 0 };
    }
    for (const a of assessments ?? []) {
      const label = LEVEL_LABELS[a.level as number];
      if (label && perPi[a.perf_indicator_id]) {
        perPi[a.perf_indicator_id][label]++;
        const bucket = distributionByPi[
          pis.find((p) => p.id === a.perf_indicator_id)?.code ?? ""
        ] as Record<string, Record<string, number>>;
        if (bucket?.consolidated && label in bucket.consolidated) {
          bucket.consolidated[label]++;
        }
      }
    }

    for (const pi of pis) {
      const entry = distributionByPi[pi.code] as Record<string, unknown>;
      (entry.by_module as Array<unknown>).push({
        module_id: mod.id,
        course_code: mod.course_code,
        group_name: mod.group_name,
        distribution: perPi[pi.id],
      });
    }
  }

  const so = period.student_outcomes as Record<string, unknown> | null;
  return {
    period: {
      id: period.id,
      name: period.name,
      status: period.status,
      start_date: period.start_date,
      end_date: period.end_date,
    },
    student_outcome: {
      id: so?.id ?? null,
      code: so?.code ?? null,
      description: so?.description ?? null,
    },
    modules_summary: modulesSummary,
    distribution_by_pi: distributionByPi,
  };
}

function renderHtml(report: ReportPayload): string {
  const lines = [
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Reporte ABET</title></head><body>",
    `<h1>Reporte ABET — ${report.period.name}</h1>`,
    `<p>RA: ${report.student_outcome.code} — ${report.student_outcome.description}</p>`,
    "<h2>Módulos</h2><ul>",
  ];
  for (const m of report.modules_summary) {
    lines.push(
      `<li>${m.course_code} ${m.group_name}: ${m.teacher_names} (${m.active_students} estudiantes)</li>`,
    );
  }
  lines.push("</ul></body></html>");
  return lines.join("");
}

function renderXlsx(report: ReportPayload): Uint8Array {
  const wb = XLSX.utils.book_new();
  const summaryRows = [
    ["Periodo", safeCellValue(String(report.period.name))],
    ["RA", safeCellValue(String(report.student_outcome.code))],
    [],
    ["Curso", "Grupo", "Docentes", "Estudiantes activos"],
  ];
  for (const m of report.modules_summary) {
    summaryRows.push([
      safeCellValue(String(m.course_code)),
      safeCellValue(String(m.group_name)),
      safeCellValue(String(m.teacher_names)),
      String(m.active_students),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws, "Resumen");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, error } = await getCaller(req);
    if (error || !user) return jsonResponse({ error: error ?? "Unauthorized" }, 401);

    const forbidden = requireRole(user, ["admin", "leader"]);
    if (forbidden) return jsonResponse({ error: forbidden }, 403);

    const body = await req.json();
    const periodId = Number(body.period_id);
    const format = String(body.format ?? "json");

    if (!periodId) return jsonResponse({ error: "period_id required" }, 400);

    const report = await buildReportData(periodId);

    if (format === "json" || format === "preview") {
      return jsonResponse(report);
    }

    if (format === "pdf") {
      const html = renderHtml(report);
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="reporte-${periodId}.html"`,
        },
      });
    }

    if (format === "xlsx") {
      const bytes = renderXlsx(report);
      return new Response(bytes, {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="reporte-${periodId}.xlsx"`,
        },
      });
    }

    return jsonResponse({ error: "Invalid format" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
