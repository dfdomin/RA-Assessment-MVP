/**
 * supabase-client.js — RA Assessment MVP
 * Inicializa el cliente Supabase para todo el frontend.
 * Cargar antes que cualquier otro modulo JS.
 */
const SUPABASE_URL = 'https://whjjervbojyktkhvvmte.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoamplcnZib2p5a3RraHZ2bXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0MzgsImV4cCI6MjA5NTkwOTQzOH0.wgnOFx980NFXGs2pvNTxo6PnabHSx9_pV-UFKWYB2Xs';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Helper: get current session user
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Helper: get user profile from public.users
async function getUserProfile() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    if (error) return null;
    return data;
}

// Helper: check if user has specific role
async function hasRole(role) {
    const profile = await getUserProfile();
    return profile && profile.role === role;
}

// Helper: redirect if not authenticated
async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/frontend/index.html';
        return null;
    }
    return session;
}

console.log('[Supabase] Client initialized');
