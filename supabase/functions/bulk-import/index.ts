import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { getCaller, requireRole, serviceClient } from "../_shared/auth.ts";
import {
  ensureNoFormula,
  normalizeHeader,
} from "../_shared/sanitize.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { persistRosterRows } from "../_shared/students_roster.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const REQUIRED: Record<string, Set<string>> = {
  students: new Set(["id_interno", "numero_documento", "nombre_completo", "modulo_id"]),
  modules: new Set(["periodo_id", "codigo_curso", "nombre_curso", "grupo"]),
  users: new Set(["nombre_completo", "email_institucional", "rol"]),
  rubrics: new Set(["ra_codigo", "pi_codigo", "pi_descripcion", "pi_peso"]),
};

const SAFE_ID = /^[A-Za-z0-9_.-]{1,50}$/;
const SAFE_DOC = /^[A-Za-z0-9_.-]{3,50}$/;
const SAFE_NAME = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'()/-]{1,200}$/;
const SAFE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function parseXlsx(bytes: Uint8Array): Array<Record<string, string>> {
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, {
    header: 1,
    defval: "",
  });
  if (!rows.length) return [];
  const headers = rows[0].map((c) => normalizeHeader(String(c)));
  return rows.slice(1).map((raw) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = String(raw[i] ?? "").trim();
    });
    return row;
  });
}

function rowError(row: number, field: string, reason: string) {
  return { row, field, reason };
}

async function importStudents(
  rows: Array<Record<string, string>>,
  consent: boolean,
) {
  if (!consent) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      errors: [rowError(0, "consent", "consent_acknowledged required")],
    };
  }

  const db = serviceClient();
  const errors: Array<Record<string, unknown>> = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const byModule = new Map<number, Array<{ row: Record<string, string>; rowNumber: number }>>();
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];
    try {
      const moduleId = Number(ensureNoFormula(row.modulo_id ?? ""));
      if (!moduleId) throw new Error("modulo_id required");
      const { data: module } = await db.from("modules").select("id").eq("id", moduleId).single();
      if (!module) throw new Error(`Module not found: ${moduleId}`);
      const bucket = byModule.get(moduleId) ?? [];
      bucket.push({ row, rowNumber });
      byModule.set(moduleId, bucket);
    } catch (err) {
      errors.push(rowError(rowNumber, "row", String(err)));
    }
  }

  for (const [moduleId, moduleRows] of byModule.entries()) {
    const rosterRows = [];
    for (let i = 0; i < moduleRows.length; i++) {
      const { row, rowNumber } = moduleRows[i];
      try {
        const internalId = ensureNoFormula(row.id_interno ?? "");
        const documentNumber = ensureNoFormula(row.numero_documento ?? "");
        const fullName = ensureNoFormula(row.nombre_completo ?? "");
        if (!SAFE_ID.test(internalId) || !SAFE_DOC.test(documentNumber)) {
          throw new Error("Invalid id or document");
        }
        if (!SAFE_NAME.test(fullName)) throw new Error("Invalid name");
        rosterRows.push({
          roster_position: i + 1,
          document_number: documentNumber,
          full_name: fullName,
          internal_id: internalId,
        });
      } catch (err) {
        errors.push(rowError(rowNumber, "row", String(err)));
      }
    }

    if (!rosterRows.length) continue;

    const result = await persistRosterRows(db, moduleId, rosterRows);
    imported += result.imported;
    updated += result.updated;
    skipped += result.skipped;
    for (const item of result.errors) {
      errors.push(rowError(item.row + 1, "row", item.error));
    }
  }

  return { imported, updated, skipped, failed: errors.length, errors };
}

async function importModules(rows: Array<Record<string, string>>) {
  const db = serviceClient();
  let imported = 0;
  const errors: Array<Record<string, unknown>> = [];
  const periodIds = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];
    try {
      const periodId = Number(ensureNoFormula(row.periodo_id ?? ""));
      const courseCode = ensureNoFormula(row.codigo_curso ?? "");
      const courseName = ensureNoFormula(row.nombre_curso ?? "");
      const groupName = ensureNoFormula(row.grupo ?? "");
      if (!periodId || !courseCode || !courseName || !groupName) {
        throw new Error("Missing required module fields");
      }
      const { error } = await db.from("modules").insert({
        period_id: periodId,
        course_code: courseCode,
        course_name: courseName,
        group_name: groupName,
        status: "pending",
      });
      if (error) throw error;
      periodIds.add(periodId);
      imported++;
    } catch (err) {
      errors.push(rowError(rowNumber, "row", String(err)));
    }
  }

  return {
    imported,
    failed: errors.length,
    errors,
    period_ids: [...periodIds],
  };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, error } = await getCaller(req);
    if (error || !user) return jsonResponse({ error: error ?? "Unauthorized" }, 401);

    const forbidden = requireRole(user, ["admin"]);
    if (forbidden) return jsonResponse({ error: forbidden }, 403);

    const contentType = req.headers.get("content-type") ?? "";
    let entity = "";
    let fileName = "";
    let fileBytes: Uint8Array = new Uint8Array();
    let consentAcknowledged = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      entity = String(form.get("entity") ?? "");
      const file = form.get("file");
      consentAcknowledged = String(form.get("consent_acknowledged") ?? "").toLowerCase() === "true";
      if (!(file instanceof File)) {
        return jsonResponse({ error: "file required" }, 400);
      }
      fileName = file.name;
      fileBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      entity = String(body.entity ?? "");
      fileName = String(body.file_name ?? "upload.csv");
      consentAcknowledged = body.consent_acknowledged === true;
      const encoded = String(body.file_base64 ?? "");
      fileBytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    }

    const required = REQUIRED[entity];
    if (!required) return jsonResponse({ error: "Bulk entity not found" }, 404);
    if (fileBytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: "File exceeds 2 MB limit" }, 413);
    }

    const isXlsx = fileName.toLowerCase().endsWith(".xlsx");
    const rows = isXlsx
      ? parseXlsx(fileBytes)
      : parseCsv(new TextDecoder().decode(fileBytes));

    if (rows.length) {
      const missing = [...required].filter((col) => !(col in rows[0]));
      if (missing.length) {
        return jsonResponse({ error: `Missing columns: ${missing.join(", ")}` }, 422);
      }
    }

    let result: Record<string, unknown>;
    if (entity === "students") {
      result = await importStudents(rows, consentAcknowledged);
    } else if (entity === "modules") {
      result = await importModules(rows);
    } else {
      result = {
        imported: 0,
        failed: rows.length,
        errors: [rowError(0, "entity", `${entity} import not implemented in MVP`)],
      };
    }

    await serviceClient().from("security_events").insert({
      event: `bulk_import_${entity}`,
      user_id: user.id,
      severity: (result.failed as number) > 0 ? "WARN" : "INFO",
      detail: result,
    });

    return jsonResponse(result, 207);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
