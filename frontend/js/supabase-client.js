/**
 * supabase-client.js — RA Assessment MVP
 * Inicializa el cliente Supabase para todo el frontend.
 * Cargar antes que cualquier otro modulo JS.
 */
var   SUPABASE_URL = 'https://whjjervbojyktkhvvmte.supabase.co';
var   SUPABASE_ANON_KEY = 'sb_publishable_H0K8qn0Jgqk5VgI-goiKsw_EXaiNoHN';

var   supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Helper: get current session user
async function getCurrentUser() {
    var   { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Helper: get user profile from public.users
async function getUserProfile() {
    var   user = await getCurrentUser();
    if (!user) return null;
    var   { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    if (error) return null;
    return data;
}

// Helper: check if user has specific role
async function hasRole(role) {
    var   profile = await getUserProfile();
    return profile && profile.role === role;
}

// Helper: redirect if not authenticated
async function requireAuth() {
    var   { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return null;
    }
    return session;
}

console.log('[Supabase] Client initialized with project: ra-assessment-mvp');
