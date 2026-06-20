(function () {
  "use strict";

  var form = document.getElementById("role-select-form");
  var statusEl = document.getElementById("role-select-status");
  if (!form) return;

  async function init() {
    var sessionRes = await supabase.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) {
      window.location.replace("./index.html");
      return;
    }
    var uid = sessionRes.data.session.user.id;
    var caps = await RaRoleMode.detectUserCapabilities(supabase, uid);
    if (!caps.dual) {
      RaRoleMode.setWorkMode(caps.teacher ? "teacher" : "leader");
      window.location.replace("./dashboard.html");
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var picked = form.querySelector('input[name="work-mode"]:checked');
    if (!picked) return;
    RaRoleMode.setWorkMode(picked.value);
    window.location.replace("./dashboard.html");
  });

  init().catch(function (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Error al cargar. Intente de nuevo.";
  });
})();
