/**
 * api.js — helpers para Edge Functions de Supabase (MVP)
 */
(function (global) {
  "use strict";

  async function getAccessToken() {
    if (typeof supabase === "undefined" || !supabase.auth) {
      throw new Error("Supabase client not available");
    }
    var sessionResult = await supabase.auth.getSession();
    var session = sessionResult && sessionResult.data && sessionResult.data.session;
    if (!session || !session.access_token) {
      throw new Error("No active session");
    }
    return session.access_token;
  }

  function functionsBaseUrl() {
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) {
      throw new Error("SUPABASE_URL not configured");
    }
    return SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/";
  }

  async function callEdgeFunction(name, payload, options) {
    var token = await getAccessToken();
    var opts = options || {};
    var method = opts.method || "POST";
    var headers = {
      Authorization: "Bearer " + token,
      apikey: typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : "",
    };

    var fetchOptions = { method: method, headers: headers };

    if (opts.formData) {
      fetchOptions.body = opts.formData;
    } else if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(payload);
    }

    var response = await fetch(functionsBaseUrl() + name, fetchOptions);
    return response;
  }

  async function callEdgeFunctionJson(name, payload) {
    var response = await callEdgeFunction(name, payload);
    var data = await response.json();
    if (!response.ok) {
      throw new Error((data && data.error) || "Edge function failed");
    }
    return data;
  }

  async function downloadEdgeFunction(name, payload, filename) {
    var response = await callEdgeFunction(name, payload);
    if (!response.ok) {
      var err = await response.json().catch(function () { return {}; });
      throw new Error((err && err.error) || "Download failed");
    }
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  global.RaApi = {
    getAccessToken: getAccessToken,
    callEdgeFunction: callEdgeFunction,
    callEdgeFunctionJson: callEdgeFunctionJson,
    downloadEdgeFunction: downloadEdgeFunction,
    reportAbetPreview: function (periodId) {
      return callEdgeFunctionJson("report-abet", { period_id: periodId, format: "preview" });
    },
    reportAbetExport: function (periodId, format) {
      return downloadEdgeFunction(
        "report-abet",
        { period_id: periodId, format: format },
        "reporte-" + periodId + "." + (format === "xlsx" ? "xlsx" : "html")
      );
    },
    reportLeaderExport: function (periodId, programId, format) {
      var ext = format === "docx" ? "txt" : "html";
      return downloadEdgeFunction(
        "report-leader",
        { period_id: periodId, program_id: programId, format: format },
        "informe-lider-p" + periodId + "-prog" + programId + "." + ext
      );
    },
    bulkImport: function (formData) {
      return callEdgeFunction("bulk-import", null, { formData: formData });
    },
    studentsImportPreview: async function (moduleId, file) {
      var formData = new FormData();
      formData.append("module_id", String(moduleId));
      formData.append("action", "preview");
      formData.append("file", file);
      var response = await callEdgeFunction("students-import", null, { formData: formData });
      var data = await response.json();
      if (!response.ok) {
        throw new Error((data && data.error) || "Preview failed");
      }
      return data;
    },
    studentsImportConfirm: async function (moduleId, file, consentAcknowledged) {
      var formData = new FormData();
      formData.append("module_id", String(moduleId));
      formData.append("action", "import");
      formData.append("consent_acknowledged", consentAcknowledged ? "true" : "false");
      formData.append("file", file);
      var response = await callEdgeFunction("students-import", null, { formData: formData });
      var data = await response.json();
      if (!response.ok) {
        throw new Error((data && data.error) || "Import failed");
      }
      return data;
    },
    habeasQuery: function (documentNumber) {
      return callEdgeFunctionJson("habeas-data", {
        action: "query",
        document_number: documentNumber,
      });
    },
    habeasSuppress: function (studentId) {
      return callEdgeFunctionJson("habeas-data", {
        action: "suppress",
        student_id: studentId,
      });
    },
    sanitize: function (text, mode) {
      return callEdgeFunctionJson("sanitize", { text: text, mode: mode });
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
