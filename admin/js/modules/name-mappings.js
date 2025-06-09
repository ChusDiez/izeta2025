export default class NameMappingsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.mappings = [];
        this.unmappedUsers = [];
    }

    async render(container) {
        container.innerHTML = `
            <div class="name-mappings-page">
                <h2>🔗 Mapeo de Nombres Excel → Usuarios</h2>
                
                <div class="info-box">
                    <h3>ℹ️ ¿Para qué sirve esto?</h3>
                    <p>Cuando el sistema no puede encontrar automáticamente un usuario por su nombre 
                    (por caracteres especiales, tildes, etc.), puedes crear un mapeo manual aquí.</p>
                </div>

                <div class="mappings-container">
                    <div class="section">
                        <h3>➕ Crear Nuevo Mapeo</h3>
                        <div class="form-group">
                            <label>Nombre en Excel (tal como aparece):</label>
                            <input type="text" id="excelName" placeholder="Ej: ADRIAN GOMEZ MIER" />
                        </div>
                        <div class="form-group">
                            <label>Email del usuario:</label>
                            <select id="userEmail">
                                <option value="">Selecciona un usuario...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notas (opcional):</label>
                            <input type="text" id="notes" placeholder="Ej: Mayúsculas en Excel" />
                        </div>
                        <button class="btn btn-primary" onclick="window.nameMappingsModule.createMapping()">
                            ➕ Crear Mapeo
                        </button>
                    </div>

                    <div class="section">
                        <h3>📋 Mapeos Existentes</h3>
                        <div class="table-wrapper" id="mappingsTable">
                            <div class="loading">Cargando mapeos...</div>
                        </div>
                    </div>

                    <div class="section">
                        <h3>❓ Usuarios Sin Mapear</h3>
                        <p class="hint">Estos son usuarios de la cohorte "sin_asignar" que podrían necesitar mapeo manual:</p>
                        <div class="table-wrapper" id="unmappedTable">
                            <div class="loading">Cargando usuarios...</div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .name-mappings-page {
                    padding: 2rem;
                }
                
                .mappings-container {
                    display: grid;
                    gap: 2rem;
                }
                
                .section {
                    background: white;
                    border-radius: 8px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .form-group {
                    margin-bottom: 1rem;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                    color: #333;
                }
                
                .form-group input, .form-group select {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 1rem;
                }
                
                .info-box {
                    background: #e8f4fd;
                    border: 1px solid #bee5eb;
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }
                
                .info-box h3 {
                    margin-top: 0;
                    color: #0066cc;
                }
                
                .hint {
                    color: #666;
                    font-size: 0.9rem;
                    margin-bottom: 1rem;
                }
                
                .mapping-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid #eee;
                }
                
                .mapping-item:last-child {
                    border-bottom: none;
                }
                
                .btn-delete {
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                
                .btn-delete:hover {
                    background: #c82333;
                }
                
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .data-table th,
                .data-table td {
                    padding: 0.75rem;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .data-table th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #374151;
                }
                
                .data-table tbody tr:hover {
                    background: #f9fafb;
                }
            </style>
        `;

        // Guardar referencia global
        window.nameMappingsModule = this;
        
        // Cargar datos
        setTimeout(() => {
            this.loadData();
        }, 100);
    }

    async loadData() {
        await Promise.all([
            this.loadMappings(),
            this.loadUnmappedUsers(),
            this.loadUsersList()
        ]);
    }

    async loadMappings() {
        try {
            const { data, error } = await this.supabase
                .from('excel_name_mappings')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.mappings = data || [];
            this.renderMappingsTable();
        } catch (error) {
            console.error('Error cargando mapeos:', error);
            this.dashboard.showNotification('error', 'Error cargando mapeos: ' + error.message);
        }
    }

    async loadUnmappedUsers() {
        try {
            const { data, error } = await this.supabase
                .from('usuarios_sin_mapeo')
                .select('*')
                .eq('estado_mapeo', '❌ Sin mapear')
                .limit(50);

            if (error) throw error;

            this.unmappedUsers = data || [];
            this.renderUnmappedTable();
        } catch (error) {
            console.error('Error cargando usuarios sin mapear:', error);
        }
    }

    async loadUsersList() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('email, username')
                .eq('cohort', 'sin_asignar')
                .order('username');

            if (error) throw error;

            const select = document.getElementById('userEmail');
            if (select) {
                select.innerHTML = '<option value="">Selecciona un usuario...</option>';
                data.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = `${user.username} (${user.email})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error cargando lista de usuarios:', error);
        }
    }

    renderMappingsTable() {
        const container = document.getElementById('mappingsTable');
        if (!container) return;

        if (this.mappings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay mapeos creados todavía</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre en Excel</th>
                        <th>Email Usuario</th>
                        <th>Notas</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.mappings.map(mapping => `
                        <tr>
                            <td><strong>${mapping.excel_name}</strong></td>
                            <td>${mapping.user_email}</td>
                            <td>${mapping.notes || '-'}</td>
                            <td>${new Date(mapping.created_at).toLocaleDateString('es-ES')}</td>
                            <td>
                                <button class="btn-delete" onclick="window.nameMappingsModule.deleteMapping('${mapping.id}')">
                                    🗑️ Eliminar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderUnmappedTable() {
        const container = document.getElementById('unmappedTable');
        if (!container) return;

        if (this.unmappedUsers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">¡Todos los usuarios están mapeados! 🎉</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Acción Rápida</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.unmappedUsers.map(user => `
                        <tr>
                            <td><strong>${user.username}</strong></td>
                            <td>${user.email}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" 
                                    onclick="window.nameMappingsModule.quickMap('${user.username}', '${user.email}')">
                                    ➕ Crear Mapeo
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async createMapping() {
        const excelName = document.getElementById('excelName').value.trim();
        const userEmail = document.getElementById('userEmail').value;
        const notes = document.getElementById('notes').value.trim();

        if (!excelName || !userEmail) {
            this.dashboard.showNotification('warning', 'Por favor completa los campos requeridos');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('excel_name_mappings')
                .insert({
                    excel_name: excelName,
                    user_email: userEmail,
                    notes: notes || null
                });

            if (error) throw error;

            this.dashboard.showNotification('success', 'Mapeo creado exitosamente');
            
            // Limpiar formulario
            document.getElementById('excelName').value = '';
            document.getElementById('userEmail').value = '';
            document.getElementById('notes').value = '';
            
            // Recargar datos
            this.loadData();
        } catch (error) {
            console.error('Error creando mapeo:', error);
            this.dashboard.showNotification('error', 'Error creando mapeo: ' + error.message);
        }
    }

    async deleteMapping(mappingId) {
        if (!confirm('¿Estás seguro de eliminar este mapeo?')) return;

        try {
            const { error } = await this.supabase
                .from('excel_name_mappings')
                .delete()
                .eq('id', mappingId);

            if (error) throw error;

            this.dashboard.showNotification('success', 'Mapeo eliminado');
            this.loadData();
        } catch (error) {
            console.error('Error eliminando mapeo:', error);
            this.dashboard.showNotification('error', 'Error eliminando mapeo: ' + error.message);
        }
    }

    quickMap(username, email) {
        // Pre-llenar el formulario con los datos
        document.getElementById('excelName').value = username;
        document.getElementById('userEmail').value = email;
        document.getElementById('notes').value = 'Mapeo rápido desde lista de usuarios';
        
        // Hacer scroll al formulario
        document.querySelector('.section').scrollIntoView({ behavior: 'smooth' });
    }
} 