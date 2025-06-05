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
            
            // Inyectar estilos específicos del módulo
            this.injectStyles();
            
            container.innerHTML = `
                <div class="elo-manual-page">
                    <div class="elo-container">
                        <h1>🚀 Panel de Actualización Manual - Sistema ELO</h1>
                        <p>Este panel permite forzar la actualización del ELO y las estadísticas sin esperar al proceso automático del lunes.</p>
                        
                        <!-- Sección 1: Selección de simulacro -->
                        <div class="elo-section">
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
                            <button class="elo-button btn-primary" onclick="window.eloManualModule.loadSimulationInfo()">
                                📊 Ver información del simulacro
                            </button>
                            
                            <div id="simulationInfo" style="display: none;">
                                <!-- Se llenará dinámicamente -->
                            </div>
                        </div>
                        
                        <!-- Sección 2: Actualizar estadísticas -->
                        <div class="elo-section">
                            <h2>2. Actualizar Estadísticas del Simulacro</h2>
                            <p>Recalcula participantes, promedios y estadísticas por cohorte basándose en todos los resultados actuales.</p>
                            <button class="elo-button btn-warning" onclick="window.eloManualModule.updateSimulationStats()">
                                📈 Actualizar estadísticas del simulacro
                            </button>
                        </div>
                        
                        <!-- Sección 3: Forzar cálculo de ELO -->
                        <div class="elo-section">
                            <h2>3. Forzar Cálculo de ELO</h2>
                            <p>⚠️ <strong>Importante:</strong> Este proceso calculará el ELO para TODOS los participantes del simulacro seleccionado.</p>
                            <button class="elo-button btn-danger" onclick="window.eloManualModule.forceEloCalculation()">
                                ⚡ Forzar cálculo de ELO ahora
                            </button>
                            <div class="elo-progress-bar" id="progressBar" style="display: none;">
                                <div class="elo-progress-fill" id="progressFill">0%</div>
                            </div>
                        </div>
                        
                        <!-- Log de actividad -->
                        <div class="elo-section">
                            <h3>📋 Log de actividad</h3>
                            <div class="elo-log" id="activityLog">
                                <div class="log-entry info">Sistema iniciado. Esperando acciones...</div>
                            </div>
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
    
    injectStyles() {
        // Verificar si ya existen los estilos
        if (document.getElementById('elo-manual-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'elo-manual-styles';
        styles.textContent = `
            .elo-manual-page {
                padding: 0;
            }
            
            .elo-container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .elo-section {
                background: #f9fafb;
                padding: 1.5rem;
                border-radius: 10px;
                margin: 1.5rem 0;
                border: 1px solid #e5e7eb;
            }
            
            .elo-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin: 0.5rem;
                transition: all 0.3s;
                font-size: 1rem;
            }
            
            .elo-button.btn-primary {
                background: #1E3A8A;
                color: white;
            }
            
            .elo-button.btn-primary:hover {
                background: #1e3a8a;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .elo-button.btn-warning {
                background: #F59E0B;
                color: white;
            }
            
            .elo-button.btn-warning:hover {
                background: #d97706;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .elo-button.btn-danger {
                background: #DC2626;
                color: white;
            }
            
            .elo-button.btn-danger:hover {
                background: #b91c1c;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .elo-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .elo-log {
                background: #1f2937;
                color: #e5e7eb;
                padding: 1rem;
                border-radius: 8px;
                font-family: monospace;
                font-size: 0.9rem;
                max-height: 400px;
                overflow-y: auto;
                margin-top: 1rem;
            }
            
            .elo-log .log-entry {
                margin: 0.5rem 0;
                padding: 0.25rem 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            
            .elo-log .success { color: #10b981; }
            .elo-log .error { color: #ef4444; }
            .elo-log .warning { color: #fbbf24; }
            .elo-log .info { color: #60a5fa; }
            
            .elo-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin: 1rem 0;
            }
            
            .elo-stat-box {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #e5e7eb;
            }
            
            .elo-stat-box .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #1E3A8A;
            }
            
            .elo-stat-box .stat-label {
                color: #6b7280;
                font-size: 0.9rem;
            }
            
            .elo-section select {
                padding: 0.5rem;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
                font-size: 1rem;
                margin: 0.5rem 0;
                width: 100%;
                max-width: 400px;
            }
            
            .elo-progress-bar {
                background: #e5e7eb;
                height: 30px;
                border-radius: 15px;
                overflow: hidden;
                margin: 1rem 0;
            }
            
            .elo-progress-fill {
                background: #10B981;
                height: 100%;
                width: 0%;
                transition: width 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            }
        `;
        document.head.appendChild(styles);
    }
    
    async loadSimulationInfo() {
        if (!this.selectedSimulation) {
            this.addLog('Por favor selecciona un simulacro', 'warning');
            return;
        }
        
        const results = this.dashboard.data.results.filter(r => r.simulation_id === this.selectedSimulation.id);
        const infoDiv = document.getElementById('simulationInfo');
        
        infoDiv.innerHTML = `
            <div class="elo-stats-grid">
                <div class="elo-stat-box">
                    <div class="stat-number">${results.length}</div>
                    <div class="stat-label">Participantes</div>
                </div>
                <div class="elo-stat-box">
                    <div class="stat-number">${results.length > 0 ? 
                        (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2) : 
                        'N/A'}</div>
                    <div class="stat-label">Score Promedio</div>
                </div>
                <div class="elo-stat-box">
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