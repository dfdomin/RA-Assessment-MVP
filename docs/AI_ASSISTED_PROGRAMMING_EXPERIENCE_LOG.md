# Bitacora de experiencia de programacion asistida por IA

Fecha de registro: 2026-05-15

Proyecto: RA Assessment App

Repositorio privado: [URL omitida deliberadamente por privacidad]

Nota de privacidad: este documento evita incluir identificadores personales, nombres de cuenta, rutas locales completas, tokens, URLs privadas o datos institucionales sensibles. Cuando una accion tecnica involucra esos datos, se documenta el tipo de accion y su resultado sin revelar el valor concreto.

## Proposito del registro

Este documento conserva una memoria de trabajo sobre la experiencia de desarrollo del proyecto RA Assessment App mediante programacion asistida por IA. Su objetivo es servir como insumo inicial para un futuro articulo cientifico sobre practicas, beneficios, limitaciones y dinamicas de colaboracion humano-IA durante el desarrollo de software.

## Marco metodologico comun para las entradas

Para homogeneizar el registro, cada entrada debe poder leerse desde tres lentes metodologicos:

- **Prompt engineering y andamiaje de instrucciones**: siguiendo la taxonomia de tecnicas de prompt engineering descrita en Springer 2025 (doi:10.1007/s11704-025-50058-z), se documenta si la tarea uso instrucciones de rol, memoria contextual, descomposicion, verificacion o refinamiento.
- **Transparencia y reproducibilidad**: siguiendo Springer 2025 (doi:10.1186/s44342-025-00057-0), se registran herramientas, pasos, limites, intervencion humana y evidencia verificable, evitando datos sensibles.
- **Programacion por pares humano-IA**: siguiendo PairCoder (arXiv:2409.05001), se analiza la division practica entre direccion/planificacion, ejecucion tecnica, feedback por pruebas y refinamiento iterativo.

Este marco no afirma que el proyecto replique exactamente los experimentos de esos articulos. Se usa como lente de documentacion para hacer comparables las entradas de la bitacora.

## Contexto general del proyecto

RA Assessment App es una aplicacion orientada a apoyar procesos de evaluacion relacionados con resultados de aprendizaje. Durante la sesion se trabajo sobre un repositorio local sincronizado en nube y organizado con documentacion tecnica en `docs/`, modelos de dominio en `src/models/` y recursos de interfaz en `frontend/`.

