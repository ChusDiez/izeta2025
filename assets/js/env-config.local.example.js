// env-config.local.js - Configuración LOCAL (NO commitear a Git)
// Copia este archivo como env-config.local.js y añade tus valores reales

const ENV_CONFIG = {
    // Supabase Configuration - Obtén estos valores de tu dashboard de Supabase
    SUPABASE_URL: 'tu_supabase_url_aqui',
    SUPABASE_ANON_KEY: 'tu_supabase_anon_key_aqui',
    
    // Application Configuration
    BASE_PATH: '',  // Vacío para desarrollo local
    APP_NAME: 'IZETA 2025 - DEV',
    
    // Feature Flags
    ENABLE_REALTIME: true,
    ENABLE_ANALYTICS: false,  // Desactivar analytics en desarrollo
    
    // API Endpoints (if needed in future)
    API_VERSION: 'v1'
};

// Freeze the configuration to prevent accidental modifications
Object.freeze(ENV_CONFIG);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ENV_CONFIG;
} 