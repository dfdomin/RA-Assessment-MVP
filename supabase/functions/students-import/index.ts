import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AcademusoftPdfError,
  AcademusoftPdfModuleMismatchError,
  parseAcademusoftPdf,
  validatePdfHeaderForModule,
} from "../_shared/academusoft_pdf.ts";
import { getCaller, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  persistRosterRows,
  type RosterImportRow,
  warningsForMissingInPdf,
} from "../_shared/students_roster.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_STUDENTS = 100;

async function assertModuleTeacher(
  db: ReturnType<typeof serviceClient>,
  userId: string,
  moduleId: number,
): Promise<{
  error: string | null;
  module?: { id: number; course_code: string; group_name: string };
}> {
  const { data: assignment } = await db
    .from("module_staff")
    .select("module_id")
    .eq("module_id", moduleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!assignment) {
    return { error: "Module not found" };
  }

  const { data: module, error } = await db
    .from("modules")
    .select("id, course_code, group_name")
    .eq("id", moduleId)
    .single();

  if (error || !module) {
    return { error: "Module not found" };
  }

  // modules no longer have period_id (0013); gate on open module_ra_evaluations
  const { data: openEvaluations, error: evalError } = await db
    .from("module_ra_evaluations")
    .select("id, periods!inner(status)")
    .eq("module_id", moduleId)
    .eq("periods.status", "open")
    .limit(1);

  if (evalError || !openEvaluations?.length) {
    return { error: "Period is closed" };
  }

  return { error: null, module };
}

function pdfRowsToImport(rows: Awaited<ReturnType<typeof parseAcademusoftPdf>>["rows"]): RosterImportRow[] {
  return rows.map((row) => ({
    roster_position: row.roster_position,
    document_number: row.document_number,
    full_name: row.full_name,
    internal_id: row.document_number,
  }));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user, error: authError } = await getCaller(req);
    if (authError || !user) {
      return jsonResponse({ error: authError ?? "Unauthorized" }, 401);
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonResponse({ error: "multipart/form-data required" }, 422);
    }

    const form = await req.formData();
    const action = String(form.get("action") ?? "preview").toLowerCase();
    const moduleId = Number(form.get("module_id") ?? "");
    const consentAcknowledged =
      String(form.get("consent_acknowledged") ?? "").toLowerCase() === "true";
    const file = form.get("file");

    if (!moduleId) {
      return jsonResponse({ error: "module_id required" }, 422);
    }
    if (!(file instanceof File)) {
      return jsonResponse({ error: "file required (application/pdf)" }, 422);
    }
    if (file.type && file.type !== "application/pdf") {
      return jsonResponse({ error: "Only application/pdf is supported" }, 422);
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: "File exceeds 2 MB limit" }, 413);
    }

    const db = serviceClient();
    const access = await assertModuleTeacher(db, user.id, moduleId);
    if (access.error || !access.module) {
      return jsonResponse({ error: access.error ?? "Forbidden" }, 404);
    }

    let parsed;
    try {
      parsed = await parseAcademusoftPdf(fileBytes);
      validatePdfHeaderForModule(
        parsed.header,
        access.module.course_code,
        access.module.group_name,
      );
    } catch (err) {
      if (err instanceof AcademusoftPdfModuleMismatchError) {
        return jsonResponse({ error: err.message }, 422);
      }
      if (err instanceof AcademusoftPdfError) {
        return jsonResponse({ error: err.message }, 422);
      }
      throw err;
    }

    if (parsed.rows.length > MAX_STUDENTS) {
      return jsonResponse({
        error: `Import exceeds ${MAX_STUDENTS} students limit (${parsed.rows.length} rows found)`,
      }, 422);
    }

    const importRows = pdfRowsToImport(parsed.rows);
    const pdfDocs = new Set(importRows.map((row) => row.document_number));
    const warnings = await warningsForMissingInPdf(db, moduleId, pdfDocs);

    if (action === "preview") {
      return jsonResponse({
        module_id: moduleId,
        pdf_materia: parsed.header.materia,
        pdf_group: parsed.header.group_name,
        pdf_course_code: parsed.header.course_code,
        students: importRows.map((row) => ({
          roster_position: row.roster_position,
          document_number: row.document_number,
          full_name: row.full_name,
        })),
        warnings,
      });
    }

    if (action !== "import") {
      return jsonResponse({ error: "action must be preview or import" }, 422);
    }

    if (!consentAcknowledged) {
      return jsonResponse({
        error: "consent_acknowledged must be true (Ley 1581/2012)",
      }, 422);
    }

    const result = await persistRosterRows(db, moduleId, importRows);

    await db.from("security_events").insert({
      event: "students_imported",
      user_id: user.id,
      severity: result.errors.length ? "WARN" : "INFO",
      detail: {
        module_id: moduleId,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        source: "pdf",
      },
    });

    return jsonResponse({
      module_id: moduleId,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      warnings,
      students: result.students,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
