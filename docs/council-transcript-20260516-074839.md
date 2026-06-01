# LLM Council Transcript — Lideres como evaluadores en RA Assessment App

Fecha: 2026-05-16

## Pregunta original

El usuario identifica que `verify_module_ownership` esta planificado, pero detecta un caso real: docentes lideres pueden ser evaluadores de rubricas/modulos de su propio RA o de otro RA. Pregunta si el sistema esta preparado y si ABET espera que esto se resuelva con funcionalidad o con administracion.

## Pregunta enmarcada

RA Assessment App usa roles globales (`admin`, `leader`, `teacher`) y asignaciones de modulo (`module_staff`). La documentacion ya dice que un lider tambien puede ser docente de otro SO y que `verify_module_ownership` aplica en endpoints de modulo. Sin embargo, el caso real exige distinguir entre lider de un RA/SO y evaluador asignado a modulos del mismo u otro RA/SO.

La decision: permitir o no que lideres actuen tambien como evaluadores, y decidir si esto debe resolverse en el modelo de permisos del software, en politica administrativa, o en ambos.

## Respuestas del consejo

### Contrarian

El sistema no esta preparado si depende de un unico rol global. Ese modelo no representa de forma segura "lider aqui, evaluador alla". La politica administrativa por si sola no previene IDOR ni deja evidencia suficiente. `verify_module_ownership` es necesario, pero no suficiente: solo cubre endpoints de modulo. Periodos, rubricas, reportes, exports y revisiones tambien necesitan checks por contexto. El sistema debe modelar permisos por alcance: lider para RA/SO X, evaluador para modulo Y, visor/revisor para periodo Z.

### First Principles Thinker

La pregunta correcta no es si una persona es lider o docente, sino que autoridad tiene sobre un objeto especifico. Lider y evaluador son responsabilidades contextuales, no identidades absolutas. ABET no exige separacion universal de funciones; exige procesos documentados, sistematicos y transparentes. La app debe permitir multiples sombreros, pero hacerlos explicitos y auditables.

### Expansionist

Permitir lideres evaluadores abre una oportunidad de disenar un modelo mas realista: lider por RA/SO, evaluador por modulo, coevaluador, evaluador sustituto, revision por pares y calibracion cruzada. Esto puede fortalecer la auditoria si se registra quien evaluo, bajo que asignacion y en que contexto. Bloquear el caso generaria trabajo por fuera del sistema.

### Outsider

Desde fuera, "lider" y "docente" parecen etiquetas demasiado amplias. El usuario espera que el sistema sepa que una misma persona puede cumplir distintos papeles en distintos lugares. Si eso no queda visible en pantalla y en auditoria, meses despues sera dificil explicar por que una persona califico evidencia y tambien lidero el informe.

### Executor

La ruta practica es mantener `role` global solo para navegacion gruesa, pero hacer los permisos reales por asignacion. En S2: implementar `verify_module_ownership`, aplicarlo a lideres y docentes por igual en rutas de evaluacion, impedir que `leader` bypass el check de evaluador, agregar auditoria y tests para lider asignado a modulo propio, lider asignado a modulo de otro RA y lider no asignado.

## Veredicto

El sistema esta parcialmente preparado en documentacion, pero no completamente preparado como modelo de autorizacion. La documentacion reconoce el caso de lider-docente, y `module_staff` permite asignar usuarios a modulos. Pero el `role` global en `users.role` sigue siendo demasiado grueso para representar permisos contextuales de RA/SO, modulo y periodo.

La recomendacion es permitir lideres como evaluadores cuando esten explicitamente asignados. El software debe imponer la regla "solo evalua quien esta asignado al modulo"; la administracion debe decidir si es aceptable asignar al lider de un RA como evaluador de su propio RA, si requiere revision por pares o si exige aprobacion adicional.

## Primer paso

Actualizar S2 para que `verify_module_ownership` aplique a cualquier usuario que intente escribir datos de evaluacion de modulo, incluyendo usuarios con rol `leader`, y agregar pruebas especificas para lider-evaluador en RA propio y RA ajeno.

