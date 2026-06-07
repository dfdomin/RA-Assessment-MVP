-- Migration 0010: Fix users RLS for seed/signup (M-02)
-- Allows authenticated users to insert their own profile row after Supabase Auth signup,
-- and admins to manage any user profile.

CREATE POLICY "users_insert_self_or_admin" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (
        id = auth.uid()
        OR public.user_has_role('admin')
    );

CREATE POLICY "users_update_self_or_admin" ON public.users
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.user_has_role('admin'))
    WITH CHECK (id = auth.uid() OR public.user_has_role('admin'));

-- Explicit grant for INSERT (breaks seed deadlock when trigger/app creates profile)
GRANT INSERT ON public.users TO authenticated;
