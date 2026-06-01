# LLM Council — Estrategia de Desarrollo RA Assessment App

## Where the Council Agrees

El consejo coincide en una conclusión fuerte: **no conviene pedirle a Claude Code ni a Codex que construyan toda la aplicación de una vez**. El PRD ya es suficientemente grande, sensible y regulado como para que un mega-prompt produzca deuda técnica, omisiones de seguridad y una app difícil de auditar.

La estrategia correcta es trabajar en **fases verticales, pequeñas y verificables**, donde cada fase entregue base de datos, API, UI mínima, pruebas, documentación y revisión humana.

También hubo consenso en que antes de escribir código deben existir artefactos de control: arquitectura, modelo de datos, contrato API, matriz de roles, threat model, plan de pruebas, reglas de continuidad y criterios de aceptación por fase.

## Where the Council Clashes

El principal choque fue sobre cuándo tocar reportes.

Una perspectiva dice: "no tocar reportes hasta que auth, modelo, CRUD e imports estén sólidos". Es ejecutable y reduce dispersión.

La otra advierte algo importante: en esta app, el reporte ABET no es una feature tardía; es el producto final que valida todo el sistema. Por tanto, aunque la generación PDF/XLSX venga después, **los contratos de exportación, fixtures y golden files deben definirse desde temprano**.

Resolución: no implementar F07 completo al inicio, pero sí crear desde S0/S1 una carpeta de fixtures, plantillas esperadas y criterios de paridad con Excel.

## Blind Spots the Council Caught

El punto ciego más importante: falta una **matriz de trazabilidad** que conecte cada requerimiento del PRD con entidad de datos, endpoint, pantalla, prueba, control de seguridad y evidencia ABET.

Sin esa matriz, la IA puede "cumplir visualmente" el PRD pero dejar huecos: permisos, reportes, auditoría, privacidad, exportaciones o validaciones críticas.

Otros puntos ciegos:

- Dataset semilla obligatorio para validar flujos repetibles.
- Golden files para PDF/XLSX/DOCX.
- Validación temprana de accesibilidad y guía IUB.
- Política explícita de retención, backup y restauración.
- Dueño humano de decisiones legales, ABET y privacidad.

## The Recommendation

Desarrolla la app como un **sistema de entrega auditado por fases**, no como vibecoding abierto.

Usa Claude Code y Codex así:

- **Claude Code**: arquitectura, planeación, refactors amplios, revisión de diseño, generación de planes por fase.
- **Codex**: implementación incremental, pruebas, debugging, revisión de diffs, continuidad entre sesiones.
- **Humano**: interpretación ABET, decisiones Ley 1581/2012, aceptación visual IUB, validación del reporte final y aprobación de merges.

Git debe ser el sistema de seguridad: `main` siempre estable, ramas cortas por fase o slice, commits pequeños, PRs revisables aunque trabajes solo, tags por hito.

## The One Thing to Do First

Crear una fase **S0 — Architecture & Continuity Spine** antes de implementar features.

S0 debe producir el repo base, documentación viva, matriz de trazabilidad, estructura de carpetas, tooling de pruebas, CI/local checks, dataset semilla y primer endpoint protegido de prueba.

## Implementation Operating System

### 1. Fases recomendadas del proyecto

- **S0 — Base del proyecto**
  Repo, Docker Compose/local env, FastAPI skeleton, PostgreSQL, Alembic, frontend estático mínimo, CI/checks, estructura docs, dataset semilla, matriz de trazabilidad.

- **S1 — Auth, roles y seguridad base**
  Login, JWT cookie httpOnly, logout con blocklist, `require_role()`, rate limit, audit log, usuarios base.

- **S2 — Dominio académico**
  Periodos, RA/SO, rúbricas, PIs, pesos = 100%, descriptores, módulos, asignaciones.

- **S3 — Flujo docente**
  Info módulo, estudiantes, importación inicial, exclusiones, revisión rúbrica, calificaciones, autosave.

