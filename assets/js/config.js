// config.js - Configuración principal con detección automática de entorno

// Función para cargar la configuración correcta según el entorno
function loadConfig() {
    // Intentar cargar configuración local primero (para desarrollo)
    if (typeof ENV_CONFIG !== 'undefined') {
        return ENV_CONFIG;
    }
    
    // Si no hay configuración cargada, usar valores por defecto
    console.warn('No se encontró configuración de entorno. Usando valores por defecto.');
    return {
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: '',
        BASE_PATH: '',
        APP_NAME: 'IZETA 2025'
    };
}

// Obtener configuración
const config = loadConfig();

// Exportar las variables para compatibilidad con código existente
const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

// Inicializar cliente Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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