# LLM Council Transcript — Decano, Líneas Propedéuticas y Resumen Ejecutivo Institucional

**Fecha**: 2026-05-16  
**Agente**: Claude Sonnet 4.6 (simulación de council — formato idéntico al council Codex)  
**Archivo de referencia**: `docs/council-transcript-20260516-074839.md` (council anterior)

---

## Pregunta original

El usuario identifica que el RA Assessment App está explícitamente limitado a un solo programa (TGA, FCCEA) en el PRD §12. Sin embargo, la IUB requiere que un Decano (o quien haga sus veces) pueda ver un resumen ejecutivo de resultados de Resultados de Aprendizaje agregado por **Línea Propedéutica** a nivel institucional — no solo de un programa.

La jerarquía institucional es:

- **Línea Propedéutica A** (Informática/Telecomunicaciones):  
  Técnico (Telecomunicaciones) → Tecnología (Telemática / Redes) → Profesional (Ingeniería Telemática)

- **Línea Propedéutica B** (Gestión Administrativa):  
  Tecnología (TGA — programa actual en v1) → Profesional (Inteligencia de Negocios)

El usuario confirma que el alcance es **institucional completo**, no limitado a la FCCEA.

---

## Pregunta enmarcada

¿Cuál es la mejor estrategia para incorporar el rol Decano, la jerarquía Módulo → Programa → Línea Propedéutica y un resumen ejecutivo agregado por línea propedéutica, dado que:

1. El PRD §12 dice explícitamente: *"Múltiples programas académicos (v1 solo para TGA)"*.
2. La arquitectura actual no tiene tablas `programs` ni `propedeutic_lines`.
3. El rol `dean` no existe en ningún artefacto del sistema.
4. El sprint S1 está casi completo (38/38 tests, bandit CLEAN); S2–S6 están pendientes.
5. El usuario acordó que la implementación sigue después del council.

---

## Respuestas del consejo

### Contrarian

La expansión está mal planificada en términos de secuencia. El PRD §12 no es una limitación técnica — es una decisión de scope tomada deliberadamente para reducir riesgo de entrega. Revertirla ahora, antes de que el sistema esté en producción con TGA, introduce cuatro riesgos:

**Primero**, el Decano institucional necesita datos de múltiples programas, pero esos programas aún no están en el sistema. Si se agrega el rol antes de tener los datos, el rol queda vacío y decorativo — peor que no tenerlo.

**Segundo**, la jerarquía propedéutica no es un dato administrativo estable. Los programas cambian de modalidad, se acreditan, se suspenden, se fusionan. Modelar esa jerarquía antes de que sea estable es construir sobre arena.

**Tercero**, agregar un cuarto rol (Decano) antes de que los tres roles existentes estén completamente probados en producción añade complejidad de autorización que no tiene cobertura de tests adecuada.

**Cuarto**, el resumen ejecutivo por línea propedéutica requiere que los demás programas hayan completado al menos un período en el sistema. Un resumen ejecutivo de un solo programa no es un resumen ejecutivo institucional — es un informe de programa con nombre incorrecto.

**Recomendación del Contrarian**: no tocar scope hasta que TGA esté en producción con al menos un período cerrado. El Decano no necesita el sistema en este momento; lo necesita cuando haya datos reales para leer.

---

### First Principles Thinker

La pregunta correcta no es "¿cómo agrego el Decano?" sino "¿qué necesita el Decano para tomar decisiones?". Si se responde desde los primeros principios:

El Decano necesita comparar la calidad de los resultados de aprendizaje entre programas que comparten una línea propedéutica, para justificar ante el MEN o ante un acreditador que el ciclo de formación es coherente. No necesita editar rúbricas, módulos ni períodos — solo leer datos agregados.

Desde los primeros principios, esto implica:

1. **Estructura de datos mínima**: una tabla `programs` (id, name, code, propedeutic_line_id) y una tabla `propedeutic_lines` (id, name). Los `student_outcomes` ya existentes adquieren un FK opcional a `programs`. Los períodos ya existentes adquieren un FK a `programs`.

2. **Rol mínimo**: `dean` con acceso de lectura a todos los programas. No requiere `verify_module_ownership`; no tiene endpoints de escritura. Su token lleva `role: "dean"` y el sistema devuelve datos agregados sin exponer datos individuales de estudiantes (privacidad por diseño).

3. **Endpoint mínimo**: `GET /propedeutic-lines/{id}/summary` que devuelve, para cada programa de la línea, el número de períodos cerrados, el porcentaje de estudiantes por nivel (Poor/Inadequate/Adequate/Exemplary) por SO, y el estado de cumplimiento del plan de acción. No más.

