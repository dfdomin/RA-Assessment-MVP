/**
 * Shared student upsert + module enrollment (ADR-0002).
 * Used by students-import (teacher PDF) and bulk-import (admin CSV).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type RosterImportRow = {
  roster_position: number;
  document_number: string;
  full_name: string;
  internal_id: string;
};

export type RosterStudentResult = {
  internal_id: string;
  full_name: string;
  action: "created" | "enrolled" | "updated" | "already_enrolled";
};

export type RosterImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  students: RosterStudentResult[];
};

async function findStudentByDocumentOrInternalId(
  db: SupabaseClient,
  documentNumber: string,
  internalId: string,
) {
  const { data: byDoc } = await db
    .from("students")
    .select("id, internal_id, document_number, full_name")
    .eq("document_number", documentNumber)
    .maybeSingle();
  if (byDoc) return byDoc;

  const { data: byInternal } = await db
    .from("students")
    .select("id, internal_id, document_number, full_name")
    .eq("internal_id", internalId)
    .maybeSingle();
  return byInternal;
}

export async function persistRosterRows(
  db: SupabaseClient,
  moduleId: number,
  rows: RosterImportRow[],
): Promise<RosterImportResult> {
  const result: RosterImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    students: [],
  };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;

    try {
      let student = await findStudentByDocumentOrInternalId(
        db,
        row.document_number,
        row.internal_id,
      );
      let isNewStudent = false;

      if (!student) {
        const { data: created, error } = await db
          .from("students")
          .insert({
            internal_id: row.internal_id,
            document_number: row.document_number,
            full_name: row.full_name,
          })
          .select("id, internal_id, document_number, full_name")
          .single();

        if (error) {
          student = await findStudentByDocumentOrInternalId(
            db,
            row.document_number,
            row.internal_id,
          );
          if (!student) throw error;
        } else {
          student = created;
          isNewStudent = true;
        }
      }

      let dataChanged = false;
      if (student.full_name !== row.full_name) {
        await db.from("students").update({ full_name: row.full_name }).eq("id", student.id);
        dataChanged = true;
      }
      if (student.internal_id !== row.internal_id) {
        await db.from("students").update({ internal_id: row.internal_id }).eq("id", student.id);
        dataChanged = true;
      }

      const { data: enrollment } = await db
        .from("module_students")
        .select("id, status, roster_position")
        .eq("module_id", moduleId)
        .eq("student_id", student.id)
        .maybeSingle();

      const isNewEnrollment = !enrollment;

      if (isNewEnrollment) {
        const { error: enrollError } = await db.from("module_students").insert({
          module_id: moduleId,
          student_id: student.id,
          roster_position: row.roster_position,
          status: "active",
        });
        if (enrollError) throw enrollError;
      } else {
        const updates: Record<string, unknown> = {};
        if (enrollment.roster_position !== row.roster_position) {
          updates.roster_position = row.roster_position;
          dataChanged = true;
        }
        if (enrollment.status !== "active") {
          updates.status = "active";
          dataChanged = true;
        }
        if (Object.keys(updates).length) {
          await db.from("module_students").update(updates).eq("id", enrollment.id);
        }
      }

      let action: RosterStudentResult["action"];
      if (isNewEnrollment) {
        action = isNewStudent ? "created" : "enrolled";
        result.imported++;
      } else if (dataChanged) {
        action = "updated";
        result.updated++;
      } else {
        action = "already_enrolled";
        result.skipped++;
      }

      result.students.push({
        internal_id: row.internal_id,
        full_name: row.full_name,
        action,
      });
    } catch (err) {
      result.errors.push({ row: rowNumber, error: String(err) });
    }
  }

  return result;
}

export async function warningsForMissingInPdf(
  db: SupabaseClient,
  moduleId: number,
  pdfDocuments: Set<string>,
): Promise<string[]> {
  const { data: activeRows } = await db
    .from("module_students")
    .select("student:students(document_number)")
    .eq("module_id", moduleId)
    .eq("status", "active");

  const existing = new Set(
    (activeRows ?? [])
      .map((row) => {
        const student = row.student as { document_number?: string } | null;
        return student?.document_number ?? "";
      })
      .filter(Boolean),
  );

  let missingCount = 0;
  for (const doc of existing) {
    if (!pdfDocuments.has(doc)) missingCount++;
  }

  if (!missingCount) return [];
  return [
    `${missingCount} estudiantes activos del módulo no aparecen en este PDF — ` +
      "revíselos y exclúyalos si corresponde.",
  ];
}
