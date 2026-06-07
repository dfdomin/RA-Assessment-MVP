# Known Issues — RA Assessment MVP

**Última actualización**: 2026-06-07

## Resueltos recientemente

- Documentación desactualizada (README, MIGRATION_PLAN checkboxes) — sincronizada con estado real
- Tests frontend apuntaban a FastAPI en lugar de Supabase — reescritos
- Falta de Edge Functions — implementadas en `supabase/functions/`
- Cache-busting en GitHub Pages — script `scripts/inject-cache-bust.sh` + workflow CI
- RLS seed deadlock en `public.users` — migración `0010_users_rls_seed.sql`
- Módulos sin docente asignado — migración `0011_auto_assign_module_staff.sql`

## Abiertos

- **OneDrive sync**: el repo vive bajo CloudStorage; puede afectar `.venv`, Playwright y rendimiento de git. Mover a `~/Projects/` para desarrollo activo.
- **Paridad reportes**: Edge Functions generan exportaciones simplificadas (no WeasyPrint/openpyxl). Validar formato institucional con stakeholders IUB.
- **Cierre de período**: validación server-side completa (módulos pendientes, análisis líder) pendiente de Edge Function `period-close`.
- **E2E Playwright contra Supabase live**: requiere credenciales de test en CI (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); tests estáticos cubren wiring JS.
- **F12 Microsoft OIDC**: diferido post-MVP.
- **F17 oracle_adapter**: bloqueado por PREREQ-01/02/03.

## Nota sobre dual-stack

`src/` (FastAPI) coexiste como **referencia legacy**. No ejecutar `deploy.sh` para el MVP; usar GitHub Actions → Pages + Supabase CLI para migraciones.
