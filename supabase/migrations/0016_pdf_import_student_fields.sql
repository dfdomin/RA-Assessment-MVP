-- Migration 0016: ADR-0002 — PDF Academusoft import (pege_id, document uniqueness, roster order)

-- 1. Academusoft Persona General (nullable until oracle_adapter fills it)
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS pege_id VARCHAR(50) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_pege_id
    ON public.students (pege_id)
    WHERE pege_id IS NOT NULL;

-- 2. Roster order per module (PDF column "No." / manual append order)
ALTER TABLE public.module_students
    ADD COLUMN IF NOT EXISTS roster_position INT NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY id) AS rn
    FROM public.module_students
)
UPDATE public.module_students AS ms
SET roster_position = ranked.rn
FROM ranked
WHERE ms.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_module_students_module_roster
    ON public.module_students (module_id, roster_position);

-- 3. One person = one document_number (merge legacy duplicates before UNIQUE)
WITH canonical AS (
    SELECT
        document_number,
        MIN(id) AS keep_id
    FROM public.students
    WHERE is_suppressed = FALSE
      AND document_number NOT LIKE '[SUPRIMIDO-%'
    GROUP BY document_number
    HAVING COUNT(*) > 1
),
duplicates AS (
    SELECT s.id AS drop_id, c.keep_id
    FROM public.students AS s
    INNER JOIN canonical AS c ON s.document_number = c.document_number
    WHERE s.id <> c.keep_id
      AND s.is_suppressed = FALSE
)
UPDATE public.module_students AS ms
SET student_id = d.keep_id
FROM duplicates AS d
WHERE ms.student_id = d.drop_id
  AND NOT EXISTS (
      SELECT 1
      FROM public.module_students AS existing
      WHERE existing.module_id = ms.module_id
        AND existing.student_id = d.keep_id
  );

WITH canonical AS (
    SELECT
        document_number,
        MIN(id) AS keep_id
    FROM public.students
    WHERE is_suppressed = FALSE
      AND document_number NOT LIKE '[SUPRIMIDO-%'
    GROUP BY document_number
    HAVING COUNT(*) > 1
),
duplicates AS (
    SELECT s.id AS drop_id, c.keep_id
    FROM public.students AS s
    INNER JOIN canonical AS c ON s.document_number = c.document_number
    WHERE s.id <> c.keep_id
      AND s.is_suppressed = FALSE
)
DELETE FROM public.module_students AS ms
USING duplicates AS d
WHERE ms.student_id = d.drop_id;

WITH canonical AS (
    SELECT
        document_number,
        MIN(id) AS keep_id
    FROM public.students
    WHERE is_suppressed = FALSE
      AND document_number NOT LIKE '[SUPRIMIDO-%'
    GROUP BY document_number
    HAVING COUNT(*) > 1
),
duplicates AS (
    SELECT s.id AS drop_id, c.keep_id
    FROM public.students AS s
    INNER JOIN canonical AS c ON s.document_number = c.document_number
    WHERE s.id <> c.keep_id
      AND s.is_suppressed = FALSE
)
DELETE FROM public.students AS s
USING duplicates AS d
WHERE s.id = d.drop_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_document_number
    ON public.students (document_number);
