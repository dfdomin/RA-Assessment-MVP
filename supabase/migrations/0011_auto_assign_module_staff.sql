-- Migration 0011: Auto-assign teachers to modules without staff (H-03)
-- Round-robin assignment across active teachers for modules that have students but no module_staff.

WITH unassigned AS (
    SELECT m.id AS module_id, ROW_NUMBER() OVER (ORDER BY m.id) AS rn
    FROM public.modules m
    WHERE EXISTS (
        SELECT 1 FROM public.module_students ms
        WHERE ms.module_id = m.id AND ms.status = 'active'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.module_staff mst WHERE mst.module_id = m.id
    )
),
teachers AS (
    SELECT u.id, ROW_NUMBER() OVER (ORDER BY u.created_at, u.id) AS rn
    FROM public.users u
    WHERE u.role = 'teacher' AND u.is_active = true
),
teacher_count AS (
    SELECT GREATEST(COUNT(*)::int, 1) AS cnt FROM teachers
)
INSERT INTO public.module_staff (module_id, user_id)
SELECT u.module_id, t.id
FROM unassigned u
JOIN teachers t ON t.rn = ((u.rn - 1) % (SELECT cnt FROM teacher_count)) + 1
WHERE (SELECT cnt FROM teacher_count) > 0
ON CONFLICT DO NOTHING;
