(function (global) {
  "use strict";

  var MODE_KEY = "ra_work_mode";
  var PICKER_SEEN_KEY = "ra_role_picker_seen";

  function getWorkMode() {
    var v = sessionStorage.getItem(MODE_KEY);
    return v === "teacher" || v === "leader" ? v : null;
  }

  function setWorkMode(mode) {
    if (mode !== "teacher" && mode !== "leader") return;
    sessionStorage.setItem(MODE_KEY, mode);
    sessionStorage.setItem(PICKER_SEEN_KEY, "true");
  }

  function clearWorkMode() {
    sessionStorage.removeItem(MODE_KEY);
    sessionStorage.removeItem(PICKER_SEEN_KEY);
  }

  function hasSeenRolePicker() {
    return sessionStorage.getItem(PICKER_SEEN_KEY) === "true";
  }

  async function getOpenCycleId(sb) {
    var openRes = await sb.from("measurement_cycles")
      .select("id")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!openRes.error && openRes.data && openRes.data.id) return openRes.data.id;
    var fallbackRes = await sb.from("measurement_cycles")
      .select("id")
      .eq("code", "2025-2")
      .maybeSingle();
    if (!fallbackRes.error && fallbackRes.data) return fallbackRes.data.id;
    return null;
  }

  async function detectUserCapabilities(sb, userId) {
    var cycleId = await getOpenCycleId(sb);

    var staffRes = await sb.from("module_staff")
      .select("module_id, modules!inner(cycle_id)")
      .eq("user_id", userId);
    var teacher = false;
    (staffRes.data || []).forEach(function (row) {
      var mod = row.modules;
      if (!mod) return;
      if (cycleId && mod.cycle_id !== cycleId) return;
      teacher = true;
    });

    var assignQuery = sb.from("ra_consolidator_assignments")
      .select("program_id, student_outcome_id, cycle_id")
      .eq("consolidator_user_id", userId);
    if (cycleId) assignQuery = assignQuery.eq("cycle_id", cycleId);
    var assignRes = await assignQuery;
    var leader = false;

    for (var i = 0; i < (assignRes.data || []).length; i++) {
      var a = assignRes.data[i];
      var periodRes = await sb.from("periods")
        .select("id")
        .eq("student_outcome_id", a.student_outcome_id)
        .eq("cycle_id", a.cycle_id)
        .limit(1);
      if (!periodRes.data || !periodRes.data.length) continue;
      var periodId = periodRes.data[0].id;
      var evalRes = await sb.from("module_ra_evaluations")
        .select("id, module:modules!inner(program_id)")
        .eq("period_id", periodId)
        .eq("modules.program_id", a.program_id)
        .limit(1);
      if (evalRes.data && evalRes.data.length) {
        leader = true;
        break;
      }
    }

    return { teacher: teacher, leader: leader, dual: teacher && leader };
  }

  function resolvePostLoginPath(caps, workMode, seenPicker) {
    if (caps.dual && !workMode && !seenPicker) return "./role-select.html";
    if (caps.teacher && !caps.leader) return "./dashboard.html";
    if (caps.leader && !caps.teacher) return "./dashboard.html";
    if (workMode) return "./dashboard.html";
    return "./role-select.html";
  }

  global.RaRoleMode = {
    getWorkMode: getWorkMode,
    setWorkMode: setWorkMode,
    clearWorkMode: clearWorkMode,
    hasSeenRolePicker: hasSeenRolePicker,
    detectUserCapabilities: detectUserCapabilities,
    resolvePostLoginPath: resolvePostLoginPath,
  };
})(typeof window !== "undefined" ? window : globalThis);
