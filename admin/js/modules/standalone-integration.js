// admin/js/modules/standalone-integration.js
export default class StandaloneIntegration {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
    }
    
    async openBulkUsers() {
        // Verificar auth antes de abrir
        if (await this.dashboard.auth.requireAdmin()) {
            window.open('bulk-users.html', '_blank');
        }
    }
    
    async openEloManual() {
        if (await this.dashboard.auth.requireAdmin()) {
            window.open('elo_manual.html', '_blank');
        }
    }
}