-- Migration 0017: Resync students.id sequence after bulk seed with explicit IDs

SELECT setval(
    pg_get_serial_sequence('public.students', 'id'),
    COALESCE((SELECT MAX(id) FROM public.students), 1),
    true
);
