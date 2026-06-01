-- Seed data for RA-Assessment-MVP
-- Run AFTER all migrations are applied
-- Creates demo users via Supabase Auth + app data

-- NOTE: In Supabase, users are created via auth.users (Supabase Auth).
-- This seed creates app-level data that references auth user IDs.
-- The actual auth users must be created via Supabase Dashboard or API.

-- Propedeutic lines
INSERT INTO public.propedeutic_lines (name, code) VALUES
    ('Gestión Administrativa', 'LP-GESTION'),
    ('Informática y Telecomunicaciones', 'LP-INFORMATICA');

-- Programs
INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level, faculty) 
SELECT pl.id, 'Tecnología en Gestión Administrativa', 'TGA', 'tecnologico', 
    'Facultad de Ciencias Económicas y Administrativas'
FROM public.propedeutic_lines pl WHERE pl.code = 'LP-GESTION';

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level, faculty)
SELECT pl.id, 'Inteligencia de Negocios', 'ING-NEGOCIOS', 'profesional', 
    'Facultad de Ciencias Económicas y Administrativas'
FROM public.propedeutic_lines pl WHERE pl.code = 'LP-GESTION';

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level) 
SELECT pl.id, 'Técnico en Telecomunicaciones', 'TEC-TELECOM', 'tecnico'
FROM public.propedeutic_lines pl WHERE pl.code = 'LP-INFORMATICA';

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level) 
SELECT pl.id, 'Tecnología en Telemática', 'TGLI', 'tecnologico'
FROM public.propedeutic_lines pl WHERE pl.code = 'LP-INFORMATICA';

INSERT INTO public.programs (propedeutic_line_id, name, code, cycle_level) 
SELECT pl.id, 'Ingeniería Telemática', 'ING-TELEMATICA', 'profesional'
FROM public.propedeutic_lines pl WHERE pl.code = 'LP-INFORMATICA';

-- Student Outcomes for TGA (will be linked to program after migration)
INSERT INTO public.student_outcomes (code, description) VALUES
    ('RA1', 'Identificar y clasificar documentos organizacionales según normatividad vigente'),
    ('RA2', 'Construir documentos administrativos aplicando estándares de calidad'),
    ('RA3', 'Analizar información documental para la toma de decisiones'),
    ('RA4', 'Valorar el uso de TIC en la gestión documental organizacional'),
    ('RA5', 'Gestionar sistemas de información documental con criterios de seguridad'),
    ('RA6', 'Evaluar procesos de gestión documental con indicadores de desempeño'),
    ('RA7', 'Proponer mejoras a los flujos de información organizacional');

-- Note: Rubrics, periods, modules, and students are created at runtime
-- by the application. This seed only provides the structural data.