El proyecto ya contaba con documentacion base, entre ella:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_PLAN.md`
- `docs/TRACEABILITY_MATRIX.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/llm_council_ra_assessment_resultado.md`

## Actividades realizadas con asistencia de IA

### 1. Revision del estado local del repositorio

Se inspecciono el estado del repositorio Git local para confirmar la rama activa, los remotos configurados y los commits existentes.

Hallazgos principales:

- La rama activa era `main`.
- El repositorio ya tenia remoto configurado como `origin`.
- El remoto apuntaba a un repositorio privado en GitHub.
- El historial local contenia dos commits principales:
  - `11cadff Initialize RA Assessment project`
  - `2d6ed49 Se incorporta arquitectura exagonal como solucion ante f016 que plantea integracion con BD externa`

### 2. Configuracion de autenticacion con GitHub CLI

Se intento usar GitHub CLI (`gh`) para consultar y configurar el repositorio remoto. Inicialmente, la sesion guardada de GitHub CLI tenia un token invalido asociado a una cuenta previa.

Acciones realizadas:

- Se identifico el fallo de autenticacion con `gh auth status`.
- Se elimino la sesion invalida de GitHub CLI.
- Se inicio un nuevo flujo de autenticacion web mediante codigo de dispositivo.
- Se autorizo GitHub CLI correctamente con la cuenta propietaria del repositorio.
- Se configuro Git para usar las credenciales gestionadas por GitHub CLI.

Resultado:

- GitHub CLI quedo autenticado con la cuenta autorizada.
- Git pudo usar las credenciales correctas para comunicarse con el repositorio privado.

### 3. Verificacion del repositorio en GitHub

Se verifico el repositorio remoto mediante GitHub CLI.

Resultado confirmado:

- Repositorio: repositorio privado del proyecto RA Assessment App
- URL: omitida por privacidad
- Visibilidad: `PRIVATE`
- Rama por defecto: `main`

### 4. Publicacion del repositorio local

Despues de confirmar la existencia del repositorio privado, se verifico que la rama local `main` no tenia upstream configurado. Luego se hizo `push` de la rama local hacia GitHub y se dejo enlazada con `origin/main`.

Resultado:

- La rama `main` fue subida exitosamente a GitHub.
- La rama local `main` quedo rastreando `origin/main`.
- El estado local quedo sincronizado con el remoto.

## Dinamica de colaboracion humano-IA observada

La interaccion combino acciones tecnicas, diagnostico incremental y autorizaciones humanas. La IA no reemplazo completamente la intervencion humana: requirio que el usuario completara la autenticacion en GitHub mediante navegador y codigo de dispositivo. Esto evidencia una division practica de responsabilidades:

- La IA ejecuto inspeccion, diagnostico, comandos Git/GitHub y verificacion.
- El usuario autorizo operaciones sensibles, como autenticacion y acceso a GitHub.
- La IA adapto el procedimiento ante errores de autenticacion y restricciones del entorno.

## Eventos relevantes para analisis academico

### Manejo de errores

El primer obstaculo fue un token invalido de GitHub CLI. En lugar de asumir que GitHub estaba caido o que el repositorio no existia, se aislo el problema revisando:

- Estado de autenticacion de `gh`.
- Configuracion del remoto Git.
- Existencia del repositorio mediante la API de GitHub.
- Credenciales usadas por Git para operaciones HTTPS.

Este flujo muestra una estrategia de depuracion incremental asistida por IA.

### Seguridad y control humano

Las operaciones sensibles no fueron ejecutadas de forma opaca. El entorno solicito aprobacion para acciones que requerian acceso fuera del sandbox o comunicacion con GitHub. Este patron puede analizarse como una forma de control humano sobre acciones con impacto externo.

### Trazabilidad

La sesion dejo rastros verificables:

- Comandos ejecutados.
- Estado del repositorio local.
- URL del repositorio remoto.
- Visibilidad privada confirmada.
- Rama `main` sincronizada con `origin/main`.

Esto es relevante para discutir reproducibilidad y auditabilidad en programacion asistida por IA.

## Posibles preguntas de investigacion

- Como cambia el flujo de desarrollo cuando una IA actua como copiloto operativo y no solo como generador de codigo?
- Que tipos de decisiones deben permanecer bajo control humano en entornos de desarrollo asistido por IA?
- Como contribuye la IA a la depuracion de problemas de configuracion, autenticacion y publicacion de repositorios?
- Que riesgos aparecen al delegar comandos de Git y GitHub a un asistente de IA?
- Que evidencias son necesarias para documentar cientificamente una experiencia de AI-assisted programming?

## Posibles categorias de analisis

- Productividad percibida.
- Reduccion de carga cognitiva.
- Resolucion de errores operativos.
- Seguridad y autorizacion humana.
- Transparencia del proceso.
- Trazabilidad de decisiones.
- Limitaciones del asistente por sandbox, autenticacion y acceso a red.

## Reflexion preliminar

La experiencia muestra que la programacion asistida por IA no se limita a escribir codigo. Tambien incluye gestion del repositorio, configuracion de herramientas, diagnostico de autenticacion, interpretacion de mensajes de error y documentacion del proceso. En este caso, la IA funciono como un agente tecnico que mantuvo continuidad entre diagnostico, accion y verificacion, mientras que el usuario conservo el control de decisiones externas y permisos.

Para un articulo cientifico, esta sesion puede presentarse como un caso de estudio de colaboracion humano-IA en tareas de ingenieria de software, con enfasis en la publicacion segura de un repositorio privado y la construccion de memoria documental del proceso.

## Comandos principales asociados a la experiencia

```bash
git status --short --branch
git remote -v
gh auth status
gh auth logout -h github.com -u [cuenta-omitida]
gh auth login -h github.com --web --git-protocol https
gh repo view [repositorio-privado] --json nameWithOwner,visibility,url,defaultBranchRef
gh auth setup-git
git ls-remote --heads origin main
git push -u origin main
```

## Estado final registrado

```text
Repositorio: [repositorio privado omitido]
URL: [omitida por privacidad]
Visibilidad: PRIVATE
Rama por defecto: main
Estado local: main...origin/main
```

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: la entrada inicial uso instrucciones de tarea orientadas a diagnostico operativo: revisar estado Git, autenticacion, repositorio remoto y sincronizacion. El asistente no recibio solo una pregunta aislada, sino una secuencia de objetivos verificables que funcionaron como andamiaje para decidir comandos y pasos.

**Transparencia y reproducibilidad**: se conservaron comandos principales, estados observados y resultados sin exponer credenciales, URLs privadas ni identificadores personales. Esto permite reconstruir el flujo de trabajo de forma razonable sin comprometer seguridad.

**Programacion por pares humano-IA**: el usuario mantuvo control sobre autorizaciones sensibles, especialmente autenticacion web y acceso al repositorio privado. Codex asumio el rol operativo de diagnosticar, ejecutar comandos, interpretar errores y verificar el resultado. El ciclo se parece a una pareja conductor-navegador: el humano define limites y permisos; la IA conduce tareas tecnicas bajo supervision.

## Entrada documental: implementacion asistida de modelos de negocio S1

Fecha y hora de registro: 2026-05-15 22:40:17 -05

### Objetivo de la intervencion

El usuario solicito retomar el trabajo del proyecto leyendo la memoria operativa del repositorio y ejecutar directamente la siguiente tarea pendiente prioritaria del sprint S1. La tarea identificada fue la creacion de modelos SQLAlchemy para el dominio inicial de negocio: resultados de aprendizaje, rubricas, indicadores de desempeno, niveles, umbrales, modulos y asignaciones docentes.

### Acciones realizadas por Codex

Codex actuo como agente de desarrollo dentro del repositorio local. Primero leyo los archivos de memoria del proyecto para reconstruir el estado actual y localizar la siguiente tarea pendiente. Despues contrasto esa tarea con el modelo de datos documentado para evitar implementar entidades desconectadas de la arquitectura definida.

La intervencion tecnica incluyo:

- Lectura de la memoria del proyecto y lista priorizada de tareas.
- Identificacion de la tarea S1-06 como siguiente unidad de trabajo.
- Revision del modelo de datos documentado para las tablas de negocio de S1.
- Revision de los modelos existentes para mantener consistencia con el estilo local del codigo.
- Creacion de modelos ORM para entidades de rubricas, indicadores, niveles, umbrales, modulos y asignaciones.
- Ajuste del modelo de periodo para alinearlo con el modelo de datos documentado.
- Actualizacion del indice de modelos para permitir importaciones centralizadas.
- Ajuste de la configuracion de Alembic para que la metadata incluya los modelos nuevos.
- Ejecucion de verificaciones automatizadas mediante imports y pruebas existentes.
- Actualizacion de los archivos de memoria del proyecto con el avance realizado.

### Resultado tecnico

La tarea S1-06 quedo implementada a nivel de modelos de dominio. Las clases nuevas quedaron disponibles desde el paquete de modelos y la suite de pruebas existente continuo pasando completamente. Tambien se elimino una advertencia de SQLAlchemy relacionada con una dependencia circular esperada entre periodos y rubricas, declarando explicitamente la relacion para que el ORM pudiera gestionarla de forma limpia.

### Verificacion

Se ejecuto una verificacion de importacion de modelos para confirmar que las entidades principales podian cargarse sin error. Posteriormente se ejecuto la suite de pruebas automatizadas del proyecto. El resultado fue satisfactorio: todas las pruebas existentes pasaron.

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: la tarea se ejecuto usando memoria contextual del repositorio (`memory/PROJECT_STATE.md` y `memory/NEXT_STEPS.md`) y documentacion tecnica (`docs/DATA_MODEL.md`). Esto corresponde a una estrategia de prompting con contexto externo y descomposicion de tarea: primero ubicar la tarea pendiente, luego contrastarla con el modelo de datos, despues implementar y verificar.

**Transparencia y reproducibilidad**: la entrada registra objetivo, acciones, resultado y verificacion. La evidencia principal fue la importacion de modelos y la suite de pruebas, lo que permite distinguir entre "codigo escrito" y "codigo comprobado".

**Programacion por pares humano-IA**: el usuario definio la regla de continuidad: leer memoria y ejecutar la siguiente tarea pendiente. Codex funciono como implementador, pero tambien como navegador tecnico al comparar la memoria con la arquitectura y escoger una solucion coherente con el repositorio. El feedback vino de las pruebas automatizadas y de la carga correcta de modelos.

### Observaciones para analisis cientifico

Esta intervencion muestra un patron de trabajo de AI-assisted programming basado en memoria persistente del proyecto. La IA no partio de una instruccion aislada, sino de documentos de continuidad mantenidos dentro del repositorio. Ese mecanismo permitio:

- Recuperar contexto tecnico sin una explicacion extensa del usuario.
- Seleccionar una tarea pendiente en funcion de prioridad y dependencia.
- Implementar cambios acotados y coherentes con la arquitectura existente.
- Verificar el impacto mediante pruebas automatizadas.
- Actualizar la memoria del proyecto para futuras sesiones.

Desde una perspectiva investigativa, este episodio puede analizarse como un ejemplo de continuidad cognitiva mediada por artefactos: los archivos de memoria actuan como puente entre sesiones, reducen perdida de contexto y permiten que el asistente mantenga una linea de trabajo trazable.

### Limites y controles

No se incluyeron credenciales, identificadores personales, tokens, rutas completas ni URLs privadas en esta entrada. La documentacion describe las acciones realizadas por el asistente y sus resultados, pero omite valores concretos que puedan comprometer privacidad o seguridad del proyecto.

## Entrada documental: implementacion asistida del router de periodos S1

Fecha y hora de registro: 2026-05-16 06:16:23 -05

### Objetivo de la intervencion

El usuario solicito retomar el trabajo del proyecto desde los archivos de memoria operativa y ejecutar directamente la siguiente tarea pendiente de la fase actual. Al revisar el repositorio, se identifico que los schemas de periodos ya existian aunque la memoria no los habia marcado como completados. La siguiente unidad efectiva de trabajo fue la tarea S1-14: crear el router de periodos con operaciones GET y POST.

### Acciones realizadas por Codex

La IA reconstruyo el estado del proyecto leyendo `memory/PROJECT_STATE.md`, `memory/NEXT_STEPS.md` y la documentacion de la API. Luego inspecciono los modelos ORM y los routers existentes para mantener el estilo local del codigo.

La intervencion tecnica incluyo:

- Confirmacion de que `src/api/schemas/periods.py` ya contenia los schemas requeridos para S1-13.
- Escritura previa de pruebas automatizadas para el comportamiento esperado de periodos.
- Verificacion del estado rojo inicial: las pruebas fallaron con 404 porque `/api/v1/periods` no existia.
- Creacion de `src/api/routers/periods.py`.
- Registro del router de periodos en `src/api/main.py`.
- Implementacion de listado de periodos con conteos de modulos.
- Implementacion de filtrado por rol: admin y lider ven todos los periodos; docente solo ve periodos con modulos asignados.
- Implementacion de creacion de periodos restringida a admin/lider.
- Validacion de resultado de aprendizaje existente, nombre duplicado y periodo origen para clonacion opcional.
- Soporte inicial para clonar modulos, asignaciones y rubrica activa desde un periodo origen.
- Ampliacion de pruebas para verificar clonacion de modulos y asignaciones docentes mediante `clone_from_period_id`.
- Actualizacion de archivos de memoria del proyecto y de tareas pendientes.

### Resultado tecnico

La API incorporo el endpoint `GET /api/v1/periods` para usuarios autenticados y el endpoint `POST /api/v1/periods` para roles administrativos. Las pruebas cubren listado general, filtrado docente, creacion por lider y bloqueo de creacion por docente.

### Verificacion

Se ejecuto primero la prueba especifica de periodos y luego la suite completa del repositorio. La prueba especifica paso con 5/5 casos exitosos y la suite completa paso con 16/16 pruebas exitosas.

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: la tarea se beneficio de instrucciones de proceso instaladas en el entorno, especialmente el flujo TDD y la verificacion antes de cierre. La memoria del proyecto actuo como contexto recuperado, mientras que las pruebas nuevas tradujeron la especificacion en comportamiento observable.

**Transparencia y reproducibilidad**: la entrada conserva el estado rojo inicial, el cambio implementado y los resultados de verificacion. Esto hace visible el refinamiento: la ruta fallaba con 404, luego se implemento el router y despues se confirmo el comportamiento con pruebas especificas y suite completa.

**Programacion por pares humano-IA**: Codex asumio un rol doble: navegador al reconciliar memoria y codigo real, y conductor al escribir tests, router y registro en `main.py`. El usuario proporciono direccion general y criterio de continuidad. La retroalimentacion no fue solamente conversacional, sino ejecutable mediante `pytest`.

### Observaciones para analisis cientifico

Este episodio es util para estudiar continuidad y correccion de memoria en programacion asistida por IA. La memoria del proyecto indicaba S1-13 como pendiente, pero el repositorio ya contenia el archivo correspondiente. La IA tuvo que reconciliar la fuente documental con el estado real del codigo antes de decidir la siguiente tarea. Esto muestra que los artefactos de memoria son valiosos, pero requieren verificacion contra el repositorio para evitar trabajo duplicado.

Tambien se observo un flujo TDD asistido por IA: se escribieron pruebas que fallaron por ausencia de ruta, se implemento el router minimo coherente con el dominio y luego se verifico la suite completa. Este patron deja evidencia util para un paper sobre como la IA puede sostener ciclos de desarrollo verificables, no solo generar codigo.

### Limites y controles

No se documentaron credenciales, datos personales reales, tokens, URLs privadas ni rutas locales completas. Los usuarios y datos incluidos en pruebas son sinteticos y limitados al entorno de desarrollo.

## Entrada documental: habilidades instaladas, herramientas auxiliares y marco metodologico

Fecha y hora de registro: 2026-05-16

### Objetivo de la entrada

El usuario solicito documentar, con fines investigativos, que el asistente no opero solamente como un modelo conversacional generico, sino dentro de un entorno con habilidades instaladas y herramientas de desarrollo. Esta distincion es relevante para un futuro paper porque permite separar tres capas de la experiencia:

- El modelo de IA conversacional usado como agente de programacion.
- Las habilidades procedimentales instaladas que guian el comportamiento del agente.
- Las herramientas externas o locales usadas para inspeccionar, modificar y verificar el repositorio.

### Habilidades instaladas observadas

El nombre correcto observado en el entorno fue **Superpowers**. La mencion del usuario a "superkills" parece corresponder a una confusion de nombre, no a una herramienta diferente registrada en esta sesion.

Superpowers funciono como un conjunto de habilidades metodologicas cargadas en Codex. No son comandos de shell ni librerias del proyecto; son guias de proceso que condicionan como el agente debe trabajar. Entre las habilidades relevantes para las sesiones documentadas estuvieron:

- `using-superpowers`: obliga a revisar si existe una habilidad aplicable antes de actuar.
- `test-driven-development`: orienta a escribir o ejecutar pruebas antes de considerar completa una implementacion.
- `verification-before-completion`: exige verificar con comandos concretos antes de afirmar que una tarea quedo terminada.

Estas habilidades ayudaron a mejorar la ejecucion de tareas de varias formas:

- Redujeron la improvisacion del agente, obligandolo a reconstruir contexto antes de editar codigo.
- Favorecieron ciclos de trabajo verificables: prueba roja, implementacion, prueba verde.
- Forzaron a cerrar las tareas con evidencia, por ejemplo resultados de `pytest`, imports o escaneos de seguridad.
- Ayudaron a mantener la trazabilidad entre la memoria del proyecto, la tarea pendiente y el cambio tecnico realizado.
- Disminuyeron el riesgo de marcar tareas como completas solo por inspeccion superficial.

Desde el punto de vista investigativo, Superpowers puede analizarse como una forma de "scaffolding" metodologico para agentes de programacion: no reemplaza al juicio humano, pero estructura el comportamiento del asistente para que sea mas auditable, incremental y reproducible.

### Herramientas no nombradas explicitamente por el usuario

Al revisar la bitacora existente y archivos de memoria relacionados, se identifican varias herramientas o mecanismos adicionales que participaron en la experiencia, aunque no todas fueron mencionadas explicitamente por el usuario:

- **Codex**: agente principal de programacion asistida que interactuo con el repositorio local.
- **Shell local**: entorno de ejecucion para comandos de inspeccion, pruebas y verificacion.
- **Git**: usado para revisar estado local, ramas, remotos, commits y sincronizacion.
- **GitHub CLI (`gh`)**: usado para autenticacion, verificacion del repositorio privado y configuracion de credenciales.
- **GitHub API / GitHub remoto**: usado indirectamente para confirmar existencia, visibilidad y metadata del repositorio.
- **`rg` y `sed`**: usados como herramientas de lectura y busqueda rapida dentro del repositorio.
- **`apply_patch`**: mecanismo de edicion controlada de archivos desde el asistente.
- **pytest**: herramienta central de verificacion automatizada de comportamiento.
- **pytest-asyncio**: soporte para pruebas asincronas del backend.
- **Alembic**: herramienta de migraciones y metadata SQLAlchemy.
- **Bandit**: analisis estatico de seguridad Python.
- **pip-audit**: revision de vulnerabilidades/CVEs en dependencias.
- **pip-tools / pip-compile**: generacion de `requirements.txt` con hashes.
- **Archivos de memoria Markdown**: `memory/PROJECT_STATE.md`, `memory/NEXT_STEPS.md`, `memory/SESSION_LOG.md` y este mismo log funcionaron como memoria externalizada entre sesiones.

Esta lista muestra que la experiencia fue una colaboracion humano-IA mediada por un ecosistema de herramientas, no solo por prompts aislados. El resultado tecnico dependio de la combinacion entre razonamiento del asistente, memoria documental, herramientas de ejecucion local, controles de seguridad y verificaciones automatizadas.

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: Superpowers puede interpretarse como una capa de instrucciones persistentes que estructura el comportamiento del modelo: revisar habilidades aplicables, preferir TDD, verificar antes de cerrar y mantener evidencia. Bajo el lente de la taxonomia de prompt engineering, esto se aproxima a una combinacion de instrucciones de rol, planificacion, descomposicion y verificacion.

**Transparencia y reproducibilidad**: documentar las habilidades y herramientas evita atribuir todo el resultado al modelo base. La entrada registra condiciones de ejecucion, instrumentos usados y limites de privacidad, lo cual se alinea con la idea de investigacion asistida por IA transparente y reproducible.

**Programacion por pares humano-IA**: el entorno aproxima una division de roles: el usuario define intencion, prioridad y control; las habilidades de Superpowers orientan el proceso; Codex ejecuta cambios y verifica; las herramientas como pytest, Bandit y pip-audit entregan feedback externo. Esto ofrece una variante practica del ciclo planificar, implementar, probar y refinar descrito por PairCoder.

### Observaciones para el paper

Una posible categoria de analisis emergente es **instrumentacion del asistente**: el rendimiento observado no debe atribuirse unicamente al modelo base, sino tambien al andamiaje de habilidades, al acceso a herramientas locales y a la disciplina de verificacion. Esto es importante porque dos experiencias con el mismo modelo pueden diferir mucho si una cuenta con TDD, memoria persistente, escaneo de seguridad y criterios de done ejecutables, y la otra solo usa conversacion libre.

Otra categoria posible es **transparencia operacional**. Documentar que se usaron Superpowers, GitHub CLI, pytest, Bandit, pip-audit y archivos de memoria permite reconstruir como se produjo el software, que controles se aplicaron y que acciones quedaron bajo supervision humana. Esta transparencia es clave para evitar una narrativa simplificada donde "la IA hizo el codigo" sin explicar el sistema sociotecnico que lo hizo posible.

### Referencias de apoyo

- Liu et al. (2025). *A comprehensive taxonomy of prompt engineering techniques for large language models*. Frontiers of Computer Science. https://doi.org/10.1007/s11704-025-50058-z
- Park (2025). *Towards a transparent and reproducible AI-assisted research paper writing*. Genomics & Informatics. https://doi.org/10.1186/s44342-025-00057-0
- Zhang et al. (2024). *A Pair Programming Framework for Code Generation via Multi-Plan Exploration and Feedback-Driven Refinement*. arXiv:2409.05001. https://arxiv.org/abs/2409.05001

## Entrada documental: decision e implementacion de lideres-evaluadores

Fecha y hora de registro: 2026-05-16

### Objetivo de la intervencion

El usuario identifico un caso institucional relevante: docentes con rol de lider pueden actuar tambien como evaluadores de modulos asociados a su propio RA/SO o a otro RA/SO. La parte administrativa confirmo estar de acuerdo con soportar este caso. Se solicito documentar la decision en el PRD y en los documentos derivados, y se autorizo la implementacion tecnica.

### Acciones realizadas por Codex

La IA reviso la documentacion existente, el modelo de roles y las tablas de asignacion de modulos. Luego contrasto la situacion con evidencia ABET: no se encontro una prohibicion general de que un lider interno recolecte o evalue evidencia, siempre que el proceso sea documentado, sistematico y trazable.

La intervencion incluyo:

- Ejecucion de un LLM Council con cinco perspectivas para evaluar riesgos, diseno y ruta practica.
- Creacion de artefactos del consejo en `docs/council-transcript-20260516-074839.md` y `docs/council-report-20260516-074839.html`.
- Actualizacion de `docs/PRD.md` para definir la regla de roles contextuales.
- Actualizacion de documentos derivados: arquitectura, modelo de datos, contrato API, matriz de permisos, seguridad/privacidad, plan de pruebas y matriz de trazabilidad.
- Registro de ADR-14 en `memory/DECISIONS.md`.
- Implementacion de `verify_module_ownership()` en `src/api/deps.py`.
- Creacion de `tests/test_module_ownership.py` con casos para lider asignado a RA propio, lider asignado a otro RA, lider no asignado y docente asignado.

### Resultado tecnico

La regla implementada es: para escribir datos de evaluacion de un modulo, no basta el rol global. El usuario debe estar asignado al modulo en `module_staff`. Esto permite que un `leader` actue como evaluador si la administracion lo asigno, pero evita que el rol `leader` sea un bypass para modificar modulos ajenos.

### Verificacion

Se ejecuto primero una prueba roja: la importacion de `verify_module_ownership` fallo porque la funcion aun no existia. Luego se implemento la dependencia y se corrigio el fixture de prueba para usar fechas `date`. La prueba focalizada paso con 4/4 casos exitosos. La suite completa paso con 38/38 pruebas y Bandit no reporto hallazgos medium/high.

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: la decision uso memoria contextual, documentos del proyecto, evidencia externa y un consejo de multiples perspectivas. Esto corresponde a una combinacion de contextual prompting, descomposicion de decision y verificacion.

**Transparencia y reproducibilidad**: la entrada conserva la pregunta, los artefactos del consejo, los documentos modificados y la evidencia de prueba. Se evita incluir datos personales reales o URLs privadas.

**Programacion por pares humano-IA**: el usuario aporto el caso institucional y la aprobacion administrativa. Codex hizo analisis, documentacion, implementacion y pruebas. El feedback critico vino del LLM Council y de pytest.

### Observaciones para analisis cientifico

Este episodio muestra una transicion de requisito ambiguo a control tecnico verificable. La IA no solo escribio codigo: ayudo a convertir una excepcion organizacional en una regla de autorizacion contextual, preservando realismo operativo, seguridad IDOR y trazabilidad ABET.

## Entrada documental: evaluacion de alcance institucional por lineas propedeuticas

Fecha y hora de registro: 2026-05-16

### Objetivo de la intervencion

El usuario planteo un nuevo alcance institucional: jerarquia `Modulos -> Programas -> Lineas Propedeuticas`, rol Decano o autoridad equivalente, y generacion de un resumen ejecutivo agregado por linea propedeutica. El objetivo fue evaluar si esta estructura ya estaba contemplada en el PRD, documentos derivados y codebase.

### Acciones realizadas por Codex

Codex reviso el PRD, documentos tecnicos, memoria del proyecto y modelos actuales. Tambien ejecuto un LLM Council para contrastar el hallazgo desde cinco perspectivas.

La evidencia encontrada fue:

- El PRD describe el producto como reemplazo del Excel/VBA del programa TGA.
- El PRD declara multiples programas academicos como fuera de alcance de v1.
- El modelo de datos actual no contiene `Program`, `PropedeuticLine`, `EducationalPathway`, `AcademicCycle` ni equivalentes.
- Los roles actuales son `admin`, `leader` y `teacher`; no existe `dean` ni autoridad ejecutiva equivalente.
- Los reportes actuales son por periodo, modulo, lider o reporte ABET del programa; no existe resumen ejecutivo por linea propedeutica.

### Resultado del analisis

La conclusion fue que la necesidad no esta debidamente contemplada. No se trata de una pantalla pendiente, sino de un cambio mayor de dominio: el sistema actual esta disenado para assessment operacional de un programa, no para gobierno institucional multi-programa.

### Artefactos generados

- `docs/council-transcript-20260516-082724.md`
- `docs/council-report-20260516-082724.html`

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: la tarea combino pregunta de alcance, busqueda contextual en repositorio y consejo multi-perspectiva.

**Transparencia y reproducibilidad**: se documento la evidencia local usada para sostener la conclusion y se generaron artefactos del consejo.

**Programacion por pares humano-IA**: el usuario introdujo el nuevo dominio institucional; Codex verifico el estado real del sistema y separo lo que existe de lo que requeriria redisenio.

### Observaciones para analisis cientifico

Este episodio muestra un uso de IA como evaluador de cobertura de requisitos. La IA no implemento inmediatamente; primero detecto una brecha entre el alcance originalmente documentado y una necesidad institucional emergente. Este tipo de analisis puede ser relevante para discutir como los asistentes ayudan a prevenir crecimiento accidental del alcance sin soporte en el modelo de dominio.

## Entrada documental: actualizacion posterior a requisitos no vistos y aprendizaje F17

Fecha y hora de registro: 2026-05-16

### Motivo de la actualizacion

El usuario indico que varios requisitos importantes no habian sido vistos oportunamente y solicito actualizar el documento de investigacion con los cambios y aprendizajes posteriores a la ultima entrada. Esta observacion es metodologicamente relevante porque muestra que, aun con apoyo de IA, memoria documental y revision automatizada, pueden quedar requisitos de dominio fuera del alcance inicial cuando la fuente original representa solo una parte de la operacion institucional.

El caso identificado fue el alcance institucional de la RA Assessment App: la jerarquia `Modulos -> Programas -> Lineas Propedeuticas`, la necesidad de un resumen ejecutivo agregado por linea propedeutica y el rol del Decano o autoridad equivalente como consumidor del resultado.

### Evolucion temporal del hallazgo

La primera evaluacion de cobertura concluyo que el sistema estaba modelado principalmente como herramienta de assessment para un programa academico especifico y no como plataforma institucional multi-programa. En ese momento, la evidencia revisada apuntaba a una brecha: no aparecian de forma suficiente los conceptos de `Program`, `PropedeuticLine`, autoridad ejecutiva equivalente ni resumen agregado por linea propedeutica.

Posteriormente, el proyecto incorporo una respuesta arquitectonica para cerrar parcialmente esa brecha mediante F17:

- `docs/PRD.md` fue actualizado a v2.3 con F17: Reporte Ejecutivo por Linea Propedeutica.
- `docs/DATA_MODEL.md` incorporo `propedeutic_lines`, `programs` y la relacion con `student_outcomes`.
- `docs/ROLE_PERMISSION_MATRIX.md` documento la decision de no crear un rol `dean` separado en v1.
- `docs/IMPLEMENTATION_PLAN_F17.md` definio el plan S7 para migracion, seed institucional, router, schemas y pruebas.
- `src/models/program.py` incorporo la base ORM `PropedeuticLine` y `Program`.
- `memory/PROJECT_STATE.md`, `memory/NEXT_STEPS.md` y `memory/SESSION_LOG.md` registraron F17 como base documental y ORM completada, con router y migracion pendientes para S7.

La lectura correcta para investigacion es secuencial: primero se detecto una omision de requisitos; luego se produjo una respuesta documentada y parcial en arquitectura y modelo de datos. No debe interpretarse como contradiccion, sino como evidencia de aprendizaje incremental durante el desarrollo asistido por IA.

### Decision de producto aprendida

La discusion sobre el Decano mostro que no todo actor institucional debe convertirse automaticamente en rol autenticado dentro del sistema. La decision vigente para v1 fue:

- No crear `dean` como rol de usuario separado.
- Permitir que Admin o Lider generen el resumen ejecutivo institucional.
- Entregar al Decano o autoridad equivalente un PDF exportable con datos agregados.
- Mantener fuera de F17 los datos individuales de estudiantes.

Esta decision reduce superficie de ataque, evita complejidad de permisos para un uso ocasional y conserva la trazabilidad mediante eventos de auditoria como `institutional_report_generated`.

### Requisitos no vistos inicialmente

El episodio permite identificar requisitos que no estaban suficientemente visibles en el alcance inicial:

- El sistema no solo sirve a un programa, sino potencialmente a toda la institucion.
- El dominio requiere representar ciclos o niveles academicos conectados por lineas propedeuticas.
- Los reportes ejecutivos no son equivalentes a los reportes operativos de modulo o programa.
- Los consumidores ejecutivos necesitan agregacion, comparacion y tendencia, no captura detallada.
- La autoridad institucional puede ser destinataria del reporte sin ser usuaria directa del sistema.
- La privacidad cambia de nivel: F17 debe exponer solo agregados institucionales, no informacion individual.
- El PRD debe distinguir entre estructura de datos preparada en v1 e interfaz multi-programa diferida a v2/S7.

### Lecciones aprendidas

1. **El documento inicial puede heredar el sesgo del artefacto fuente.** Si el punto de partida es un Excel de un programa, la IA puede optimizar muy bien ese alcance y aun asi no ver la necesidad institucional completa.

2. **Los nombres ausentes en el codigo son evidencia fuerte.** La busqueda de terminos como `Program`, `PropedeuticLine`, `dean` o `summary` ayudo a separar supuestos de hechos verificables.

3. **La revision humana sigue siendo indispensable.** El usuario detecto una capa de dominio que no habia emergido con suficiente fuerza en el trabajo anterior. Esto confirma que la IA mejora velocidad y trazabilidad, pero no sustituye conocimiento institucional.

4. **Un actor de negocio no siempre es un rol del sistema.** El Decano representa una audiencia ejecutiva y un punto de responsabilidad institucional, pero en v1 puede ser servido por un flujo administrativo de PDF generado por Admin/Lider.

5. **La arquitectura debe permitir crecimiento sin sobreimplementar.** Modelar `PropedeuticLine` y `Program` desde v1 prepara el terreno, mientras que router, migracion y reportes completos quedan diferidos hasta que existan datos multi-programa reales y staging PostgreSQL.

6. **La memoria externalizada debe reconciliarse.** Cuando una entrada del log registra una brecha y luego el repositorio incorpora F17, el documento de investigacion debe conservar ambos momentos: el diagnostico inicial y la respuesta posterior.

7. **El LLM Council es util, pero debe etiquetarse correctamente.** En los artefactos del proyecto aparecen consejos multi-perspectiva y tambien simulaciones de consejo realizadas por un solo modelo. Para un paper, esta diferencia debe documentarse para no exagerar la independencia metodologica.

### Herramientas y capacidades usadas desde la ultima entrada

Ademas de Codex como agente principal, esta fase uso o dejo evidencia del uso de:

- `rg` para detectar rapidamente cobertura terminologica en documentos, memoria, codigo y pruebas.
- `sed` y lectura focalizada de archivos para inspeccionar secciones relevantes sin cargar todo el repositorio.
- Archivos de memoria Markdown para reconstruir decisiones entre sesiones.
- LLM Council / simulacion de consejo para presionar la decision de alcance institucional.
- Superpowers como andamiaje de proceso, especialmente para obligar a revisar habilidades, verificar antes de cerrar y mantener disciplina metodologica.
- Documentacion viva en PRD, DATA_MODEL, ROLE_PERMISSION_MATRIX, IMPLEMENTATION_PLAN_F17 y SESSION_LOG.

### Aplicacion del marco metodologico

**Prompt engineering y andamiaje**: el caso muestra uso de prompting contextual, busqueda guiada por terminos de dominio, descomposicion de requisitos y verificacion documental. Superpowers actuo como una capa de instrucciones persistentes que ayuda a sostener el proceso, pero la correccion del alcance dependio de la intervencion humana.

**Transparencia y reproducibilidad**: la bitacora conserva la secuencia de eventos: requisito omitido, evaluacion de brecha, decision de alcance, cambios documentales y base ORM. Esta trazabilidad evita presentar el resultado como si hubiera sido correcto desde el inicio.

**Programacion por pares humano-IA**: el usuario aporto conocimiento institucional y senalo la omision; Codex inspecciono documentos y codigo, ayudo a formalizar la decision y registro el aprendizaje. La experiencia se aproxima a una programacion por pares ampliada, donde el humano corrige direccion de producto y la IA mantiene continuidad documental y tecnica.

### Observaciones para el paper

Este episodio puede analizarse como **descubrimiento tardio de requisitos en desarrollo asistido por IA**. El valor principal no fue que la IA nunca omitiera requisitos, sino que el sistema de trabajo permitio detectar la omision, documentarla, corregir parte del modelo y preservar el aprendizaje.

Tambien sugiere una categoria de analisis llamada **deriva de alcance por fuente inicial**: cuando el artefacto fuente representa un subconjunto operativo, el agente puede producir una solucion coherente pero demasiado estrecha. La mitigacion observada fue combinar revision humana experta, busqueda de cobertura en el repositorio, consejo multi-perspectiva y memoria documental versionada.

### Referencias de apoyo

- Liu et al. (2025). *A comprehensive taxonomy of prompt engineering techniques for large language models*. Frontiers of Computer Science. https://doi.org/10.1007/s11704-025-50058-z
- Park (2025). *Towards a transparent and reproducible AI-assisted research paper writing*. Genomics & Informatics. https://doi.org/10.1186/s44342-025-00057-0
- Zhang et al. (2024). *A Pair Programming Framework for Code Generation via Multi-Plan Exploration and Feedback-Driven Refinement*. arXiv:2409.05001. https://arxiv.org/abs/2409.05001
