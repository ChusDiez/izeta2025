// admin/js/modules/bulk-users.js
export default class BulkUsersModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.previewData = [];
    }

    async render(container) {
        container.innerHTML = `
            <div class="bulk-users-page">
                <h1>👥 Carga Masiva de Alumnos</h1>
                <p>Añade múltiples alumnos al sistema de forma rápida</p>
                
                <div class="card">
                    <h2>Método 1: Carga desde texto</h2>
                    <p class="help-text">Pega la lista de emails o usa el formato completo con más datos</p>
                    
                    <div class="form-grid">
                        <div class="form-section">
                            <h3>📧 Formato Simple (solo emails)</h3>
                            <div class="form-group">
                                <label for="emailList">Lista de emails (uno por línea)</label>
                                <textarea id="emailList" placeholder="juan.perez@email.com
maria.garcia@email.com
carlos.lopez@email.com"></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="defaultCohort">Cohorte por defecto</label>
                                <select id="defaultCohort">
                                    <option value="sin_asignar">Sin asignar (pendiente)</option>
                                    <option value="20h">20h - Base</option>
                                    <option value="36h">36h - Intensivo</option>
                                    <option value="48h">48h - Élite</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h3>📋 Formato Completo (CSV)</h3>
                            <div class="form-group">
                                <label for="csvData">Datos CSV (email,nombre,cohorte)</label>
                                <textarea id="csvData" placeholder="email,nombre,cohorte
juan.perez@email.com,Juan Pérez,20h
maria.garcia@email.com,María García,36h"></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                        <button class="btn btn-secondary" onclick="window.bulkUsersModule.previewUsers()">
                            👁️ Vista Previa
                        </button>
                        <button class="btn btn-primary" onclick="window.bulkUsersModule.processUsers()">
                            ⬆️ Cargar Alumnos
                        </button>
                    </div>
                </div>
                
                <!-- Vista previa -->
                <div id="previewSection" class="card" style="display: none;">
                    <h2>Vista Previa</h2>
                    <div id="previewContent">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                
                <!-- Mensajes -->
                <div id="successMessage" class="message success" style="display: none;"></div>
                <div id="errorMessage" class="message error" style="display: none;"></div>
            </div>
        `;
        
        window.bulkUsersModule = this;
    }
    
    previewUsers() {
        const emailList = document.getElementById('emailList').value.trim();
        const csvData = document.getElementById('csvData').value.trim();
        const defaultCohort = document.getElementById('defaultCohort').value;
        
        this.previewData = [];
        
        // Procesar emails simples
        if (emailList) {
            const emails = emailList.split('\n').filter(e => e.trim());
            emails.forEach(email => {
                const trimmedEmail = email.trim().toLowerCase();
                if (this.validateEmail(trimmedEmail)) {
                    this.previewData.push({
                        email: trimmedEmail,
                        username: trimmedEmail.split('@')[0],
                        cohort: defaultCohort
                    });
                }
            });
        }
        
        // Mostrar preview
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');
        
        previewContent.innerHTML = `
            <p>Se cargarán ${this.previewData.length} usuarios:</p>
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Nombre</th>
                        <th>Cohorte</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.previewData.map(user => `
                        <tr>
                            <td>${user.email}</td>
                            <td>${user.username}</td>
                            <td>${user.cohort}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        previewSection.style.display = 'block';
    }
    
    async processUsers() {
        if (this.previewData.length === 0) {
            this.showError('Primero haz vista previa de los datos');
            return;
        }
        
        if (!confirm(`¿Confirmas la carga de ${this.previewData.length} alumnos?`)) return;
        
        try {
            // Generar slugs únicos para cada usuario
            const usersToInsert = this.previewData.map(user => ({
                email: user.email,
                username: user.username,
                cohort: user.cohort,
                slug: this.generateSlug(user.username || user.email),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                active: true,
                current_elo: 1000,
                current_streak: 0,
                longest_streak: 0,
                total_simulations: 0,
                average_score: 0,
                probability_pass: 50,
                z_score: 0,
                trend_direction: 'neutral',
                risk_level: 'medium',
                notes: [],
                is_admin: false
            }));
            
            // Insertar usuarios en Supabase
            const { data, error } = await this.supabase
                .from('users')
                .insert(usersToInsert)
                .select();
            
            if (error) throw error;
            
            this.showSuccess(`${data.length} usuarios creados correctamente`);
            
            // Limpiar formularios
            document.getElementById('emailList').value = '';
            document.getElementById('csvData').value = '';
            document.getElementById('previewSection').style.display = 'none';
            this.previewData = [];
            
            // Recargar datos
            await this.dashboard.loadInitialData();
            
            // Redirigir a la página de estudiantes
            setTimeout(() => {
                this.dashboard.showPage('students');
            }, 1500);
            
        } catch (error) {
            this.showError('Error al procesar usuarios: ' + error.message);
        }
    }

    // Añadir este método si no existe:
    generateSlug(input) {
        // Tomar los primeros 8 caracteres del email o nombre
        const base = input.split('@')[0].substring(0, 8).toUpperCase();
        // Añadir un número aleatorio para evitar duplicados
        const random = Math.floor(Math.random() * 1000);
        return `${base}${random}`;
    }
    
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    showSuccess(message) {
        const el = document.getElementById('successMessage');
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    }
    
    showError(message) {
        const el = document.getElementById('errorMessage');
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    }
}