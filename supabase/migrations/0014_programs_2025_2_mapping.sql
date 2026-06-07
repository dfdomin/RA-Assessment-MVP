-- Migration 0014: Programs for 2025-2 institutional mapping (CE, ANI, TGLI label fix)

INSERT INTO public.propedeutic_lines (name, code)
VALUES ('Comercio Exterior y Logística', 'LP-CE-TGLI-ANI')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level, faculty)
SELECT pl.id, 'Comercio Exterior', 'CE', 'profesional',
       'Facultad de Ciencias Económicas y Administrativas'
FROM public.propedeutic_lines pl
WHERE pl.code = 'LP-CE-TGLI-ANI'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level, faculty)
SELECT pl.id, 'Adm. Negocios Internacionales', 'ANI', 'profesional',
       'Facultad de Ciencias Económicas y Administrativas'
FROM public.propedeutic_lines pl
WHERE pl.code = 'LP-CE-TGLI-ANI'
ON CONFLICT (code) DO NOTHING;

-- Align TGLI with Excel label (TG Logística Internacional)
UPDATE public.programs
SET name = 'TG Logística Internacional',
    faculty = COALESCE(faculty, 'Facultad de Ciencias Económicas y Administrativas')
WHERE code = 'TGLI'
  AND name <> 'TG Logística Internacional';

-- Ensure TGLI exists if seed was never applied
INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level, faculty)
SELECT pl.id, 'TG Logística Internacional', 'TGLI', 'tecnologico',
       'Facultad de Ciencias Económicas y Administrativas'
FROM public.propedeutic_lines pl
WHERE pl.code = 'LP-CE-TGLI-ANI'
  AND NOT EXISTS (SELECT 1 FROM public.programs WHERE code = 'TGLI');
