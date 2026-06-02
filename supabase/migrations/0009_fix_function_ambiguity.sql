-- Fix: is_module_teacher parameter ambiguity
-- Keep same parameter name but qualify column references inside body
-- to avoid "column reference is ambiguous" between PL/pgSQL variable and table column.

CREATE OR REPLACE FUNCTION public.is_module_teacher(module_id bigint)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.module_staff ms
        WHERE ms.module_id = is_module_teacher.module_id AND ms.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Same fix for user_has_role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = user_has_role.required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_module_teacher(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated;
