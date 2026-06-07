# RA Assessment — Medición institucional

Sistema web que reemplaza el flujo Excel/VBA de evaluación de Resultados de Aprendizaje (RA) en la IUB. El archivo de mapeo `MODULOS {cuatrimestre} POR RESULTADOS DE APRENDIZAJE.xlsx` es la fuente operativa de quién evalúa qué, en qué programa y bajo qué líder consolidador.

## Language

### Ciclo y estructura

**Ciclo de medición**:
Un cuatrimestre académico en el que se miden RAs (ej. `2025-2`). Un archivo Excel de mapeo corresponde a exactamente un ciclo.
_Avoid_: Período (cuando se refiere al cuatrimestre completo), semestre

**Línea propedéutica**:
Agrupación institucional de programas que comparten un informe ejecutivo (ej. CE-TGLI-ANI, TGA-INE). Una hoja del Excel de mapeo corresponde a una línea.
_Avoid_: Facultad, programa

**Programa**:
Carrera o ciclo formativo concreto (ej. Comercio Exterior, TG Administrativa). Columna `PROGRAMA` del Excel.
_Avoid_: Módulo, curso

### Roles

**Docente evaluador**:
Persona que califica estudiantes y redacta análisis cualitativo de un módulo para un RA concreto. Columna `DOCENTE` del Excel.
_Avoid_: Docente (sin calificar), profesor

**Líder consolidador de RA**:
Persona que consolida todos los módulos de un **programa × RA** en un informe. Columna `LIDER DE MEDICION DEL RA` del Excel. Distinta por cada combinación programa×RA.
_Avoid_: Líder de programa, líder de medición, admin

**Líder de medición**:
Persona (rol `admin`) que consolida el informe ejecutivo de toda una línea propedéutica. Aparece en el encabezado del Excel (Diego Domínguez).
_Avoid_: Decano, admin (sin contexto)

### Objetos de evaluación

**RA medido**:
Resultado de aprendizaje que el decano eligió evaluar en este ciclo. Marcado con `X` en columnas RA1–RA6 del Excel. No todos los RAs se miden siempre.
_Avoid_: Período, rúbrica

**Módulo físico**:
Instancia curso+grupo (`CODIGO` + `GRUPO 2025-2`). Puede medir varios RAs en el mismo ciclo.
_Avoid_: Período, clase

**Asignación módulo×RA**:
Vínculo entre un módulo físico y un RA que ese módulo debe medir en el ciclo. Una fila del Excel con tres `X` genera tres asignaciones (305 totales en 2025-2).
_Avoid_: Módulo (solo), período

### Flagged ambiguities

**Período** — resuelto así:
- **Ciclo de medición** = cuatrimestre (`2025-2`)
- **Período de captura** = ventana técnica en BD (`periods`) para capturar un RA (ej. `2025-2 RA3`)

## Example dialogue

**Experto IUB:** En 2025-2, el módulo ADM17 del programa Comercio Exterior mide RA3, RA4 y RA5.

**Dev:** Eso son tres **asignaciones módulo×RA** sobre un mismo **módulo físico**. Cada una tiene su **líder consolidador de RA** distinto según el mapeo.

**Experto IUB:** El docente envía tres veces, pero no elige destinatario.

**Dev:** Correcto: el sistema enruta cada envío al líder de esa combinación programa×RA. El **líder de medición** solo ve el panorama de línea para el informe ejecutivo.
