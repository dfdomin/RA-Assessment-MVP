# Human Review

## Pending review

- Confirm repository name.
- Confirm GitHub account/organization.
- Confirm private repository visibility.
- Confirm whether `main` should be protected after first push.
- Confirm S0 scope before implementation starts.

## S1-20 — Revisión de seguridad de S1

Fecha: 2026-05-16  
Revisado por: Diego Domínguez Tapia

- [OK] `verify_module_ownership` está planificado para S2 y cuenta con base técnica implementada para docentes y líderes-evaluadores asignados en `module_staff`.
- [OK] Las cookies emitidas son `httpOnly` y `Secure`.
- [ok] El audit log escribe correctamente `login_success` y `login_failed`.
  Evidencia: el código usa `httponly=True` y `secure=True`; el header `Set-Cookie` contiene `HttpOnly; Secure`.

- [pendiente] `deploy.sh` falla correctamente ante CVEs.

Resultado: revisión parcial. Punto (1) aprobado; puntos (2), (3) y (4) siguen pendientes de verificación manual.



curl -i -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.periods@iub.edu.co","password":"Admin1234!"}'

admin.periods@iub.edu.co
