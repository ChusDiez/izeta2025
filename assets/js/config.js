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

// Verificar que tenemos credenciales válidas antes de inicializar
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    // Inicializar cliente Supabase solo si tenemos credenciales
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('⚠️ CONFIGURACIÓN FALTANTE: No se encontraron las credenciales de Supabase.');
    console.error('Asegúrate de que env-config.js se carga antes que config.js');
    
    // Mostrar mensaje de error en la página si existe el elemento
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function() {
            const errorMessage = `
                <div style="background: #fee; color: #c00; padding: 20px; margin: 20px; border-radius: 8px; text-align: center;">
                    <h3>Error de Configuración</h3>
                    <p>No se pudieron cargar las credenciales de Supabase.</p>
                    <p>Por favor, recarga la página o contacta al administrador.</p>
                </div>
            `;
            
            // Intentar insertar el mensaje en varios lugares comunes
            const containers = ['contentWrapper', 'weeklyRanking', 'eloRanking', 'app', 'root'];
            for (const id of containers) {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = errorMessage;
                    break;
                }
            }
        });
    }
}

// Funciones helper globales
async function checkAuth() {
    if (!supabaseClient) {
        console.error('Supabase client no inicializado');
        return null;
    }
    const { data: { user } } = await supabaseClient.auth.getUser()
    return user
}

async function isAdmin() {
    try {
        if (!supabaseClient) {
            console.error('Supabase client no inicializado');
            return false;
        }
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
    if (!supabaseClient) {
        console.error('Supabase client no inicializado');
        window.location.href = 'index.html';
        return;
    }
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