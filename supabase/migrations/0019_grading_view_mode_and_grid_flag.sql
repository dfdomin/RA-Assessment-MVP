-- ADR-0003: ModoGrilla por docente y modo de vista fijado por evaluación.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS grid_grading_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.module_ra_evaluations
    ADD COLUMN IF NOT EXISTS grading_view_mode VARCHAR(20)
        CHECK (grading_view_mode IS NULL OR grading_view_mode IN ('student_card', 'grid'));

COMMENT ON COLUMN public.users.grid_grading_enabled IS
    'Admin: permite al docente elegir ModoGrilla en 3c (ADR-0003).';

COMMENT ON COLUMN public.module_ra_evaluations.grading_view_mode IS
    'Vista de captura fijada tras el primer guardado de calificación (student_card | grid).';
