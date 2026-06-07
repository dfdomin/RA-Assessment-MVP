# PRD — RA Assessment App
**Version**: 2.4
**Fecha**: 2026-06-07
**Changelog v2.4**: Jerarquía institucional de tres niveles documentada a partir del mapeo real `MODULOS 2025-2 POR RESULTADOS DE APRENDIZAJE.xlsx` (206 módulos, 2 líneas propedéuticas, 5 programas, 27 combinaciones programa×RA, 11 líderes consolidadores). Rol **Administrador** redefinido como **Líder de Medición** (consolida informes ejecutivos por línea; no califica). Rol **Líder** redefinido como **Líder consolidador de RA** (una persona distinta por combinación programa×RA). Módulos multi-RA: un mismo curso puede contribuir a varios RAs en el mismo cuatrimestre; cada RA genera un envío independiente hacia su líder asignado; el enrutamiento al líder es **automático y transparente** para el docente. Dominio institucional de correo: **`@unibarranquilla.edu.co`** (único válido para login, recuperación de contraseña, `mailto:` y contacto con líder). Campo canónico: `public.users.email` (sincronizado con `auth.users.email`). UX docente (F05): desde el **paso 1 (Información general)** mostrar líder consolidador del RA + correo; repetir en paso Enviar con sugerencia de notificación por correo. Ciclo de medición = un cuatrimestre académico (ej. `2025-2`); el archivo de mapeo siempre corresponde a un solo cuatrimestre. Pendiente de propagar a `DATA_MODEL.md`, `ROLE_PERMISSION_MATRIX.md`, `API_CONTRACT.md`, `MIGRATION_PLAN.md` (ver `memory/NEXT_STEPS.md` H-05).
**Changelog v2.3**: Incorporación de F17 (Reporte Ejecutivo por Línea Propedéutica — institucional). Enmienda de §12: múltiples programas pasan de "fuera de alcance v1" a "estructura de datos modelada en v1, UI multi-programa en v2". Decisión arquitectónica tomada tras LLM Council (2026-05-16): no se crea rol `dean` en v1; el reporte institucional es exportable por Admin/Líder.
**Changelog v2.2**: Incorporación de requerimientos de la Guía de Usabilidad y Estilos IUB (DG-TSI-09-V4) como sección #18. Actualizaciones menores en secciones #9, #11, #13 y #14 para alineación.
**Changelog v2.1**: Incorporacion de features F12 (Microsoft OIDC nice-to-have), F13 (seguimiento y notificacion de docentes), F14 (informe del lider regenerable en PDF/DOCX), F15 (carga masiva y creacion individual para administrador). Controles de seguridad de las nuevas features alineados con Google Cloud Well-Architected Framework: Security by Design, Zero Trust, Shift-Left, Preemptive Cyber Defense.
**Changelog v2.0**: Incorporacion del analisis de seguridad WAF (Security by Design, Zero Trust, Shift-Left, Preemptive Cyber Defense, Ley 1581/2012). Nuevas secciones: #16 Postura de Seguridad, #17 Analisis de Superficie F03. Secciones existentes ampliadas: #8 API REST (autorizacion por endpoint), #9 Stack Tecnico (dependencias de seguridad), #10 Infraestructura (hardening), #11 No-Funcionales (seguridad), #14 Sprints (tareas de seguridad por sprint).
**Programa**: Tecnologia en Gestion Administrativa — Facultad de Ciencias Economicas y Administrativas
**Stack**: FastAPI + PostgreSQL + HTML/JS estatico (servido por Caddy en Hetzner)
**Infraestructura**: Hetzner CAX11 (Ashburn, US-East) ~$4.65 USD/mes

---

## 1. Contexto y Problema

El programa lleva actualmente el proceso de assessment de Resultados de Aprendizaje (RA/SO) en archivos Excel (.xlsm con macros VBA + hojas de mapeo operativo). El proceso institucional real (validado en `MODULOS 2025-2 POR RESULTADOS DE APRENDIZAJE.xlsx`) funciona así:

1. El decano define **qué RAs de cada programa** se medirán en el cuatrimestre (ej. `2025-2`). Esa decisión queda en el **archivo de mapeo**: docente, programa, módulo, grupo, RA(s) a medir y **líder consolidador por cada RA**.
2. Cada docente completa calificaciones y análisis cualitativo para su(s) módulo(s) y los envía (en Excel: pegar en hojas y devolver archivos).
3. Por cada combinación **programa × RA**, el **líder consolidador asignado** recibe los módulos de ese RA, consolida distribución y análisis, y genera el informe de ese RA (hoy: copiar/pegar manual entre archivos).
4. El **líder de medición** (Administrador del sistema) consolida un **informe ejecutivo por línea propedéutica**, agregando todos los RAs medidos de los programas de esa línea (dos informes en 2025-2: línea CE-TGLI-ANI y línea TGA-INE).

**Problemas del flujo actual:**
- No hay control de versiones: multiples copias del archivo circulan por correo
- Las macros se rompen al cambiar versiones de Excel o en macOS
- El lider recibe archivos incompletos sin forma de saber el estado de cada modulo
- No hay validacion: un docente puede dejar PIs en blanco sin aviso
- El reporte final requiere intervencion manual para eliminar filas/columnas con ceros

---

## 2. Objetivo del Producto

Reemplazar el flujo Excel/VBA con una aplicacion web que:

- Permita a cada docente ingresar datos de su modulo desde cualquier dispositivo
- Consolide automaticamente todos los modulos en un reporte final descargable
- De al lider visibilidad en tiempo real del estado de cada modulo
- Elimine la dependencia de macros VBA y distribucion manual de archivos

---

## 3. Roles de Usuario

| Rol técnico (`users.role`) | Nombre institucional | Responsabilidad |
|---|---|---|
| `teacher` | **Docente** | Califica estudiantes y redacta análisis cualitativo **por módulo y por RA asignado**. No consolida informes. |
| `leader` | **Líder consolidador de RA** | Por cada combinación **programa × RA** que le fue asignada en el mapeo: supervisa módulos, consolida resultados, redacta análisis del líder (F07/F14) y genera el informe de ese RA. **No califica** salvo que además esté en `module_staff` como evaluador. Una persona distinta por cada RA/programa (11 personas en 2025-2). |
| `admin` | **Líder de medición** | Supervisa el ciclo completo del cuatrimestre. **No califica.** Consolida el **informe ejecutivo por línea propedéutica** (F17) a partir de los informes de RA entregados por los líderes consolidadores. Además: carga masiva inicial (F15), usuarios, reapertura de períodos (F06). |

### 3.1 Jerarquía de informes (tres niveles)

```
Cuatrimestre académico (ej. 2025-2)          ← un archivo de mapeo = un cuatrimestre
  └── Línea propedéutica (2 en 2025-2)
        └── Programa (5 en 2025-2)
              └── RA medido (subconjunto elegido por el decano; no todos los RA siempre)
                    └── Módulos (curso + grupo + docente)
                          └── Envío del docente (calificaciones + análisis por PI)
                    └── Informe consolidado del líder de RA (1 por programa × RA)
              └── Informe ejecutivo de línea (1 por línea propedéutica — Líder de medición)
```

**Fuente de verdad del mapeo:** `MODULOS {cuatrimestre} POR RESULTADOS DE APRENDIZAJE.xlsx`. Columnas operativas: `GRUPO`, `CODIGO`, `MÓDULO`, `DOCENTE`, `PROGRAMA`, `RA1`…`RA6` (marca `X`), `LIDER DE MEDICION DEL RA` (una línea por RA marcado, ej. `RA3 - JORLY BERDUGO` / `RA5 - J. PERTUZ`).

**Datos reales 2025-2:** 206 módulos físicos → 305 asignaciones módulo×RA (75 módulos miden 2 o 3 RAs); 27 combinaciones programa×RA; 51 docentes; 11 líderes consolidadores.

**Líneas propedéuticas 2025-2 (hojas del mapeo):**

| Hoja Excel | Línea | Programas incluidos |
|---|---|---|
| `RA CE TGLI ANI` | Comercio exterior / logística internacional | Comercio Exterior, TG Logística Internacional, Adm. Negocios Internacionales |
| `RA TGA INE` | Inteligencia de negocios | TG Administrativa, Inteligencia de Negocios |

---

## 4. Estructura de Dominio

Mapeada del archivo de mapeo y del Excel de assessment (.xlsm):

```
Cuatrimestre academico (ej. 2025-2)           -- contenedor del ciclo de medicion
  └── Linea propedeutica
        └── Programa
              └── RA medido en este cuatrimestre (subconjunto definido por el decano)
                    └── Rubrica / PIs del RA
                    └── Lider consolidador asignado (programa × RA)
                    └── Modulo (curso + grupo + docente calificador)
                          └── Estudiante → Calificacion por PI
                          └── Analisis cualitativo por PI (docente)
                    └── Informe consolidado del lider (analisis + distribucion + plan de accion)
              └── Informe ejecutivo de linea (lider de medicion / admin)
```

### 4.1 Módulos multi-RA (regla crítica)

Un mismo módulo físico (mismo `CODIGO` + `GRUPO`) puede medir **varios RAs** en el mismo cuatrimestre (36 % de los módulos en 2025-2). Ejemplo real: `ADM17 · 1_CE_G1` mide RA3, RA4 y RA5 con líderes distintos (Jorly / Juan Roa / J. Pertuz).

**Comportamiento requerido en la app:**

- El docente completa **un envío independiente por cada RA** que su módulo debe medir (wizard distinto o contexto explícito `módulo + RA`).
- Cada envío se enruta al **líder consolidador de ese RA** para ese programa — no a un único líder del módulo.
- El docente **no** envía "un solo paquete" repartido manualmente entre líderes; el sistema separa automáticamente por RA según el mapeo.
- **Para el docente, el destino del envío es transparente**: no elige líder ni programa de consolidación; solo ve **qué RA debe evaluar** y el estado de su medición.

**Correo institucional (`public.users.email`):**

| Requisito | Detalle |
|---|---|
| Dominio obligatorio | `@unibarranquilla.edu.co` |
| Campo en BD | `public.users.email` VARCHAR(254) UNIQUE — fuente canónica para UI, `mailto:` y recuperación de contraseña |
| Sincronización | Debe coincidir con `auth.users.email` (Supabase Auth) para login y `resetPasswordForEmail()` |
| Alta de usuarios | F15 / mapeo / admin: siempre registrar correo institucional real; vincular nombre del mapeo Excel → fila `users` por email |
| Validación | Login y recuperación de contraseña rechazan dominios distintos a `@unibarranquilla.edu.co` |

**UX docente — paso 1 Información general (por cada RA):**

Al **iniciar** la evaluación, antes de calificar, el docente debe ver quién es su contacto para dudas:

| Elemento | Contenido |
|---|---|
| RA en evaluación | Ej. `RA3 — Analizar información documental…` |
| Módulo y grupo | Curso que está evaluando |
| Líder consolidador | Nombre completo (desde mapeo → `users.full_name`) |
| Correo del líder | `users.email` del líder (`@unibarranquilla.edu.co`), con enlace `mailto:` |
| Nota | *"Para inquietudes sobre esta medición, contacte a su líder consolidador."* |

**UX docente — paso Enviar (por cada RA):**

Tras completar calificaciones y análisis, se repite líder + correo y se añade:

| Elemento adicional | Contenido |
|---|---|
| Mensaje sugerido | *"Se recomienda enviar un correo a su líder consolidador informando que completó la medición de este RA."* |
| Acción opcional | `mailto:` precargado (módulo, grupo, RA, cuatrimestre) |

El docente **no** elige destinatario ni conoce la lógica de consolidación; debe saber **qué RA medir**, **a quién consultar durante** la evaluación y **a quién avisar al terminar**.

**UX administrativa / líder consolidador:**

En dashboard de líder (F08) y líder de medición (F08b) es obligatorio ver **qué líder consolidador corresponde a cada programa×RA** y su correo, para seguimiento y avisos a docentes pendientes.

Ejemplo: si un módulo mide RA1 (líder Marta) y RA5 (líder Indira), el docente hace **dos envíos** en el mismo cuatrimestre `2025-2`; cada paso Enviar muestra el líder y correo de **ese RA**; el sistema alimenta el informe correspondiente sin intervención del docente.

### Nivel de desempeno y escala de puntuacion (mapeado de `Data_Assessment_TGA_RA1_2024-2.xlsm`)

En el Excel original, la calificacion era un valor numerico continuo (1.0–5.0) mapeado a cuatro niveles. **En la app, el docente selecciona el nivel directamente** — no ingresa un numero. Los rangos del Excel se preservan como referencia para el calculo del Total Score y el Standard:

| Nivel (EN) | Nivel (ES) | Valor interno | Rango equivalente Excel | Estandar | Tipo de accion |
|---|---|---|---|---|---|
| Poor | Deficiente | 1 | 1.0 – 2.0 | Low | Acciones correctivas |
| Inadequate | Insuficiente | 2 | 2.1 – 3.0 | — | Acciones preventivas |
| Adequate | Bueno | 3 | 3.1 – 4.0 | Medium | Acciones preventivas |
| Exemplary | Sobresaliente | 4 | 4.1 – 5.0 | High | Planes de mejora/mantenimiento |

El Total Score de un estudiante = suma (valor_interno_nivel_PI x peso_PI). El Standard del estudiante se deriva del Total Score usando los rangos de la columna "Rango equivalente Excel" como umbrales de corte.

> Fuente: hoja `Conversion` de `Data_Assessment_TGA_RA1_2024-2.xlsm`

---

## 5. Features — Derivadas de las Macros VBA

### F01 — Gestion de Rubricas
**Origen Excel**: Hoja `RUBRIC` + hojas `RA1`–`RA5`, `SO6`, `SO7`

El lider configura la rubrica de cada SO/RA para el periodo. Cada rubrica contiene:
- Nombre y descripcion del SO/RA
- Hasta 15 PIs por SO, cada uno con:
  - Descripcion del PI
  - Descriptor de cada nivel: Poor, Inadequate, Adequate, Exemplary
  - **Peso porcentual del PI** (ej. PI1=30%, PI2=40%, PI3=15%, PI4=15%)
- Las rubricas se versionan por periodo academico
- Un SO puede tener rubricas distintas en distintos periodos

**Pre-carga de descriptores desde el RA seleccionado:**

Al crear la rubrica para un nuevo periodo, el sistema pre-carga automaticamente los descriptores del RA seleccionado desde la version mas reciente de esa rubrica (equivale al mecanismo dinamico de la hoja RUBRIC que jala descriptores de las hojas RA1–RA5). El lider puede editar, ajustar o clonar los descriptores antes de abrir el periodo — no parte de cero cada ciclo.

**Criterios de aceptacion:**
- El lider puede crear, editar y clonar rubricas entre periodos
- Al seleccionar un RA, el sistema pre-carga los descriptores de PI del periodo anterior de ese RA; si no existe periodo anterior, carga los descriptores base registrados en el sistema
- Cada PI activo tiene un peso porcentual asignable por el lider
- **La suma de los pesos de todos los PIs activos debe ser exactamente 100%** antes de poder guardar la rubrica; el sistema muestra el total acumulado en tiempo real y bloquea el guardado si el resultado no es 100% (equivale a `=SUM(B9:B14)` con validacion en RUBRIC!C15). Esta validacion se aplica tanto en el frontend como en la API (Pydantic validator), para que no sea bypasseable por un cliente malicioso
- Un PI puede activarse/desactivarse sin eliminarse; al desactivar un PI su peso queda en 0% y no se incluye en el calculo del Total Score
- No se puede editar una rubrica si el periodo ya esta cerrado
- El sistema no permite abrir un periodo cuya rubrica tenga pesos que no sumen 100%

---

### F02 — Registro de Informacion General del Modulo
**Origen Excel**: Hoja `EF_ASESSM_SO_GENERIC`, celdas B5, D5, D7, B8

El docente completa o confirma los datos de su modulo. Campos mapeados directamente del Excel:

| Campo | Celda Excel | Comportamiento en la app |
|---|---|---|
| Codigo / Nombre del curso | B5 | Pre-llenado desde la asignacion del periodo |
| Grupo | D5 | Pre-llenado desde la asignacion del periodo |
| Nombre del docente | D7 | Auto-completado desde el login (no editable) |
| Periodo academico | B8 | Auto-completado desde el periodo activo (no editable) |
| Total de estudiantes | calculado | Auto-calculado al guardar la lista de estudiantes |

**Criterios de aceptacion:**
- Si el docente tiene un solo modulo asignado, todos los campos se pre-llenan automaticamente
- El campo "Total de estudiantes" se auto-calcula al guardar la lista; el docente no lo escribe
- No se puede avanzar al F03 sin que curso y grupo esten confirmados
- El docente no puede editar campos auto-completados desde el sistema (docente, periodo)

---

### F03 — Registro de Calificaciones por Estudiante
**Origen Excel**: Hoja `EF_ASESSM_SO_GENERIC`, filas 15–81; hoja `STUDENTS LIST` columnas A–C

#### 3a. Estructura de la lista de estudiantes

Cada fila (estudiante) en el Excel tiene tres campos de identidad:

| Columna Excel | Campo | Descripcion |
|---|---|---|
| B (col 2) | ID interno | Identificador interno del sistema academico |
| C (col 3) | Numero de documento | Cedula o tarjeta de identidad |
| D (col 4) | Nombre completo | Apellidos y nombre |

La hoja `STUDENTS LIST` (A2:C38) es la fuente maestra de estudiantes del periodo; la hoja de evaluacion la referencia. En la app, esta separacion se mantiene como "lista de estudiantes del modulo" cargada antes de calificar.

#### 3b. Escala de calificacion: selector directo de nivel (4 opciones discretas)

El docente **no ingresa un numero**. Selecciona directamente uno de los cuatro niveles de la rubrica ABET para cada estudiante por PI. Esto es intencional: el proposito del assessment no es trasladar una nota de otra actividad sino que el docente evalue el desempeno del estudiante contra los descriptores de la rubrica — un ejercicio de reflexion y autoevaluacion del programa, no de calificacion.

| Nivel | Espanol | Valor interno | Accion derivada |
|---|---|---|---|
| Poor | Deficiente | 1 | Acciones correctivas |
| Inadequate | Insuficiente | 2 | Acciones preventivas |
| Adequate | Bueno | 3 | Acciones preventivas |
| Exemplary | Sobresaliente | 4 | Planes de mejora / mantenimiento |

**Valores intermedios o decimales no existen.** El sistema solo acepta una de las cuatro opciones. El valor interno (1–4) se usa exclusivamente para el calculo ponderado del Total Score; el docente nunca lo ve.

**UI de seleccion:** radio buttons o segmented control horizontal con los cuatro niveles etiquetados. Al seleccionar un nivel, el descriptor completo de ese nivel para ese PI aparece como tooltip o panel expandible para que el docente pueda confirmar que su seleccion corresponde al descriptor correcto de la rubrica.

