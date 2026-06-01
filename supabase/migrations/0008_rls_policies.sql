-- Migration 0008: Row Level Security Policies
-- Enables RLS on all tables and creates role-based access policies.

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propedeutic_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perf_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- READ POLICIES: authenticated users can read
-- ============================================

-- Users: everyone authenticated can read user list (needed for teacher names)
CREATE POLICY "users_read_authenticated" ON public.users
    FOR SELECT TO authenticated USING (true);

-- Structural tables: readable by all authenticated
CREATE POLICY "propedeutic_lines_read" ON public.propedeutic_lines
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "programs_read" ON public.programs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "student_outcomes_read" ON public.student_outcomes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "periods_read" ON public.periods
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "rubrics_read" ON public.rubrics
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "perf_indicators_read" ON public.perf_indicators
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_levels_read" ON public.pi_levels
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "level_thresholds_read" ON public.level_thresholds
    FOR SELECT TO authenticated USING (true);

-- Modules: readable by all authenticated
CREATE POLICY "modules_read" ON public.modules
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "module_staff_read" ON public.module_staff
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "students_read" ON public.students
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "module_students_read" ON public.module_students
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "assessments_read" ON public.assessments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "module_analysis_read" ON public.module_analysis
    FOR SELECT TO authenticated USING (true);

-- Leader tables: readable by all authenticated
CREATE POLICY "leader_analysis_read" ON public.leader_analysis
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "action_plans_read" ON public.action_plans
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports_read" ON public.reports
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "reminder_log_read" ON public.reminder_log
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "leader_report_drafts_read" ON public.leader_report_drafts
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "security_events_read" ON public.security_events
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_memberships_read" ON public.program_memberships
    FOR SELECT TO authenticated USING (true);

-- ============================================
-- WRITE POLICIES: role-based
-- ============================================

-- Helper function: check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user is assigned to a module (teacher or leader-evaluator)
CREATE OR REPLACE FUNCTION public.is_module_teacher(module_id bigint)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.module_staff
        WHERE module_id = $1 AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Periods: admin + leader can insert/update
CREATE POLICY "periods_insert_admin_leader" ON public.periods
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "periods_update_admin_leader" ON public.periods
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'))
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Rubrics: admin + leader can insert/update
CREATE POLICY "rubrics_insert_admin_leader" ON public.rubrics
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "rubrics_update_admin_leader" ON public.rubrics
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'))
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Modules: admin + leader can manage
CREATE POLICY "modules_insert_admin_leader" ON public.modules
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "modules_update" ON public.modules
    FOR UPDATE TO authenticated
    USING (
        public.user_has_role('admin') 
        OR public.user_has_role('leader')
        OR public.is_module_teacher(id)
    );

-- Module_staff: admin + leader manage assignments
CREATE POLICY "module_staff_insert_admin_leader" ON public.module_staff
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Assessments: module teacher can insert/update
CREATE POLICY "assessments_insert_teacher" ON public.assessments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.module_students ms
            JOIN public.module_staff mst ON mst.module_id = ms.module_id
            WHERE ms.id = module_student_id AND mst.user_id = auth.uid()
        )
    );

CREATE POLICY "assessments_update_teacher" ON public.assessments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.module_students ms
            JOIN public.module_staff mst ON mst.module_id = ms.module_id
            WHERE ms.id = module_student_id AND mst.user_id = auth.uid()
        )
    );

-- Module_analysis: module teacher can insert/update
CREATE POLICY "module_analysis_insert_teacher" ON public.module_analysis
    FOR INSERT TO authenticated
    WITH CHECK (public.is_module_teacher(module_id));

CREATE POLICY "module_analysis_update_teacher" ON public.module_analysis
    FOR UPDATE TO authenticated
    USING (public.is_module_teacher(module_id));

-- Leader_analysis: admin + leader can insert/update
CREATE POLICY "leader_analysis_insert_admin_leader" ON public.leader_analysis
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "leader_analysis_update_admin_leader" ON public.leader_analysis
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Action_plans: admin + leader can insert/update
CREATE POLICY "action_plans_insert_admin_leader" ON public.action_plans
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "action_plans_update_admin_leader" ON public.action_plans
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Reminder_log: admin + leader can insert
CREATE POLICY "reminder_log_insert_admin_leader" ON public.reminder_log
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Leader_report_drafts: admin + leader can insert/update
CREATE POLICY "leader_report_drafts_insert_admin_leader" ON public.leader_report_drafts
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "leader_report_drafts_update_admin_leader" ON public.leader_report_drafts
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Module_students: module teacher can insert/update (for student import and management)
CREATE POLICY "module_students_insert_teacher" ON public.module_students
    FOR INSERT TO authenticated
    WITH CHECK (public.is_module_teacher(module_id));

CREATE POLICY "module_students_update_teacher" ON public.module_students
    FOR UPDATE TO authenticated
    USING (public.is_module_teacher(module_id));

-- Students: admin + module teacher can insert/update
CREATE POLICY "students_insert_authenticated" ON public.students
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "students_update_admin" ON public.students
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin'));

-- Reports: admin + leader can insert
CREATE POLICY "reports_insert_admin_leader" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Student_exclusions: module teacher can insert
CREATE POLICY "student_exclusions_insert_teacher" ON public.student_exclusions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.module_students ms
            JOIN public.module_staff mst ON mst.module_id = ms.module_id
            WHERE ms.id = module_student_id AND mst.user_id = auth.uid()
        )
    );

-- Program_memberships: admin can manage
CREATE POLICY "program_memberships_insert_admin" ON public.program_memberships
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin'));

-- Perf_indicators and pi_levels: admin + leader
CREATE POLICY "perf_indicators_insert_admin_leader" ON public.perf_indicators
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "perf_indicators_update_admin_leader" ON public.perf_indicators
    FOR UPDATE TO authenticated
    USING (public.user_has_role('admin') OR public.user_has_role('leader'));

CREATE POLICY "pi_levels_insert_admin_leader" ON public.pi_levels
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_role('admin') OR public.user_has_role('leader'));

-- Security_events: append-only, any authenticated can insert for audit
CREATE POLICY "security_events_insert_authenticated" ON public.security_events
    FOR INSERT TO authenticated WITH CHECK (true);

-- oracle_sync_log: admin only
CREATE POLICY "oracle_sync_log_read_admin" ON public.oracle_sync_log
    FOR SELECT TO authenticated USING (public.user_has_role('admin'));
CREATE POLICY "oracle_sync_log_insert_admin" ON public.oracle_sync_log
    FOR INSERT TO authenticated WITH CHECK (public.user_has_role('admin'));

-- ============================================
-- Grant API access
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_module_teacher(bigint) TO authenticated;
