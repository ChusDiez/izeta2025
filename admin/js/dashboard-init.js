// /admin/js/dashboard-init.js
// Inicialización del dashboard administrativo

// Importar el core
import { DashboardCore } from './dashboard-core.js';

// Variable global para la instancia del dashboard
let dashboard = null;

/**
 * Función principal de inicialización
 */
async function initializeDashboard() {
    try {
        console.log('=== INICIALIZANDO DASHBOARD ADMINISTRATIVO ===');
        
        // Verificar que tenemos Supabase
        if (typeof supabaseClient === 'undefined') {
            throw new Error('Supabase no está configurado. Verifica config.js');
        }
        
        // Crear instancia del dashboard
        dashboard = new DashboardCore(supabaseClient);
        
        // Inicializar
        const initialized = await dashboard.init();
        
        if (!initialized) {
            console.error('No se pudo inicializar el dashboard');
            return;
        }
        
        // Configurar manejadores globales
        setupGlobalHandlers();
        
        // Configurar actualización automática
        setupAutoRefresh();
        
        console.log('=== DASHBOARD LISTO ===');
        
    } catch (error) {
        console.error('Error crítico en la inicialización:', error);
        showFatalError(error);
    }
}

/**
 * Configurar manejadores globales
 */
function setupGlobalHandlers() {
    // Manejador de errores no capturados
    window.addEventListener('unhandledrejection', event => {
        console.error('Promise rechazada:', event.reason);
        dashboard?.showNotification('error', 'Error inesperado: ' + event.reason);
    });
    
    // Manejador para cerrar sesión
    window.logout = async () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            const result = await dashboard.auth.logout();
            if (result.success) {
                window.location.href = dashboard.auth.getBasePath() + '/admin/login.html';
            }
        }
    };
    
    // Manejador para refrescar datos
    window.refreshData = async () => {
        dashboard?.showNotification('info', 'Actualizando datos...');
        await dashboard?.loadInitialData();
        await dashboard?.refreshCurrentPage();
        dashboard?.showNotification('success', 'Datos actualizados');
    };
    
    // Manejador para aplicar filtros
    window.applyFilters = () => {
        const cohort = document.getElementById('cohortFilter')?.value;
        const status = document.getElementById('statusFilter')?.value;
        
        if (cohort) dashboard?.applyFilters('cohort', cohort);
        if (status) dashboard?.applyFilters('status', status);
    };
    
    // Manejador para búsqueda en tablas
    window.filterTable = (tableId, searchTerm) => {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    };
    
    // Prevenir salida accidental
    window.addEventListener('beforeunload', (e) => {
        if (dashboard?.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Limpiar al salir
    window.addEventListener('unload', () => {
        dashboard?.destroy();
    });
}

/**
 * Configurar actualización automática opcional
 */
function setupAutoRefresh() {
    // Actualizar badges cada minuto
    setInterval(() => {
        dashboard?.updateBadges();
    }, 60000);
    
    // Verificar sesión cada 5 minutos
    setInterval(async () => {
        const authResult = await dashboard?.auth.verifyAdminAccess();
        if (!authResult.success) {
            console.warn('Sesión expirada o permisos revocados');
            window.location.href = dashboard.auth.getBasePath() + '/admin/login.html';
        }
    }, 300000);
}

/**
 * Mostrar error fatal
 */
function showFatalError(error) {
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f9fafb;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px;">
                <h1 style="color: #dc2626; margin-bottom: 1rem;">❌ Error Fatal</h1>
                <p style="margin-bottom: 1rem;">${error.message}</p>
                <p style="color: #6b7280; font-size: 0.875rem;">
                    Por favor, recarga la página o contacta al administrador del sistema.
                </p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Recargar Página
                </button>
            </div>
        </div>
    `;
}

/**
 * Exponer funciones útiles globalmente
 */
window.dashboardAdmin = {
    getInstance: () => dashboard,
    refreshData: () => window.refreshData(),
    showPage: (page) => dashboard?.showPage(page),
    applyFilter: (type, value) => dashboard?.applyFilters(type, value),
    exportData: async (type) => {
        const exportsModule = await dashboard?.loadModule('exports');
        return exportsModule?.exportData(type);
    },
    showStudentDetail: (studentId) => dashboard?.showStudentDetail(studentId),
    showNotification: (type, message) => dashboard?.showNotification(type, message)
};

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}

// Exportar para debugging
export { dashboard };