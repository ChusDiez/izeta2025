// /admin/js/modules/dashboard-visualizations.js
// Módulo de visualizaciones interactivas modernas para el dashboard

export default class DashboardVisualizations {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.initialized = false;
    }

    /**
     * Renderizar el dashboard principal
     */
    async render() {
        if (!this.initialized) {
            await this.initializeCharts();
            this.initialized = true;
        }

        const content = `
            <div class="modern-dashboard">
                <!-- Header con métricas principales -->
                <div class="dashboard-header">
                    <h1 class="dashboard-title">Dashboard Analítico</h1>
                    <div class="dashboard-actions">
                        <button class="action-btn" onclick="window.dashboardAdmin.refreshDashboard()">
                            <i class="fas fa-sync-alt"></i> Actualizar
                        </button>
                        <button class="action-btn" onclick="window.dashboardAdmin.exportDashboard()">
                            <i class="fas fa-download"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- Tarjetas de métricas principales -->
                <div class="metrics-grid" id="mainMetrics">
                    ${this.renderLoadingCards(4)}
                </div>

                <!-- Gráficos principales -->
                <div class="charts-grid">
                    <div id="weeklyEvolutionChart" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="chart-loading-spinner"></div>
                            <p>Cargando evolución semanal...</p>
                        </div>
                    </div>
                    
                    <div id="riskDistributionChart" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="chart-loading-spinner"></div>
                            <p>Cargando análisis de riesgo...</p>
                        </div>
                    </div>
                    
                    <div id="cohortComparisonChart" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="chart-loading-spinner"></div>
                            <p>Cargando comparación de cohortes...</p>
                        </div>
                    </div>
                    
                    <div id="topicPerformanceChart" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="chart-loading-spinner"></div>
                            <p>Cargando rendimiento por temas...</p>
                        </div>
                    </div>
                </div>

                <!-- Tabla de estudiantes en riesgo -->
                <div class="risk-students-section">
                    <h2 class="section-title">⚠️ Estudiantes que Requieren Atención</h2>
                    <div id="riskStudentsList" class="risk-students-grid">
                        ${this.renderLoadingCards(3)}
                    </div>
                </div>

                <!-- Insights automáticos -->
                <div class="insights-section">
                    <h2 class="section-title">💡 Insights Automáticos</h2>
                    <div id="insightsList" class="insights-grid">
                        ${this.renderLoadingCards(2)}
                    </div>
                </div>
            </div>
        `;

        // Actualizar el contenido
        const contentWrapper = document.getElementById('contentWrapper');
        if (contentWrapper) {
            contentWrapper.innerHTML = content;
        }

        // Cargar datos y renderizar
        await this.loadDashboardData();
    }

    /**
     * Renderizar tarjetas de carga
     */
    renderLoadingCards(count) {
        return Array(count).fill('').map(() => `
            <div class="metric-card loading">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-title"></div>
            </div>
        `).join('');
    }

    /**
     * Cargar datos del dashboard
     */
    async loadDashboardData() {
        try {
            // Cargar datos en paralelo
            const [
                studentsData,
                resultsData,
                eloData,
                evolcampusData
            ] = await Promise.all([
                this.fetchStudentsData(),
                this.fetchResultsData(),
                this.fetchEloData(),
                this.fetchEvolcampusData()
            ]);

            // Renderizar métricas principales
            this.renderMainMetrics(studentsData, resultsData, eloData, evolcampusData);

            // Renderizar gráficos
            await this.renderCharts(studentsData, resultsData, eloData);

            // Renderizar estudiantes en riesgo
            this.renderRiskStudents(studentsData);

            // Generar y renderizar insights
            this.renderInsights(studentsData, resultsData, eloData, evolcampusData);

        } catch (error) {
            console.error('Error cargando dashboard:', error);
            this.dashboard.showNotification('Error cargando datos del dashboard', 'error');
        }
    }

    /**
     * Renderizar métricas principales
     */
    renderMainMetrics(students, results, elo, evolcampus) {
        const activeStudents = students.filter(s => s.active !== false).length;
        const avgScore = results.length > 0 
            ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
            : 0;
        const avgElo = elo.length > 0
            ? Math.round(elo.reduce((sum, e) => sum + e.current_elo, 0) / elo.length)
            : 1000;
        const evolcampusProgress = evolcampus.length > 0
            ? (evolcampus.reduce((sum, e) => sum + e.completed_percent, 0) / evolcampus.length).toFixed(1)
            : 0;

        const metricsHTML = `
            <div class="metric-card gradient-blue">
                <div class="metric-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="metric-content">
                    <div class="metric-value">${activeStudents}</div>
                    <div class="metric-label">Estudiantes Activos</div>
                    <div class="metric-trend trend-up">
                        <i class="fas fa-arrow-up"></i> +5% esta semana
                    </div>
                </div>
            </div>

            <div class="metric-card gradient-green">
                <div class="metric-icon">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="metric-content">
                    <div class="metric-value">${avgScore}/10</div>
                    <div class="metric-label">Puntuación Media</div>
                    <div class="metric-trend ${avgScore >= 7 ? 'trend-up' : 'trend-down'}">
                        <i class="fas fa-arrow-${avgScore >= 7 ? 'up' : 'down'}"></i> 
                        ${avgScore >= 7 ? 'Por encima' : 'Por debajo'} del objetivo
                    </div>
                </div>
            </div>

            <div class="metric-card gradient-purple">
                <div class="metric-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="metric-content">
                    <div class="metric-value">${avgElo}</div>
                    <div class="metric-label">ELO Promedio</div>
                    <div class="metric-trend trend-neutral">
                        <i class="fas fa-minus"></i> Estable
                    </div>
                </div>
            </div>

            <div class="metric-card gradient-orange">
                <div class="metric-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div class="metric-content">
                    <div class="metric-value">${evolcampusProgress}%</div>
                    <div class="metric-label">Progreso Evolcampus</div>
                    <div class="metric-trend ${evolcampusProgress >= 50 ? 'trend-up' : 'trend-down'}">
                        <i class="fas fa-arrow-${evolcampusProgress >= 50 ? 'up' : 'down'}"></i> 
                        ${evolcampusProgress >= 50 ? 'Buen ritmo' : 'Necesita impulso'}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('mainMetrics').innerHTML = metricsHTML;

        // Añadir animaciones de entrada
        document.querySelectorAll('.metric-card').forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }

    /**
     * Renderizar gráficos principales
     */
    async renderCharts(students, results, elo) {
        // Importar módulo de charts si no está cargado
        if (!window.chartsModule) {
            const ChartsModule = (await import('./charts.js')).default;
            window.chartsModule = new ChartsModule(this.supabase, this.dashboard);
        }

        // Renderizar cada gráfico
        await window.chartsModule.renderWeeklyChart('weeklyEvolutionChart', { results });
        await window.chartsModule.renderRiskAnalysis('riskDistributionChart', students);
        
        // Para los otros gráficos, crear placeholders por ahora
        this.renderPlaceholderChart('cohortComparisonChart', 'Comparación de Cohortes');
        this.renderPlaceholderChart('topicPerformanceChart', 'Rendimiento por Temas');
    }

    /**
     * Renderizar estudiantes en riesgo
     */
    renderRiskStudents(students) {
        const riskStudents = students
            .filter(s => s.probability_pass < 50 && s.active !== false)
            .sort((a, b) => a.probability_pass - b.probability_pass)
            .slice(0, 6);

        const riskHTML = riskStudents.map(student => `
            <div class="risk-student-card">
                <div class="student-header">
                    <div class="student-avatar">${this.getInitials(student.name)}</div>
                    <div class="student-info">
                        <h4>${student.name}</h4>
                        <p class="student-cohort">${this.formatCohort(student.cohort)}</p>
                    </div>
                </div>
                <div class="risk-indicator">
                    <div class="risk-bar">
                        <div class="risk-fill" style="width: ${student.probability_pass}%"></div>
                    </div>
                    <span class="risk-value">${student.probability_pass}% probabilidad</span>
                </div>
                <div class="student-actions">
                    <button class="btn-action" onclick="window.dashboardAdmin.viewStudent('${student.id}')">
                        <i class="fas fa-eye"></i> Ver detalles
                    </button>
                    <button class="btn-action secondary" onclick="window.dashboardAdmin.contactStudent('${student.id}')">
                        <i class="fas fa-envelope"></i> Contactar
                    </button>
                </div>
            </div>
        `).join('');

        document.getElementById('riskStudentsList').innerHTML = riskHTML || 
            '<p class="no-data">No hay estudiantes en riesgo crítico 🎉</p>';
    }

    /**
     * Renderizar insights automáticos
     */
    renderInsights(students, results, elo, evolcampus) {
        const insights = this.generateInsights(students, results, elo, evolcampus);
        
        const insightsHTML = insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">
                    <i class="fas fa-${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                    ${insight.action ? `
                        <button class="insight-action" onclick="${insight.action}">
                            ${insight.actionText} →
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        document.getElementById('insightsList').innerHTML = insightsHTML;
    }

    /**
     * Generar insights automáticos
     */
    generateInsights(students, results, elo, evolcampus) {
        const insights = [];

        // Insight sobre estudiantes en riesgo
        const riskCount = students.filter(s => s.probability_pass < 50).length;
        if (riskCount > 5) {
            insights.push({
                type: 'warning',
                icon: 'exclamation-triangle',
                title: 'Alto número de estudiantes en riesgo',
                description: `${riskCount} estudiantes tienen menos del 50% de probabilidad de aprobar. Considera implementar sesiones de refuerzo.`,
                action: 'window.dashboardAdmin.showRiskStudents()',
                actionText: 'Ver estudiantes'
            });
        }

        // Insight sobre mejora general
        const recentResults = results.filter(r => {
            const date = new Date(r.submitted_at);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date > weekAgo;
        });
        
        if (recentResults.length > 10) {
            const avgRecent = recentResults.reduce((sum, r) => sum + r.score, 0) / recentResults.length;
            if (avgRecent > 7.5) {
                insights.push({
                    type: 'success',
                    icon: 'chart-line',
                    title: 'Excelente rendimiento esta semana',
                    description: `La puntuación media de la última semana es ${avgRecent.toFixed(1)}/10. ¡El grupo está progresando muy bien!`,
                });
            }
        }

        // Insight sobre participación en Evolcampus
        const lowProgressCount = evolcampus.filter(e => e.completed_percent < 20).length;
        if (lowProgressCount > 3) {
            insights.push({
                type: 'info',
                icon: 'book',
                title: 'Baja participación en Evolcampus',
                description: `${lowProgressCount} estudiantes tienen menos del 20% de progreso en la plataforma. Considera enviar recordatorios.`,
                action: 'window.dashboardAdmin.sendEvolcampusReminders()',
                actionText: 'Enviar recordatorios'
            });
        }

        return insights;
    }

    /**
     * Métodos de datos
     */
    async fetchStudentsData() {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    }

    async fetchResultsData() {
        const { data, error } = await this.supabase
            .from('exam_results')
            .select('*')
            .order('submitted_at', { ascending: false })
            .limit(1000);
        
        if (error) throw error;
        return data || [];
    }

    async fetchEloData() {
        const { data, error } = await this.supabase
            .from('elo_ratings')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    }

    async fetchEvolcampusData() {
        const { data, error } = await this.supabase
            .from('evolcampus_enrollments')
            .select('*')
            .order('synced_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    }

    /**
     * Utilidades
     */
    getInitials(name) {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatCohort(cohort) {
        const formats = {
            '20h': '20h - Base',
            '36h': '36h - Intensivo',
            '48h': '48h - Élite',
            'sin_asignar': 'Sin asignar'
        };
        return formats[cohort] || cohort || 'Sin asignar';
    }

    renderPlaceholderChart(containerId, title) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">${title}</h3>
                    <p class="chart-subtitle">Próximamente</p>
                </div>
                <div class="chart-body" style="display: flex; align-items: center; justify-content: center;">
                    <p style="color: #64748b;">🚧 En desarrollo</p>
                </div>
            </div>
        `;
    }

    /**
     * Inicializar librerías de gráficos
     */
    async initializeCharts() {
        // Asegurarse de que Chart.js esté cargado
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            document.head.appendChild(script);
            
            return new Promise((resolve) => {
                script.onload = resolve;
            });
        }
    }

    /**
     * Actualizar dashboard
     */
    async refresh() {
        await this.loadDashboardData();
        this.dashboard.showNotification('Dashboard actualizado', 'success');
    }

    /**
     * Destruir componentes
     */
    destroy() {
        if (window.chartsModule) {
            window.chartsModule.destroy();
        }
    }
} 