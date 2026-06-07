import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cleanHtml, safeCellValue } from "../_shared/sanitize.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { text, mode } = await req.json();
    if (typeof text !== "string") {
      return jsonResponse({ error: "text must be a string" }, 400);
    }

    if (mode === "clean") {
      return jsonResponse({ result: cleanHtml(text) });
    }
    if (mode === "safe_cell") {
      return jsonResponse({ result: safeCellValue(text) });
    }

    return jsonResponse({ error: "Invalid mode" }, 400);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
