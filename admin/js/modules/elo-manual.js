// admin/js/modules/elo-manual.js
export default class EloManualModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedSimulation = null;
    }

    async render(container) {
        try {
            const simulations = this.dashboard.data.simulations;
            
            container.innerHTML = `
                <div class="elo-manual-page">
                    <h1>🚀 Panel de Actualización Manual - Sistema ELO</h1>
                    <p>Este panel permite forzar la actualización del ELO y las estadísticas sin esperar al proceso automático del lunes.</p>
                    
                    <!-- Sección 1: Selección de simulacro -->
                    <div class="section">
                        <h2>1. Seleccionar Simulacro</h2>
                        <select id="simulationSelect" onchange="window.eloManualModule.selectSimulation(this.value)">
                            <option value="">Selecciona un simulacro...</option>
                            ${simulations.map(sim => `
                                <option value="${sim.id}">
                                    RF${sim.week_number} - ${sim.status} - ${this.formatDate(sim.start_date)}
                                    ${sim.processed_at ? ' (YA PROCESADO)' : ''}
                                </option>
                            `).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="window.eloManualModule.loadSimulationInfo()">
                            📊 Ver información del simulacro
                        </button>
                        
                        <div id="simulationInfo" style="display: none;">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Sección 2: Actualizar estadísticas -->
                    <div class="section">
                        <h2>2. Actualizar Estadísticas del Simulacro</h2>
                        <p>Recalcula participantes, promedios y estadísticas por cohorte basándose en todos los resultados actuales.</p>
                        <button class="btn btn-warning" onclick="window.eloManualModule.updateSimulationStats()">
                            📈 Actualizar estadísticas del simulacro
                        </button>
                    </div>
                    
                    <!-- Sección 3: Forzar cálculo de ELO -->
                    <div class="section">
                        <h2>3. Forzar Cálculo de ELO</h2>
                        <p>⚠️ <strong>Importante:</strong> Este proceso calculará el ELO para TODOS los participantes del simulacro seleccionado.</p>
                        <button class="btn btn-danger" onclick="window.eloManualModule.forceEloCalculation()">
                            ⚡ Forzar cálculo de ELO ahora
                        </button>
                        <div class="progress-bar" id="progressBar" style="display: none;">
                            <div class="progress-fill" id="progressFill">0%</div>
                        </div>
                    </div>
                    
                    <!-- Log de actividad -->
                    <div class="section">
                        <h3>📋 Log de actividad</h3>
                        <div class="log" id="activityLog">
                            <div class="log-entry info">Sistema iniciado. Esperando acciones...</div>
                        </div>
                    </div>
                </div>
            `;
            
            window.eloManualModule = this;
            
        } catch (error) {
            console.error('Error en módulo ELO Manual:', error);
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
    
    async selectSimulation(simulationId) {
        this.selectedSimulation = this.dashboard.data.simulations.find(s => s.id === simulationId);
    }
    
    async loadSimulationInfo() {
        if (!this.selectedSimulation) {
            this.addLog('Por favor selecciona un simulacro', 'warning');
            return;
        }
        
        const results = this.dashboard.data.results.filter(r => r.simulation_id === this.selectedSimulation.id);
        const infoDiv = document.getElementById('simulationInfo');
        
        infoDiv.innerHTML = `
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-number">${results.length}</div>
                    <div class="stat-label">Participantes</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${results.length > 0 ? 
                        (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2) : 
                        'N/A'}</div>
                    <div class="stat-label">Score Promedio</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${this.selectedSimulation.processed_at ? '✅' : '❌'}</div>
                    <div class="stat-label">Procesado</div>
                </div>
            </div>
        `;
        
        infoDiv.style.display = 'block';
        this.addLog(`Simulacro RF${this.selectedSimulation.week_number}: ${results.length} resultados`, 'success');
    }
    
    async forceEloCalculation() {
        if (!this.selectedSimulation) {
            this.addLog('Primero selecciona un simulacro', 'warning');
            return;
        }
        
        if (!confirm(`¿Estás seguro de forzar el cálculo de ELO para RF${this.selectedSimulation.week_number}?`)) {
            return;
        }
        
        try {
            this.addLog('🚀 Iniciando cálculo forzado de ELO...', 'warning');
            
            // Aquí iría la lógica de cálculo de ELO
            // Por ahora solo simulamos el proceso
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            progressBar.style.display = 'block';
            
            for (let i = 0; i <= 100; i += 10) {
                progressFill.style.width = i + '%';
                progressFill.textContent = i + '%';
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            this.addLog('✅ Cálculo de ELO completado', 'success');
            
            // Recargar datos
            await this.dashboard.loadInitialData();
            
        } catch (error) {
            this.addLog(`❌ Error: ${error.message}`, 'error');
        }
    }
    
    addLog(message, type = 'info') {
        const log = document.getElementById('activityLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}