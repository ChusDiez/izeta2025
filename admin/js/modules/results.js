// admin/js/modules/results.js
export default class ResultsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.currentFilter = {
            simulation: 'all',
            cohort: 'all',
            dateRange: 'week'
        };
    }

    async render(container, data) {
    const results = data.results || [];
    const simulations = this.dashboard.data.simulations || [];
    
    // Obtener simulacro activo
    const activeSimulation = simulations.find(s => s.status === 'active');
    
    container.innerHTML = `
        <div class="results-page">
            <!-- Resumen del simulacro activo -->
            ${activeSimulation ? this.renderActiveSimulationSummary(activeSimulation, results) : ''}
            
            <!-- Filtros específicos de resultados -->
            <div class="results-filters">
                <div class="filter-group">
                    <label>Simulacro:</label>
                    <select id="simulationFilter" onchange="window.resultsModule.applyFilter('simulation', this.value)">
                        <option value="all">Todos los simulacros</option>
                        ${simulations.map(sim => `
                            <option value="${sim.id}" ${sim.status === 'active' ? 'selected' : ''}>
                                RF${sim.week_number} - ${this.formatDate(sim.start_date)}
                                ${sim.status === 'active' ? '(Activo)' : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <button class="btn btn-secondary" onclick="window.resultsModule.exportResults()">
                        📊 Exportar Resultados
                    </button>
                </div>
            </div>
            
            <!-- Tabla de resultados -->
            <div class="table-card">
                <div class="table-header">
                    <h2 class="table-title">📈 Resultados Detallados</h2>
                    <div class="table-controls">
                        <div class="search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" class="search-input" 
                                   placeholder="Buscar por estudiante..." 
                                   onkeyup="window.resultsModule.filterResults(this.value)">
                        </div>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table id="resultsTable">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Estudiante</th>
                                <th>Cohorte</th>
                                <th>Simulacro</th>
                                <th>Score</th>
                                <th>Aciertos/Fallos/Blancos</th>
                                <th>Tiempo</th>
                                <th>En Directo</th>
                                <th>Dispositivo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.slice(0, 100).map(result => this.renderResultRow(result)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    window.resultsModule = this;
}

renderActiveSimulationSummary(simulation, allResults) {
    const simResults = allResults.filter(r => r.simulation_id === simulation.id);
    
    if (simResults.length === 0) {
        return `
            <div class="results-summary-card">
                <div class="results-summary-header">
                    <h3 class="results-summary-title">
                        <span>🎯</span>
                        Simulacro RF${simulation.week_number} - Activo
                    </h3>
                    <span class="badge badge-success">En curso</span>
                </div>
                <p style="text-align: center; color: #6b7280; padding: 2rem 0;">
                    Aún no hay resultados registrados para este simulacro
                </p>
            </div>
        `;
    }
    
    // Calcular estadísticas
    const avgScore = simResults.reduce((sum, r) => sum + r.score, 0) / simResults.length;
    const saturdayLive = simResults.filter(r => r.is_saturday_live).length;
    const maxScore = Math.max(...simResults.map(r => r.score));
    const minScore = Math.min(...simResults.map(r => r.score));
    
    // Contar por cohortes
    const cohortCounts = simResults.reduce((acc, r) => {
        const cohort = r.users?.cohort || 'sin_asignar';
        acc[cohort] = (acc[cohort] || 0) + 1;
        return acc;
    }, {});
    
    return `
        <div class="results-summary-card">
            <div class="results-summary-header">
                <h3 class="results-summary-title">
                    <span>🎯</span>
                    Simulacro RF${simulation.week_number} - Resumen en Tiempo Real
                </h3>
                <span class="badge badge-success">En curso</span>
            </div>
            
            <div class="results-summary-grid">
                <div class="results-summary-item">
                    <span class="results-summary-value">${simResults.length}</span>
                    <span class="results-summary-label">Participantes</span>
                </div>
                <div class="results-summary-item">
                    <span class="results-summary-value">${avgScore.toFixed(2)}</span>
                    <span class="results-summary-label">Media actual</span>
                </div>
                <div class="results-summary-item">
                    <span class="results-summary-value">${maxScore.toFixed(1)}</span>
                    <span class="results-summary-label">Mejor score</span>
                </div>
                <div class="results-summary-item">
                    <span class="results-summary-value">${minScore.toFixed(1)}</span>
                    <span class="results-summary-label">Peor score</span>
                </div>
                <div class="results-summary-item">
                    <span class="results-summary-value">${saturdayLive}</span>
                    <span class="results-summary-label">En directo</span>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                <small style="color: #6b7280;">
                    Participación por cohorte: 
                    ${Object.entries(cohortCounts).map(([c, n]) => `${c}: ${n}`).join(' | ')}
                </small>
            </div>
        </div>
    `;
}

    renderResultRow(result) {
        const simulation = this.dashboard.data.simulations.find(s => s.id === result.simulation_id);
        const date = new Date(result.submitted_at);
        
        return `
            <tr data-result-id="${result.id}">
                <td>
                    <div>${date.toLocaleDateString('es-ES')}</div>
                    <div class="text-small text-muted">${date.toLocaleTimeString('es-ES')}</div>
                </td>
                <td>
                    <strong>${result.users?.username || 'N/A'}</strong>
                    <div class="text-small text-muted">${result.users?.email || ''}</div>
                </td>
                <td>
                    <span class="badge badge-info">${result.users?.cohort || 'N/A'}</span>
                </td>
                <td>RF${simulation?.week_number || '?'}</td>
                <td>
                    <strong style="color: ${this.getScoreColor(result.score)}">
                        ${result.score.toFixed(2)}/10
                    </strong>
                </td>
                <td>
                    <span style="color: #10B981">✓ ${result.correct_answers || 0}</span> / 
                    <span style="color: #DC2626">✗ ${result.wrong_answers || 0}</span> / 
                    <span style="color: #6B7280">○ ${result.blank_answers || 0}</span>
                </td>
                <td>${result.time_taken ? Math.round(result.time_taken / 60) + ' min' : 'N/A'}</td>
                <td>${result.is_saturday_live ? '🔴 Sí' : '⚪ No'}</td>
                <td>${result.device_type || 'N/A'}</td>
                <td>
                    <button class="btn-icon" onclick="window.resultsModule.viewDetails('${result.id}')"
                            title="Ver detalles">
                        👁️
                    </button>
                </td>
            </tr>
        `;
    }

    calculateAverageScore(results) {
        if (results.length === 0) return 0;
        const sum = results.reduce((acc, r) => acc + (r.score || 0), 0);
        return sum / results.length;
    }

    getScoreColor(score) {
        if (score >= 8) return '#10B981';
        if (score >= 6) return '#F59E0B';
        return '#DC2626';
    }

    applyFilter(filterType, value) {
        this.currentFilter[filterType] = value;
        // Aquí podrías implementar el filtrado real
        this.dashboard.refreshCurrentPage();
    }

    filterResults(searchTerm) {
        const rows = document.querySelectorAll('#resultsTable tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    async exportResults() {
        const exportsModule = await this.dashboard.loadModule('exports');
        await exportsModule.exportResults(this.currentFilter);
    }

    async viewDetails(resultId) {
        // Aquí podrías mostrar un modal con detalles completos
        const result = this.dashboard.data.results.find(r => r.id === resultId);
        if (!result) return;
        
        alert(`Detalles del resultado:\n
Score: ${result.score}/10
Tiempo: ${result.time_taken ? Math.round(result.time_taken / 60) + ' minutos' : 'N/A'}
Nivel de estrés: ${result.stress_level || 50}%
Tiempo de revisión: ${result.review_time || 0} minutos
Temas débiles: ${result.weakest_topics?.join(', ') || 'Ninguno'}
Notas: ${result.difficulty_note || 'Sin notas'}`);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}