- **S4 — Análisis, distribución y cierre**
  Análisis cualitativo, distribución por módulo, wizard completo, submit, cierre/reapertura, dashboard líder.

- **S5 — Reportes y closing the loop**
  Reporte ABET PDF/XLSX, análisis líder, plan de acción, informe líder PDF/DOCX, golden files.

- **S6 — Admin, bulk import, notificaciones y hardening**
  F13, F15, OIDC opcional, backups GPG, deploy Hetzner, fail2ban, restauración de prueba.

### 2. Archivos de documentación que debes crear

```text
docs/PRD.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/SECURITY_PRIVACY.md
docs/ROLE_PERMISSION_MATRIX.md
docs/TRACEABILITY_MATRIX.md
docs/UX_IUB_RULES.md
docs/TEST_PLAN.md
docs/VALIDATION_LOG.md

memory/PROJECT_STATE.md
memory/NEXT_STEPS.md
memory/DECISIONS.md
memory/KNOWN_ISSUES.md
memory/AI_PROMPT_LOG.md
memory/HUMAN_REVIEW.md
```

### 3. Flujo de Git recomendado

- `main`: siempre estable y desplegable.
- `dev`: integración opcional.
- Ramas: `feature/s0-project-spine`, `feature/s1-auth`, `feature/s2-rubrics`.
- PR por slice, no por macrofase gigante.
- Tags: `s0-complete`, `s1-auth-complete`, `s2-rubrics-complete`.
- Cada PR debe incluir: pruebas, migraciones, notas de seguridad, capturas si toca UI, actualización de `memory/`.

### 4. Rutina por sesión con Claude Code/Codex

1. Leer `memory/PROJECT_STATE.md`, `NEXT_STEPS.md` y `DECISIONS.md`.
2. Elegir un solo slice pequeño.
3. Pedir plan breve antes de editar.
4. Implementar con pruebas.
5. Ejecutar gates.
6. Revisar diff humano.
7. Actualizar memoria.
8. Commit pequeño con mensaje claro.

### 5. Checklist de cierre de cada fase

- Tests pasan.
- Migraciones aplican y revierten.
- Matriz de trazabilidad actualizada.
- Role/permission matrix validada.
- Seguridad revisada: IDOR, sanitización, rate limit, audit log según aplique.
- UI revisada contra guía IUB si toca frontend.
- Documentación y memoria actualizadas.
- Demo manual completada con dataset semilla.
- Tag de fase creado.

### 6. Prompt maestro inicial para Claude Code

```text
Lee el PRD v2.2 de RA Assessment App y no escribas código todavía.

Tu tarea es crear la fase S0 — Architecture & Continuity Spine.

Produce o actualiza:
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/SECURITY_PRIVACY.md
- docs/ROLE_PERMISSION_MATRIX.md
- docs/TRACEABILITY_MATRIX.md
- docs/TEST_PLAN.md
- memory/PROJECT_STATE.md
- memory/NEXT_STEPS.md
- memory/DECISIONS.md

Define la estructura del repositorio para FastAPI + PostgreSQL + frontend HTML/JS estático.
Incluye fases S1-S6, criterios de aceptación, gates de validación y riesgos.
No implementes features de la app todavía.
```

### 7. Prompt maestro inicial para Codex

```text
Lee el PRD v2.2 y los archivos en docs/ y memory/.

Implementa únicamente S0 — base técnica mínima:
- estructura del repo
- FastAPI skeleton
- PostgreSQL/Alembic skeleton
- frontend estático mínimo
- configuración local
- pruebas base
- tooling de calidad
- dataset semilla mínimo
- un endpoint protegido de prueba
- actualización de memory/PROJECT_STATE.md y memory/NEXT_STEPS.md

No implementes todavía rúbricas, docentes, reportes ni imports.
Trabaja en commits pequeños.
Al terminar, ejecuta las pruebas y resume riesgos pendientes.
```

