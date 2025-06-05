// debug-config.js - Script de diagnóstico de configuración
// Úsalo añadiendo <script src="/assets/js/debug-config.js"></script> al final de tu HTML

(function() {
    console.log('🔍 DIAGNÓSTICO DE CONFIGURACIÓN IZETA 2025');
    console.log('==========================================');
    
    // 1. Verificar si ENV_CONFIG existe
    if (typeof ENV_CONFIG !== 'undefined') {
        console.log('✅ ENV_CONFIG cargado correctamente');
        console.log('   - SUPABASE_URL:', ENV_CONFIG.SUPABASE_URL ? '✓ Definida' : '✗ Vacía');
        console.log('   - SUPABASE_ANON_KEY:', ENV_CONFIG.SUPABASE_ANON_KEY ? '✓ Definida' : '✗ Vacía');
        console.log('   - BASE_PATH:', ENV_CONFIG.BASE_PATH || '(vacío - desarrollo local)');
    } else {
        console.error('❌ ENV_CONFIG no está definido');
        console.error('   Verifica que env-config.js se carga antes que config.js');
    }
    
    // 2. Verificar variables globales
    console.log('\n📋 Variables Globales:');
    console.log('   - SUPABASE_URL:', typeof SUPABASE_URL !== 'undefined' ? (SUPABASE_URL || '✗ Vacía') : '✗ No definida');
    console.log('   - SUPABASE_ANON_KEY:', typeof SUPABASE_ANON_KEY !== 'undefined' ? (SUPABASE_ANON_KEY ? '✓ Definida' : '✗ Vacía') : '✗ No definida');
    
    // 3. Verificar supabaseClient
    console.log('\n🔌 Cliente Supabase:');
    if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
        console.log('✅ supabaseClient inicializado');
        
        // Intentar una llamada simple para verificar conexión
        if (supabaseClient.from) {
            supabaseClient
                .from('weekly_simulations')
                .select('count')
                .limit(1)
                .then(({ data, error }) => {
                    if (error) {
                        console.error('❌ Error de conexión:', error.message);
                    } else {
                        console.log('✅ Conexión a Supabase exitosa');
                    }
                })
                .catch(err => {
                    console.error('❌ Error al verificar conexión:', err);
                });
        }
    } else {
        console.error('❌ supabaseClient NO inicializado');
    }
    
    // 4. Información del entorno
    console.log('\n🌐 Información del Entorno:');
    console.log('   - Hostname:', window.location.hostname);
    console.log('   - Pathname:', window.location.pathname);
    console.log('   - Protocolo:', window.location.protocol);
    console.log('   - Es GitHub Pages:', window.location.hostname.includes('github.io') ? 'Sí' : 'No');
    console.log('   - Es desarrollo local:', ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'Sí' : 'No');
    
    // 5. Scripts cargados
    console.log('\n📜 Scripts Cargados:');
    const scripts = Array.from(document.scripts);
    const relevantScripts = scripts.filter(s => 
        s.src.includes('supabase') || 
        s.src.includes('config') || 
        s.src.includes('env-config')
    );
    
    relevantScripts.forEach((script, index) => {
        const scriptName = script.src.split('/').pop() || 'inline script';
        console.log(`   ${index + 1}. ${scriptName}`);
    });
    
    console.log('\n==========================================');
    console.log('Para más ayuda, revisa SECURITY.md');
})(); 