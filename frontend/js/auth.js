(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submit-btn");
  const errorBox = document.getElementById("login-error");

  if (!form) return;

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.setAttribute("aria-live", "assertive");
    errorBox.classList.add("error");
    errorBox.style.display = "block";
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.removeAttribute("aria-live");
    errorBox.style.display = "none";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("Por favor complete todos los campos.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando…";

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        window.location.replace("/dashboard.html");
        return;
      }

      if (response.status === 429) {
        showError("Demasiados intentos. Por favor espere un minuto e intente nuevamente.");
        return;
      }

      if (response.status === 401) {
        showError("Credenciales incorrectas. Verifique su correo y contraseña.");
        return;
      }

      showError("Error del servidor. Intente más tarde.");
    } catch (_) {
      showError("No se pudo conectar con el servidor. Verifique su conexión.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Ingresar";
    }
  });
})();