> **Origen**: analisis de `Data_Assessment_TGA_RA1_2024-2.xlsm` confirma que la formula de nivel (`IF(score<2,"Poor", IF(score<=3,"Inadequate"...))`) solo produce resultados distintos para enteros {1, 2, 4, 5} en escala 1–5. La app consolida esto en 4 niveles discretos directamente seleccionables, eliminando la ambiguedad de que 2 y 3 produjeran el mismo nivel ABET.

#### 3c. Estructura de columnas por PI (hoja `EF_ASESSM_SO_GENERIC`)

Para cada PI, el Excel tiene un bloque de tres columnas. El docente **solo ingresa la columna Score**; las otras dos son formulas automaticas:

| PI | Col. Score (entrada docente) | Col. Level (auto) | Col. % (auto) |
|---|---|---|---|
| PI1 | I (Score PI1) | H (Level PI1) | J (% PI1) |
| PI2 | L (Score PI2) | K (Level PI2) | M (% PI2) |
| PI3 | O (Score PI3) | N (Level PI3) | P (% PI3) |
| PI4 | R (Score PI4) | Q (Level PI4) | S (% PI4) |
| PI5 | U (Score PI5) | T (Level PI5) | V (% PI5) |
| PI6 | X (Score PI6) | W (Level PI6) | Y (% PI6) |

Columnas calculadas por fila de estudiante (no editables por el docente):

| Columna | Campo | Formula |
|---|---|---|
| E | Total Score | Suma de todos los porcentajes por PI: `J+M+P+S+V+Y` |
| F | Overall Level | Nivel consolidado del estudiante (Poor/Inadequate/Adequate/Exemplary) |
| G | Standard | Estandar global: Low / Medium / High (derivado del Total Score) |

#### 3d. Sistema de pesos por PI

Cada PI tiene un peso porcentual (almacenado en fila 12: J12, M12, P12, S12, V12, Y12). El % de un PI = `Score_PI x peso_PI`. La app debe respetar estos pesos; el lider los configura en la rubrica al momento de crear el periodo.

#### 3e. Regla de completitud: todos los estudiantes activos deben estar calificados

Para poder enviar el modulo, **todos los estudiantes en estado activo deben tener los PIs activos calificados**. La completitud es total — no es suficiente con que haya al menos 1 estudiante calificado.

Si un estudiante no debe ser evaluado en el periodo (se retiro, nunca asistio, incapacidad), el docente no lo elimina — lo **excluye con motivo documentado**:

```
Accion en la fila del estudiante: [ ... ] → "Excluir del assessment"

Modal de confirmacion:
  ┌─────────────────────────────────────────────────┐
  │ Excluir a Garcia, Maria del assessment          │
  │                                                 │
  │ Motivo de exclusion:                            │
  │  ○ Se retiro del curso                          │
  │  ○ Nunca asistio                                │
  │  ○ Incapacidad / motivo medico                  │
  │  ○ Otro: [_________________________________]    │
  │                                                 │
  │  [ Cancelar ]        [ Confirmar exclusion ]    │
  └─────────────────────────────────────────────────┘
```

- El estudiante excluido no desaparece de la lista; queda en una seccion colapsada "Excluidos (N)" visible en la pantalla
- El motivo queda registrado en la BD y aparece en el reporte del modulo (trazabilidad para ABET)
- El docente puede re-incluir un estudiante excluido por error hasta antes del envio
- El indicador de progreso: `Activos: 31 | Calificados: 28 | Pendientes: 3 | Excluidos: 2`
- El boton "Confirmar y Enviar" solo se habilita cuando Activos = Calificados (cero pendientes)

#### 3f. Otros criterios de aceptacion

