export default class NameMappingsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.mappings = [];
    }
    
    async render(container) {
        container.innerHTML = `
            <div class="name-mappings-page">
                <h2>🔗 Mapeo de Nombres Excel</h2>
                
                <div class="info-box">
                    <h3>ℹ️ Información</h3>
                    <p>Esta tabla permite mapear nombres de archivos Excel con usuarios del sistema.</p>
                    <p>Cuando se sube un archivo Excel, el sistema buscará coincidencias aquí antes de procesar.</p>
                </div>
                
                <div class="actions-bar">
                    <button class="btn btn-primary" onclick="window.nameMappingsModule.showAddModal()">
                        ➕ Añadir mapeo
                    </button>
                    <button class="btn btn-secondary" onclick="window.nameMappingsModule.loadMappings()">
                        🔄 Actualizar
                    </button>
                </div>
                
                <div class="mappings-grid">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Nombre en Excel</th>
                                <th>Usuario</th>
                                <th>Email</th>
                                <th>Cohorte</th>
                                <th>Notas</th>
                                <th>Creado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="mappingsBody">
                            <tr>
                                <td colspan="7" style="text-align: center;">Cargando mapeos...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- Modal para añadir/editar -->
                <div id="mappingModal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modalTitle">Añadir Mapeo</h3>
                            <button class="close-btn" onclick="window.nameMappingsModule.closeModal()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Nombre en Excel:</label>
                                <input type="text" id="excelName" class="form-control" 
                                       placeholder="ej: juan perez garcia">
                                <small>El nombre como aparece en el archivo Excel (sin tildes)</small>
                            </div>
                            
                            <div class="form-group">
                                <label>Usuario del sistema:</label>
                                <select id="userEmail" class="form-control">
                                    <option value="">-- Selecciona un usuario --</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Notas (opcional):</label>
                                <textarea id="notes" class="form-control" rows="3"
                                          placeholder="Cualquier nota relevante sobre este mapeo"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="window.nameMappingsModule.closeModal()">
                                Cancelar
                            </button>
                            <button class="btn btn-primary" onclick="window.nameMappingsModule.saveMapping()">
                                💾 Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .name-mappings-page {
                    padding: 2rem;
                }
                
                .actions-bar {
                    margin: 20px 0;
                    display: flex;
                    gap: 10px;
                }
                
                .mappings-grid {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    width: 90%;
                    max-width: 500px;
                    border-radius: 12px;
                    overflow: hidden;
                }
                
                .modal-header {
                    background: #f8f9fa;
                    padding: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .modal-header h3 {
                    margin: 0;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #666;
                }
                
                .modal-body {
                    padding: 1.5rem;
                }
                
                .modal-footer {
                    background: #f8f9fa;
                    padding: 1rem 1.5rem;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    border-top: 1px solid #e0e0e0;
                }
                
                .form-group {
                    margin-bottom: 1.5rem;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }
                
                .form-group small {
                    display: block;
                    margin-top: 0.25rem;
                    color: #666;
                    font-size: 0.875rem;
                }
                
                .form-control {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    font-size: 1rem;
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #0066cc;
                    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
                }
                
                .btn-icon {
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 0.25rem;
                    transition: transform 0.2s;
                }
                
                .btn-icon:hover {
                    transform: scale(1.1);
                }
            </style>
        `;
        
        // Guardar referencia global
        window.nameMappingsModule = this;
        
        // Cargar datos iniciales
        this.loadMappings();
        this.loadUsersList();
    }
    
    async loadMappings() {
        try {
            const { data, error } = await this.supabase
                .from('excel_name_mappings_view')
                .select('*')
                .order('excel_name');
            
            if (error) throw error;
            
            this.mappings = data || [];
            this.renderMappingsTable();
            
        } catch (error) {
            console.error('Error cargando mapeos:', error);
            this.dashboard.showNotification('error', 'Error cargando mapeos: ' + error.message);
        }
    }
    
    renderMappingsTable() {
        const tbody = document.getElementById('mappingsBody');
        if (!tbody) return;
        
        if (this.mappings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        No hay mapeos configurados todavía
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.mappings.map(mapping => `
            <tr>
                <td><strong>${mapping.excel_name}</strong></td>
                <td>${mapping.username || 'N/A'}</td>
                <td>${mapping.user_email}</td>
                <td><span class="badge badge-info">${mapping.cohort || 'N/A'}</span></td>
                <td>${mapping.notes || '-'}</td>
                <td>${new Date(mapping.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                    <button class="btn-icon" onclick="window.nameMappingsModule.deleteMapping('${mapping.id}')" 
                            title="Eliminar mapeo">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    async loadUsersList() {
        try {
            const { data: users } = await this.supabase
                .from('users')
                .select('id, email, username, cohort')
                .eq('role', 'user')
                .order('username');
            
            const select = document.getElementById('userEmail');
            if (!select || !users) return;
            
            // Limpiar select
            select.innerHTML = '<option value="">-- Selecciona un usuario --</option>';
            
            // Agrupar por cohorte
            const grouped = {};
            users.forEach(user => {
                const cohort = user.cohort || 'Sin cohorte';
                if (!grouped[cohort]) grouped[cohort] = [];
                grouped[cohort].push(user);
            });
            
            // Llenar el select
            Object.entries(grouped).forEach(([cohort, cohortUsers]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = cohort;
                
                cohortUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = `${user.username} (${user.email})`;
                    optgroup.appendChild(option);
                });
                
                select.appendChild(optgroup);
            });
            
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }
    
    showAddModal() {
        document.getElementById('mappingModal').style.display = 'flex';
        document.getElementById('modalTitle').textContent = 'Añadir Mapeo';
        
        // Limpiar formulario
        document.getElementById('excelName').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('notes').value = '';
    }
    
    closeModal() {
        document.getElementById('mappingModal').style.display = 'none';
    }
    
    async saveMapping() {
        const excelName = document.getElementById('excelName').value.trim().toLowerCase();
        const userEmail = document.getElementById('userEmail').value;
        const notes = document.getElementById('notes').value.trim();
        
        if (!excelName || !userEmail) {
            this.dashboard.showNotification('warning', 'Por favor completa todos los campos requeridos');
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
            
            this.dashboard.showNotification('success', 'Mapeo guardado correctamente');
            this.closeModal();
            this.loadMappings();
            
        } catch (error) {
            console.error('Error guardando mapeo:', error);
            this.dashboard.showNotification('error', 'Error al guardar: ' + error.message);
        }
    }
    
    async deleteMapping(id) {
        if (!confirm('¿Estás seguro de eliminar este mapeo?')) return;
        
        try {
            const { error } = await this.supabase
                .from('excel_name_mappings')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Mapeo eliminado');
            this.loadMappings();
            
        } catch (error) {
            console.error('Error eliminando mapeo:', error);
            this.dashboard.showNotification('error', 'Error al eliminar: ' + error.message);
        }
    }
} 