// admin/js/modules/analytics.js
export default class AnalyticsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.charts = new Map();
    }

    async render(container) {
        container.innerHTML = `
            <div class="analytics-page">
                <h2>📊 Centro de Análisis y Tendencias</h2>
                
                <!-- Filtros de período -->
                <div class="analytics-filters">
                    <div class="filter-group">
                        <label>Período de análisis:</label>
                        <select id="analyticsPeriod" onchange="window.analyticsModule.updateAnalysis()">
                            <option value="month">Último mes</option>
                            <option value="quarter">Último trimestre</option>
                            <option value="semester">Último semestre</option>
                            <option value="all">Todo</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Comparar cohortes:</label>
                        <input type="checkbox" id="compareCohorts" checked 
                               onchange="window.analyticsModule.updateAnalysis()">
                    </div>
                </div>
                
                <!-- Grid de gráficos -->
                <div class="analytics-grid">
                    <!-- Evolución de scores -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>📈 Evolución de Puntuaciones</h3>
                        </div>
                        <div class="chart-body">
                            <canvas id="scoresEvolutionChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Distribución de riesgo -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>⚠️ Distribución de Riesgo Actual</h3>
                        </div>
                        <div class="chart-body">
                            <canvas id="riskDistributionChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Participación por día -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>📅 Patrón de Participación</h3>
                        </div>
                        <div class="chart-body">
                            <canvas id="participationPatternChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Progresión ELO -->
                    <div class="chart-card span-2">
                        <div class="chart-header">
                            <h3>⚡ Progresión ELO por Cohorte</h3>
                        </div>
                        <div class="chart-body">
                            <canvas id="eloProgressionChart"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- Insights automáticos -->
                <div class="insights-section">
                    <h3>💡 Insights Detectados</h3>
                    <div id="insightsList" class="insights-list">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                
                <!-- Tabla de tendencias individuales -->
                <div class="table-card">
                    <div class="table-header">
                        <h2>📊 Tendencias Individuales Destacadas</h2>
                    </div>
                    <div class="table-wrapper">
                        <table id="trendsTable">
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Cohorte</th>
                                    <th>Tendencia</th>
                                    <th>Δ Score (3 últ.)</th>
                                    <th>Δ ELO (mes)</th>
                                    <th>Consistencia</th>
                                    <th>Predicción</th>
                                </tr>
                            </thead>
                            <tbody id="trendsTableBody">
                                <!-- Se llenará dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        window.analyticsModule = this;
        
        // Cargar análisis inicial
        await this.updateAnalysis();
    }

    async updateAnalysis() {
        const period = document.getElementById('analyticsPeriod').value;
        const compareCohorts = document.getElementById('compareCohorts').checked;
        
        // Cargar datos según el período
        const data = await this.loadAnalyticsData(period);
        
        // Renderizar gráficos
        await this.renderScoresEvolution(data, compareCohorts);
        await this.renderRiskDistribution(data);
        await this.renderParticipationPattern(data);
        await this.renderEloProgression(data, compareCohorts);
        
        // Generar insights
        await this.generateInsights(data);
        
        // Actualizar tabla de tendencias
        await this.updateTrendsTable(data);
    }

    async loadAnalyticsData(period) {
        // Calcular fecha de inicio según el período
        const endDate = new Date();
        const startDate = new Date();
        
        switch(period) {
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case 'semester':
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            default: // 'all'
                startDate.setFullYear(2024);
        }
        
        // Cargar resultados del período
        const { data: results } = await this.supabase
            .from('user_results')
            .select(`
                *,
                users!inner(slug, username, cohort, current_elo)
            `)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: true });
        
        // Cargar historial ELO
        const { data: eloHistory } = await this.supabase
            .from('elo_history')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });
        
        return { results, eloHistory, startDate, endDate };
    }

    async renderScoresEvolution(data, compareCohorts) {
        const ctx = document.getElementById('scoresEvolutionChart').getContext('2d');
        
        // Destruir gráfico anterior si existe
        if (this.charts.has('scores')) {
            this.charts.get('scores').destroy();
        }
        
        // Agrupar por semana
        const weeklyData = this.groupByWeek(data.results);
        
        let datasets = [];
        
        if (compareCohorts) {
            // Un dataset por cohorte
            const cohorts = ['20h', '36h', '48h'];
            datasets = cohorts.map((cohort, index) => ({
                label: `Cohorte ${cohort}`,
                data: Object.entries(weeklyData).map(([week, results]) => {
                    const cohortResults = results.filter(r => r.users.cohort === cohort);
                    return cohortResults.length > 0 ?
                        cohortResults.reduce((sum, r) => sum + r.score, 0) / cohortResults.length : null;
                }),
                borderColor: ['#3B82F6', '#8B5CF6', '#DC2626'][index],
                backgroundColor: ['#3B82F620', '#8B5CF620', '#DC262620'][index],
                tension: 0.4
            }));
        } else {
            // Un solo dataset general
            datasets = [{
                label: 'Score Promedio',
                data: Object.entries(weeklyData).map(([week, results]) => 
                    results.reduce((sum, r) => sum + r.score, 0) / results.length
                ),
                borderColor: '#1E3A8A',
                backgroundColor: '#1E3A8A20',
                tension: 0.4,
                fill: true
            }];
        }
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(weeklyData),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context) => 
                                `${context.dataset.label}: ${context.parsed.y?.toFixed(2) || 'N/A'}/10`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        title: { display: true, text: 'Score Promedio' }
                    }
                }
            }
        });
        
        this.charts.set('scores', chart);
    }

    async renderRiskDistribution(data) {
        const ctx = document.getElementById('riskDistributionChart').getContext('2d');
        
        if (this.charts.has('risk')) {
            this.charts.get('risk').destroy();
        }
        
        // Calcular distribución actual
        const students = this.dashboard.data.students;
        const riskLevels = {
            'Crítico': students.filter(s => s.probability_pass < 30).length,
            'Alto': students.filter(s => s.probability_pass >= 30 && s.probability_pass < 50).length,
            'Medio': students.filter(s => s.probability_pass >= 50 && s.probability_pass < 70).length,
            'Bajo': students.filter(s => s.probability_pass >= 70).length
        };
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(riskLevels),
                datasets: [{
                    data: Object.values(riskLevels),
                    backgroundColor: ['#DC2626', '#F59E0B', '#3B82F6', '#10B981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('risk', chart);
    }

    async renderParticipationPattern(data) {
        const ctx = document.getElementById('participationPatternChart').getContext('2d');
        
        if (this.charts.has('participation')) {
            this.charts.get('participation').destroy();
        }
        
        // Agrupar por día de la semana
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const participationByDay = Array(7).fill(0);
        const saturdayLive = Array(7).fill(0);
        
        data.results.forEach(result => {
            const date = new Date(result.submitted_at);
            const day = date.getDay();
            participationByDay[day]++;
            if (result.is_saturday_live && day === 6) {
                saturdayLive[day]++;
            }
        });
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dayNames,
                datasets: [
                    {
                        label: 'Total Participación',
                        data: participationByDay,
                        backgroundColor: '#3B82F6'
                    },
                    {
                        label: 'En Directo (Sábados)',
                        data: saturdayLive,
                        backgroundColor: '#DC2626'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Número de Participaciones' }
                    }
                }
            }
        });
        
        this.charts.set('participation', chart);
    }

    async renderEloProgression(data, compareCohorts) {
        const ctx = document.getElementById('eloProgressionChart').getContext('2d');
        
        if (this.charts.has('elo')) {
            this.charts.get('elo').destroy();
        }
        
        // Procesar historial ELO
        const eloByWeek = {};
        
        data.eloHistory.forEach(record => {
            const week = `S${record.week_number}`;
            if (!eloByWeek[week]) {
                eloByWeek[week] = { '20h': [], '36h': [], '48h': [] };
            }
            
            // Necesitamos obtener la cohorte del usuario
            const user = this.dashboard.data.students.find(s => s.id === record.user_id);
            if (user && eloByWeek[week][user.cohort]) {
                eloByWeek[week][user.cohort].push(record.elo_after);
            }
        });
        
        // Calcular promedios
        const weeks = Object.keys(eloByWeek).sort();
        const datasets = compareCohorts ? 
            ['20h', '36h', '48h'].map((cohort, index) => ({
                label: `Cohorte ${cohort}`,
                data: weeks.map(week => {
                    const cohortElos = eloByWeek[week][cohort];
                    return cohortElos.length > 0 ?
                        cohortElos.reduce((a, b) => a + b, 0) / cohortElos.length : null;
                }),
                borderColor: ['#3B82F6', '#8B5CF6', '#DC2626'][index],
                tension: 0.4
            })) :
            [{
                label: 'ELO Promedio General',
                data: weeks.map(week => {
                    const allElos = [...eloByWeek[week]['20h'], ...eloByWeek[week]['36h'], ...eloByWeek[week]['48h']];
                    return allElos.length > 0 ?
                        allElos.reduce((a, b) => a + b, 0) / allElos.length : null;
                }),
                borderColor: '#1E3A8A',
                backgroundColor: '#1E3A8A20',
                tension: 0.4,
                fill: true
            }];
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'ELO Promedio' }
                    }
                }
            }
        });
        
        this.charts.set('elo', chart);
    }

    async generateInsights(data) {
        const insights = [];
        const students = this.dashboard.data.students;
        
        // Insight 1: Tendencia general
        const recentResults = data.results.slice(-100);
        const olderResults = data.results.slice(0, 100);
        
        if (recentResults.length > 0 && olderResults.length > 0) {
            const recentAvg = recentResults.reduce((sum, r) => sum + r.score, 0) / recentResults.length;
            const olderAvg = olderResults.reduce((sum, r) => sum + r.score, 0) / olderResults.length;
            const change = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);
            
            insights.push({
                type: change > 0 ? 'positive' : 'negative',
                title: 'Tendencia General de Puntuaciones',
                message: `Las puntuaciones han ${change > 0 ? 'mejorado' : 'empeorado'} un ${Math.abs(change)}% en el período analizado`
            });
        }
        
        // Insight 2: Participación en directo
        const saturdayRate = (data.results.filter(r => r.is_saturday_live).length / data.results.length * 100).toFixed(1);
        insights.push({
            type: saturdayRate > 30 ? 'positive' : 'warning',
            title: 'Participación en Directo',
            message: `${saturdayRate}% de los simulacros se realizan en directo los sábados`
        });
        
        // Insight 3: Estudiantes en riesgo
        const atRiskCount = students.filter(s => s.probability_pass < 50).length;
        const atRiskPercentage = (atRiskCount / students.length * 100).toFixed(1);
        insights.push({
            type: atRiskPercentage > 30 ? 'negative' : 'info',
            title: 'Estudiantes en Riesgo',
            message: `${atRiskCount} estudiantes (${atRiskPercentage}%) tienen probabilidad de aprobar menor al 50%`
        });
        
        // Renderizar insights
        const container = document.getElementById('insightsList');
        container.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">
                    ${insight.type === 'positive' ? '✅' : 
                      insight.type === 'negative' ? '⚠️' : 
                      insight.type === 'warning' ? '⚡' : 'ℹ️'}
                </div>
                <div class="insight-content">
                    <strong>${insight.title}</strong>
                    <p>${insight.message}</p>
                </div>
            </div>
        `).join('');
    }

    async updateTrendsTable(data) {
        // Calcular tendencias para cada estudiante
        const trends = [];
        
        for (const student of this.dashboard.data.students) {
            const studentResults = data.results
                .filter(r => r.user_id === student.id)
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            
            if (studentResults.length >= 3) {
                // Calcular cambio en últimos 3 resultados
                const recent3 = studentResults.slice(0, 3);
                const scoreChange = recent3[0].score - recent3[2].score;
                
                // Calcular cambio ELO en el mes
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const eloHistory = data.eloHistory
                    .filter(e => e.user_id === student.id && new Date(e.created_at) > monthAgo);
                
                const eloChange = eloHistory.length > 0 ?
                    eloHistory[eloHistory.length - 1].elo_after - eloHistory[0].elo_before : 0;
                
                // Calcular consistencia (desviación estándar)
                const scores = recent3.map(r => r.score);
                const avg = scores.reduce((a, b) => a + b) / scores.length;
                const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
                const consistency = Math.sqrt(variance);
                
                // Predicción simple
                const trend = scoreChange > 0 ? 'up' : scoreChange < 0 ? 'down' : 'stable';
                const prediction = this.predictNextScore(studentResults);
                
                trends.push({
                    student,
                    scoreChange,
                    eloChange,
                    consistency,
                    trend,
                    prediction
                });
            }
        }
        
        // Ordenar por cambio de score (los que más mejoran primero)
        trends.sort((a, b) => b.scoreChange - a.scoreChange);
        
        // Renderizar tabla
        const tbody = document.getElementById('trendsTableBody');
        tbody.innerHTML = trends.slice(0, 20).map(t => `
            <tr>
                <td>${t.student.username}</td>
                <td><span class="badge badge-info">${t.student.cohort}</span></td>
                <td>${this.getTrendIcon(t.trend)}</td>
                <td class="${t.scoreChange > 0 ? 'text-success' : 'text-danger'}">
                    ${t.scoreChange > 0 ? '+' : ''}${t.scoreChange.toFixed(2)}
                </td>
                <td class="${t.eloChange > 0 ? 'text-success' : 'text-danger'}">
                    ${t.eloChange > 0 ? '+' : ''}${t.eloChange}
                </td>
                <td>${this.getConsistencyLabel(t.consistency)}</td>
                <td>${t.prediction.toFixed(2)}/10</td>
            </tr>
        `).join('');
    }

    // Utilidades
    groupByWeek(results) {
        const grouped = {};
        
        results.forEach(result => {
            const date = new Date(result.submitted_at);
            const week = `S${this.getWeekNumber(date)}`;
            
            if (!grouped[week]) {
                grouped[week] = [];
            }
            grouped[week].push(result);
        });
        
        return grouped;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getTrendIcon(trend) {
        const icons = {
            'up': '📈',
            'down': '📉',
            'stable': '➡️'
        };
        return icons[trend] || '➡️';
    }

    getConsistencyLabel(consistency) {
        if (consistency < 0.5) return '✅ Muy consistente';
        if (consistency < 1) return '👍 Consistente';
        if (consistency < 2) return '⚠️ Variable';
        return '❌ Muy variable';
    }

    predictNextScore(results) {
        // Predicción simple basada en tendencia lineal
        if (results.length < 3) return results[0]?.score || 5;
        
        const recent = results.slice(0, 5).map(r => r.score);
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05]; // Más peso a resultados recientes
        
        let prediction = 0;
        recent.forEach((score, i) => {
            if (i < weights.length) {
                prediction += score * weights[i];
            }
        });
        
        return Math.max(0, Math.min(10, prediction));
    }

    destroy() {
        // Limpiar gráficos
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}