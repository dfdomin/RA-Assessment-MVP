-- F13: allow RA consolidators (ra_consolidator_assignments) to insert reminder_log,
-- not only users with role = 'leader' (dual teacher/consolidator accounts like John Doe).

CREATE OR REPLACE FUNCTION public.is_period_consolidator(p_period_id bigint)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.ra_consolidator_assignments rca
        JOIN public.periods p ON p.id = p_period_id
        WHERE rca.student_outcome_id = p.student_outcome_id
          AND rca.consolidator_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_period_consolidator(bigint) TO authenticated;

DROP POLICY IF EXISTS "reminder_log_insert_admin_leader" ON public.reminder_log;

CREATE POLICY "reminder_log_insert_leader_or_consolidator" ON public.reminder_log
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_has_role('admin')
        OR public.user_has_role('leader')
        OR public.is_period_consolidator(period_id)
    );
