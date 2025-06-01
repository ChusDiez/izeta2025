// config.js
const SUPABASE_URL = 'https://hindymhwohevsqumekyv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpbmR5bWh3b2hldnNxdW1la3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3ODc4OTksImV4cCI6MjA2NDM2Mzg5OX0.oHuotC0MjPDrEMQksKt6QJ-Z_Yh0G60ZNRv5Ncy4MUQ'

// Inicializar cliente Supabase
const { createClient } = supabase
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Funciones helper globales
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser()
    return user
}

async function isAdmin() {
    try {
        const user = await checkAuth();
        if (!user) return false;
        
        const { data, error } = await supabaseClient.rpc('is_admin')
        if (error) {
            console.error('Error checking admin:', error);
            return false;
        }
        return data === true;
    } catch (error) {
        console.error('Error in isAdmin:', error);
        return false;
    }
}

// Logout
async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// Formatear números
function formatNumber(num) {
    return new Intl.NumberFormat('es-ES').format(num)
}

// Formatear fechas
function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES')
}