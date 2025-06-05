// env-config.js - Configuración centralizada de variables de entorno
// Para GitHub Pages, usamos un archivo de configuración en lugar de variables de entorno reales

// En desarrollo local, puedes crear un archivo env-config.local.js con tus valores reales
// En producción, este archivo contendrá los valores de producción

const ENV_CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://hindymhwohevsqumekyv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpbmR5bWh3b2hldnNxdW1la3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3ODc4OTksImV4cCI6MjA2NDM2Mzg5OX0.oHuotC0MjPDrEMQksKt6QJ-Z_Yh0G60ZNRv5Ncy4MUQ',
    
    // Application Configuration
    BASE_PATH: '/izeta2025',
    APP_NAME: 'IZETA 2025',
    
    // Feature Flags
    ENABLE_REALTIME: true,
    ENABLE_ANALYTICS: true,
    
    // API Endpoints (if needed in future)
    API_VERSION: 'v1'
};

// Freeze the configuration to prevent accidental modifications
Object.freeze(ENV_CONFIG);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ENV_CONFIG;
} 