// admin/js/modules/simulations.js
export default class SimulationsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.currentSimulation = null;
    }

    async render(container, simulations) {
        // Primero, vamos a obtener el simulacro activo
        const activeSimulation = simulations.find(s => s.status === 'active');
        
        container.innerHTML = `
            <div class="simulations-page">
                <!-- Simulacro Activo -->
                ${this.renderActiveSimulation(activeSimulation)}
                
                <!-- Acciones Rápidas -->
                <div class="quick-actions">
                    <h3>⚡ Acciones Rápidas</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="window.simulationsModule.createNewSimulation()">
                            ➕ Crear Nuevo Simulacro
                        </button>
                        <button class="btn btn-warning" onclick="window.dashboardAdmin.showPage('elo-manual')">
                            ⚡ Actualizar ELO Manual
                        </button>
                        <button class="btn btn-secondary" onclick="window.simulationsModule.processWeeklyResults()">
                            🔄 Procesar Resultados Semanales
                        </button>
                    </div>
                </div>
                
                <!-- Lista de Simulacros -->
                <div class="table-card">
                    <div class="table-header">
                        <h2 class="table-title">📊 Todos los Simulacros</h2>
                    </div>
                    <div class="table-wrapper">
                        <table id="simulationsTable">
                            <thead>
                                <tr>
                                    <th>Semana</th>
                                    <th>Fechas</th>
                                    <th>Estado</th>
                                    <th>Participantes</th>
                                    <th>Score Promedio</th>
                                    <th>Procesado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${simulations.map(sim => this.renderSimulationRow(sim)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Modal para crear/editar -->
                ${this.renderSimulationModal()}
            </div>
        `;
        
        // Guardar referencia global para eventos
        window.simulationsModule = this;
    }

    renderActiveSimulation(simulation) {
        if (!simulation) {
            return `
                <div class="active-simulation-card" style="background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);">
                    <h3>⚠️ No hay simulacro activo</h3>
                    <p>Crea un nuevo simulacro para que los estudiantes puedan enviar resultados.</p>
                    <button class="btn btn-secondary" style="background: white; color: #1e3a8a; margin-top: 1rem;" 
                            onclick="window.simulationsModule.createNewSimulation()">
                        ➕ Crear nuevo simulacro
                    </button>
                </div>
            `;
        }

        // Calcular estadísticas en tiempo real
        const results = this.dashboard.data.results.filter(r => r.simulation_id === simulation.id);
        const actualParticipants = results.length;
        const actualAverage = results.length > 0 
            ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2)
            : 'N/A';
        
        // Calcular tiempo restante
        const endDate = new Date(simulation.end_date);
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        
        // Determinar participación por cohorte
        const cohortStats = results.reduce((acc, r) => {
            const cohort = r.users?.cohort || 'sin_asignar';
            if (!acc[cohort]) acc[cohort] = { count: 0, sum: 0 };
            acc[cohort].count++;
            acc[cohort].sum += r.score;
            return acc;
        }, {});

        return `
            <div class="active-simulation-card">
                <h3>🟢 Simulacro Activo: RF${simulation.week_number}</h3>
                
                <div class="simulation-stats">
                    <div class="stat">
                        <span class="stat-label">📅 Período</span>
                        <span class="stat-value">${this.formatDate(simulation.start_date)} - ${this.formatDate(simulation.end_date)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">👥 Participantes</span>
                        <span class="stat-value">${actualParticipants}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">📊 Score Promedio</span>
                        <span class="stat-value">${actualAverage}/10</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">⏱️ Tiempo Restante</span>
                        <span class="stat-value">${daysLeft > 0 ? `${daysLeft} días` : 'Finalizado'}</span>
                    </div>
                </div>
                
                ${Object.keys(cohortStats).length > 0 ? `
                    <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.875rem; opacity: 0.9;">
                            Participación por cohorte:
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem;">
                            ${Object.entries(cohortStats).map(([cohort, stats]) => `
                                <div style="text-align: center;">
                                    <strong>${cohort}</strong><br>
                                    <span style="font-size: 0.875rem;">
                                        ${stats.count} alumnos<br>
                                        Media: ${(stats.sum / stats.count).toFixed(2)}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-secondary" style="background: rgba(255,255,255,0.2); border: 1px solid white;"
                            onclick="window.simulationsModule.viewDetails('${simulation.id}')">
                        📊 Ver Detalles Completos
                    </button>
                    <button class="btn btn-secondary" style="background: rgba(255,255,255,0.2); border: 1px solid white;"
                            onclick="window.dashboardAdmin.showPage('results')">
                        📈 Ver Resultados
                    </button>
                </div>
            </div>
        `;
    }

    renderSimulationRow(simulation) {
        const isProcessed = simulation.processed_at !== null;
        const statusColor = {
            'active': 'success',
            'completed': 'info',
            'future': 'secondary'
        };

        // Calcular participantes reales
        const results = this.dashboard.data.results.filter(r => r.simulation_id === simulation.id);
        const actualParticipants = results.length;
        const actualAverage = results.length > 0 
            ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2)
            : 'N/A';

        return `
            <tr>
                <td><strong>RF${simulation.week_number}</strong></td>
                <td>${this.formatDate(simulation.start_date)} - ${this.formatDate(simulation.end_date)}</td>
                <td>
                    <span class="badge badge-${statusColor[simulation.status] || 'secondary'}">
                        ${this.getStatusLabel(simulation.status)}
                    </span>
                </td>
                <td>${actualParticipants}</td>
                <td>${actualAverage}/10</td>
                <td>
                    ${isProcessed ? 
                        `✅ ${this.formatDate(simulation.processed_at)}` : 
                        '❌ Pendiente'}
                </td>
                <td>
                    <button class="btn-icon" onclick="window.simulationsModule.viewDetails('${simulation.id}')"
                            title="Ver detalles">
                        👁️
                    </button>
                    <button class="btn-icon" onclick="window.simulationsModule.editSimulation('${simulation.id}')"
                            title="Editar">
                        ✏️
                    </button>
                    ${!isProcessed ? `
                        <button class="btn-icon" onclick="window.simulationsModule.processSimulation('${simulation.id}')"
                                title="Procesar ahora">
                            ⚡
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    renderSimulationModal() {
        return `
            <div id="simulationModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Crear Nuevo Simulacro</h3>
                        <button class="btn-icon" onclick="window.simulationsModule.closeModal()">✖️</button>
                    </div>
                    <div class="modal-body">
                        <form id="simulationForm">
                            <div class="form-group">
                                <label>Número de Semana (RF)</label>
                                <input type="number" id="weekNumber" required min="1">
                            </div>
                            <div class="form-group">
                                <label>Fecha de Inicio</label>
                                <input type="date" id="startDate" required>
                            </div>
                            <div class="form-group">
                                <label>Fecha de Fin</label>
                                <input type="date" id="endDate" required>
                            </div>
                            <div class="form-group">
                                <label>Estado</label>
                                <select id="status">
                                    <option value="future">Futuro</option>
                                    <option value="active">Activo</option>
                                    <option value="completed">Completado</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.simulationsModule.closeModal()">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" onclick="window.simulationsModule.saveSimulation()">
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Métodos de interacción
    async createNewSimulation() {
        // Obtener el último número de semana
        const lastWeek = Math.max(...this.dashboard.data.simulations.map(s => s.week_number || 0));
        
        // Preparar el modal con valores por defecto
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Simulacro';
        document.getElementById('weekNumber').value = lastWeek + 1;
        
        // Calcular fechas por defecto (próximo lunes a domingo)
        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7);
        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 6);
        
        document.getElementById('startDate').value = nextMonday.toISOString().split('T')[0];
        document.getElementById('endDate').value = nextSunday.toISOString().split('T')[0];
        document.getElementById('status').value = 'future';
        
        // Mostrar modal
        document.getElementById('simulationModal').style.display = 'flex';
    }

    async editSimulation(simulationId) {
        const simulation = this.dashboard.data.simulations.find(s => s.id === simulationId);
        if (!simulation) return;
        
        this.currentSimulation = simulation;
        
        // Llenar el modal con los datos existentes
        document.getElementById('modalTitle').textContent = 'Editar Simulacro';
        document.getElementById('weekNumber').value = simulation.week_number;
        document.getElementById('startDate').value = simulation.start_date;
        document.getElementById('endDate').value = simulation.end_date;
        document.getElementById('status').value = simulation.status;
        
        document.getElementById('simulationModal').style.display = 'flex';
    }

    async saveSimulation() {
        const formData = {
            week_number: parseInt(document.getElementById('weekNumber').value),
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            status: document.getElementById('status').value
        };
        
        try {
            if (this.currentSimulation) {
                // Actualizar existente
                const { error } = await this.supabase
                    .from('weekly_simulations')
                    .update(formData)
                    .eq('id', this.currentSimulation.id);
                    
                if (error) throw error;
                this.dashboard.showNotification('success', 'Simulacro actualizado correctamente');
            } else {
                // Crear nuevo
                const { error } = await this.supabase
                    .from('weekly_simulations')
                    .insert(formData);
                    
                if (error) throw error;
                this.dashboard.showNotification('success', 'Simulacro creado correctamente');
            }
            
            this.closeModal();
            await this.dashboard.loadInitialData();
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al guardar: ' + error.message);
        }
    }

    async processSimulation(simulationId) {
        if (!confirm('¿Procesar este simulacro ahora? Esto calculará ELOs y posiciones.')) return;
        
        try {
            // Llamar a la función RPC de procesamiento
            const { data, error } = await this.supabase.rpc('process_weekly_results', {
                p_week_number: this.dashboard.data.simulations.find(s => s.id === simulationId).week_number
            });
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Simulacro procesado correctamente');
            await this.dashboard.loadInitialData();
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al procesar: ' + error.message);
        }
    }

    async processWeeklyResults() {
        if (!confirm('¿Procesar todos los resultados pendientes de la semana?')) return;
        
        try {
            // Invocar la Edge Function
            const { data, error } = await this.supabase.functions.invoke('weekly-update');
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Procesamiento semanal completado');
            console.log('Resultado del procesamiento:', data);
            
            await this.dashboard.loadInitialData();
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error en procesamiento semanal: ' + error.message);
        }
    }

    async viewDetails(simulationId) {
        // Navegar a ELO manual con el simulacro seleccionado
        window.dashboardAdmin.showPage('elo-manual');
        // TODO: Pasar el simulationId al módulo elo-manual
    }

    closeModal() {
        document.getElementById('simulationModal').style.display = 'none';
        this.currentSimulation = null;
    }

    // Utilidades
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }

    getStatusLabel(status) {
        const labels = {
            'active': '🟢 Activo',
            'completed': '✅ Completado',
            'future': '🔜 Futuro'
        };
        return labels[status] || status;
    }
}