// admin/js/modules/bulk-users.js
export default class BulkUsersModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.previewData = [];
        this.currentUsers = [];
    }

    async render(container) {
        // Inyectar estilos
        this.injectStyles();
        
        container.innerHTML = `
            <div class="bulk-users-page">
                <div class="bulk-container">
                    <h1>👥 Carga Masiva de Alumnos</h1>
                    <p>Añade múltiples alumnos al sistema de forma rápida</p>
                    
                    <div class="bulk-card">
                        <h2>Método 1: Carga desde texto</h2>
                        <p class="bulk-help-text">Pega la lista de emails o usa el formato completo con más datos</p>
                        
                        <div class="bulk-form-grid">
                            <div class="bulk-form-section">
                                <h3>📧 Formato Simple (solo emails)</h3>
                                <div class="bulk-form-group">
                                    <label for="emailList">Lista de emails (uno por línea)</label>
                                    <textarea id="emailList" placeholder="juan.perez@email.com
maria.garcia@email.com
carlos.lopez@email.com"></textarea>
                                    <div class="bulk-format-example">
                                        Ejemplo:<br>
                                        alumno1@gmail.com<br>
                                        alumno2@hotmail.com<br>
                                        alumno3@yahoo.es
                                    </div>
                                </div>
                                
                                <div class="bulk-form-group">
                                    <label for="defaultCohort">Cohorte por defecto</label>
                                    <select id="defaultCohort">
                                        <option value="sin_asignar">Sin asignar (pendiente)</option>
                                        <option value="20h">20h - Base</option>
                                        <option value="36h">36h - Intensivo</option>
                                        <option value="48h">48h - Élite</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="bulk-form-section">
                                <h3>📋 Formato Completo (CSV)</h3>
                                <div class="bulk-form-group">
                                    <label for="csvData">Datos CSV (email,nombre,cohorte)</label>
                                    <textarea id="csvData" placeholder="email,nombre,cohorte
juan.perez@email.com,Juan Pérez,20h
maria.garcia@email.com,María García,36h"></textarea>
                                    <div class="bulk-format-example">
                                        Formato: email,nombre,cohorte<br>
                                        Ejemplo:<br>
                                        juan@email.com,Juan Pérez,20h<br>
                                        maria@email.com,María García,36h
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                            <button class="bulk-btn bulk-btn-secondary" onclick="window.bulkUsersModule.previewUsers()">
                                👁️ Vista Previa
                            </button>
                            <button class="bulk-btn bulk-btn-primary" onclick="window.bulkUsersModule.processUsers()">
                                ⬆️ Cargar Alumnos
                            </button>
                        </div>
                        
                        <!-- Opciones avanzadas -->
                        <div class="bulk-advanced-options">
                            <h4 style="margin-bottom: 1rem;">⚙️ Opciones Avanzadas</h4>
                            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="updateExisting" style="width: auto;">
                                    <span>Actualizar datos de usuarios existentes</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="onlyUpdateCohort" style="width: auto;">
                                    <span>Solo actualizar cohorte (mantener otros datos)</span>
                                </label>
                            </div>
                            <p class="bulk-help-text" style="margin-top: 0.5rem;">
                                Si está marcado, actualizará los datos de usuarios que ya existen en lugar de saltarlos.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Vista previa -->
                    <div id="previewSection" class="bulk-card" style="display: none;">
                        <h2>Vista Previa</h2>
                        <div class="bulk-stats-grid">
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="totalCount">0</div>
                                <div class="stat-label">Total alumnos</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="cohort20h">0</div>
                                <div class="stat-label">Cohorte 20h</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="cohort36h">0</div>
                                <div class="stat-label">Cohorte 36h</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="cohort48h">0</div>
                                <div class="stat-label">Cohorte 48h</div>
                            </div>
                        </div>
                        <div id="previewContent">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Mensajes -->
                    <div id="successMessage" class="bulk-message bulk-success" style="display: none;"></div>
                    <div id="errorMessage" class="bulk-message bulk-error" style="display: none;"></div>
                    
                    <!-- Log de procesamiento -->
                    <div id="processingLog" class="bulk-processing-log" style="display: none;"></div>
                    
                    <!-- Lista actual de usuarios -->
                    <div class="bulk-card">
                        <h2>👥 Alumnos Actuales en el Sistema</h2>
                        <div id="currentStats" class="bulk-stats-grid" style="margin-bottom: 2rem;">
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="currentTotal">...</div>
                                <div class="stat-label">Total actual</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="currentActive">...</div>
                                <div class="stat-label">Activos</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="currentInactive">...</div>
                                <div class="stat-label">Inactivos</div>
                            </div>
                            <div class="bulk-stat-box">
                                <div class="stat-number" id="currentUnassigned">...</div>
                                <div class="stat-label">Sin asignar</div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="searchInput" placeholder="Buscar por email, nombre o slug..." 
                                   style="max-width: 400px; flex: 1;" 
                                   onkeyup="window.bulkUsersModule.filterUsers()">
                            
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <label style="margin: 0;">Cambiar cohorte seleccionados:</label>
                                <select id="bulkCohortChange" style="width: auto;">
                                    <option value="">-- Seleccionar --</option>
                                    <option value="sin_asignar">Sin asignar</option>
                                    <option value="20h">20h - Base</option>
                                    <option value="36h">36h - Intensivo</option>
                                    <option value="48h">48h - Élite</option>
                                </select>
                                <button class="bulk-btn bulk-btn-primary" style="padding: 0.5rem 1rem;" 
                                        onclick="window.bulkUsersModule.bulkChangeCohort()">
                                    Aplicar
                                </button>
                            </div>
                        </div>
                        
                        <div style="overflow-x: auto;">
                            <table class="bulk-preview-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;">
                                            <input type="checkbox" id="selectAll" 
                                                   onchange="window.bulkUsersModule.toggleSelectAll()" 
                                                   style="width: auto;">
                                        </th>
                                        <th>Email</th>
                                        <th>Nombre</th>
                                        <th>Slug</th>
                                        <th>Cohorte</th>
                                        <th>ELO</th>
                                        <th>Simulacros</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="currentUsersBody">
                                    <tr>
                                        <td colspan="9" style="text-align: center;">Cargando...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        window.bulkUsersModule = this;
        
        // Cargar usuarios actuales
        this.loadCurrentUsers();
    }
    
    injectStyles() {
        if (document.getElementById('bulk-users-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'bulk-users-styles';
        styles.textContent = `
            .bulk-users-page {
                padding: 0;
            }
            
            .bulk-container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .bulk-card {
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                margin-bottom: 2rem;
            }
            
            .bulk-form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
            }
            
            .bulk-form-section {
                padding: 1.5rem;
                background: #F9FAFB;
                border-radius: 8px;
            }
            
            .bulk-form-group {
                margin-bottom: 1.5rem;
            }
            
            .bulk-form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #212121;
            }
            
            .bulk-form-group input,
            .bulk-form-group select,
            .bulk-form-group textarea {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e5e7eb;
                border-radius: 6px;
                font-size: 1rem;
                transition: border-color 0.3s;
            }
            
            .bulk-form-group input:focus,
            .bulk-form-group select:focus,
            .bulk-form-group textarea:focus {
                outline: none;
                border-color: #1E3A8A;
                box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
            }
            
            .bulk-form-group textarea {
                min-height: 200px;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                resize: vertical;
            }
            
            .bulk-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 6px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .bulk-btn-primary {
                background: #1E3A8A;
                color: white;
            }
            
            .bulk-btn-primary:hover {
                background: #1e3a8a;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .bulk-btn-secondary {
                background: #e5e7eb;
                color: #212121;
            }
            
            .bulk-btn-secondary:hover {
                background: #d1d5db;
                transform: translateY(-2px);
            }
            
            .bulk-btn-danger {
                background: #dc2626;
                color: white;
            }
            
            .bulk-btn-danger:hover {
                background: #b91c1c;
                transform: translateY(-1px);
            }
            
            .bulk-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }
            
            .bulk-message {
                padding: 1rem;
                border-radius: 6px;
                margin: 1rem 0;
            }
            
            .bulk-message.bulk-success {
                background: #d1fae5;
                color: #065f46;
                border: 1px solid #10b981;
            }
            
            .bulk-message.bulk-error {
                background: #fee2e2;
                color: #991b1b;
                border: 1px solid #dc2626;
            }
            
            .bulk-preview-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
            }
            
            .bulk-preview-table th {
                background: #1E3A8A;
                color: white;
                padding: 0.75rem;
                text-align: left;
            }
            
            .bulk-preview-table td {
                padding: 0.75rem;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .bulk-preview-table tr:hover {
                background: #F9FAFB;
            }
            
            .bulk-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin: 1rem 0;
            }
            
            .bulk-stat-box {
                background: #F9FAFB;
                padding: 1rem;
                border-radius: 6px;
                text-align: center;
            }
            
            .bulk-stat-box .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #1E3A8A;
            }
            
            .bulk-stat-box .stat-label {
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            .bulk-help-text {
                font-size: 0.875rem;
                color: #6b7280;
                margin-top: 0.25rem;
            }
            
            .bulk-format-example {
                background: #f3f4f6;
                padding: 1rem;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.85rem;
                margin-top: 0.5rem;
            }
            
            .bulk-processing-log {
                background: #1f2937;
                color: #e5e7eb;
                padding: 1rem;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.85rem;
                max-height: 300px;
                overflow-y: auto;
                margin-top: 1rem;
            }
            
            .bulk-processing-log .log-entry {
                margin-bottom: 0.5rem;
            }
            
            .bulk-processing-log .log-success { color: #10b981; }
            .bulk-processing-log .log-error { color: #ef4444; }
            .bulk-processing-log .log-warning { color: #f59e0b; }
            
            .bulk-advanced-options {
                margin-top: 2rem;
                padding: 1rem;
                background: #fef3c7;
                border-radius: 6px;
            }
            
            .bulk-advanced-options h4 {
                margin-bottom: 1rem;
                color: #92400e;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Actualizar previewUsers para usar la tabla con estilos
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
                        cohort: defaultCohort,
                        slug: this.generateSlug(trimmedEmail.split('@')[0])
                    });
                }
            });
        }
        
        // Procesar datos CSV
        if (csvData) {
            this.processCSVData();
        }
        
        // Actualizar estadísticas
        document.getElementById('totalCount').textContent = this.previewData.length;
        document.getElementById('cohort20h').textContent = this.previewData.filter(u => u.cohort === '20h').length;
        document.getElementById('cohort36h').textContent = this.previewData.filter(u => u.cohort === '36h').length;
        document.getElementById('cohort48h').textContent = this.previewData.filter(u => u.cohort === '48h').length;
        
        // Mostrar preview
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');
        
        previewContent.innerHTML = `
            <table class="bulk-preview-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Nombre</th>
                        <th>Slug</th>
                        <th>Cohorte</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.previewData.map(user => `
                        <tr>
                            <td>${user.email}</td>
                            <td>${user.username}</td>
                            <td><code>${user.slug}</code></td>
                            <td><span style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 4px;">${user.cohort}</span></td>
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
            // Aquí iría la lógica de inserción en Supabase
            // Por ahora simulamos el proceso
            
            this.showSuccess(`${this.previewData.length} usuarios procesados correctamente`);
            
            // Limpiar formularios
            document.getElementById('emailList').value = '';
            document.getElementById('csvData').value = '';
            document.getElementById('previewSection').style.display = 'none';
            this.previewData = [];
            
            // Recargar datos
            await this.dashboard.loadInitialData();
            
        } catch (error) {
            this.showError('Error al procesar usuarios: ' + error.message);
        }
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
    
    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }
    
    // Cargar usuarios actuales
    async loadCurrentUsers() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            this.currentUsers = data || [];
            
            // Actualizar estadísticas
            document.getElementById('currentTotal').textContent = data.length;
            document.getElementById('currentActive').textContent = data.filter(u => u.active).length;
            document.getElementById('currentInactive').textContent = data.filter(u => !u.active).length;
            document.getElementById('currentUnassigned').textContent = data.filter(u => u.cohort === 'sin_asignar').length;
            
            // Mostrar tabla
            this.updateCurrentUsersTable(data);
            
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.showError('Error al cargar usuarios actuales');
        }
    }
    
    // Actualizar tabla de usuarios
    updateCurrentUsersTable(users) {
        const tbody = document.getElementById('currentUsersBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay usuarios</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => {
            const cohortColor = {
                '20h': '#3b82f6',
                '36h': '#8b5cf6',
                '48h': '#dc2626',
                'sin_asignar': '#6b7280'
            };
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="user-select" value="${user.id}" style="width: auto;">
                    </td>
                    <td>${user.email}</td>
                    <td>${user.username}</td>
                    <td><code>${user.slug}</code></td>
                    <td>
                        <span style="background: ${cohortColor[user.cohort] || '#e5e7eb'}; 
                                   color: white; 
                                   padding: 0.25rem 0.5rem; 
                                   border-radius: 4px;">
                            ${user.cohort === 'sin_asignar' ? 'Sin asignar' : user.cohort}
                        </span>
                    </td>
                    <td><strong>${user.current_elo || 1000}</strong></td>
                    <td>${user.total_simulations || 0}</td>
                    <td>
                        <span style="color: ${user.active ? '#10b981' : '#dc2626'};">
                            ${user.active ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                    </td>
                    <td>
                        <button class="bulk-btn bulk-btn-danger" 
                                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;"
                                onclick="window.bulkUsersModule.toggleUserStatus('${user.id}', ${user.active})">
                            ${user.active ? 'Desactivar' : 'Activar'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Procesar usuarios con formato CSV
    async processCSVData() {
        const csvData = document.getElementById('csvData').value.trim();
        if (!csvData) return;
        
        const lines = csvData.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 3) {
                const email = parts[0].toLowerCase();
                const username = parts[1];
                const cohort = parts[2];
                
                if (this.validateEmail(email)) {
                    // Buscar si ya existe en previewData
                    const existingIndex = this.previewData.findIndex(u => u.email === email);
                    if (existingIndex >= 0) {
                        // Actualizar existente
                        this.previewData[existingIndex] = {
                            email,
                            username,
                            cohort,
                            slug: this.generateSlug(username)
                        };
                    } else {
                        // Añadir nuevo
                        this.previewData.push({
                            email,
                            username,
                            cohort,
                            slug: this.generateSlug(username)
                        });
                    }
                }
            }
        });
    }
    
    // Toggle seleccionar todos
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAll').checked;
        document.querySelectorAll('.user-select').forEach(cb => {
            cb.checked = selectAll;
        });
    }
    
    // Cambio masivo de cohorte
    async bulkChangeCohort() {
        const newCohort = document.getElementById('bulkCohortChange').value;
        if (!newCohort) {
            this.showError('Selecciona una cohorte');
            return;
        }
        
        const selectedIds = Array.from(document.querySelectorAll('.user-select:checked'))
            .map(cb => cb.value);
        
        if (selectedIds.length === 0) {
            this.showError('Selecciona al menos un usuario');
            return;
        }
        
        if (!confirm(`¿Cambiar cohorte a ${selectedIds.length} usuarios?`)) return;
        
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ 
                    cohort: newCohort,
                    updated_at: new Date().toISOString()
                })
                .in('id', selectedIds);
            
            if (error) throw error;
            
            this.showSuccess(`Cohorte actualizada para ${selectedIds.length} usuarios`);
            document.getElementById('bulkCohortChange').value = '';
            document.getElementById('selectAll').checked = false;
            await this.loadCurrentUsers();
            
        } catch (error) {
            this.showError('Error al actualizar cohortes: ' + error.message);
        }
    }
    
    // Filtrar usuarios
    filterUsers() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const filtered = this.currentUsers.filter(user => 
            user.email.toLowerCase().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm) ||
            user.slug.toLowerCase().includes(searchTerm)
        );
        this.updateCurrentUsersTable(filtered);
    }
    
    // Toggle estado usuario
    async toggleUserStatus(userId, currentStatus) {
        if (!confirm(`¿${currentStatus ? 'Desactivar' : 'Activar'} este usuario?`)) return;
        
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ 
                    active: !currentStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);
            
            if (error) throw error;
            
            this.showSuccess(`Usuario ${!currentStatus ? 'activado' : 'desactivado'} correctamente`);
            await this.loadCurrentUsers();
            
        } catch (error) {
            this.showError('Error al cambiar estado del usuario');
        }
    }
    
    // Mejorar el procesamiento de usuarios
    async processUsers() {
        if (this.previewData.length === 0) {
            this.showError('Primero haz vista previa de los datos');
            return;
        }
        
        if (!confirm(`¿Confirmas la carga de ${this.previewData.length} alumnos?`)) return;
        
        const updateExisting = document.getElementById('updateExisting').checked;
        const onlyUpdateCohort = document.getElementById('onlyUpdateCohort').checked;
        
        // Mostrar log
        const log = document.getElementById('processingLog');
        log.style.display = 'block';
        log.innerHTML = '';
        
        try {
            let created = 0;
            let updated = 0;
            let errors = 0;
            
            for (const userData of this.previewData) {
                try {
                    // Verificar si existe
                    const { data: existing } = await this.supabase
                        .from('users')
                        .select('id, username, cohort')
                        .eq('email', userData.email)
                        .single();
                    
                    if (existing) {
                        if (updateExisting) {
                            // Actualizar usuario existente
                            const updateData = onlyUpdateCohort ? 
                                { cohort: userData.cohort } : 
                                {
                                    username: userData.username,
                                    cohort: userData.cohort,
                                    slug: userData.slug,
                                    updated_at: new Date().toISOString()
                                };
                            
                            const { error } = await this.supabase
                                .from('users')
                                .update(updateData)
                                .eq('id', existing.id);
                            
                            if (error) throw error;
                            
                            updated++;
                            this.addLogEntry(`✅ Actualizado: ${userData.email}`, 'success');
                        } else {
                            this.addLogEntry(`⚠️ Ya existe: ${userData.email}`, 'warning');
                        }
                    } else {
                        // Crear nuevo usuario
                        const { error } = await this.supabase
                            .from('users')
                            .insert({
                                email: userData.email,
                                username: userData.username,
                                slug: userData.slug,
                                cohort: userData.cohort,
                                active: true,
                                current_elo: 1000,
                                total_simulations: 0,
                                average_score: 0,
                                current_streak: 0,
                                longest_streak: 0,
                                probability_pass: 50,
                                created_at: new Date().toISOString()
                            });
                        
                        if (error) throw error;
                        
                        created++;
                        this.addLogEntry(`✅ Creado: ${userData.email}`, 'success');
                    }
                } catch (error) {
                    errors++;
                    this.addLogEntry(`❌ Error con ${userData.email}: ${error.message}`, 'error');
                }
            }
            
            this.showSuccess(`Proceso completado: ${created} creados, ${updated} actualizados, ${errors} errores`);
            
            // Limpiar formularios
            document.getElementById('emailList').value = '';
            document.getElementById('csvData').value = '';
            document.getElementById('previewSection').style.display = 'none';
            this.previewData = [];
            
            // Recargar datos
            await this.loadCurrentUsers();
            await this.dashboard.loadInitialData();
            
        } catch (error) {
            this.showError('Error al procesar usuarios: ' + error.message);
        }
    }
    
    addLogEntry(message, type = '') {
        const log = document.getElementById('processingLog');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
}