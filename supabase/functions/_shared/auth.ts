import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "leader" | "teacher";
};

export async function getCaller(
  req: Request,
): Promise<{ user: AppUser | null; error: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { user: null, error: "Missing Authorization header" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Supabase env not configured" };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    return { user: null, error: "Invalid session" };
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("id, email, full_name, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: "User profile not found" };
  }

  return { user: profile as AppUser, error: null };
}

export function requireRole(
  user: AppUser,
  roles: Array<AppUser["role"]>,
): string | null {
  if (!roles.includes(user.role)) {
    return "Forbidden";
  }
  return null;
}

/** Docente asignado como consolidador del programa en el RA del período. */
export async function isProgramConsolidator(
  userId: string,
  programId: number,
  periodId: number,
): Promise<boolean> {
  const db = serviceClient();
  const { data: period } = await db
    .from("periods")
    .select("student_outcome_id")
    .eq("id", periodId)
    .single();
  if (!period?.student_outcome_id) return false;

  const { count } = await db
    .from("ra_consolidator_assignments")
    .select("id", { count: "exact", head: true })
    .eq("consolidator_user_id", userId)
    .eq("program_id", programId)
    .eq("student_outcome_id", period.student_outcome_id);

  return (count ?? 0) > 0;
}

/** Admin, rol leader legacy o consolidador del programa×período. */
export async function requireLeaderAccess(
  user: AppUser,
  programId: number,
  periodId: number,
): Promise<string | null> {
  if (user.role === "admin" || user.role === "leader") return null;
  if (await isProgramConsolidator(user.id, programId, periodId)) return null;
  return "Forbidden";
}

export function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Service role env not configured");
  }
  return createClient(supabaseUrl, serviceKey);
}
