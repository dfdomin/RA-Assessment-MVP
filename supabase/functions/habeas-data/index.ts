import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCaller, requireRole, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user, error } = await getCaller(req);
    if (error || !user) return jsonResponse({ error: error ?? "Unauthorized" }, 401);

    const forbidden = requireRole(user, ["admin"]);
    if (forbidden) return jsonResponse({ error: forbidden }, 403);

    const body = await req.json();
    const action = String(body.action ?? "query");
    const db = serviceClient();

    if (action === "query") {
      const docNumber = String(body.document_number ?? "").trim();
      if (!docNumber) return jsonResponse({ error: "document_number required" }, 400);

      const { data: students, error: studentError } = await db
        .from("students")
        .select(`
          id, internal_id, document_number, full_name, is_suppressed,
          module_students(
            status,
            module:modules(id, course_code, course_name, group_name, status),
            assessments(level, perf_indicator:perf_indicators(code))
          )
        `)
        .eq("document_number", docNumber);

      if (studentError) throw studentError;
      if (!students?.length) {
        return jsonResponse({ error: "Student data not found" }, 404);
      }

      await db.from("security_events").insert({
        event: "habeas_data_accessed",
        user_id: user.id,
        severity: "INFO",
        detail: {
          document_hash: await sha256Hex(docNumber),
          match_count: students.length,
        },
      });

      return jsonResponse({
        document_number: docNumber,
        match_count: students.length,
        students,
      });
    }

    if (action === "suppress") {
      const studentId = Number(body.student_id);
      if (!studentId) return jsonResponse({ error: "student_id required" }, 400);

      const { data: student, error: fetchError } = await db
        .from("students")
        .select("id, document_number")
        .eq("id", studentId)
        .single();
      if (fetchError || !student) {
        return jsonResponse({ error: "Student not found" }, 404);
      }

      const originalDocument = student.document_number;
      const { error: updateError } = await db
        .from("students")
        .update({
          full_name: "[SUPRIMIDO]",
          document_number: `[SUPRIMIDO-${studentId}]`,
          is_suppressed: true,
        })
        .eq("id", studentId);
      if (updateError) throw updateError;

      await db.from("security_events").insert({
        event: "student_suppressed",
        user_id: user.id,
        severity: "INFO",
        detail: {
          student_id: studentId,
          document_hash: await sha256Hex(originalDocument),
        },
      });

      return jsonResponse({
        id: studentId,
        document_number: `[SUPRIMIDO-${studentId}]`,
        full_name: "[SUPRIMIDO]",
        is_suppressed: true,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