- El evaluador solo ve y edita los modulos que le estan asignados. **La API verifica en cada request de modulo que el usuario autenticado aparece en `module_staff`** (ver #16 — proteccion IDOR). Esto aplica igual para docentes y lideres asignados como evaluadores.
- El sistema calcula en tiempo real: Overall Level y Standard del estudiante al seleccionar el nivel de cada PI
- Se puede guardar como borrador y continuar despues
- Estudiantes pueden importarse desde CSV/Excel (formato: ID interno, N documento, nombre) o ingresarse manualmente. Ver #17 para especificacion de seguridad del parser
- Los campos Overall Level y Standard son de solo lectura para el docente

---

### F04 — Analisis Cualitativo por PI (nivel modulo — docente)
**Origen VBA**: Boton `Pegar_Analisis` / `CommandButton3` — pegaba texto libre en rango `Analisis_Pegar_N` (fila 79 de cada hoja `EF_ASESSM_SO#_CODIG_MODULO_N`)

El docente escribe su analisis de resultados para **cada PI de su modulo**. Este es el primer nivel de analisis requerido por ABET: la lectura del docente sobre el desempeno de sus propios estudiantes.

- Un campo de texto libre por PI activo (hasta 2000 caracteres)
- Se puede guardar independientemente de las calificaciones (borrador)
- El docente ve la distribucion porcentual de niveles de su modulo mientras escribe (ver F04b)

**Texto orientador (placeholder) en el campo de analisis:**

El campo de analisis no aparece vacio. Muestra un texto guia como placeholder que desaparece al comenzar a escribir:

```
Indique el analisis de los resultados encontrados en la medicion de este PI.
Considere: que porcentaje del grupo alcanzo suficiencia? Que factores
explican los resultados en los niveles Poor e Inadequate? Que aspectos
pedagogicos o curriculares se deben ajustar para el siguiente periodo?
```

Este prompt es configurable por el administrador del sistema (no por el docente). Su proposito es garantizar que el analisis sea una reflexion pedagogica real sobre los resultados, no una transcripcion de notas de otra actividad.

**Criterios de aceptacion:**
- El analisis es opcional en borrador pero **obligatorio** para marcar el modulo como "Completado"
- Si un PI tiene 0 estudiantes calificados, no se pide analisis para ese PI
- El texto orientador (placeholder) se muestra en todos los campos de analisis vacios
- El texto se preserva entre sesiones
- El lider puede leer el analisis de cada docente desde el dashboard y desde el reporte
- **El texto se sanitiza en la API antes de persistir**: se elimina todo HTML/JS mediante `bleach.clean()` con lista de tags permitidos vacia (ver #16). El analisis se almacena y se muestra siempre como texto plano; el renderer PDF/HTML escapa el contenido al generar el reporte

---

### F04b — Reporte de Distribucion por Modulo
**Origen VBA**: Mini-tabla en filas 53–62 de cada hoja `EF_ASESSM_SO#_CODIG_MODULO_N` — mostraba distribucion de niveles solo para ese modulo

Al terminar de calificar, el sistema muestra al docente (y al lider) la distribucion de niveles de **su modulo especifico**, separada del consolidado del periodo.

**La metrica primaria es el porcentaje del grupo**, no el conteo absoluto. ABET evalua la proporcion de estudiantes que alcanzaron suficiencia en cada PI, no el numero bruto. El conteo absoluto se muestra como dato secundario entre parentesis.

Equivalente a la formula del Excel: `=COUNTIF(H14:H53,"Poor") / COUNTA(H14:H53)`

```
Distribucion — Contabilidad I, Grupo A  (31 estudiantes activos)

PI   | Poor      | Inadequate | Adequate   | Exemplary  |
PI 1 | 6%  (2)   | 16%  (5)   | 58%  (18)  | 26%  (8)   |
PI 2 | 3%  (1)   | 10%  (3)   | 64%  (20)  | 29%  (9)   |
PI 3 | 10% (3)   | 23%  (7)   | 48%  (15)  | 26%  (8)   |
PI 4 | 0%  (0)   | 6%   (2)   | 71%  (22)  | 26%  (8)   |
```

Esta vista existe en dos contextos:
- Para el **docente**: visible en tiempo real durante la calificacion y como confirmacion antes del envio
- Para el **lider**: detalle por modulo accesible desde el dashboard (ABET puede solicitar resultados a nivel de modulo individual, no solo el consolidado)

**Criterios de aceptacion:**
- La distribucion se calcula en tiempo real mientras el docente ingresa calificaciones
- El denominador es siempre el numero de estudiantes activos (excluidos no cuentan)
- Los porcentajes suman 100% por fila de PI (tolerancia de redondeo +-1%)
- Es visible antes de enviar el modulo y permanece visible en modo lectura despues del cierre
- Exportable de forma independiente como parte del reporte de modulo individual

---

### F05 — Navegacion entre Modulos (Wizard)
**Origen VBA**: Boton `Next_Group` / `CommandButton4` — ocultaba hoja actual y mostraba la siguiente

Para el lider consolidador: vista de los modulos de su programa×RA con estado de completitud.
Para el docente: interfaz en pasos (stepper), **una instancia por cada RA** que el modulo debe medir en el cuatrimestre:

```
[ Info General ] → [ Calificaciones ] → [ Distribucion ] → [ Analisis ] → [ Enviar ]
```

**Paso Info General (docente):** ademas del curso y grupo, muestra **el RA de esta sesion**, el **lider consolidador** (nombre + correo `@unibarranquilla.edu.co` desde `users.email`) y nota de contacto para inquietudes. Si el modulo es multi-RA, el dashboard lista entradas separadas ("Calificar RA3", "Calificar RA5", etc.).

**Paso Enviar (docente):** cuando calificaciones y analisis estan completos, repite lider + correo y anade:
- Nombre del **lider consolidador** asignado a ese programa×RA (desde mapeo → `users`)
- **Correo institucional** del lider (`@unibarranquilla.edu.co`) junto al nombre
- Mensaje: *"Se recomienda enviar un correo a su lider consolidador informando que completo la medicion de este RA."*
- Boton o enlace `mailto:` opcional con asunto sugerido: `[RA Assessment] Medicion completada — {RA} — {modulo} — {grupo} — 2025-2`
- El envio en la app (boton Enviar) registra `completed` en el sistema; el correo al lider es **complementario** (v1 sin SMTP automatico), pero la UI lo facilita

**Criterios de aceptacion:**
- El docente puede navegar libremente entre pasos sin perder datos
- El paso "Enviar" esta deshabilitado hasta que todos los estudiantes activos tengan los PIs activos calificados y todos los analisis cualitativos esten escritos
- Tras enviar, el docente ve confirmacion con el nombre y correo del lider ya mostrados en el paso
- El enrutamiento al lider consolidador ocurre en backend; el docente no selecciona destinatario
- Modulo multi-RA: cada RA tiene su propio flujo Enviar con lider y correo distintos si el mapeo asi lo define
- El lider consolidador ve indicador por modulo×RA: `Pendiente | En progreso | Completado`

---

### F06 — Cierre y Finalizacion del Periodo
**Origen VBA**: Boton `Finalizar_Registros` / `CommandButton5` — ejecutaba `Eliminar_PIs`, `Eliminar_Consolidados`, `Eliminar_Columnas` y ocultaba todas las hojas de modulo

El lider cierra el periodo de captura:
- Solo el lider puede ejecutar el cierre
- Al cerrar: ningun docente puede modificar calificaciones
- El sistema valida que todos los modulos obligatorios esten en estado "Completado"
- Si hay modulos sin completar, muestra lista y permite forzar cierre con advertencia

**Criterios de aceptacion:**
- El cierre es reversible solo por el administrador
- Despues del cierre, los datos quedan en modo solo-lectura para docentes
- El lider puede reabrir un modulo individual sin reabrir todo el periodo
- La accion de cierre queda registrada en el security audit log con `user_id`, `period_id` y timestamp (ver #16 — logging estructurado)

---

### F07 — Generacion del Reporte Final (ABET)
**Origen VBA**: Hoja `FINAL_REPORT_ASESSMT_SO` + macros `Eliminar_PIs`, `Eliminar_Consolidados`, `Eliminar_Columnas`

El reporte final consolida todos los modulos del periodo. Tiene **tres secciones obligatorias para ABET**:

---

**Seccion 1 — Encabezado** (equivale a filas 1–23 del Excel)

Campos auto-completados por el sistema (eliminan la entrada manual del lider):
- SO/RA evaluado + descripcion completa
- Institucion y programa
- Periodo academico — antes: el lider lo escribia en celda D22
- Nombre del lider del SO — antes: el lider lo escribia en celda D23
- Tabla de modulos: Curso | Grupo | Docente | N Estudiantes (solo modulos con datos)

Los modulos con 0 estudiantes no aparecen — antes requeria ejecutar `Eliminar_Consolidados`.

---

**Seccion 2 — Distribucion de niveles por PI** (equivale a filas 27–190 del Excel)

Para cada PI activo (con al menos 1 estudiante calificado):
- Descripcion completa del PI y sus 4 niveles con descriptores
- Tabla de distribucion con **porcentaje como metrica primaria** y conteo absoluto entre parentesis, por nivel y por modulo
- Fila de totales consolidados: porcentaje agregado de todos los modulos combinados (ponderado por numero de estudiantes activos de cada modulo)
- Los PIs sin ningun dato no aparecen — antes requeria ejecutar `Eliminar_PIs`
- Las columnas de modulos sin datos no aparecen — antes requeria ejecutar `Eliminar_Columnas`

---

**Seccion 3 — Analisis por PI** (equivale a celdas `ANALYSIS PI N` del Excel — filas 65, 107, 149, 191)

Este es el **segundo nivel de analisis requerido por ABET**: la sintesis del lider sobre los resultados consolidados de todos los modulos para cada PI.

En la app, esto se reemplaza por una seccion estructurada donde el lider ve:
- El analisis que cada docente escribio para ese PI (F04, solo lectura)
- Un campo propio del lider por PI para escribir su sintesis consolidada

El campo del lider es **obligatorio** para poder exportar el reporte final. No es una observacion opcional: es el campo que ABET evalua para determinar si el programa tiene capacidad de analisis sobre sus propios resultados.

**Criterios de aceptacion:**
- El reporte se puede previsualizar en cualquier momento (no requiere cierre del periodo)
- La Seccion 3 solo esta disponible para edicion del lider; los docentes la ven en modo lectura
- El lider puede guardar borradores del analisis por PI y completarlo en multiples sesiones
- El reporte exportado a PDF mantiene la estructura del formato institucional existente
- El reporte exportado a Excel (.xlsx) mantiene compatibilidad con el formato `FINAL_REPORT_ASESSMT_SO`
- En el PDF/Excel exportado, la Seccion 3 muestra primero los analisis de cada docente (etiquetados por modulo) y luego la sintesis del lider, replicando la estructura del template original pero sin la friccion de escribir todo en una sola celda fusionada
- **El reporte exportado en .xlsx sanitiza todos los campos de texto provenientes de usuarios antes de escribirlos en celdas**: cualquier valor que empiece con `=`, `+`, `-`, `@`, `|` o `%` se prefija con un apostrofe (`'`) para prevenir Excel/CSV injection en el equipo del auditor ABET (ver #17)

---

**Seccion 4 — Plan de Accion (F11)**

Ver F11 mas abajo.

---

### F08 — Dashboard del Lider consolidador de RA
**Origen**: No existia en el Excel; compensaba revisando manualmente cada hoja y copiando informes entre archivos

Vista principal del **líder consolidador** (`leader`), filtrada por las combinaciones **programa × RA** asignadas a esa persona en el mapeo del cuatrimestre:

- Cuatrimestre activo (ej. `2025-2`) y RA(s) bajo su responsabilidad (ej. solo `Comercio Exterior · RA3`)
- Barra de progreso: X de Y módulos completados **para ese RA y programa**
- Tabla de módulos: estado | docente | progreso | acción **Revisar** (no Calificar)
- Botones: Ver reporte ABET (F07) | Guardar análisis del líder | Exportar informe (F14) | Enviar recordatorio (F13)
- El líder **no** ve módulos de RAs que no le fueron asignados, aunque pertenezcan al mismo programa

**Criterios de aceptación:**
- Un líder con varias asignaciones (ej. Jorly: RA3 en CE y TGLI) ve un selector o pestañas por programa×RA
- El dashboard muestra qué falta antes de poder cerrar el informe de ese RA

---

### F08b — Dashboard del Líder de medición (Administrador)
**Origen**: consolidación manual del informe ejecutivo por línea propedéutica

Vista principal del **líder de medición** (`admin`):

- Cuatrimestre activo (`2025-2`) con panorama de **las dos líneas propedéuticas**
- Por línea: programas incluidos, RAs medidos, estado de cada informe de líder consolidador (pendiente / en progreso / listo)
- Acción principal: **Generar informe ejecutivo de línea** (F17) cuando los informes por RA estén completos
- **Sin** botón Calificar; **sin** tabla masiva de todos los módulos sin contexto
- Acciones secundarias: carga masiva F15, reapertura F06, gestión de usuarios

---

### F09 — Gestion del ciclo de medicion (cuatrimestre)

El **ciclo de medicion** corresponde a **un cuatrimestre academico** (ej. `2025-2`). El archivo de mapeo `MODULOS {cuatrimestre} POR RESULTADOS DE APRENDIZAJE.xlsx` define todo el ciclo:

- Que programas participan
- Que RAs se miden por programa (subconjunto elegido por el decano)
- Que modulos (curso + grupo) aportan evidencia a cada RA
- Que docente califica cada modulo
- Que lider consolidador recibe cada combinacion programa × RA

La importacion del mapeo (F15 / `bulk-import`) crea o actualiza las asignaciones del cuatrimestre. Internamente cada **RA medido dentro de un programa** puede modelarse como un periodo de captura (ej. `2025-2 · Comercio Exterior · RA3`), siempre **dentro del mismo cuatrimestre** — no son cuatrimestres distintos.

**Criterios de aceptacion:**
- Un cuatrimestre puede clonarse del anterior para agilizar la configuracion del mapeo
- Al publicar el mapeo, cada docente y cada lider consolidador recibe visibilidad de sus asignaciones
- Un modulo multi-RA genera tantas asignaciones de evaluacion como RAs tenga marcados
- El sistema no permite activar un RA sin al menos 1 modulo con docente asignado

---

### F10 — Autenticacion y Control de Acceso

- Login con email institucional + contrasena
- **Dominio de correo obligatorio**: `@unibarranquilla.edu.co`. El email de login debe existir en `public.users.email` y coincidir con `auth.users.email`. Usado para: autenticacion, recuperacion de contraseña (B-00), enlaces `mailto:` al lider consolidador, notificaciones futuras (F13)
- JWT con expiracion de 8 horas (sesion de trabajo), almacenado en cookie httpOnly
- Roles: Admin | Lider | Docente; verificados en cada endpoint mediante dependencia FastAPI `require_role()`
- **Rate limiting en `/auth/login`**: maximo 5 intentos por IP por minuto (slowapi). Los intentos fallidos se registran en el security audit log para correlacion con fail2ban
- **Blocklist de tokens revocados**: al ejecutar `/auth/logout` el JTI del token se inserta en la tabla `revoked_tokens`. En cada request autenticado la API verifica que el JTI no esta revocado. La tabla se limpia automaticamente de entradas expiradas
- Un docente puede tener multiples modulos en distintos periodos
- El lider de un SO puede ser docente de otro SO simultaneamente
- Si las variables de entorno de Microsoft OIDC estan configuradas, el login muestra ademas el boton "Ingresar con cuenta institucional Microsoft" (ver F12)

---

### F11 — Registro del Plan de Accion (Closing the Loop)
**Origen Excel**: Hoja `Conversion` — columna `Decision` con tipo de accion por Standard

Este es el componente de **cierre del ciclo ABET**: una vez que el lider ha visto los resultados consolidados del periodo, debe documentar que accion concreta tomara el programa para cada PI en el siguiente ciclo. Sin este registro, el assessment queda como un ejercicio de medicion sin impacto curricular, lo que ABET penaliza explicitamente.

El sistema sugiere automaticamente el **tipo de accion** segun el Standard agregado del PI en el periodo:

| Standard del PI (consolidado) | Tipo de accion sugerida |
|---|---|
| Low (mayoria Poor) | Establecer y verificar planes de acciones correctivas |
| Medium (mayoria Adequate) | Establecer y verificar planes de acciones preventivas |
| High (mayoria Exemplary) | Establecer planes de mejora / mantener el estandar |

El lider registra, por cada PI del periodo:
- El tipo de accion (pre-seleccionado segun Standard, editable)
- La descripcion concreta de la accion: que cambio curricular, pedagogico o de recursos se implementara
- La fecha estimada de implementacion
- El responsable de la accion (puede ser el lider, un docente especifico, o el programa)

**Relacion con el reporte final:**

El Plan de Accion aparece como **Seccion 4** del reporte final exportado (PDF y Excel), despues del analisis del lider. Esta seccion cierra el ciclo ABET ante el auditor: los datos muestran los resultados, el analisis los interpreta, y el plan de accion documenta la respuesta del programa.

**Criterios de aceptacion:**
- El tipo de accion se sugiere automaticamente pero el lider puede cambiarlo
- La descripcion de la accion es texto libre (hasta 2000 caracteres) con placeholder orientador
- El plan de accion es editable despues del cierre del periodo (el programa puede actualizar el estado de implementacion)
- El sistema registra si una accion del periodo anterior fue marcada como implementada antes de abrir el nuevo periodo (historial de acciones)
- El campo es obligatorio para exportar el reporte final
- En el reporte exportado, la Seccion 4 muestra: PI | Standard | Tipo de accion | Descripcion | Responsable | Fecha estimada

---

### F12 — Autenticacion con Microsoft OpenID Connect (Nice-to-Have)

> Feature deseable pero no bloqueante: el sistema funciona completo sin F12. Si las variables de entorno de Azure AD no estan configuradas, el flujo nativo de F10 opera sin cambios y sin mensajes de error al usuario final.

Esta feature agrega Microsoft OIDC como segunda opcion de autenticacion en paralelo al login nativo (email + contrasena) de F10.

**Flujo dual de login:**

La pantalla de login muestra dos opciones:
- "Ingresar con cuenta institucional Microsoft" (solo visible si `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID` y `MICROSOFT_CLIENT_SECRET` estan configuradas)
- "Ingresar con email y contrasena" (siempre visible)

Si las variables de entorno no estan presentes, el boton de Microsoft no aparece; solo el admin ve una alerta en el panel de configuracion indicando que las credenciales OIDC no estan configuradas.

**Mapeo de cuentas Microsoft a roles:**

El admin asigna el rol manualmente en el primer login del usuario via Microsoft. El sistema no sincroniza roles desde grupos de Azure AD automaticamente en v1. Un usuario con cuenta Microsoft no registrado en el sistema recibe el mensaje: "Tu cuenta institucional no esta registrada en el sistema. Contacta al administrador del programa." — no puede acceder a ninguna feature hasta que el admin le asigne un rol.

**Responsabilidades de configuracion:**

La configuracion del tenant en Azure AD la realiza el administrador de Microsoft de la institucion; el equipo de desarrollo solo necesita recibir `client_id`, `tenant_id` y `client_secret` para completar la integracion.

El enlace que se incluye en correos de notificacion y recordatorio (F13) es siempre la URL de login de la aplicacion. No se implementan magic links ni enlaces de sesion autenticada en v1.

**Requerimientos de seguridad — Google Cloud WAF:**

- **Security by Design (A):** el flujo OIDC valida el `id_token` recibido de Microsoft (firma criptografica, campos `iss`, `aud`, `exp`) antes de crear la sesion interna. Ningun campo del token se usa sin verificacion previa.
- **Zero Trust (B):** aunque el usuario se autentique via Microsoft, el JWT interno de la app mantiene expiracion de 8 horas y JTI blocklist. La validez de la sesion Microsoft no se hereda sin verificacion continua.
- El `client_secret` de Azure AD se almacena en `.env` (permisos `600`), nunca en el repositorio. Se documenta junto a `SECRET_KEY` y `GMAIL_APP_PASSWORD` como variable sensible en la guia de operaciones.
- **Shift-Left (C):** `authlib` se agrega a `requirements.in` y se somete a `pip-audit` en el pipeline de deploy igual que el resto de dependencias.
- **Preemptive Cyber Defense (D):** registrar en `security_events` los eventos: `oidc_login_success`, `oidc_login_failed`, `oidc_account_not_registered`, con user_id (cuando aplique), IP y timestamp.

**Impacto en modelo de datos (#7):**

```sql
-- Nuevas columnas en tabla users
ALTER TABLE users ADD COLUMN microsoft_oid VARCHAR(255) UNIQUE NULLABLE;
-- Almacena el object ID del usuario en Azure AD para vincular cuentas
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
-- Valores: 'local' | 'microsoft'
```

**Nuevas variables de entorno:**

```bash
MICROSOFT_CLIENT_ID=<desde Azure AD>
MICROSOFT_CLIENT_SECRET=<desde Azure AD>
MICROSOFT_TENANT_ID=<desde Azure AD>
# Si estas variables no estan presentes, el boton de Microsoft no aparece en la UI
```

**Criterios de aceptacion:**
- Con las tres variables de entorno configuradas, el boton "Ingresar con cuenta institucional Microsoft" aparece en la pantalla de login.
- Sin las variables configuradas, el boton no aparece y la autenticacion local funciona sin cambios.
- Un usuario que se autentica por Microsoft por primera vez queda en estado "pendiente de rol"; no puede acceder a ninguna feature hasta que el admin le asigne un rol.
- El flujo OIDC completo (redirect a Microsoft, callback, validacion del token, creacion de sesion) se completa en menos de 3 segundos en condiciones normales de red.

---

### F13 — Seguimiento y Notificacion de Docentes Pendientes

Esta feature permite al lider de programa hacer seguimiento en tiempo real de que docentes no han completado su evaluacion en el periodo activo, y enviar correos de recordatorio desde la misma interfaz.

**Vista de metricas por docente:**

Accesible desde el dashboard del lider (F08). Columnas: Modulo | Grupo | Docente | Estado (Pendiente / En progreso / Completado) | Ultimo acceso | Dias restantes al cierre | Estudiantes calificados / total activos | % de avance.

**Seleccion y envio de recordatorios:**

El lider puede seleccionar uno, varios o todos los docentes con modulos en estado Pendiente o En progreso mediante checkboxes. La opcion "Seleccionar todos los pendientes" marca automaticamente los docentes con modulos no completados.

El lider redacta el mensaje de recordatorio en un campo de texto. El sistema pre-llena una plantilla editable con: saludo nominal al docente (`{nombre_docente}`), nombre del modulo pendiente (`{modulo}`), porcentaje de avance actual (`{avance_pct}`), dias restantes (`{dias_restantes}`) y enlace a la pagina de login de la aplicacion.

El lider previsualiza el correo antes de enviar, con las variables ya resueltas para el primer destinatario seleccionado. Los correos se envian usando la cuenta Gmail generica ya configurada en el stack (SMTP relay / Gmail App Password, #9).

**Requerimientos de seguridad — Google Cloud WAF:**

- **Security by Design (A) — throttle anti-spam:** la API no permite enviar correos a mas de 15 docentes en menos de 60 segundos. Si se supera el limite, devuelve `429 Too Many Requests` y registra el intento en `security_events` con severidad WARN.
- **Security by Design (A) — destinatarios validos:** la API solo acepta como destinatarios emails que existan en la tabla `users` con asignacion activa en el periodo. Rechaza cualquier direccion externa, previniendo open relay accidental.
- **Zero Trust (B):** solo roles Lider y Admin acceden a los endpoints de esta feature. Un docente no puede ver las metricas de otros docentes ni enviar correos.
- **Preemptive Cyber Defense (D):** cada envio queda registrado en `security_events` con evento `reminder_sent`, incluyendo: `user_id` del lider, lista de `recipient_ids` (IDs internos, no emails en el log), `period_id` y timestamp.

**Nuevos endpoints (#8) — grupo NOTIFICATIONS:**

```
GET  /periods/{period_id}/tracking           -- roles: Admin, Lider
                                             -- devuelve metricas por docente del periodo
POST /periods/{period_id}/reminders          -- roles: Admin, Lider
                                             -- rate-limited: 15 destinatarios / 60 s por usuario
GET  /periods/{period_id}/reminders/preview  -- roles: Admin, Lider
                                             -- previsualiza correo resolviendo variables del primer destinatario
```

**Impacto en modelo de datos (#7):**

```sql
-- Historial de recordatorios enviados
CREATE TABLE reminder_log (
    id            SERIAL PRIMARY KEY,
    period_id     INT NOT NULL REFERENCES periods(id),
    sent_by       INT NOT NULL REFERENCES users(id),
    recipient_ids JSONB NOT NULL,   -- lista de user_ids destinatarios
    message_body  TEXT NOT NULL,    -- texto enviado (sin resolver variables)
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Criterios de aceptacion:**
- El lider puede enviar recordatorios solo a docentes con modulos en el periodo activo; la API rechaza recipient_ids fuera del periodo.
- El correo llega al docente con las variables correctamente resueltas para su nombre y modulo especifico.
- El historial de recordatorios enviados es visible para el lider en la vista de seguimiento (fecha, destinatarios, extracto del mensaje).
- El enlace en el correo apunta a la URL de login de la aplicacion (no a un magic link).

---

### F14 — Informe del Lider (PDF editable y regenerable desde la web)

Esta feature permite al lider generar un informe de conclusiones basado en los analisis de los docentes y las metricas consolidadas del periodo. Este informe es **distinto del reporte ABET de F07**: es el documento de reflexion del lider, regenerable libremente, no el reporte formal de acreditacion.

**Requerimientos funcionales:**

- El lider accede al informe desde el dashboard (F08) o desde el menu del periodo activo.
- La pantalla muestra, por cada PI activo: la distribucion de niveles del modulo (F04b), los analisis cualitativos de cada docente (F04, solo lectura, etiquetados por modulo), y un campo de texto editable para las conclusiones del lider.
- Los campos de conclusiones se guardan automaticamente como borrador entre sesiones (autosave por campo con debounce de 2 segundos).
- El lider puede generar el informe en **PDF** (WeasyPrint, ya en el stack) y en **DOCX** (python-docx, a agregar). Justificacion de consumo de recursos: ambos formatos son comparables en uso de CPU (~50 ms para un informe tipico de 5 PIs); se recomienda **PDF como predeterminado** por ser inmutable, no requerir licencia de software en el equipo del auditor y ser identico en cualquier sistema operativo.
- El lider puede regenerar el documento sin limite de veces. Cada generacion produce un archivo con timestamp en el nombre: `informe-lider-{periodo}-{YYYYMMDD-HHmmss}.pdf`.
- El boton "Generar informe" esta disponible en cualquier estado del periodo (no requiere cierre previo).
- El documento incluye: encabezado institucional, periodo, SO/RA evaluado, tabla de metricas consolidadas por PI (distribucion de niveles ponderada por modulo), analisis por docente (etiquetados por modulo), conclusiones del lider por PI, y fecha y hora de generacion.

**Requerimientos de seguridad — Google Cloud WAF:**

- **Security by Design (A) — sanitizacion:** todos los campos de texto del informe (conclusiones del lider y analisis de docentes) se sanitizan con `bleach.clean()` antes de renderizarse en PDF/DOCX, identico al control de F04 y F07.
- **Security by Design (A) — DOCX injection:** aplicar `safe_cell_value()` a cualquier campo de datos de usuarios escrito en el DOCX. Un campo que comience con `=`, `+`, `-`, `@`, `|` o `%` se prefija con apostrofe para prevenir ejecucion de formula si el auditor abre el archivo en Word.
- **Shift-Left (C):** `python-docx` se agrega a `requirements.in` y se somete a `pip-audit` en el pipeline de deploy.
- **Preemptive Cyber Defense (D):** registrar en `security_events` el evento `leader_report_generated` con `user_id`, `period_id`, `format` ('pdf' | 'docx') y timestamp en cada generacion.
- **Zero Trust (B):** solo roles Admin y Lider acceden a los endpoints de generacion y edicion. Los docentes no acceden a este informe en v1 (documentar como restriccion para v2).

**Nuevos endpoints (#8) — grupo LEADER REPORT:**

```
GET  /periods/{period_id}/leader-report       -- roles: Admin, Lider; devuelve borrador actual con metricas
PUT  /periods/{period_id}/leader-report       -- roles: Admin, Lider; guarda conclusiones por PI
GET  /periods/{period_id}/leader-report/pdf   -- roles: Admin, Lider; genera y descarga PDF
GET  /periods/{period_id}/leader-report/docx  -- roles: Admin, Lider; genera y descarga DOCX
                                              -- registra leader_report_generated en audit log
```

**Impacto en modelo de datos (#7):**

```sql
-- Borradores de conclusiones del lider por periodo
CREATE TABLE leader_report_drafts (
    id             SERIAL PRIMARY KEY,
    period_id      INT NOT NULL UNIQUE REFERENCES periods(id),
    pi_conclusions JSONB NOT NULL DEFAULT '{}',
    -- Estructura: { "pi_id_1": "texto conclusion", "pi_id_2": "texto conclusion" }
    last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     INT NOT NULL REFERENCES users(id)
);
```

**Criterios de aceptacion:**
- El lider puede editar conclusiones en la web y descargar el PDF en la misma sesion sin recargar la pagina.
- Dos descargas consecutivas del mismo periodo con el mismo contenido producen archivos identicos en contenido pero con timestamps distintos en el nombre.
- El PDF generado usa la misma plantilla institucional que el reporte ABET (F07).
- El DOCX no contiene macros ni formulas ejecutables.

---

### F15 — Carga Masiva por CSV/Excel y Creacion Individual (Administrador)

Esta feature permite al administrador cargar la configuracion inicial del sistema mediante archivos CSV o Excel, y tambien crear los mismos registros individualmente desde la UI. El objetivo es eliminar la configuracion manual registro por registro al inicio de cada ciclo academico.

**Entidades con soporte de carga masiva Y creacion individual:**

**a) Rubricas** — una fila por PI:

Columnas: `SO_codigo | SO_descripcion | PI_codigo | PI_descripcion | Poor_descriptor | Inadequate_descriptor | Adequate_descriptor | Exemplary_descriptor | peso_pct`

Validacion adicional de negocio: la suma de `peso_pct` de todos los PIs del mismo SO debe ser exactamente 100. Si no lo es, se rechaza el lote completo de ese SO con mensaje: "Los PIs del SO [codigo] suman [N]%, se requiere exactamente 100%."

**b) Usuarios (docentes y lideres)** — una fila por usuario:

Columnas: `nombre_completo | email_institucional | rol | programa`

Valores validos de `rol`: `admin | lider | docente`. Al importar, se crea la cuenta con contrasena temporal autogenerada y se envia correo de activacion al email del usuario.

**c) Modulos y asignaciones de un periodo** — una fila por modulo:

Columnas: `period_id | curso_codigo | curso_nombre | grupo | docente_email`

Validacion: `docente_email` debe existir en `users`. Si no existe, la fila se rechaza con mensaje: "Docente no registrado: [email]."

**d) Estudiantes por modulo** — una fila por estudiante:

Columnas: `ID_interno | numero_documento | nombre_completo | modulo_id`

Aplica la misma validacion de documento unico por modulo de F03: si `numero_documento` ya existe en ese modulo, se actualiza el registro (upsert).

**Comportamiento ante errores — procesamiento parcial:**

El sistema no aborta el lote ante un error. Procesa todas las filas validas e informa un reporte de errores fila por fila. Respuesta de la API: `HTTP 207 Multi-Status` con estructura:

```json
{
  "imported": 42,
  "failed": 3,
  "errors": [
    { "row": 5,  "field": "peso_pct", "reason": "Los PIs del SO RA1 suman 95%, se requiere 100%" },
    { "row": 12, "field": "email",    "reason": "Docente no registrado: juan@ejemplo.edu" },
    { "row": 18, "field": "nombre_completo", "reason": "Caracter no permitido en el nombre" }
  ]
}
```

El admin puede corregir solo las filas fallidas y volver a importar sin duplicar las exitosas (upsert por clave natural: `email` para usuarios, `document_number + module_id` para estudiantes, `SO_codigo + PI_codigo` para rubricas).

**Plantillas de ejemplo descargables:**

El panel de admin incluye un boton "Descargar plantilla" por entidad. Las plantillas son archivos CSV con encabezados en la primera fila y una fila de ejemplo. Las plantillas se sirven como archivos estaticos desde el servidor, versionadas en el repositorio bajo `/static/templates/`. No se generan dinamicamente. Nombres de archivos: `template_rubricas.csv`, `template_usuarios.csv`, `template_modulos.csv`, `template_estudiantes.csv`.

**Requerimientos de seguridad — Google Cloud WAF:**

- **Security by Design (A) — parser defensivo:** aplicar todos los controles del parser de F03 (#17): limite de 2 MB por archivo, encoding UTF-8 estricto (error en encoding invalido), validacion regex campo por campo (`SAFE_NAME_RE`, `SAFE_ID_RE`, `SAFE_DOC_RE`), rechazo de prefijos de formula (`=`, `+`, `-`, `@`, `|`, `%`), `openpyxl.load_workbook(read_only=True, data_only=True)` para archivos XLSX.
- **Security by Design (A) — validaciones en API:** todas las validaciones de negocio (suma de pesos = 100, email unico, documento unico por modulo) se implementan en validadores Pydantic. Un cliente que bypasee el JavaScript de validacion recibe `422 Unprocessable Entity`.
- **Security by Design (A) — consentimiento de privacidad:** la carga masiva de estudiantes (datos personales: cedula, nombre) requiere que el admin confirme interactivamente que los datos fueron recopilados con consentimiento informado. Campo `consent_acknowledged: bool` obligatorio en el request body del endpoint de importacion de estudiantes; si es `false`, la API devuelve `400 Bad Request` con mensaje: "Debe confirmar que los datos fueron recopilados con consentimiento informado (Ley 1581/2012)."
- **Zero Trust (B):** todos los endpoints de F15 requieren rol Admin exclusivamente. Un Lider no puede importar rubricas, usuarios ni modulos aunque tenga acceso al sistema.
- **Shift-Left (C):** los parsers de carga masiva se incluyen explicitamente en el scope de Bandit en el pre-commit hook, dado que son la superficie de ataque mas amplia del sistema.
- **Preemptive Cyber Defense (D):** registrar en `security_events` los eventos: `bulk_import_rubrics` (count, admin_id), `bulk_import_users` (count, admin_id), `bulk_import_modules` (count, period_id, admin_id), `bulk_import_students` (count, module_id, admin_id). Los errores de importacion tambien se registran con severidad WARN.
- **Ley 1581/2012:** la importacion masiva de estudiantes activa el mismo registro de trazabilidad que la importacion individual de F03. El evento `student_imported` en `security_events` incluye `module_id`, `count` y confirmacion de `consent_acknowledged: true`.

**Nuevos endpoints (#8) — grupo ADMIN BULK:**

```
POST /admin/bulk/rubrics          -- roles: Admin; importa rubricas desde CSV/XLSX
POST /admin/bulk/users            -- roles: Admin; importa usuarios desde CSV/XLSX
POST /admin/bulk/modules          -- roles: Admin; importa modulos/asignaciones desde CSV/XLSX
POST /admin/bulk/students         -- roles: Admin; importa estudiantes (requiere consent_acknowledged)

GET  /admin/rubrics               -- roles: Admin; lista rubricas registradas
POST /admin/rubrics               -- roles: Admin; crea rubrica individual
PUT  /admin/rubrics/{id}          -- roles: Admin; edita rubrica individual

GET  /admin/users                 -- roles: Admin; lista usuarios
POST /admin/users                 -- roles: Admin; crea usuario individual
PUT  /admin/users/{id}            -- roles: Admin; edita usuario individual

GET  /admin/modules               -- roles: Admin; lista modulos de un periodo
POST /admin/modules               -- roles: Admin; crea modulo individual
PUT  /admin/modules/{id}          -- roles: Admin; edita modulo individual

GET  /admin/templates/{entity}    -- roles: Admin; descarga plantilla CSV
                                  -- {entity}: rubrics | users | modules | students
```

**Criterios de aceptacion:**
- El admin puede completar la configuracion de un periodo completo (rubricas, usuarios, modulos, estudiantes) importando cuatro archivos CSV sin intervenir fila por fila.
- El reporte de errores es suficientemente descriptivo para que el admin corrija el CSV sin necesidad de soporte tecnico.
- La importacion de 100 estudiantes se completa en menos de 3 segundos.
- Los formularios de creacion individual tienen las mismas validaciones que la importacion masiva; no es posible crear un registro invalido por ninguna de las dos vias.

---

### F16 — Capa de Integracion de Datos (Ports & Adapters)

> **Sprint**: S2 (contracts.py + sync_service.py); S5 (file_adapter.py — refactor de parsers de F15); S7 condicional (oracle_adapter.py — ver prerequisitos).

Esta feature formaliza el patron de ingesta de datos externos como **Ports & Adapters** (Hexagonal Architecture). Reemplaza la dependencia directa de cualquier fuente de datos especifica (CSV, Oracle, REST) con un contrato unico (`SyncPayload`) que el backend consume independientemente del origen.

**Motivacion**: el SIS Academusoft de la IUB corre sobre Oracle. En el mediano plazo, la carga manual de CSV de F15 debe poder reemplazarse con sincronizacion directa sin cambiar ninguna linea del backend de assessment. La capa de integracion hace explicita la distincion entre datos de app (calificaciones, analisis, rubricas — propios del sistema) y datos de matricula (estudiantes, modulos, docentes — provenientes del SIS).

**Estructura de la capa de integracion:**

```
src/integration/
  contracts.py          -- SyncPayload — contrato universal sin dependencias externas
  sync_service.py       -- SyncService — puerto de entrada; valida y persiste en PostgreSQL
  adapters/
    file_adapter.py     -- CSV/Excel → SyncPayload (refactoriza parser de F15, S5)
    oracle_adapter.py   -- Academusoft Oracle → SyncPayload (condicional, S7)
    rest_adapter.py     -- Template para SIS REST futuro (estructura ahora, codigo S7+)
```

**Contrato central (`SyncPayload`):**

```python
class SyncPayload(BaseModel):
    periodo_codigo: str
    docentes: List[DocenteRecord]
    modulos: List[ModuloRecord]
    estudiantes: List[EstudianteRecord]
    source: str  # 'academusoft' | 'csv' | 'rest' | 'manual'
    consent_acknowledged: bool = False  # Ley 1581/2012 — obligatorio para estudiantes
```

**Nuevos endpoints — grupo SYNC (Admin exclusivo):**

```
POST /admin/sync/preview   -- valida SyncPayload sin persistir; retorna errores y conteos
POST /admin/sync/apply     -- aplica el SyncPayload (upsert) + registra sync_applied en security_events
GET  /admin/sync/log       -- historial de sincronizaciones (fuente, fecha, conteos, admin_id)
```

**Trazabilidad en el modelo de datos:**

- `users.pege_id VARCHAR(50) UNIQUE NULLABLE` — ID del docente en el SIS Academusoft; permite mapear el registro en el sistema con el registro en Oracle.
- `oracle_sync_log` — tabla de auditoria de todas las sincronizaciones (timestamp, source, periodo_codigo, counts, admin_id, detail JSONB).

**Prerequisitos para `oracle_adapter.py`** (bloquean S7 — no bloquean S2 ni S5):

1. Schema Oracle confirmado por DBA de la IUB (mapeo de columnas Academusoft → campos SyncPayload).
2. Entorno Oracle de prueba disponible para CI (datos sinteticos, sin afectar produccion).
3. Concepto juridico de Ley 1581/2012 del area juridica de la IUB para la extraccion automatica masiva de datos personales de estudiantes desde Oracle.

---

### F17 — Reporte Ejecutivo por Línea Propedéutica (Institucional)

> **Sprint**: MVP+ (prioridad alta para demo ante facultad). La estructura de datos se modela en v1; UI pendiente en frontend Supabase.  
> **Responsable principal**: rol `admin` (Líder de medición). El Decano define qué RAs se miden; el líder de medición consolida el ejecutivo.

Esta feature permite generar un **resumen ejecutivo de Resultados de Aprendizaje agregado por Línea Propedéutica** dentro de un cuatrimestre — reemplazando el copy-paste manual de informes de RA en un Excel maestro.

**Prerequisito:** todos los informes de líder consolidador (F07/F14) de los RAs medidos en los programas de esa línea deben estar completos o el dashboard debe indicar cuáles faltan.

**Líneas propedéuticas operativas 2025-2** (según mapeo institucional):

| Línea (hoja Excel) | Programas | Informe ejecutivo |
|---|---|---|
| **CE — TGLI — ANI** | Comercio Exterior, TG Logística Internacional, Adm. Negocios Internacionales | 1 PDF por cuatrimestre |
| **TGA — INE** | TG Administrativa, Inteligencia de Negocios | 1 PDF por cuatrimestre |

**Contexto institucional ampliado** (otras líneas futuras):

| Línea | Ciclo Técnico | Ciclo Tecnológico | Ciclo Profesional |
|---|---|---|---|
| **Informática/Telecomunicaciones** | Técnico en Telecomunicaciones | Tecnología en Telemática | Ingeniería Telemática |
| **Gestión / Negocios** | Comercio Exterior (CTP) | TGA, TGLI, etc. | Adm. Negocios Int., Inteligencia de Negocios |

El alcance es **institucional** — no limitado a una sola facultad. Cada programa tiene sus propios RAs; el informe ejecutivo agrega los RAs **medidos en ese cuatrimestre** entre programas de la misma línea.

**Jerarquía de datos (modelada en v1, UI en v2):**

```
propedeutic_lines          -- Línea A: Informática/Telecom | Línea B: Gestión Administrativa
  └── programs             -- TGA, TGLI, Ingeniería Telemática, etc.
        └── student_outcomes  -- RA1, RA2, … (FK program_id opcional en v1)
              └── periods   -- Período académico (FK program_id opcional en v1)
```

**Nuevos endpoints — grupo PROPEDEUTIC (Admin y Líder, solo lectura):**

```
GET  /propedeutic-lines                    -- Lista todas las líneas propedéuticas
GET  /propedeutic-lines/{id}/programs      -- Programas de una línea con métricas de períodos
GET  /propedeutic-lines/{id}/summary       -- JSON con indicadores agregados por programa
GET  /propedeutic-lines/{id}/report/pdf    -- PDF exportable del resumen ejecutivo institucional
```

**Contenido del resumen ejecutivo (por programa dentro de la línea):**

- Nombre del programa y ciclo (Técnico / Tecnológico / Profesional)
- Número de períodos cerrados en el sistema
- Por SO evaluado: distribución de niveles (Poor/Inadequate/Adequate/Exemplary) como % del total de estudiantes activos
- Estado de cumplimiento del plan de acción del último período cerrado
- Tendencia entre períodos (si hay ≥2 períodos cerrados para ese SO)

**Criterios de aceptación:**

- El endpoint `/summary` devuelve datos solo de períodos con `status = 'closed'`; no expone calificaciones individuales de estudiantes (privacidad por diseño — Ley 1581/2012)
- El PDF sigue la plantilla institucional IUB (DG-TSI-09-V4)
- Si un programa no tiene períodos cerrados en el sistema, aparece en la lista con `periods_closed: 0` y métricas vacías
- El acceso requiere rol `admin` o `leader`; un `teacher` recibe `403 Forbidden`
- Se registra `institutional_report_generated` en `security_events` con `user_id`, `propedeutic_line_id` y `timestamp`

**Controles de seguridad:**

- **Zero Trust**: los datos de estudiantes individuales **no** se exponen en ningún endpoint de F17; solo agregados
- **Audit log**: cada generación de PDF queda en `security_events`
- **safe_cell_value()** si en algún futuro se exporta a XLSX (prevención de inyección de fórmulas)

**Requerimientos de seguridad — Google Cloud WAF:**

- **Security by Design (A):** `SyncService` valida el payload completo antes de escribir; ningun adaptador puede bypassear las validaciones de negocio.
- **Ley 1581/2012 (E):** `consent_acknowledged: true` en `SyncPayload` es el unico punto de control de privacidad para datos de estudiantes, independientemente de la fuente (CSV manual u Oracle automatico). `SyncService` rechaza con `400 Bad Request` si es `false` y hay estudiantes en el payload.
- **Preemptive Cyber Defense (D):** evento `sync_applied` en `security_events` con `source`, `periodo_codigo`, `counts` y `admin_id`. Todas las sincronizaciones quedan registradas en `oracle_sync_log` con su fuente de origen.
- `oracle_adapter.py` opera en modo degradado si `ORACLE_DSN` no esta configurado: retorna error descriptivo sin afectar la disponibilidad del resto del sistema.

**Criterios de aceptacion:**

- El mismo `SyncPayload` producido por `file_adapter.py` y por `oracle_adapter.py` produce registros identicos en PostgreSQL.
- `POST /admin/sync/preview` retorna errores descriptivos por registro sin modificar la DB.
- `oracle_adapter.py` esta deshabilitado si `ORACLE_DSN` no esta configurado como variable de entorno.
- El Admin puede ver el historial de sincronizaciones con fuente, fecha y conteos desde `GET /admin/sync/log`.

---

## 6. Flujo Principal de Uso

```
LIDER — Apertura del periodo:
  Crear Periodo → Configurar Rubrica → Asignar Modulos/Docentes → Abrir Periodo
  (Alternativa: cargar configuracion completa via CSV con F15)

DOCENTE (por cada modulo asignado):
  Login → Ver modulo pendiente → Confirmar Info General →
  Ingresar/importar Lista de Estudiantes → Excluir estudiantes no evaluables (con motivo) →
  Calificar por PI (Poor / Inadequate / Adequate / Exemplary) →
  Ver distribucion de su modulo (F04b) →
  Escribir Analisis por PI [nivel 1 ABET: analisis del docente] →
  Enviar modulo

LIDER (durante el periodo):
  Ver Dashboard → Ver avance por modulo (F13) →
  Enviar recordatorios a docentes pendientes (F13) →
  Leer analisis de cada docente →
  Previsualizar reporte consolidado en tiempo real →
  Generar informe de conclusiones (F14) en cualquier momento

LIDER (al cierre):
  Verificar modulos completos → Cerrar Periodo →
  Escribir Sintesis por PI [nivel 2 ABET: analisis del lider] →
  Registrar Plan de Accion por PI [F11: closing the loop ABET] →
  Revisar reporte final completo (4 secciones) → Exportar PDF/Excel (F07)
```

---

## 7. Modelo de Datos (PostgreSQL)

```sql
-- Entidades principales

periods          -- Periodos academicos (TGA RA1 2024-2)
student_outcomes -- RA/SO con descripcion
rubrics          -- Version de rubrica por periodo

perf_indicators  -- PIs de cada rubrica (hasta 15 por SO)
                 -- Incluye: descripcion, peso porcentual (pi_weight NUMERIC 0-100)
                 -- Origen: columnas J12/M12/P12/S12/V12/Y12 de EF_ASESSM_SO_GENERIC

pi_levels        -- Descriptores de los 4 niveles por PI (Poor/Inadequate/Adequate/Exemplary)
                 -- Incluye: nivel (1-4), etiqueta, descripcion del desempeno esperado

level_thresholds -- Umbrales de corte score→nivel por rubrica (configurables por el lider)
                 -- Origen: RUBRIC sheet ($I$6,$I$7,$I$8) y hoja Conversion
                 -- Defecto: Poor≤2.0, Inadequate≤3.0, Adequate≤4.0, Exemplary≤5.0

modules          -- Curso-grupo asignado a un periodo (hasta 15 por periodo)
users            -- Docentes y lideres
                 -- Columnas nuevas en v2.1:
                 --   microsoft_oid VARCHAR(255) UNIQUE NULLABLE (object ID de Azure AD)
                 --   auth_provider VARCHAR(20) NOT NULL DEFAULT 'local' ('local' | 'microsoft')
                 -- Columna nueva en F16:
                 --   pege_id VARCHAR(50) UNIQUE NULLABLE (ID del docente en SIS Academusoft)
module_staff     -- Evaluador(es) asignado(s) a cada modulo; puede incluir docentes y lideres

students         -- Estudiantes (ID interno, N documento, nombre completo)
                 -- Origen: hoja STUDENTS LIST columnas A-C de Data_Assessment
module_students  -- Estudiantes matriculados en un modulo especifico

assessments      -- Calificacion: module_student x perf_indicator → level INTEGER 1-4
                 -- 1=Poor, 2=Inadequate, 3=Adequate, 4=Exemplary (seleccion directa, sin decimales)
                 -- Campos calculados por la API (no en DB): pi_percentage, total_score, standard
                 -- Origen: celdas I/L/O/R/U/X (filas 15-81) de EF_ASESSM_SO_GENERIC

student_exclusions -- Estudiantes excluidos de un modulo especifico
                   -- Campos: module_student_id, reason_code, reason_text, excluded_by, excluded_at
                   -- reason_code: 'withdrew' | 'never_attended' | 'medical' | 'other'

-- Dos tablas de analisis separadas (dos niveles distintos, ambos requeridos por ABET):
module_analysis  -- Analisis del DOCENTE: modulo x PI → texto libre (hasta 2000 chars)
                 -- Obligatorio para que el modulo quede en estado "Completado"
                 -- El texto se sanitiza (bleach) antes de persistir

leader_analysis  -- Analisis del LIDER: periodo x PI → texto libre
                 -- Obligatorio para poder exportar el reporte final

action_plans     -- Plan de accion del LIDER: periodo x PI → tipo de accion + descripcion + responsable + fecha
                 -- Tipos: 'corrective' | 'preventive' | 'improvement'
                 -- Obligatorio para poder exportar el reporte final (Seccion 4)

reports          -- Metadatos del reporte exportado (snapshot del estado al momento de exportar)

-- Tablas de seguridad:
revoked_tokens   -- JTI de tokens revocados al hacer logout
                 -- Campos: jti UUID PK, expires_at TIMESTAMPTZ
                 -- Job periodico: DELETE FROM revoked_tokens WHERE expires_at < NOW()

security_events  -- Audit log de eventos de seguridad (append-only)
                 -- Campos: id, ts TIMESTAMPTZ, event VARCHAR, user_id INT, ip INET,
                 --          severity VARCHAR, detail JSONB
                 -- Eventos base: login_success | login_failed | login_rate_limited |
                 --   access_denied | period_closed | report_exported |
                 --   student_imported | password_changed | habeas_data_accessed
                 -- Eventos nuevos en v2.1: oidc_login_success | oidc_login_failed |
                 --   oidc_account_not_registered | reminder_sent | leader_report_generated |
                 --   bulk_import_rubrics | bulk_import_users | bulk_import_modules |
                 --   bulk_import_students

-- Tablas nuevas en v2.1:
reminder_log     -- Historial de recordatorios enviados por el lider (F13)
                 -- Campos: id, period_id, sent_by, recipient_ids JSONB,
                 --          message_body TEXT, sent_at TIMESTAMPTZ

leader_report_drafts  -- Borradores de conclusiones del lider por periodo (F14)
                      -- Campos: id, period_id UNIQUE, pi_conclusions JSONB,
                      --          last_updated TIMESTAMPTZ, updated_by INT

-- Tabla nueva en F16:
oracle_sync_log  -- Auditoria de sincronizaciones via SyncService (F16 Ports & Adapters)
                 -- Campos: id, ts TIMESTAMPTZ, source VARCHAR ('csv'|'academusoft'|'rest'|'manual'),
                 --          periodo_codigo VARCHAR, docentes_count INT, modulos_count INT,
                 --          estudiantes_count INT, admin_id INT FK, detail JSONB
                 -- Trazabilidad Ley 1581: el campo source permite responder de que sistema
                 --   provienen los datos del titular ante una solicitud habeas data.
```

---

## 8. API REST — Endpoints Clave

Todos los endpoints protegidos requieren JWT valido (cookie httpOnly). La autorizacion sigue el principio de minimo privilegio: cada endpoint declara explicitamente los roles permitidos mediante la dependencia `require_role()` y, cuando la accion toca un modulo, valida la asignacion contextual mediante `verify_module_ownership()`.

**Regla de roles contextuales para lideres-evaluadores**: ABET exige procesos de assessment documentados, sistematicos y transparentes, pero no prohibe que un lider interno tambien evalue evidencias cuando la institucion lo autoriza. Por acuerdo administrativo de la IUB, un usuario con rol global `leader` puede actuar como evaluador/docente de un modulo de su propio RA/SO o de otro RA/SO **solo si aparece asignado en `module_staff` para ese modulo**. El rol global `leader` no otorga permiso automatico para escribir calificaciones, importar estudiantes, guardar analisis cualitativo de modulo ni hacer submit. Para esas acciones, `module_staff` es la autoridad efectiva.

```
AUTH
  POST /auth/login                    -- rate-limited 5/min por IP
  POST /auth/logout                   -- revoca JTI en revoked_tokens
  GET  /auth/oidc/microsoft           -- redirige a Microsoft (solo si MICROSOFT_CLIENT_ID configurado)
  GET  /auth/oidc/microsoft/callback  -- callback OIDC; valida id_token; crea sesion interna

PERIODS
  GET  /periods                       -- roles: Admin, Lider, Docente (ve solo los propios)
  POST /periods                       -- roles: Admin, Lider
  PUT  /periods/{id}/close            -- roles: Admin, Lider

RUBRICS
  GET  /rubrics                       -- roles: Admin, Lider, Docente (lectura)
  POST /rubrics                       -- roles: Admin, Lider
  POST /rubrics/{id}/clone            -- roles: Admin, Lider

MODULES
  GET  /periods/{period_id}/modules   -- roles: Admin, Lider; Docente (filtra por asignacion)
  PUT  /modules/{id}/submit           -- roles: Docente o Lider asignado; verifica module_ownership

ASSESSMENTS
  GET  /modules/{id}/assessments      -- roles: Admin, Lider; Docente (verifica module_ownership)
  PUT  /modules/{id}/assessments      -- roles: Docente o Lider asignado; verifica module_ownership

STUDENTS
  POST /modules/{id}/students/import  -- roles: Docente o Lider asignado; verifica module_ownership
                                      -- parser defensivo: limite 2 MB, validacion regex,
                                      --   sanitizacion CSV injection (ver #17)

QUALITATIVE
  GET  /modules/{id}/qualitative      -- roles: Admin, Lider; Docente (verifica module_ownership)
  PUT  /modules/{id}/qualitative      -- roles: Docente o Lider asignado; verifica module_ownership
                                      -- sanitiza texto con bleach antes de persistir

REPORT (ABET)
  GET  /periods/{id}/report           -- roles: Admin, Lider
  GET  /periods/{id}/report/pdf       -- roles: Admin, Lider; registra report_exported en audit log
  GET  /periods/{id}/report/xlsx      -- roles: Admin, Lider; registra report_exported en audit log
                                      -- sanitiza celdas con safe_cell_value() antes de escribir

LEADER REPORT (F14)
  GET  /periods/{period_id}/leader-report       -- roles: Admin, Lider
  PUT  /periods/{period_id}/leader-report       -- roles: Admin, Lider
  GET  /periods/{period_id}/leader-report/pdf   -- roles: Admin, Lider
  GET  /periods/{period_id}/leader-report/docx  -- roles: Admin, Lider
                                                -- registra leader_report_generated en audit log

NOTIFICATIONS (F13)
  GET  /periods/{period_id}/tracking           -- roles: Admin, Lider
  POST /periods/{period_id}/reminders          -- roles: Admin, Lider; rate-limited 15/60s
  GET  /periods/{period_id}/reminders/preview  -- roles: Admin, Lider

ADMIN — Habeas Data (Ley 1581/2012)
  GET  /admin/habeas-data/{doc_number} -- roles: Admin unicamente
  PUT  /admin/suppress/{student_id}    -- roles: Admin unicamente; anonimiza, no elimina

ADMIN — Carga masiva y CRUD individual (F15)
  POST /admin/bulk/rubrics             -- roles: Admin
  POST /admin/bulk/users               -- roles: Admin
  POST /admin/bulk/modules             -- roles: Admin
  POST /admin/bulk/students            -- roles: Admin (requiere consent_acknowledged)

  GET  /admin/rubrics                  -- roles: Admin
  POST /admin/rubrics                  -- roles: Admin
  PUT  /admin/rubrics/{id}             -- roles: Admin

  GET  /admin/users                    -- roles: Admin
  POST /admin/users                    -- roles: Admin
  PUT  /admin/users/{id}               -- roles: Admin

  GET  /admin/modules                  -- roles: Admin
  POST /admin/modules                  -- roles: Admin
  PUT  /admin/modules/{id}             -- roles: Admin

  GET  /admin/templates/{entity}       -- roles: Admin
```

**Dependencia `verify_module_ownership`** — aplicada en todos los endpoints de modulo con escritura de evaluador y en lecturas propias:

Verifica que el modulo `{id}` tiene al usuario autenticado en `module_staff`. Aplica igual a usuarios `teacher` y `leader`: si un lider esta asignado al modulo, puede actuar como evaluador de ese modulo; si no esta asignado, su rol de lider no bypassa el control. Si el check falla, devuelve `404 Not Found` (deliberadamente ambiguo: no confirma existencia del recurso a un atacante). Esta dependencia previene Insecure Direct Object Reference (IDOR) entre modulos de distintos usuarios y soporta el caso institucional de lideres que tambien evaluan modulos.

```python
async def verify_module_ownership(
    module_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Module:
    result = await db.execute(
        select(Module)
        .join(ModuleStaff, Module.id == ModuleStaff.module_id)
        .where(
            Module.id == module_id,
            ModuleStaff.user_id == current_user.id,
        )
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module
```

---

## 9. Stack Tecnico

| Capa | Tecnologia | Justificacion |
|---|---|---|
| Frontend | HTML + Vanilla JS + CSS | Sin framework; sin build step; servido como archivos estáticos por Caddy desde el mismo VPS Hetzner (mismo origen que la API — elimina CORS y permite `SameSite=Strict` en cookies JWT sin workarounds). **Ver restricciones de diseño IUB en #18:** tipografía obligatoria (Arial / Open Sans / Helvetica / Verdana), paleta de colores institucional (`#1E2843`, `#FFDF2D` y grises complementarios), estructura header + contenido + footer. |
| Backend | Python 3.12 + FastAPI | Async nativo; ~60 MB RAM; documentacion OpenAPI auto-generada |
| ORM | SQLAlchemy 2.x (async) | Soporte completo PostgreSQL; migraciones con Alembic; sin SQL crudo |
| Base de datos | PostgreSQL 16 | LTS hasta 2028; soporte JSONB para descriptores de rubrica |
| PDF | WeasyPrint | Genera PDF desde HTML/CSS; sin dependencia de LibreOffice |
| Excel export | openpyxl | Genera .xlsx con formato institucional; sanitizacion `safe_cell_value()` en todas las celdas con datos de usuario |
| DOCX export | python-docx | Genera archivos .docx para el informe del lider (F14); agregar a `requirements.in` |
| Autenticacion | python-jose + passlib | JWT + bcrypt; sin dependencia de servicios externos |
| OIDC (nice-to-have) | authlib | Cliente OIDC para Microsoft Azure AD (F12); agregar a `requirements.in`; optional en runtime segun variables de entorno |
| Autorizacion | FastAPI Depends | `require_role()` + `verify_module_ownership()` en cada endpoint de modulo con contexto de evaluador |
| Rate limiting | slowapi | 5 req/min en `/auth/login`; 15 destinatarios/60s en `/reminders`; basado en IP/usuario |
| Sanitizacion HTML | bleach | Limpia campos de texto libre antes de persistir y de renderizar en PDF/DOCX |
| Reverse proxy | Caddy 2 | TLS automatico; zero-config; ~15 MB RAM |
| Deploy | Git + SSH + systemd | `git push` dispara script de deploy con pip-audit previo |
| Gestion de dependencias | pip-tools (pip-compile) | Genera `requirements.txt` con hashes SHA-256; instala con `--require-hashes` |
| Escaneo de CVEs | pip-audit | Corre en deploy.sh antes de instalar; bloquea el deploy si hay CVEs |
| SAST | Bandit | Analisis estatico del codigo Python en pre-commit y en deploy; scope incluye parsers de carga masiva (F15) |
| Logging de seguridad | stdlib logging (JSON) | Escribe `security.jsonl` en `/var/log/ra-assessment/`; integrado con fail2ban |
| Brute-force defense | fail2ban | Lee `security.jsonl`; bloquea IPs con 5+ `login_failed` en 1 minuto |
| Email | SMTP relay (Gmail App Password) | Notificaciones a docentes y recordatorios (F13); sin servidor de correo propio |

**Restricciones de diseño frontend — Guía IUB DG-TSI-09-V4 (ver detalle completo en #18):**

- **Tipografía:** usar exclusivamente Arial, Open Sans, Helvetica o Verdana en todo el CSS. Prohibido usar fuentes externas (Google Fonts u otras) sin aprobación de la Dirección de Comunicaciones Estratégicas de la IUB.
- **Paleta primaria:** `#1E2843` (azul oscuro) y `#FFDF2D` (amarillo institucional). Paleta complementaria: `#E9EAED`, `#DEDFE4`, `#FAFAFA`.
- **Estructura de página:** toda pantalla debe seguir el esquema header + contenido + footer. El header incluye el logo IUB en la esquina superior izquierda, vinculado al inicio (`/`).
- **Hojas de estilo:** CSS separado para pantalla (`screen`) e impresión (`print`); si el diseño es responsive se omite la hoja de móvil pero se mantiene la de impresión.

**Dependencias de seguridad en `requirements.in`:**

```
slowapi
bleach
pip-audit
bandit[toml]
authlib
python-docx
```

---

## 10. Infraestructura

| Recurso | Spec | Costo |
|---|---|---|
| Servidor | Hetzner CAX11 (ARM64, 2 vCPU, 4 GB RAM, 40 GB NVMe) | €3.79/mes |
| IPv4 | IP primaria dedicada | €0.50/mes |
| Backup | pg_dump diario cifrado con GPG → Cloudflare R2 (free tier 10 GB) | €0.00 |
| **Total** | | **~€4.29/mes (~$4.65 USD)** |

### Hardening del servidor (requerido antes del primer deploy en produccion)

**SSH:**
```
# /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes
# Usar llaves Ed25519 unicamente
```

**Firewall UFW:**
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH admin"
ufw allow 80/tcp comment "Caddy HTTP→HTTPS redirect"
ufw allow 443/tcp comment "Caddy HTTPS"
ufw enable
```

**PostgreSQL — solo loopback:**
```
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost'
# Verificar: ss -tlnp | grep 5432 → debe mostrar 127.0.0.1:5432
```

**Actualizaciones automaticas de seguridad del OS:**
```bash
apt install unattended-upgrades -y
dpkg-reconfigure unattended-upgrades   # habilitar solo security updates
```

**fail2ban — integrado con el security audit log:**
```ini
# /etc/fail2ban/filter.d/ra-assessment.conf
[Definition]
failregex = .*"event": "login_failed".*"ip": "<HOST>".*

# /etc/fail2ban/jail.d/ra-assessment.conf
[ra-assessment]
enabled  = true
filter   = ra-assessment
logpath  = /var/log/ra-assessment/security.jsonl
maxretry = 5
bantime  = 3600
findtime = 60
```

### Backups cifrados

Los dumps diarios de PostgreSQL contienen cedulas y nombres completos de estudiantes colombianos. Se cifran con GPG antes de subir a R2 para cumplir con la obligacion de medidas tecnicas de la Ley 1581/2012:

```bash
# /usr/local/bin/backup-ra.sh — cron: 0 2 * * *
pg_dump -U ra_app ra_assessment | gzip > /tmp/ra-$(date +%Y%m%d).sql.gz
gpg --recipient backup@ra-app --encrypt --output /tmp/ra-$(date +%Y%m%d).sql.gz.gpg /tmp/ra-$(date +%Y%m%d).sql.gz
rm /tmp/ra-$(date +%Y%m%d).sql.gz
rclone copy /tmp/ra-$(date +%Y%m%d).sql.gz.gpg r2:ra-assessment-backups/
```

La llave privada GPG se almacena offline (no en el servidor). Para restaurar se necesita acceso fisico al material de llave del administrador.

### Variables de entorno — no en el repositorio

Credenciales en `/srv/ra-assessment/.env` (permisos `600`, fuera del control de versiones):

```bash
DATABASE_URL=postgresql+asyncpg://ra_user:STRONG_PASS@localhost/ra_assessment
SECRET_KEY=<64 bytes aleatorios — openssl rand -hex 32>
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
BACKUP_GPG_RECIPIENT=backup@ra-app
BACKUP_RCLONE_REMOTE=r2:ra-assessment-backups/

# Microsoft OIDC (opcional — si no estan presentes, F12 se deshabilita silenciosamente)
MICROSOFT_CLIENT_ID=<desde Azure AD>
MICROSOFT_CLIENT_SECRET=<desde Azure AD>
MICROSOFT_TENANT_ID=<desde Azure AD>
```

Verificar que `.env` y `*.env` estan en `.gitignore` antes del primer commit.

---

## 11. Restricciones y No-Funcionales

- **Disponibilidad**: 99% uptime esperado; sin SLA formal
- **Concurrencia**: Hasta 30 docentes simultaneos en pico de cierre; CAX11 soporta esto sin problemas
- **Latencia**: < 500 ms para operaciones de lectura; < 1 s para escritura batch de calificaciones; < 3 s para generacion de PDF/DOCX de informe del lider (F14)
- **Seguridad**:
  - HTTPS obligatorio (Caddy TLS automatico)
  - Passwords hasheados con bcrypt (passlib)
  - JWT en cookie httpOnly con expiracion de 8 horas
  - Autorizacion por rol y por recurso en cada endpoint de la API
  - Rate limiting en `/auth/login` (5/min por IP) y en `/reminders` (15 destinatarios/60s por usuario)
  - Sanitizacion de HTML en todos los campos de texto libre (bleach)
  - Proteccion IDOR mediante `verify_module_ownership` en todos los endpoints de modulo; aplica a docentes y lideres asignados como evaluadores
  - Todo el codigo Python sometido a Bandit (SAST) antes de deploy; scope incluye parsers de carga masiva
  - Dependencias con hashes SHA-256 verificados en cada deploy (pip-audit); incluye `authlib` y `python-docx`
  - Security audit log en formato JSON estructurado
  - Validacion criptografica del id_token de Microsoft OIDC antes de crear sesion (F12)
- **Privacidad y cumplimiento (Ley 1581/2012)**:
  - Los datos personales de estudiantes (cedula, nombre) solo son visibles para el docente asignado al modulo y para el lider/admin
  - Los backups se cifran con GPG antes de salir del servidor
  - Existe un endpoint de habeas data (`/admin/habeas-data/{doc}`) para atender peticiones de acceso del titular
  - La supresion de datos se implementa como anonimizacion (no eliminacion fisica) para preservar integridad de reportes cerrados
  - La carga masiva de estudiantes (F15) requiere confirmacion explicita de consentimiento informado (`consent_acknowledged: true`)
- **Retencion de datos**: Los datos de periodos cerrados se conservan indefinidamente (no hay eliminacion)
- **Idioma**: UI en ingles (mantiene terminologia del Excel: SO, PI, Poor/Adequate/Exemplary)
- **Exportacion**: El formato del PDF/Excel debe ser compatible con el reporte institucional existente
- **Estrategia de pruebas E2E (tres capas)**: (1) *Flujos API encadenados* — tests pytest+httpx que validan secuencias completas de endpoints (import → calificar → analizar → submit); sin nueva infraestructura, se integran en `pytest tests/`; implementar en S2. (2) *Staging/PostgreSQL local de pruebas* — los mismos tests ejecutados contra PostgreSQL real con `alembic upgrade head` o schema recreado por fixture para validar comportamientos específicos del motor (`ON CONFLICT`, `JSONB`, `NUMERIC`); activados por variable de entorno `TEST_PG_URL`; requeridos antes del primer deploy y antes de tratar S5 como gate-ready. La primera implementación puede usar `docker-compose.yml` local con una base descartable/test-owned; staging Hetzner sigue siendo necesario para validar Caddy/TLS y despliegue real. (3) *Browser Playwright* — `pytest-playwright` contra servidor levantado; cubre login, logout, dashboard y conformidad DG-TSI-09-V4 automatizable; requerido antes del primer deploy. Ver `docs/TEST_PLAN.md §11` para el catálogo completo de IDs de prueba E2E.
- **Diseño y Usabilidad — Conformidad con Guía IUB DG-TSI-09-V4**: El frontend debe cumplir todos los criterios de la sección #18 de este PRD antes de pasar a producción. Los requisitos mínimos verificables son: paleta de colores institucional, tipografía permitida, estructura header/contenido/footer, navegación global consistente, ruta de migas, URLs limpios, texto alineado a la izquierda, sin scroll horizontal a 1024×768 px, campos obligatorios marcados con `*`, labels asociados a inputs, sin popups de nueva ventana, y mensajes de confirmación en todas las acciones que lo requieran.

---

## 12. Fuera del Alcance (v1)

- Aplicacion movil nativa
- Integracion con sistema academico de la universidad (SIRA u otro SIA)
- Múltiples programas académicos — **estructura de datos modelada desde v1** (`propedeutic_lines`, `programs`, FK opcionales en `student_outcomes` y `periods`); UI multi-programa y reporte ejecutivo institucional (F17) implementados en v2 post-despliegue de TGA. Decisión: LLM Council 2026-05-16.
- Notificaciones push
- Sincronizacion automatica de roles desde grupos de Azure AD (la asignacion de roles post-primer-login Microsoft es manual por el admin en v1; cubierta como requerimiento futuro de F12). Integracion con directorio LDAP institucional (fuera del alcance indefinidamente).
- RA distintos a RA1 (la rubrica actual solo modela RA1; el modelo de datos los soporta pero la UI v1 no)
- SIEM externo o centralizacion de logs (los logs de seguridad permanecen en el servidor local)
- Visualizacion del informe del lider (F14) por parte de los docentes (documentado como restriccion para v2)

---

## 13. Flujo Detallado del Docente — Especificacion de Pantallas

> Esta seccion describe las pantallas, validaciones y transiciones de estado del flujo docente, derivadas directamente del analisis de `Data_Assessment_TGA_RA1_2024-2.xlsm`.
>
> **Nota de conformidad IUB (DG-TSI-09-V4):** todos los wireframes de esta sección asumen alineación de texto a la izquierda, campos obligatorios marcados con `*`, y ningún elemento que genere una ventana emergente de nueva pestaña/ventana de navegador. Los modales de confirmación (exclusión de estudiantes en F03, confirmación de envío en F05) se implementan como diálogos accesibles dentro del DOM de la misma página (`<dialog>` HTML nativo o equivalente accesible), lo cual es conforme a la Guía IUB.

---

### Pantalla 1: Dashboard del Docente (vista inicial al login)

El docente ve la lista de modulos que tiene asignados en el periodo activo:

```
Periodo: TGA RA1 2024-2
┌─────────────────────────────────────────────────────┐
│ Modulo           │ Grupo │ Estado      │ Accion      │
├──────────────────┼───────┼─────────────┼─────────────┤
│ Contabilidad I   │ A     │ Pendiente   │ Comenzar →  │
│ Contabilidad I   │ B     │ En progreso │ Continuar → │
│ Contabilidad II  │ A     │ Completado  │ Ver →       │
└─────────────────────────────────────────────────────┘
```

**Estados posibles de un modulo:**
- `Pendiente`: No ha ingresado ningun dato
- `En progreso`: Tiene borradores guardados pero no ha enviado
- `Completado`: Ha enviado; el lider puede verlo; no editable salvo reapertura

---

### Pantalla 2: Informacion General del Modulo (F02)

**Campos pre-llenados (no editables):**
- Periodo academico — desde el periodo activo
- Nombre del docente — desde el login
- Codigo y nombre del curso — desde la asignacion del periodo

**Campos confirmables por el docente:**
- Grupo (puede haber mas de un grupo por curso)
- Seccion / sede (si aplica)

**Validacion de avance:** todos los campos deben estar completos para pasar a la Pantalla 3.

---

### Pantalla 3: Lista de Estudiantes (F03 — Parte A)

El docente carga o confirma la lista de estudiantes de su modulo.

**Estructura de cada fila de estudiante (mapeada de STUDENTS LIST sheet):**

| # | Campo | Obligatorio | Fuente |
|---|---|---|---|
| 1 | ID interno | Si — marcado con `*` | Sistema academico / import |
| 2 | Numero de documento | Si — marcado con `*` | Sistema academico / import |
| 3 | Nombre completo | Si — marcado con `*` | Sistema academico / import |

**Opciones de carga:**
- **Importar CSV/Excel**: columnas en orden ID interno, N documento, Nombre completo. Ver #17 para la especificacion completa del parser defensivo
- **Importar desde lista del periodo**: si el administrador cargo la nomina previamente (via F15)
- **Agregar manualmente**: fila por fila

**Accion de exclusion por estudiante:**

Cada fila tiene un menu contextual `[ ... ]` con la opcion "Excluir del assessment". Al activarla:
- Se abre un **dialog accesible dentro de la misma página** (no popup de nueva ventana) pidiendo motivo: `Se retiro del curso | Nunca asistio | Incapacidad / motivo medico | Otro (texto libre)`
- El estudiante pasa a una seccion colapsada **"Excluidos (N)"** debajo de la lista activa
- Desde esa seccion se puede re-incluir antes del envio
- El motivo queda registrado para trazabilidad ABET

```
Activos: 31  |  Calificados: 0  |  Excluidos: 2      Total matricula: 33
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Garcia, Maria      1005432   Maria Garcia Perez     [ ... ]
 Lopez, Juan        1005433   Juan Lopez Ruiz        [ ... ]
 ...

▸ Excluidos (2)
```

**Validaciones:**
- El numero de documento debe ser unico dentro del modulo
- No se puede avanzar con 0 estudiantes activos
- El total de estudiantes se auto-calcula y es de solo lectura

---

### Pantalla 3b: Revision de la Rubrica (paso obligatorio antes de calificar)

Antes de acceder a la grilla de calificacion, el docente ve la rubrica completa del periodo.

```
Rubrica vigente — TGA RA1 2024-2
SO/RA: Aplicar principios de contabilidad, economia, finanzas...

┌────────────────────────────────────────────┬────────────────────────────┬───────┐
│ Performance Indicator                      │ Niveles de desempeno       │ Peso  │
├────────────────────────────────────────────┼────────────────────────────┼───────┤
│ PI1: Identificar necesidades y             │ Poor / Inadequate /        │  30%  │
│ problematicas...                           │ Adequate / Exemplary  [►]  │       │
├────────────────────────────────────────────┼────────────────────────────┼───────┤
│ PI2: Formular alternativas de solucion...  │ Poor / Inadequate /        │  40%  │
│                                            │ Adequate / Exemplary  [►]  │       │
├────────────────────────────────────────────┼────────────────────────────┼───────┤
│ PI3: Disenar la solucion...                │ Poor / Inadequate /        │  15%  │
│                                            │ Adequate / Exemplary  [►]  │       │
├────────────────────────────────────────────┼────────────────────────────┼───────┤
│ PI4: Evaluar el impacto...                 │ Poor / Inadequate /        │  15%  │
│                                            │ Adequate / Exemplary  [►]  │       │
└────────────────────────────────────────────┴────────────────────────────┴───────┘
  [►] expande los 4 descriptores completos del nivel para ese PI

                                          [ He leido la rubrica → Calificar ]
```

**Comportamiento:**
- El docente puede expandir cada PI para ver los cuatro descriptores completos antes de comenzar
- El boton "Calificar" esta disponible desde el primer momento — la revision no es un bloqueo, es un prompt intencional
- Si el docente ya tiene calificaciones guardadas como borrador, este paso muestra la rubrica y un boton "Continuar calificacion"
- La rubrica se puede consultar en cualquier momento desde la grilla de calificacion mediante un boton "Ver rubrica" persistente

---

### Pantalla 4: Ingreso de Calificaciones (F03 — Parte B)

Vista de grilla: filas = estudiantes activos, columnas = selector de nivel por PI activo.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Contabilidad I — Grupo A          Activos: 31 | Calificados: 28 | Pend.: 3  │
├──────────────────┬────────────────┬────────────────┬──────────────┬──────────┤
│ Estudiante       │      PI1       │      PI2       │     PI3      │ Standard │
│                  │     (30%)      │     (40%)      │    (15%)     │          │
├──────────────────┼────────────────┼────────────────┼──────────────┼──────────┤
│ Garcia, Maria    │ P  I  [A] E    │ P  I  [A] E    │ P [I] A  E   │ Medium   │
│ Lopez, Juan      │ P  I   A [E]   │ P  I  [A] E    │ P  I  [A] E  │ High     │
│ Martinez, Ana    │ —  —   —  —    │ —  —   —  —    │ —  —   —  —  │ —        │
│ ...              │                │                │              │          │
├──────────────────┼────────────────┼────────────────┼──────────────┼──────────┤
│ ► Excluidos (2)  │                │                │              │          │
└──────────────────┴────────────────┴────────────────┴──────────────┴──────────┘
  P = Poor  I = Inadequate  A = Adequate  E = Exemplary   [ ] = seleccionado
```

**Comportamiento del selector de nivel (por celda):**
- 4 opciones en linea: `Poor | Inadequate | Adequate | Exemplary`
- Se selecciona con un clic; la opcion activa queda resaltada
- Al hacer hover sobre cualquier opcion, se muestra en un tooltip el descriptor completo de ese nivel para ese PI segun la rubrica
- Al seleccionar, el sistema recalcula en tiempo real el Standard del estudiante

**Persistencia:** cada seleccion se guarda como borrador inmediatamente (autosave).

---

### Pantalla 5: Distribucion del Modulo (F04b)

```
Distribucion de niveles — Contabilidad I, Grupo A
Matricula total: 33 | Activos: 31 | Excluidos: 2

┌─────┬──────┬────────────┬──────────┬───────────┬─────────────────┐
│ PI  │ Poor │ Inadequate │ Adequate │ Exemplary │ Total (activos) │
├─────┼──────┼────────────┼──────────┼───────────┼─────────────────┤
│ PI1 │  2   │     5      │   18     │     6     │       31        │
│ PI2 │  1   │     3      │   20     │     7     │       31        │
│ PI3 │  3   │     7      │   15     │     6     │       31        │
│ PI4 │  0   │     2      │   22     │     7     │       31        │
└─────┴──────┴────────────┴──────────┴───────────┴─────────────────┘
```

Se calcula en tiempo real. El total siempre refleja estudiantes activos unicamente.

---

### Pantalla 6: Analisis Cualitativo por PI (F04)

```
PI1 — [Descripcion del PI del RA]
Distribucion: Poor: 2 | Inadequate: 5 | Adequate: 18 | Exemplary: 8

┌─────────────────────────────────────────────────────┐
│ Escriba su analisis de los resultados del PI1...    │
│                                                     │
│                                              0/2000 │
└─────────────────────────────────────────────────────┘
```

**Validacion de envio:** todos los campos de analisis de PIs con datos deben tener al menos 1 caracter para poder marcar el modulo como "Completado".

---

### Pantalla 7: Confirmacion y Envio (F05 — paso final)

```
Resumen del modulo: Contabilidad I — Grupo A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Informacion general completa
✅ 33 / 33 estudiantes calificados
✅ Analisis completado para 6 PIs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Al enviar, el modulo quedara bloqueado para edicion.
El lider podra ver tus datos y analisis.

[  Cancelar  ]          [ Confirmar y Enviar → ]
```

**Post-envio:**
- El modulo cambia de estado `En progreso` → `Completado`
- Las calificaciones y analisis pasan a modo solo-lectura
- El lider recibe notificacion automatica

---

### Reglas de navegacion entre pantallas (wizard)

```
[1. Info General] → [2. Estudiantes] → [3. Calificaciones + Distribucion] → [4. Analisis] → [5. Enviar]
```

- El docente puede navegar hacia atras libremente sin perder datos
- Los pasos 3, 4 y 5 solo son accesibles si la lista de estudiantes tiene al menos 1 fila
- El paso 5 solo esta habilitado si todos los PIs activos tienen calificacion y analisis

---

### Estados de calificacion de un estudiante individual

| Condicion | Estado mostrado |
|---|---|
| Sin ningun score | Sin datos (fila excluida del analisis) |
| Al menos 1 score ingresado, no todos | Incompleto |
| Todos los PIs activos calificados | Calificado |

---

## 14. Priorizacion de Desarrollo (MVP)

Las tareas de seguridad marcadas con el simbolo de candado son bloqueantes para pasar al siguiente sprint o al deploy en produccion.

| Sprint | Features | Tareas de seguridad/calidad (🔒 = bloqueante) | Criterio de done |
|---|---|---|---|
| S1 | F10 Auth + F09 Periodos + F01 Rubricas (con pesos y pre-carga de descriptores) | 🔒 `require_role()` + JWT blocklist + rate limiting `/auth/login` + `pip-compile --generate-hashes` + variables de entorno en `.env` | Lider puede crear periodo con rubrica valida (pesos = 100%); login tiene rate limit activo |
| S2 | F02 Info Modulo + F03 Calificaciones + Pantalla 3b Revision Rubrica + exclusion de estudiantes + **F16** (`contracts.py` + `sync_service.py`) | 🔒 `verify_module_ownership` en todos los endpoints de modulo; docentes y lideres asignados en `module_staff` pueden evaluar, lider no asignado no bypassa ownership + `bleach` en campos de analisis + validacion Pydantic de pesos en API. 🔒 **Auditoría de conformidad DG-TSI-09-V4:** verificar paleta de colores institucional (`#1E2843`, `#FFDF2D`), tipografía permitida (Arial / Open Sans / Helvetica / Verdana), estructura header/contenido/footer, vínculos visitados con color diferenciado, ausencia de scroll horizontal a 1024×768 px, y ausencia de popups de nueva ventana en todo el flujo docente. 🔒 Agnosticismo de `SyncService`: mismo `SyncPayload` con `source='csv'` y `source='academusoft'` produce resultado identico en DB (U-S2-11). | Evaluador asignado solo ve/edita sus modulos; calificacion con selector de 4 niveles; validacion de pesos replicada en API; frontend pasa auditoría DG-TSI-09-V4; `SyncService` rechaza `consent_acknowledged: false` con estudiantes |
| S3 | F04 Analisis + F04b Distribucion % + F05 Wizard + F06 Cierre | 🔒 Security audit log (`security_events`) + fail2ban configurado + UFW habilitado en servidor | Flujo completo docente → submit; logging de `period_closed` y `login_failed` activo |
| S4 | F07 Reporte Final (4 secciones) + F11 Plan de Accion + F08 Dashboard + **F13 Seguimiento y Notificaciones** + **F14 Informe del Lider** | 🔒 `safe_cell_value()` en exportacion xlsx + logging de `report_exported` + endpoint habeas data `/admin/habeas-data/` + throttle anti-spam F13 (429 / 15 dest / 60 s) + logging `reminder_sent` + logging `leader_report_generated` + `python-docx` en `pip-audit` | Lider descarga PDF/Excel; xlsx sin formulas inyectadas; endpoint habeas data funcional; recordatorios funcionan con variables resueltas; DOCX del lider sin macros |
| S5 | Importacion CSV/Excel de estudiantes (F03) + **F15 Carga masiva admin** + **F16** (`file_adapter.py` — refactor de parsers de F15) + exportacion Excel completa + historial de planes de accion | 🔒 Parser defensivo F03 (#17: limite 2 MB, validacion regex, sanitizacion CSV injection) + parsers masivos F15/F16 bajo Bandit en pre-commit + `consent_acknowledged` en `SyncPayload` obligatorio (CSV via `file_adapter.py`) + **PG-01 a PG-05 ejecutados contra PostgreSQL real** + backups GPG cifrados + `pip-audit` en `deploy.sh` | Paridad completa con flujo Excel; importacion rechaza archivos maliciosos; admin carga periodo completo via 4 CSV usando `SyncPayload`; tests PG pasan sin skips; backups cifrados en R2 |
| S6 | **F12 Microsoft OIDC (nice-to-have)** | 🔒 Validacion criptografica del `id_token` (firma, `iss`, `aud`, `exp`) + `client_secret` en `.env` con permisos 600 + `authlib` en `pip-audit` + logging `oidc_login_success` / `oidc_login_failed` / `oidc_account_not_registered` | Login con cuenta Microsoft funcional; sin variables de entorno el boton no aparece y el login nativo opera sin cambios; usuario nuevo queda pendiente de rol hasta asignacion manual |
| S7 | **F16** `oracle_adapter.py` — condicional (3 prerequisitos externos: schema Oracle, entorno prueba CI, concepto juridico Ley 1581) | 🔒 Schema Oracle confirmado por DBA + entorno Oracle en CI + concepto juridico Ley 1581 del area juridica de la IUB + modo degradado: Oracle no disponible → error descriptivo, resto del sistema sin afectacion | `oracle_adapter.py` produce el mismo resultado en DB que `file_adapter.py` para un payload equivalente; deshabilitado si `ORACLE_DSN` no esta configurado |

---

## 15. Criterios de Exito

- Un lider puede completar el ciclo de un periodo cuatrimestral sin abrir Excel
- Los docentes completan su modulo en < 20 minutos (vs. promedio estimado actual de 45 min con el Excel)
- El reporte final generado es aceptado por acreditacion sin reformateo manual
- Costo de infraestructura <= $5 USD/mes durante el primer año
- **Ningun docente puede acceder a calificaciones o analisis de un modulo no asignado a el** (verificado con prueba de penetracion basica antes del primer deploy)
- **El deploy.sh bloquea el deploy si pip-audit detecta CVEs en dependencias**
- **Los backups diarios en R2 estan cifrados con GPG** (verificado restaurando un backup de prueba antes de poner en produccion)
- **F13**: el lider puede enviar recordatorios a todos los docentes pendientes en menos de 2 minutos desde el dashboard
- **F14**: el informe del lider en PDF se genera en menos de 3 segundos para un periodo tipico de 5 PIs y 15 modulos
- **F15**: el admin puede configurar un periodo completo (rubricas + usuarios + modulos + estudiantes) importando 4 archivos CSV en menos de 10 minutos

---

## 16. Postura de Seguridad

> Seccion nueva en v2.0, ampliada en v2.1. Documenta las decisiones de seguridad, los controles implementados y el modelo de amenazas minimo del sistema. Referencia: analisis WAF de seguridad realizado el 2026-05-15.

### 16.1 Resumen ejecutivo — semaforo WAF

| Principio | Estado en v1.0 | Estado en v2.0 | Estado en v2.1 |
|---|---|---|---|
| A — Security by Design | Parcial | Cubierto | Cubierto (reforzado: parser masivo F15, consentimiento F15, throttle F13, DOCX injection F14) |
| B — Zero Trust | Ausente | Cubierto | Cubierto (reforzado: validacion criptografica OIDC F12, JWT interno independiente de sesion Microsoft) |
| C — Shift-Left Security | Ausente | Cubierto | Cubierto (reforzado: `authlib` y `python-docx` en pip-audit; parsers F15 en scope de Bandit) |
| D — Preemptive Cyber Defense | Ausente | Cubierto | Cubierto (reforzado: nuevos eventos en security_events para F12, F13, F14, F15) |
| E — Ley 1581/2012 | Parcial | Cubierto | Cubierto (reforzado: `consent_acknowledged` en carga masiva F15) |

### 16.2 Modelo de amenazas minimo

**Actores de amenaza relevantes para este workload:**

| Actor | Motivacion | Vector mas probable |
|---|---|---|
| Docente con acceso legitimo | Curiosidad, ventaja comparativa, error accidental | IDOR — cambiar `{module_id}` en URL para ver modulos de colegas |
| Atacante externo (credential stuffing) | Acceso a datos de estudiantes | Fuerza bruta en `/auth/login` con credenciales filtradas de otros servicios |
| Docente o estudiante con conocimiento tecnico | Manipular calificaciones en el reporte final | Bypass de validaciones del frontend enviando requests directos a la API |
| Atacante de supply chain | Comprometer el servidor a traves de una dependencia | Paquete PyPI con malware instalado en un deploy sin verificacion de hashes |
| Auditor ABET con Excel (amenaza indirecta) | N/A — victima | CSV/Excel injection en campos de nombre que se ejecutan al abrir el reporte exportado o el informe del lider (F14) |
| Lider malintencionado usando F13 | Spam / open relay | Envio de correos masivos a destinatarios externos usando el SMTP relay de la app |

**Amenazas fuera del modelo de amenazas de v1** (no mitigadas, documentadas para v2+):
- Compromiso fisico del servidor Hetzner (requeriria cifrado de disco completo — fuera del alcance con este presupuesto)
- Ataque de denegacion de servicio distribuido sostenido (requeriria CDN/WAF externo)
- Insider threat a nivel de administrador de sistema (requeriria auditoria de acceso SSH)
- Suplantacion del IdP de Microsoft en el flujo OIDC (mitigado parcialmente por validacion del `id_token`; mitigacion completa requeriria certificate pinning, fuera de alcance en v1)

### 16.3 A — Security by Design

**Proteccion IDOR en modulos**

Todo endpoint que exponga o modifique datos de un modulo especifico bajo el contexto de evaluador requiere la dependencia `verify_module_ownership`. Esta dependencia verifica que el usuario autenticado esta en `module_staff` para ese modulo. Aplica igual a `teacher` y a `leader`: un lider solo puede escribir calificaciones, analisis de modulo, importacion de estudiantes o submit cuando fue asignado explicitamente al modulo. El error devuelto es siempre `404 Not Found` — nunca `403 Forbidden` — para no confirmar la existencia del recurso a un atacante.

```python
async def verify_module_ownership(
    module_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Module:
    result = await db.execute(
        select(Module)
        .join(ModuleStaff, Module.id == ModuleStaff.module_id)
        .where(
            Module.id == module_id,
            ModuleStaff.user_id == current_user.id,
        )
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module
```

**Validaciones de negocio en la API (no solo en frontend)**

Las validaciones criticas — suma de pesos de PIs = 100%, modulo completo antes de envio, suma de pesos en carga masiva de rubricas (F15) — se replican en validadores Pydantic en la API. Un cliente que bypass el JavaScript de validacion del frontend recibe igualmente un error `422 Unprocessable Entity`:

```python
class RubricInput(BaseModel):
    pis: List[PIInput]

    @field_validator("pis")
    @classmethod
    def weights_must_sum_100(cls, pis):
        total = sum(pi.weight for pi in pis if pi.weight > 0)
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"PI weights must sum to 100%, got {total:.2f}%")
        return pis
```

**Sanitizacion de campos de texto libre (XSS / HTML injection)**

Los campos de analisis cualitativo del docente y del lider, el texto del plan de accion, y las conclusiones del informe del lider (F14) se sanitizan antes de persistir en la base de datos:

```python
import bleach

def sanitize_qualitative_text(text: str, max_chars: int = 2000) -> str:
    cleaned = bleach.clean(text, tags=[], attributes={}, strip=True)
    if len(cleaned) > max_chars:
        raise ValueError(f"Text exceeds {max_chars} characters")
    return cleaned.strip()
```

**Throttle anti-spam en F13 (recordatorios)**

```python
@router.post("/periods/{period_id}/reminders")
@limiter.limit("15/minute", key_func=lambda request: get_current_user(request).id)
async def send_reminders(request: Request, period_id: int, body: ReminderInput):
    # Verificar que todos los recipient_ids pertenecen al periodo
    ...
```

### 16.4 B — Zero Trust

**Autorizacion por rol en cada endpoint**

```python
class Role(str, Enum):
    ADMIN = "admin"
    LEADER = "leader"
    TEACHER = "teacher"

def require_role(*roles: Role):
    async def checker(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker
```

**Rate limiting en `/auth/login`**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginInput):
    ...
```

**Token JWT con blocklist de revocacion**

El logout inserta el JTI del token en `revoked_tokens`. Cada request autenticado verifica que el JTI no esta revocado antes de proceder. Un job periodico limpia tokens expirados de la tabla.

**Validacion criptografica del id_token de Microsoft (F12)**

```python
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()
oauth.register(
    name="microsoft",
    client_id=settings.MICROSOFT_CLIENT_ID,
    client_secret=settings.MICROSOFT_CLIENT_SECRET,
    server_metadata_url=f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# En el callback: verificar firma, iss, aud, exp antes de crear sesion interna
token = await oauth.microsoft.authorize_access_token(request)
user_info = token.get("userinfo")  # authlib valida el id_token automaticamente
```

El JWT interno de la app se emite siempre con expiracion de 8 horas y JTI blocklist, independientemente de si el usuario se autentico por Microsoft o por login nativo. La validez de la sesion Microsoft no se hereda.

### 16.5 C — Shift-Left Security

**Lockfile con hashes SHA-256**

```bash
# Generar
pip-compile --generate-hashes requirements.in

# Instalar en produccion (verifica hashes)
pip install --require-hashes -r requirements.txt
```

**Pipeline de seguridad en deploy.sh**

```bash
# deploy.sh — ejecutado via git post-receive hook
pip-audit --require-hashes -r requirements.txt --output json \
  --output-file /var/log/ra-assessment/pip-audit-$(date +%Y%m%d).json
if [ $? -ne 0 ]; then
  echo "ERROR: CVEs found. Deploy aborted."
  exit 1
fi
bandit -r src/ -ll -ii
if [ $? -ne 0 ]; then
  echo "ERROR: Bandit found issues. Deploy aborted."
  exit 1
fi
```

Bandit cubre en su scope por defecto todos los modulos bajo `src/`, incluyendo los parsers de importacion masiva de F15 y F03.

### 16.6 D — Preemptive Cyber Defense

**Security audit log (JSON estructurado)**

Todos los eventos de seguridad se escriben en `/var/log/ra-assessment/security.jsonl` como JSON por linea:

```python
def log_security_event(event: str, user_id: int | None, ip: str,
                       detail: dict | None = None, severity: str = "INFO"):
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "user_id": user_id,
        "ip": ip,
        "severity": severity,
        **(detail or {}),
    }
    security_logger.info(json.dumps(record))
```

**Eventos registrados obligatoriamente:**

| Evento | Cuando | Datos adicionales |
|---|---|---|
| `login_success` | Login exitoso | user_id, IP |
| `login_failed` | Credenciales incorrectas | email intento (sin contrasena), IP |
| `login_rate_limited` | IP supera el limite | IP |
| `access_denied` | `403` en cualquier endpoint | user_id, endpoint |
| `period_closed` | Lider cierra periodo | user_id, period_id |
| `report_exported` | Descarga PDF o xlsx (F07) | user_id, period_id, format |
| `student_imported` | Import CSV/Excel exitoso (F03) | user_id, module_id, count |
| `password_changed` | Cambio de contrasena | user_id, IP |
| `habeas_data_accessed` | Consulta endpoint habeas data | admin_id, hash parcial del documento |
| `oidc_login_success` | Login exitoso via Microsoft (F12) | user_id, IP |
| `oidc_login_failed` | Fallo en validacion del id_token (F12) | IP, motivo |
| `oidc_account_not_registered` | Usuario de Microsoft no registrado (F12) | microsoft_oid (hash), IP |
| `reminder_sent` | Lider envia recordatorios (F13) | user_id, recipient_ids (IDs internos), period_id |
| `leader_report_generated` | Descarga informe del lider (F14) | user_id, period_id, format ('pdf' / 'docx') |
| `bulk_import_rubrics` | Importacion masiva de rubricas (F15) | admin_id, count |
| `bulk_import_users` | Importacion masiva de usuarios (F15) | admin_id, count |
| `bulk_import_modules` | Importacion masiva de modulos (F15) | admin_id, period_id, count |
| `bulk_import_students` | Importacion masiva de estudiantes (F15) | admin_id, module_id, count, consent_acknowledged |

### 16.7 E — Ley 1581/2012 (Habeas Data Colombia)

**Datos personales en scope:** cedulas y nombres completos de estudiantes universitarios colombianos, clasificados como datos semiprivados bajo la Ley 1581/2012.

**Medidas tecnicas implementadas:**
- Backups cifrados con GPG antes de salir del servidor (datos en reposo protegidos)
- Acceso a datos de estudiantes restringido por rol y por asignacion de modulo
- Security audit log para trazabilidad de accesos a datos personales
- Confirmacion de consentimiento informado en carga masiva de estudiantes (F15)

**Derechos del titular — procedimiento:**

El Articulo 8 de la Ley 1581 otorga a los titulares derechos de acceso, correccion y supresion. El endpoint `/admin/habeas-data/{doc_number}` (solo rol Admin) permite exportar todos los datos del titular para responder peticiones. La supresion se implementa como anonimizacion:

```sql
-- Anonimizar estudiante (no eliminar — preserva integridad de reportes cerrados)
UPDATE students
SET full_name = '[SUPRIMIDO]',
    document_number = '[SUPRIMIDO-' || id || ']'
WHERE id = :student_id;
```

El acto de supresion queda registrado en `security_events` con fecha, `admin_id` y hash parcial del numero de documento (no el numero completo).

**Limitacion de retencion:** Los datos de periodos cerrados se conservan indefinidamente por requerimiento de ABET (trazabilidad de ciclos de acreditacion). Esta politica de retencion debe documentarse en el aviso de privacidad institucional y comunicarse a los titulares al momento de la recoleccion de datos.

---

## 17. Analisis de Superficie F03 — Importacion CSV/Excel

> Seccion nueva en v2.0. La importacion de archivos con datos de estudiantes es la superficie de ataque mas amplia de la aplicacion: combina file upload, parsing de datos externos, e insercion masiva en base de datos con datos personales. Los mismos controles aplican a la carga masiva del administrador (F15).

### 17.1 Vectores de ataque y controles

| Vector | Severidad | Mecanismo | Control implementado |
|---|---|---|---|
| **CSV Injection / Formula Injection** | Critico | Campo que empieza con `=`, `+`, `-`, `@` se ejecuta como formula en Excel cuando el auditor ABET abre el reporte exportado | Validador rechaza valores con prefijos de formula en cualquier campo; `safe_cell_value()` prefija con `'` al exportar |
| **Archivo sobredimensionado** | Alto | Upload de un .xlsx de 500 MB — openpyxl carga en memoria → DoS del servidor (4 GB RAM) | Limite de 2 MB en el endpoint antes de pasar al parser |
| **Encoding attack** | Alto | CSV con UTF-16 o Latin-1 — strings como `<script>` escapan la validacion si el decodificador no es estricto | Parser fuerza decodificacion UTF-8 con modo estricto; error en encoding invalido |
| **Zip bomb / XML bomb** | Medio | .xlsx es un ZIP — archivo maliciosamente anidado se expande a GBs en disco | Limite de tamano en upload (2 MB raw); openpyxl con `read_only=True` no resuelve formulas |
| **Inyeccion SQL via datos** | Bajo | Nombre con `'; DROP TABLE students; --` | Mitigado por SQLAlchemy ORM (parametros preparados). Sin queries raw en el codebase |
| **Explotacion de macros VBA en .xlsx** | Medio | Archivo .xlsx con macros embebidas | `openpyxl.load_workbook(read_only=True, data_only=True)` no ejecuta macros ni formulas |

### 17.2 Especificacion del parser defensivo

**Limites de seguridad:**

| Parametro | Valor | Justificacion |
|---|---|---|
| Tamano maximo del archivo | 2 MB | Un CSV con 100 estudiantes x 3 campos ocupa ~10 KB; 2 MB es >200x el caso real |
| Maximo de estudiantes por import | 100 | Limite del dominio (max. 15 modulos x ~35 estudiantes = 525 total; 100 por modulo es conservador) |
| Encoding permitido | UTF-8 (con BOM) | Unico encoding aceptado; archivos Excel exportados como UTF-8 son el caso normal |
| Tipos MIME permitidos | `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Validado en el content-type del request |

**Regex de validacion de campos:**

```python
SAFE_NAME_RE = re.compile(r"^[\w\s\-\.ÁÉÍÓÚáéíóúÑñÜü,]{1,120}$")
SAFE_ID_RE   = re.compile(r"^\d{5,12}$")      # ID interno: solo digitos
SAFE_DOC_RE  = re.compile(r"^[\d\-]{6,15}$")  # cedula/TI: digitos y guion
```

**Regla de rechazo por formula (CSV Injection):**

```python
FORMULA_PREFIXES = ("=", "+", "-", "@", "|", "%")

if value and str(value)[0] in FORMULA_PREFIXES:
    raise ValueError(f"Potentially malicious formula in field: {value!r}")
```

**Opciones de openpyxl que previenen ejecucion de codigo:**

```python
openpyxl.load_workbook(
    io.BytesIO(raw),
    read_only=True,   # no carga las hojas en memoria completa
    data_only=True,   # lee valores calculados, no formulas
)
# data_only=True significa que =HYPERLINK(...) se lee como el ultimo valor
# calculado en cache, no como la formula ejecutable
```

**Sanitizacion en el reporte exportado:**

```python
FORMULA_PREFIXES = ("=", "+", "-", "@", "|", "%")

def safe_cell_value(value: str) -> str:
    """Previene Excel injection prefijando valores con apostrofe."""
    if value and str(value)[0] in FORMULA_PREFIXES:
        return "'" + value
    return value

# Aplicar en toda celda que contenga datos provenientes del usuario:
ws.cell(row=r, column=4, value=safe_cell_value(student.full_name))
ws.cell(row=r, column=5, value=safe_cell_value(analysis_text))
```

Esta misma funcion `safe_cell_value()` se aplica al generar el DOCX del informe del lider (F14) en cualquier campo proveniente de usuarios.

### 17.3 Especificacion del endpoint (F03)

```
POST /modules/{module_id}/students/import

Prerrequisitos:
  - JWT valido con rol Docente o Lider
  - module_id pertenece al usuario autenticado via `module_staff` (verify_module_ownership)

Request:
  Content-Type: multipart/form-data
  file: archivo CSV o XLSX

Validaciones en orden (fallo en cualquiera devuelve error y no procesa el archivo):
  1. content_type en ALLOWED_MIME_TYPES
  2. Leer maximo MAX_FILE_BYTES + 1 bytes; rechazar si supera el limite
  3. Detectar formato por extension del filename
  4. Parsear con funcion especifica (_parse_csv o _parse_xlsx)
  5. Verificar que len(rows) <= MAX_STUDENTS
  6. Verificar que len(rows) > 0
  7. Insertar via ORM (upsert: actualizar si document_number ya existe en el modulo)

Respuesta exitosa:
  HTTP 200 { "imported": N }

Errores posibles:
  415 — tipo de archivo no permitido
  413 — archivo supera 2 MB
  422 — error de parsing, campo invalido, formula detectada, encoding incorrecto
  404 — modulo no existe o no pertenece al usuario autenticado

Efectos colaterales:
  - Registra evento student_imported en security_events con module_id y count
```

### 17.4 Nota sobre F15 — reutilizacion del parser defensivo

Los endpoints de carga masiva del administrador (F15) reutilizan los mismos controles del parser de F03: mismo limite de 2 MB, mismos MIME types, misma validacion de encoding UTF-8, mismos regex campo por campo, misma regla de rechazo por prefijos de formula. El unico diferencial es que F15 opera con `HTTP 207 Multi-Status` (procesamiento parcial con reporte de errores por fila) en lugar del `HTTP 200` de exito total de F03.

---

## 18. Conformidad con la Guía de Usabilidad y Estilos IUB (DG-TSI-09-V4)

> Esta sección es autónoma: un desarrollador frontend que la lea de forma aislada obtiene toda la información necesaria para implementar los estándares visuales y de usabilidad de la Institución Universitaria de Barranquilla. Referencia normativa: Guía DG-TSI-09-V4, vigente desde el 24/04/2026.

---

### 18.1 Arquitectura de Información

La Guía define cuatro directrices en su sección 4.1. A continuación se mapea cada una a criterios concretos de la app:

#### 18.1.1 Navegación global consistente (Guía §4.1.1)

El diseño gráfico del header, el menú de navegación y el footer debe mantenerse idéntico en todas las pantallas de la app, independientemente del rol del usuario autenticado o del estado del flujo en el que se encuentre.

**Criterios de aceptación:**
- El header (logo, nombre de la app, menú de navegación principal y nombre del usuario autenticado) es el mismo componente HTML reutilizado en todas las páginas; no se reconstruye con layouts distintos por pantalla.
- El footer (datos de contacto institucionales, enlaces externos a otras instituciones) es el mismo componente en todas las páginas.
- El menú de navegación muestra las opciones activas según el rol; los ítems inaccesibles se ocultan (no se muestran deshabilitados), pero la estructura visual del menú no cambia.
- No está cubierto en versiones anteriores del PRD; es un requerimiento nuevo derivado de la Guía.

#### 18.1.2 Ruta de migas / breadcrumb (Guía §4.1.2)

La app debe mostrar la ruta de navegación recorrida por el usuario en todo momento, excepto en la pantalla de login.

**Criterios de aceptación:**
- Toda pantalla interior (post-login) muestra un breadcrumb en la parte superior del área de contenido, por encima del título de la página.
- El breadcrumb refleja la jerarquía real de navegación. Ejemplos:
  - `Inicio > Periodos > TGA RA1 2024-2 > Contabilidad I — Grupo A > Calificaciones`
  - `Inicio > Admin > Usuarios`
- Cada segmento del breadcrumb (excepto el último, que es la página actual) es un enlace clicable que navega al nivel correspondiente.
- El último segmento (página actual) no es un enlace; es texto simple.
- En el wizard del docente (F05), el breadcrumb muestra el nombre del módulo como ancla fija; los pasos del stepper (Info General → Estudiantes → …) se muestran aparte como indicador de progreso, no como parte del breadcrumb.
- No está cubierto en versiones anteriores del PRD; es un requerimiento nuevo.

#### 18.1.3 URLs limpios (Guía §4.1.3)

Las URLs de la app deben ser legibles, sin variables de query string ni caracteres especiales en los segmentos de ruta.

**Criterios de aceptación:**
- Las URLs de navegación usan segmentos semánticos en minúsculas separados por guiones. Ejemplos correctos:
  - `/periods/2024-2/modules/contabilidad-1-grupo-a/assessments`
  - `/admin/users`
  - `/periods/2024-2/report`
- No se usan query strings para identificar recursos (incorrecto: `/module?id=42&period=7`).
- Los IDs numéricos de base de datos pueden aparecer en la URL solo cuando no existe un slug legible; en ese caso se prefieren IDs compuestos descriptivos (ej. `/periods/12/modules/34`) sobre query strings.
- Las URLs de la API REST (prefijo `/api/v1/`) no están sujetas a esta directriz de legibilidad; aplica exclusivamente a las URLs del frontend.
- No está cubierto en versiones anteriores del PRD; es un requerimiento nuevo.

#### 18.1.4 Enlaces bien formulados (Guía §4.1.4)

Ningún enlace en la app puede usar textos genéricos como "ver más", "clic aquí", "aquí" o "link". El texto de cada enlace debe describir con precisión el destino o la acción.

**Criterios de aceptación:**
- Todos los elementos `<a>` y `<button>` tienen texto descriptivo del destino o la acción. Ejemplos correctos:
  - "Ver reporte del periodo TGA RA1 2024-2"
  - "Descargar informe del líder en PDF"
  - "Continuar con Contabilidad I — Grupo A"
- Los iconos usados como enlaces (ej. icono de descarga, icono de edición) tienen atributo `aria-label` con texto descriptivo.
- Los botones de acción en tablas (ej. "Comenzar →", "Ver →") incluyen el nombre del recurso al que aplican en el `aria-label` cuando el texto visible solo muestra la acción: `aria-label="Comenzar Contabilidad I Grupo A"`.
- Aplica a todas las pantallas del flujo docente, dashboard del líder y panel de administrador.
- No está cubierto en versiones anteriores del PRD; es un requerimiento nuevo.

---

### 18.2 Estilo Visual

Las siguientes restricciones de diseño son de obligatorio cumplimiento en todo el CSS de la app.

#### 18.2.1 Paleta de colores institucionales

**Colores primarios (obligatorios):**

| Token CSS recomendado | Valor hex | RGB | Uso |
|---|---|---|---|
| `--color-primary` | `#1E2843` | R:30 G:40 B:67 | Fondo del header, elementos de navegación activos, encabezados de sección |
| `--color-accent` | `#FFDF2D` | R:255 G:223 B:45 | Acentos, botones de acción primaria, indicadores de estado activo |

**Colores complementarios grises (obligatorios para fondos y separadores):**

| Token CSS recomendado | Valor hex | RGB | Uso |
|---|---|---|---|
| `--color-gray-light` | `#E9EAED` | R:233 G:234 B:237 | Fondos de secciones secundarias, bordes de tabla |
| `--color-gray-medium` | `#DEDFE4` | R:222 G:223 B:228 | Separadores, bordes de card |
| `--color-gray-off-white` | `#FAFAFA` | R:250 G:250 B:250 | Fondo del área de contenido principal |

**Criterios de aceptación:**
- Todo el CSS de la app define estos cinco valores como variables CSS (custom properties) en `:root` con los nombres de token indicados o equivalentes.
- Ningún componente usa colores de fondo o de texto que no pertenezcan a esta paleta o al blanco (`#FFFFFF`) y negro puros para texto de alto contraste.
- Los botones de acción primaria (ej. "Confirmar y Enviar", "Generar PDF") usan `--color-accent` como fondo y `--color-primary` como color de texto, garantizando contraste WCAG AA (ratio mínimo 4.5:1 para texto normal).

#### 18.2.2 Tipografía

**Familias de fuente permitidas (en orden de preferencia):**

```css
font-family: 'Open Sans', Arial, Helvetica, Verdana, sans-serif;
```

**Criterios de aceptación:**
- La propiedad `font-family` del `body` usa exclusivamente las fuentes listadas. No se cargan fuentes externas (Google Fonts, Adobe Fonts u otras CDN) sin aprobación explícita de la Dirección de Comunicaciones Estratégicas de la IUB.
- Si se carga Open Sans desde una CDN aprobada, se declara `Arial` como fallback inmediato para garantizar que el sistema funciona sin conexión a internet (entorno de intranet).
- No se usan fuentes decorativas, monoespaciadas (salvo en bloques de código técnico) ni con serif en el contenido de la interfaz.

#### 18.2.3 Logo institucional

**Criterios de aceptación:**
- El logo de la IUB está presente en el header de **todas** las pantallas post-login y en la pantalla de login.
- El logo se ubica en la **esquina superior izquierda** del header.
- Sobre fondos claros se usa la versión estándar del logo; sobre el fondo `#1E2843` del header se usa la **versión sobre fondo oscuro** (variante de contraste blanco/amarillo).
- El logo es un enlace (`<a href="/">`) que redirige al dashboard del usuario autenticado (inicio de la app). Ver también §18.3 criterio de "vínculo a la página de inicio".
- El logo tiene atributo `alt="Institución Universitaria de Barranquilla — Inicio"`.
- El logo nunca se estira, recorta ni rota. Se muestra en su tamaño real o escalado proporcionalmente con CSS manteniendo el aspect ratio.

#### 18.2.4 Estructura de página

Toda pantalla de la app sigue el esquema de tres secciones definido por la Guía:

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  Logo IUB (izq.) | Nav | Usuario (der.) │
├─────────────────────────────────────────┤
│  CONTENIDO                              │
│  Breadcrumb                             │
│  Título de la página (H1)               │
│  Cuerpo principal                       │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  Links institucionales | Contacto       │
└─────────────────────────────────────────┘
```

**Criterios de aceptación:**
- El HTML de cada página tiene exactamente un elemento `<header>`, un elemento `<main>` y un elemento `<footer>` como estructura semántica principal.
- El `<header>` contiene el logo y la navegación global.
- El `<main>` contiene el breadcrumb, el H1 y el contenido de la página.
- El `<footer>` contiene los enlaces a otras instituciones e información de contacto institucional (dirección, teléfono, correo) de la IUB.
- El área de contenido puede tener una, dos o tres columnas según el tipo de pantalla (ver Guía §3.1.1.2), pero siempre dentro del elemento `<main>`.

---

### 18.3 Diseño de Interfaz de Usuario

Criterios de aceptación verificables derivados de la sección 4.2 de la Guía:

#### 18.3.1 Justificación del texto (Guía §4.2.1)

- Todo el texto de contenido (párrafos, etiquetas, celdas de tabla, mensajes de error, placeholders) está alineado a la **izquierda** (`text-align: left`).
- No se usa `text-align: justify` en ningún componente de la interfaz.
- Los títulos (`H1`–`H6`) también están alineados a la izquierda.
- Excepción permitida: los números en columnas de tablas de datos pueden centrarse o alinearse a la derecha si mejora la legibilidad comparativa (ej. columna de porcentajes en la tabla de distribución de niveles).

#### 18.3.2 Ancho del cuerpo de texto (Guía §4.2.2)

- El ancho de las columnas de texto narrativo (instrucciones, análisis cualitativos, placeholders largos) está limitado para mantener entre **60 y 80 caracteres por línea** a tamaño de fuente base (16px).
- Implementación recomendada: `max-width: 65ch` en los contenedores de texto narrativo.
- Las tablas de datos (grilla de calificaciones, tabla de distribución de niveles) quedan exentas de esta restricción; usan el ancho disponible del contenedor.

#### 18.3.3 Texto subrayado (Guía §4.2.3)

- El subrayado de texto se reserva **exclusivamente** para hipervínculos (`<a>`).
- Ningún texto decorativo, énfasis, título o etiqueta usa `text-decoration: underline`.
- Los enlaces en el breadcrumb y en el cuerpo de texto son subrayados por defecto; se puede quitar el subrayado en la navegación del menú principal si el contexto visual lo hace suficientemente reconocible como navegación.

#### 18.3.4 Sin desplazamiento horizontal (Guía §4.2.4)

- A resolución de **1024×768 px** ninguna pantalla de la app genera una barra de desplazamiento horizontal.
- La grilla de calificaciones (Pantalla 4, F03) — que puede tener hasta 15 columnas de PI — implementa scroll horizontal **dentro del contenedor de la tabla**, no en el viewport. El resto de la interfaz (header, breadcrumb, controles de estado) permanece fijo.
- Verificación: prueba manual en Chrome DevTools con viewport 1024×768 px en cada pantalla antes de pasar a producción.

#### 18.3.5 Vínculo del logo a la página de inicio (Guía §4.2.5)

- El logo del IUB en el header es siempre un enlace `<a href="/">` que redirige al dashboard del usuario autenticado.
- El destino del enlace es el mismo para todos los roles: `/` (el backend redirige al dashboard correspondiente según el rol).
- En la pantalla de login el logo no es un enlace (no hay "inicio" al que navegar sin autenticación).

#### 18.3.6 CSS para diferentes formatos (Guía §4.2.6)

- La app implementa hojas de estilo para dos formatos mediante media queries:
  - **Pantalla (`screen`):** estilos generales de la interfaz.
  - **Impresión (`print`):** estilos optimizados para impresión (ocultar header de navegación, footer de links, botones de acción; mostrar solo el contenido relevante con márgenes apropiados).
- El diseño es **responsive** (mobile-first con breakpoints para tablet y desktop), por lo que no se requiere una hoja de estilo de móvil separada — es suficiente con los breakpoints del diseño responsive más la hoja de impresión.
- Los estilos de impresión se declaran en el mismo archivo CSS usando `@media print { ... }`.

#### 18.3.7 Compatibilidad con navegadores (Guía §4.2.7)

- La app funciona correctamente en las versiones actuales de **Google Chrome**, **Mozilla Firefox** y **Microsoft Edge** como mínimo.
- No se requiere compatibilidad con Internet Explorer (fuera de soporte desde 2022).
- Los estilos CSS y el JavaScript de la interfaz no usan APIs experimentales sin fallback.

#### 18.3.8 Vínculos visitados con color diferenciado (Guía §4.2.8)

- Los enlaces visitados muestran un color diferente al de los enlaces no visitados usando el pseudo-selector CSS `:visited`.
- Implementación de referencia:

```css
a:link    { color: #1E2843; }          /* azul oscuro institucional */
a:visited { color: #6B4FA0; }          /* violeta diferenciado */
a:hover   { color: #FFDF2D; text-decoration: underline; }
a:active  { color: #FFDF2D; }
```

- Esta distinción aplica a los enlaces de contenido (breadcrumb, cuerpo de texto). Los botones de navegación del menú principal pueden omitirla por razones de diseño, siempre que los colores del menú sean consistentes con la paleta institucional.

---

### 18.4 Diseño de Interacción

Criterios de aceptación derivados de la sección 4.3 de la Guía:

#### 18.4.1 Campos obligatorios (Guía §4.3.1)

- Todo campo obligatorio en un formulario está marcado con un asterisco (`*`) visible junto a su etiqueta.
- El asterisco se coloca inmediatamente después del texto de la etiqueta, antes del campo: `Número de documento *`.
- Al pie del formulario (o en la primera aparición) se incluye la leyenda: `* Campo obligatorio`.
- Esta convención aplica a todos los formularios de la app: login, creación de período, rubrica, carga de estudiantes, análisis cualitativo y plan de acción.
- Los campos obligatorios también declaran el atributo HTML `required` para validación nativa del navegador como primera línea de defensa (además de la validación Pydantic en la API).

#### 18.4.2 Asociación de etiquetas y campos (Guía §4.3.2)

- Todo `<input>`, `<textarea>` y `<select>` tiene un elemento `<label>` asociado mediante el atributo `for` (que coincide con el `id` del campo).
- No se usa el atributo `placeholder` como sustituto de la etiqueta visible; el placeholder es texto orientador adicional (ver §18.4.4).
- En la grilla de calificaciones (Pantalla 4), los selectores de nivel por celda usan `<fieldset>` + `<legend>` para agrupar los radio buttons de cada PI por estudiante, cumpliendo la semántica de asociación.

#### 18.4.3 Sin ventanas emergentes (Guía §4.3.3)

- La app no abre ventanas emergentes (`window.open()`, `target="_blank"` con foco forzado, ni popups de JavaScript) en ningún nivel de navegación.
- **Nota de aplicación para esta app:** el modal de exclusión de estudiantes (F03) y el modal de confirmación de envío (F05) se implementan como elementos `<dialog>` HTML nativos (o equivalente accesible con `role="dialog"`) que se renderizan **dentro del DOM de la misma página**, sin abrir una nueva ventana ni pestaña del navegador. Esta implementación es conforme a la Guía: la directriz prohíbe popups de nueva ventana, no los diálogos modales accesibles dentro de la misma página.
- Los enlaces a documentos externos (ej. link a la página de login en correos de recordatorio F13) que se abran en nueva pestaña llevan atributo `rel="noopener noreferrer"` y una advertencia visual (ícono de enlace externo).

#### 18.4.4 Ejemplos en campos de formulario (Guía §4.3.4)

- Los campos que requieren un formato específico o que pueden resultar ambiguos incluyen un texto de ejemplo en el atributo `placeholder`.
- Campos con placeholder obligatorio en esta app:

| Campo | Placeholder de ejemplo |
|---|---|
| Email institucional (login) | `docente@unibarranquilla.edu.co` |
| ID interno del estudiante (carga manual) | `Ej: 20241001` |
| Número de documento | `Ej: 1234567890` |
| Nombre completo del estudiante | `Ej: García Pérez, María` |
| Fecha estimada del plan de acción | `Ej: 2025-01` (cuatrimestre) |
| Campo de análisis cualitativo por PI (F04) | Texto orientador definido en §F04 de este PRD |
| Campo de conclusiones del líder (F14) | `Escriba las conclusiones consolidadas para este PI...` |

- El placeholder desaparece al comenzar a escribir; el texto de ayuda no reemplaza a la etiqueta visible del campo.

---

### 18.5 Contenido

Criterios de aceptación derivados de la sección 4.4 de la Guía:

#### 18.5.1 Títulos y encabezados (Guía §4.4.1)

- Cada página tiene exactamente un elemento `<h1>` que describe el contenido principal de la pantalla. Ejemplos:
  - Login: `<h1>Acceso al Sistema de Assessment</h1>`
  - Dashboard docente: `<h1>Mis módulos — TGA RA1 2024-2</h1>`
  - Grilla de calificaciones: `<h1>Calificaciones — Contabilidad I, Grupo A</h1>`
- Los encabezados `<h2>`–`<h6>` se usan en orden lógico descendente sin saltar niveles (no se usa `<h3>` después de un `<h1>` si no hay `<h2>` intermedio).
- Los títulos son directos e informativos; no usan términos genéricos como "Información" o "Datos". El título describe lo que el usuario puede hacer o ver en esa sección.
- Las páginas con gran cantidad de información (ej. el reporte final, el informe del líder) se dividen en sub-secciones con encabezados `<h2>`/`<h3>` claramente titulados.

#### 18.5.2 Sin vínculos rotos (Guía §4.4.2)

- La app no debe contener enlaces rotos en ningún nivel de navegación.
- **Proceso de verificación:** antes de cada deploy a producción, ejecutar una verificación automática de vínculos mediante la extensión **Check My Links** (Chrome) o herramienta equivalente (ej. `linkchecker` en el pipeline CI) sobre la URL del entorno de staging.
- Los endpoints de la API que ya no existen devuelven `404` con mensaje claro; no redirigen silenciosamente a otra ruta.
- Los archivos estáticos referenciados en el HTML (CSS, JS, imágenes, plantillas CSV descargables) están versionados en el repositorio y no se eliminan sin actualizar las referencias.

#### 18.5.3 Páginas de confirmación (Guía §4.4.3)

- Toda acción que modifica estado de forma significativa o irreversible muestra un mensaje de confirmación explícito al usuario. Acciones cubiertas:

| Acción | Mecanismo de confirmación |
|---|---|
| Enviar módulo (F05) | Dialog de confirmación con resumen del módulo antes del submit (Pantalla 7, §13) |
| Cerrar período (F06) | Dialog de confirmación con lista de módulos pendientes si los hay |
| Excluir estudiante del assessment (F03) | Dialog de confirmación con selección de motivo (Pantalla 3, §13) |
| Descargar PDF del reporte ABET (F07) | Mensaje de confirmación inline: "El reporte fue generado exitosamente. [Descargar PDF]" |
| Descargar PDF/DOCX del informe del líder (F14) | Mensaje inline con nombre del archivo generado y timestamp |
| Carga masiva de estudiantes (F15) | Pantalla de resultados con conteo de registros importados y lista de errores por fila |
| Importación masiva de usuarios/rubricas/módulos (F15) | Misma pantalla de resultados `HTTP 207` |
| Envío de recordatorios a docentes (F13) | Mensaje inline: "Se enviaron N recordatorios correctamente." |

- Los mensajes de error de validación en formularios aparecen adyacentes al campo con error (no solo en un banner genérico arriba del formulario).
- Las acciones exitosas en formularios cortos (ej. guardar borrador de análisis) muestran un mensaje de confirmación no bloqueante (toast/snackbar) que desaparece automáticamente en 3 segundos.

---

### 18.6 Imágenes

Estándares derivados de la sección 3.2.4 de la Guía:

#### 18.6.1 Resolución y formato

- Las imágenes de contenido (fotografías institucionales, capturas de referencia) se publican a **72 dpi**.
- Las fotografías se guardan en formato **JPG** (`.jpg`).
- Los gráficos, iconos e ilustraciones se guardan en formato **PNG** (`.png`) o **SVG** (`.svg` — preferido para iconografía vectorial). El formato GIF solo se usa para animaciones simples si fueran necesarias; se desaconseja para contenido estático.
- No aplica para los iconos de UI del sistema (que usan una librería de iconos SVG inline o web font de iconos); aplica para imágenes de contenido editorial que pudieran agregarse al sistema en el futuro.

#### 18.6.2 Tamaño real de la imagen

- Las imágenes se insertan en su **tamaño real** (ancho y alto naturales) o escaladas proporcionalmente mediante CSS con `max-width: 100%; height: auto`.
- No se usa CSS para escalar una imagen a un tamaño significativamente diferente del original (ej. mostrar una imagen de 2000×1500 px escalada a 200×150 px vía CSS); en ese caso se debe redimensionar el archivo fuente.
- Esta directriz es especialmente relevante para el logo institucional: se usa el archivo en su tamaño correcto para el header, no una versión oversized escalada por CSS.

#### 18.6.3 Atributo `alt` descriptivo

- Toda imagen de contenido tiene un atributo `alt` con descripción significativa del contenido de la imagen.
- Las imágenes decorativas (fondos, separadores gráficos) tienen `alt=""` (vacío) para que los lectores de pantalla las ignoren.
- El logo institucional tiene `alt="Institución Universitaria de Barranquilla — Inicio"` (ver §18.2.3).
- Los iconos de acción con texto visible adyacente tienen `alt=""` (el texto visible ya describe la acción); los iconos sin texto visible tienen `aria-label` descriptivo (ver §18.1.4).

> **Nota de exclusión justificada:** La Guía menciona el tratamiento de imágenes en el contexto de contenido editorial (noticias, banners, galerías). La RA Assessment App es una aplicación de gestión interna sin contenido fotográfico editorial significativo. Las directrices de esta sección (§18.6) aplican principalmente al logo institucional y a cualquier imagen que pudiera agregarse en versiones futuras. No se requiere una gestión editorial de imágenes en v1.

---

### 18.7 Tabla de Conformidad

Checklist de todas las directrices de las secciones 4.1–4.4 de la Guía DG-TSI-09-V4 y su estado en la versión 2.2 del PRD:

| Directriz IUB (sección) | Estado en v2.2 | Referencia en el PRD |
|---|---|---|
| **4.1 — Arquitectura de información** | | |
| Navegación global consistente (§4.1.1) | ✅ Cubierta | §18.1.1 |
| Ruta de migas / breadcrumb (§4.1.2) | ✅ Cubierta | §18.1.2 |
| URLs limpios (§4.1.3) | ✅ Cubierta | §18.1.3 |
| Enlaces bien formulados (§4.1.4) | ✅ Cubierta | §18.1.4 |
| **4.2 — Diseño de interfaz de usuario** | | |
| Texto alineado a la izquierda (§4.2.1) | ✅ Cubierta | §18.3.1 |
| Ancho del cuerpo de texto 60–80 cpl (§4.2.2) | ✅ Cubierta | §18.3.2 |
| Texto subrayado solo para hipervínculos (§4.2.3) | ✅ Cubierta | §18.3.3 |
| Sin desplazamiento horizontal a 1024×768 (§4.2.4) | ✅ Cubierta | §18.3.4 |
| Logo vinculado a la página de inicio (§4.2.5) | ✅ Cubierta | §18.3.5 y §18.2.3 |
| CSS para pantalla, móvil e impresión (§4.2.6) | ✅ Cubierta | §18.3.6 |
| Independencia del navegador (§4.2.7) | ✅ Cubierta | §18.3.7 |
| Vínculos visitados con color diferenciado (§4.2.8) | ✅ Cubierta | §18.3.8 |
| **4.3 — Diseño de interacción** | | |
| Campos obligatorios marcados con `*` (§4.3.1) | ✅ Cubierta | §18.4.1 y §13 (Pantalla 3) |
| Asociación de etiquetas y campos (§4.3.2) | ✅ Cubierta | §18.4.2 |
| Sin ventanas emergentes (§4.3.3) | ✅ Cubierta | §18.4.3 |
| Ejemplos / placeholders en campos especiales (§4.3.4) | ✅ Cubierta | §18.4.4 y §F04 |
| **4.4 — Contenido** | | |
| Títulos y encabezados claros y semánticos (§4.4.1) | ✅ Cubierta | §18.5.1 |
| Sin vínculos rotos (§4.4.2) | ✅ Cubierta | §18.5.2 |
| Páginas / mensajes de confirmación (§4.4.3) | ✅ Cubierta | §18.5.3 y §13 (Pantalla 7) |
| **3.2 — Estilo visual** | | |
| Colores institucionales primarios y complementarios (§3.2.2) | ✅ Cubierta | §18.2.1 y §9 |
| Tipografía permitida (§3.2.3) | ✅ Cubierta | §18.2.2 y §9 |
| Logo: ubicación, versiones y vínculo (§3.2.1) | ✅ Cubierta | §18.2.3 |
| Estructura header + contenido + footer (§3.1.1.2) | ✅ Cubierta | §18.2.4 |
| Imágenes: resolución, formato y atributo alt (§3.2.4) | ✅ Cubierta | §18.6 |

---

*Fin del PRD v2.2 — RA Assessment App*
*Próxima revisión programada: antes del inicio de S4 o ante cambios de infraestructura*
