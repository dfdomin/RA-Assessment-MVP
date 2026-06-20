(function () {
  "use strict";

  function rememberLabel(btn) {
    if (!btn.dataset.actionDefaultLabel) {
      btn.dataset.actionDefaultLabel = btn.textContent.trim();
    }
  }

  function setLoading(btn, loading, loadingLabel) {
    if (!btn) return false;
    if (loading) {
      if (btn.getAttribute("aria-busy") === "true") return false;
      rememberLabel(btn);
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.textContent = loadingLabel || "Cargando…";
      return true;
    }
    btn.removeAttribute("aria-busy");
    btn.textContent = btn.dataset.actionDefaultLabel || btn.textContent;
    btn.disabled = false;
    return true;
  }

  async function run(btn, loadingLabel, action) {
    if (!setLoading(btn, true, loadingLabel)) return;
    try {
      return await action();
    } finally {
      setLoading(btn, false);
    }
  }

  window.RaActionButton = {
    setLoading: setLoading,
    run: run,
  };
})();
