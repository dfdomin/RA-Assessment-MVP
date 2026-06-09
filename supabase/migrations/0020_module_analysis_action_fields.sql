-- Migration 0020: Análisis cualitativo extendido a nivel evaluación (módulo × RA)
-- Conclusiones, recomendaciones y medidas (preventivas, correctivas, plan de mejoramiento).

ALTER TABLE public.module_ra_evaluations
    ADD COLUMN IF NOT EXISTS conclusions_text TEXT
        CHECK (conclusions_text IS NULL OR char_length(conclusions_text) <= 4000),
    ADD COLUMN IF NOT EXISTS recommendations_text TEXT
        CHECK (recommendations_text IS NULL OR char_length(recommendations_text) <= 4000),
    ADD COLUMN IF NOT EXISTS preventive_measures_text TEXT
        CHECK (preventive_measures_text IS NULL OR char_length(preventive_measures_text) <= 4000),
    ADD COLUMN IF NOT EXISTS corrective_measures_text TEXT
        CHECK (corrective_measures_text IS NULL OR char_length(corrective_measures_text) <= 4000),
    ADD COLUMN IF NOT EXISTS improvement_plan_text TEXT
        CHECK (improvement_plan_text IS NULL OR char_length(improvement_plan_text) <= 4000);

COMMENT ON COLUMN public.module_ra_evaluations.conclusions_text IS
    'Conclusiones generales del docente sobre el RA en el módulo (análisis cualitativo 4b).';
COMMENT ON COLUMN public.module_ra_evaluations.recommendations_text IS
    'Recomendaciones didácticas generales del docente.';
COMMENT ON COLUMN public.module_ra_evaluations.preventive_measures_text IS
    'Medidas preventivas documentadas por el docente.';
COMMENT ON COLUMN public.module_ra_evaluations.corrective_measures_text IS
    'Medidas correctivas para estudiantes con bajo desempeño.';
COMMENT ON COLUMN public.module_ra_evaluations.improvement_plan_text IS
    'Plan de mejoramiento con acciones y metas del docente.';
