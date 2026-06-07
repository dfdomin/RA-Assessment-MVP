import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCaller, requireRole, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

async function buildLeaderReport(periodId: number) {
  const db = serviceClient();
  const { data: period } = await db
    .from("periods")
    .select("id, name, rubric_id")
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
    .eq("period_id", periodId);
  const { data: drafts } = await db
    .from("leader_report_drafts")
    .select("perf_indicator_id, conclusion_text")
    .eq("period_id", periodId);

  const laMap = new Map(
    (analyses ?? []).map((r) => [r.perf_indicator_id, r.analysis_text]),
  );
  const drMap = new Map(
    (drafts ?? []).map((r) => [r.perf_indicator_id, r.conclusion_text]),
  );

  return {
    period,
    items: pis.map((pi) => ({
      perf_indicator_id: pi.id,
      pi_code: pi.code,
      pi_description: pi.description,
      leader_analysis: laMap.get(pi.id) ?? "",
      conclusion_text: drMap.get(pi.id) ?? "",
    })),
  };
}

function renderHtml(report: Awaited<ReturnType<typeof buildLeaderReport>>): string {
  const parts = [
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Informe del líder</title></head><body>",
    `<h1>Informe del líder — ${report.period.name}</h1>`,
  ];
  for (const item of report.items) {
    parts.push(`<h2>${item.pi_code}</h2>`);
    parts.push(`<p><strong>PI:</strong> ${item.pi_description}</p>`);
    parts.push(`<p><strong>Análisis:</strong> ${item.leader_analysis}</p>`);
    parts.push(`<p><strong>Conclusión:</strong> ${item.conclusion_text}</p>`);
  }
  parts.push("</body></html>");
  return parts.join("");
}

function renderDocxLike(report: Awaited<ReturnType<typeof buildLeaderReport>>): string {
  const lines = [`Informe del líder — ${report.period.name}`, ""];
  for (const item of report.items) {
    lines.push(`${item.pi_code} — ${item.pi_description}`);
    lines.push(`Análisis: ${item.leader_analysis}`);
    lines.push(`Conclusión: ${item.conclusion_text}`);
    lines.push("");
  }
  return lines.join("\n");
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

    const report = await buildLeaderReport(periodId);

    if (format === "json") return jsonResponse(report);

    if (format === "pdf") {
      return new Response(renderHtml(report), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="informe-lider-${periodId}.html"`,
        },
      });
    }

    if (format === "docx") {
      return new Response(renderDocxLike(report), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="informe-lider-${periodId}.txt"`,
        },
      });
    }

    return jsonResponse({ error: "Invalid format" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