**Conclusión del First Principles Thinker**: la expansión es arquitectónicamente pequeña si se limita a lo que el Decano realmente necesita. El error sería diseñar un sistema de multi-tenancy completo cuando lo que se necesita es una vista de lectura agregada.

---

### Expansionist

La jerarquía propedéutica no es solo una vista de reporte — es el modelo conceptual que subyace al diseño curricular de la IUB. Modelarla correctamente abre oportunidades que el sistema actual no puede aprovechar:

**Trazabilidad longitudinal de estudiantes**: si un estudiante que cursó el Técnico en Telecomunicaciones pasa a la Tecnología en Telemática, sus resultados de aprendizaje en el ciclo técnico deberían ser visibles en contexto cuando el programa de tecnología evalúa sus RA. La línea propedéutica es la estructura que conecta esos ciclos.

**Comparación de resultados entre programas del mismo ciclo**: ¿Cómo se compara el desempeño en RA1 del programa TGA con el RA equivalente del programa de Telemática? Esa pregunta es relevante para el Decano y para la acreditación.

**Evidencia para acreditación institucional**: la IUB puede estar en proceso de acreditación institucional (ACREDITACIÓN MULTICAMPUS del CNA colombiano). El resumen ejecutivo por línea propedéutica es exactamente el tipo de evidencia que un acreditador institucional solicita.

**Calibración cruzada de rúbricas**: si dos programas de la misma línea propedéutica usan rúbricas distintas para el mismo tipo de SO, el Decano puede detectar inconsistencias de criterio.

**Recomendación del Expansionist**: no solo agregar el Decano y las líneas propedéuticas, sino diseñar la estructura de datos de forma que soporte también el ID de estudiante cruzado entre programas (con consentimiento Ley 1581/2012) para habilitar trazabilidad longitudinal en v3.

---

### Outsider

Desde fuera del sistema, "Decano" en una institución colombiana como la IUB es un cargo con funciones administrativas y académicas bien definidas por el MEN. Hay algo que llama la atención en la forma en que se está planteando el problema:

El Decano probablemente no va a usar una aplicación web todos los días. Su interacción con el sistema va a ser esporádica — quizás una o dos veces por período — y va a ser para descargar un reporte, no para navegar dashboards interactivos.

Esto sugiere que la solución técnica óptima no es un rol interactivo en la aplicación web, sino un **reporte exportable** que el Líder o el Admin puede generar y enviar al Decano. El Decano no necesita credenciales en el sistema si el Líder puede generar y descargar un PDF de resumen ejecutivo por línea propedéutica.

Esto tiene una ventaja de seguridad importante: un usuario menos con credenciales en el sistema es una superficie de ataque menor. También tiene una ventaja de usabilidad: el Decano recibe el reporte en su correo institucional en lugar de tener que recordar una URL y una contraseña.

**Pregunta que el consejo debería responder antes de implementar**: ¿existe un caso de uso real en el que el Decano necesite acceso directo al sistema en lugar de recibir un reporte generado por el Líder o el Admin? Si la respuesta es no, el "rol Decano" debería implementarse como un tipo de reporte exportable, no como un rol de usuario.

---

### Executor

La ruta práctica, considerando que S2–S6 están pendientes y el equipo de desarrollo es efectivamente una persona más herramientas de IA:

**Lo que se puede hacer ahora (PRE-S2, bajo costo):**

1. Enmendar PRD §12: remover "Múltiples programas académicos" de fuera de scope. Agregar F17: *Executive Summary by Propedeutic Line*.
2. Agregar tablas `programs` y `propedeutic_lines` a DATA_MODEL.md con FK opcionales desde `student_outcomes` y `periods`.
3. Agregar `dean` a ROLE_PERMISSION_MATRIX.md como rol de solo lectura.
4. Crear los modelos SQLAlchemy `Program` y `PropedeuticLine` en `src/models/` (sin migración PostgreSQL aún — igual que los otros modelos que esperan staging).

**Lo que debe esperar hasta después de S6 (POST-producción TGA):**

5. Migración Alembic para `programs` y `propedeutic_lines`.
6. Router `GET /propedeutic-lines/{id}/summary`.
7. Seed de datos: programas e instituciones reales de la IUB.
8. Tests de integración para el rol `dean`.

**Decisión sobre el Outsider**: el Executor está de acuerdo con el Outsider en que el Decano probablemente no necesita un login. La implementación práctica debería ser un endpoint protegido que el Admin puede invocar para generar un PDF de resumen ejecutivo, y ese PDF se envía al Decano por correo. Esto no requiere el rol `dean` en el token — requiere un endpoint de exportación con acceso Admin/Líder y formato de salida PDF.

