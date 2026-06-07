/**
 * auth.js — RA Assessment MVP
 * Maneja login/logout con Supabase Auth.
 * Reemplaza el JWT cookie original por Supabase session.
 */
(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submit-btn");
  const errorBox = document.getElementById("login-error");

  if (!form) return;

  // Check if already logged in
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Verify user has a profile in public.users
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        window.location.replace("./dashboard.html");
      } else {
        // User exists in Auth but not in public.users — sign out
        await supabase.auth.signOut();
      }
    }
  }

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

  const INSTITUTIONAL_EMAIL_SUFFIX = "@unibarranquilla.edu.co";

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("Por favor complete todos los campos.");
      return;
    }

    var emailLower = email.toLowerCase();
    if (!emailLower.endsWith(INSTITUTIONAL_EMAIL_SUFFIX) && !emailLower.endsWith("@iub.edu.co")) {
      showError("Use su correo institucional " + INSTITUTIONAL_EMAIL_SUFFIX);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando…";

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          showError("Credenciales incorrectas. Verifique su correo y contraseña.");
        } else if (error.message.includes("rate") || error.status === 429) {
          showError("Demasiados intentos. Por favor espere un minuto e intente nuevamente.");
        } else if (error.message.includes("Email not confirmed")) {
          showError("Debe confirmar su correo electrónico antes de ingresar.");
        } else {
          showError("Error al iniciar sesión: " + error.message);
        }
        return;
      }

      if (data.session) {
        // Verify user profile exists
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          showError("Usuario no registrado en el sistema. Contacte al administrador.");
          return;
        }

        window.location.replace("./dashboard.html");
      }
    } catch (_) {
      showError("No se pudo conectar con el servidor. Verifique su conexión.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Ingresar";
    }
  });

  // Check session on page load
  checkSession();
})();
