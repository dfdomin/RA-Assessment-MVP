# RA Assessment MVP

**MVP de la aplicación de assessment de Resultados de Aprendizaje (ABET) para IUB/Unibarranquilla.**

Este repositorio es la versión migrada a **Supabase + GitHub Pages** del proyecto original [RA-Assessment-App](https://github.com/dfdomin/RA-Assessment-App) (FastAPI + PostgreSQL + Hetzner).

## ¿Por qué este MVP?

El objetivo es probar que la aplicación funciona completamente sin necesidad de un servidor propio (Hetzner), usando:

- **Supabase** (free tier) como backend: base de datos PostgreSQL, autenticación, y Edge Functions
- **GitHub Pages** como hosting estático gratuito para el frontend HTML/CSS/JS

Si el MVP funciona, se puede decidir si mantener Supabase o migrar a Hetzner.

## Stack

| Componente | Tecnología |
|------------|-----------|
| Frontend | HTML/CSS/JS vanilla |
| Backend | Supabase (PostgREST + Auth + Edge Functions) |
| Base de datos | PostgreSQL 15 (Supabase) |
| Auth | Supabase Auth |
| Hosting | GitHub Pages |
| Reportes | Edge Functions (Deno/TypeScript) |

## Estado

- **Fase actual**: Plan de migración creado. Ver `docs/MIGRATION_PLAN.md`.
- **Origen**: 201 tests, S0-S5 completos en el repo original
- **Pendiente**: 28 tareas en 7 bloques (A-G)

## Estructura

```
frontend/        → HTML/CSS/JS (páginas estáticas)
supabase/        → Migraciones SQL, Edge Functions, seed data
docs/            → Documentación del proyecto
tests/e2e/       → Tests Playwright
memory/          → Memoria del proyecto (PROJECT_STATE, NEXT_STEPS, DECISIONS)
```

## Guía Rápida

1. Leer `docs/PRD.md` — fuente de verdad del producto
2. Leer `docs/MIGRATION_PLAN.md` — plan de migración a Supabase
3. Revisar `docs/DATA_MODEL.md` — modelo de datos completo
4. Revisar `docs/ROLE_PERMISSION_MATRIX.md` — roles y permisos

## Repo Original

El desarrollo completo (S0-S5, 201 tests, ~40 endpoints) está en:
https://github.com/dfdomin/RA-Assessment-App

---

**IUB / Unibarranquilla — Facultad de Ciencias Económicas y Administrativas**