**Secuencia recomendada por el Executor:**
```
AHORA:   Documentación (PRD, DATA_MODEL, ROLE_PERMISSION_MATRIX)
         + modelos SQLAlchemy (sin migración)
S2–S6:   Implementación normal (no bloquear por esta expansión)
POST-S6: sprint S7 — propedeutic lines + dean summary PDF
```

---

## Veredicto

El consejo está dividido en una tensión productiva: **el Contrarian y el Outsider tienen razón en que el Decano no necesita el sistema ahora**, y el **First Principles Thinker y el Executor tienen razón en que la expansión arquitectónica es pequeña si se hace bien**.

La síntesis es la siguiente:

**El rol `dean` como usuario con credenciales en el sistema probablemente no es necesario.** Lo que el Decano necesita es un *reporte exportable* que consolide resultados por línea propedéutica — y ese reporte lo puede generar el Admin o el Líder con sus credenciales existentes. Esto reduce el riesgo de seguridad y la complejidad de autorización.

**La jerarquía `programs` → `propedeutic_lines` SÍ debe modelarse en los datos**, porque es la estructura conceptual correcta de la institución y habilitará reportes institucionales sin rediseño. Hacerlo ahora en DATA_MODEL.md y en SQLAlchemy cuesta menos de una hora y no bloquea ningún sprint.

**El resumen ejecutivo por línea propedéutica debe implementarse como un tipo de reporte PDF exportable** por el Admin/Líder, no como una pantalla interactiva para un rol `dean`. Esto es más alineado con el uso real del cargo y más fácil de implementar.

**El PRD §12 debe enmendarse** para reflejar esta decisión: "Múltiples programas académicos (v2 — se modela la estructura de datos ahora; la UI multi-programa y el reporte institucional se implementan post-despliegue de TGA v1)".

---

## Primer paso

**Documentación (esta semana, antes de continuar S2):**

1. Enmendar `docs/PRD.md` §12: cambiar "Múltiples programas académicos (v1 solo para TGA)" por "Múltiples programas académicos — estructura de datos modelada desde v1; reporte ejecutivo por línea propedéutica implementado en v2 post-despliegue de TGA".
2. Añadir F17 en `docs/PRD.md`: *Reporte Ejecutivo por Línea Propedéutica* — solo lectura, exportable como PDF por Admin/Líder, sin rol `dean` separado en v1.
3. Añadir tablas `programs` y `propedeutic_lines` a `docs/DATA_MODEL.md`.
4. Actualizar `docs/ROLE_PERMISSION_MATRIX.md`: documentar que el resumen institucional es accesible para Admin/Líder con filtro por `propedeutic_line_id`, sin rol `dean` separado en v1.

**Código (antes de S7, después de S6):**

5. Crear `src/models/program.py` — modelos `Program` y `PropedeuticLine`.
6. Agregar FK opcionales a `src/models/student_outcome.py` y `src/models/period.py`.
7. Crear migración Alembic `0002_programs_propedeutic_lines.py` cuando haya PostgreSQL disponible.
8. Crear `src/api/routers/dean_report.py` — `GET /propedeutic-lines/{id}/summary` + `GET /propedeutic-lines/{id}/report/pdf`.
9. Tests: acceso Admin/Líder al summary; acceso `teacher` → 403; datos correctamente agregados por programa.

---

## Nota metodológica

Este transcript fue generado por **Claude Sonnet 4.6** en Claude Code siguiendo el formato del consejo anterior (`council-transcript-20260516-074839.md`). No es un multi-model council con instancias paralelas — es una simulación de perspectivas múltiples por un solo modelo. Las perspectivas representan posiciones analíticas distintas, no modelos distintos. Para un council genuinamente multi-modelo, usar Codex `llm-council` con este mismo prompt.

**Prompt para Codex si se desea validación independiente:**

> Ejecuta `llm-council` con cinco perspectivas (Contrarian, First Principles Thinker, Expansionist, Outsider, Executor) para responder: ¿Cuál es la mejor estrategia para incorporar el rol Decano, la jerarquía Módulo → Programa → Línea Propedéutica (nivel institucional, IUB Colombia) y un resumen ejecutivo agregado por línea propedéutica al RA Assessment App, dado que v1 está explícitamente limitado a un solo programa (TGA) en el PRD §12, y el Decano confirmó que el alcance es institucional completo (múltiples facultades)?  
>
> Contexto: la jerarquía propedéutica tiene dos líneas confirmadas:  
> - Línea A: Técnico Telecomunicaciones → Tecnología Telemática → Profesional Ingeniería Telemática  
> - Línea B: Tecnología TGA → Profesional Inteligencia de Negocios  
>
> El stack es FastAPI + PostgreSQL + HTML/JS estático. El PRD y los artefactos de arquitectura están en el repositorio local.
