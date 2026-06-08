-- Migration 0015: Align level scale with Excel/ABET (1, 2, 4, 5 — no value 3)

-- Drop legacy 1–4 checks before remapping rows to 5
ALTER TABLE public.assessments
    DROP CONSTRAINT IF EXISTS assessments_level_check;

ALTER TABLE public.pi_levels
    DROP CONSTRAINT IF EXISTS pi_levels_level_value_check;

-- Remap legacy ordinal storage (1–4) to display scores where needed
UPDATE public.assessments SET level = 5 WHERE level = 4;
UPDATE public.assessments SET level = 4 WHERE level = 3;

UPDATE public.pi_levels SET level_value = 5 WHERE level_value = 4;
UPDATE public.pi_levels SET level_value = 4 WHERE level_value = 3;

ALTER TABLE public.assessments
    ADD CONSTRAINT assessments_level_check
    CHECK (level IN (1, 2, 4, 5));

ALTER TABLE public.pi_levels
    ADD CONSTRAINT pi_levels_level_value_check
    CHECK (level_value IN (1, 2, 4, 5));
