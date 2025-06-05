// Dashboard Modular - Sistema de widgets personalizables
export default class DashboardModular {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        
        // Configuración de widgets disponibles - simplificado
        this.availableWidgets = {
            'stats-overview': {
                id: 'stats-overview',
                name: 'Resumen de Estadísticas',
                icon: '📊',
                size: 'full',
                defaultEnabled: true
            },
            'weekly-evolution': {
                id: 'weekly-evolution',
                name: 'Evolución Semanal',
                icon: '📈',
                size: 'half',
                defaultEnabled: true
            },
            'cohort-distribution': {
                id: 'cohort-distribution',
                name: 'Distribución por Cohortes',
                icon: '🎯',
                size: 'half',
                defaultEnabled: true
            },
            'risk-analysis': {
                id: 'risk-analysis',
                name: 'Estudiantes en Riesgo',
                icon: '⚠️',
                size: 'half',
                defaultEnabled: true
            },
            'quick-actions': {
                id: 'quick-actions',
                name: 'Acciones Rápidas',
                icon: '⚡',
                size: 'half',
                defaultEnabled: true
            }
        };
    }

    async render() {
        const contentWrapper = document.getElementById('contentWrapper');
        
        // Aplicar estilos
        this.injectStyles();
        
        contentWrapper.innerHTML = `
            <div class="modular-dashboard">
                <!-- Grid de widgets -->
                <div id="widgetsGrid" class="widgets-grid">
                    <!-- Los widgets se cargarán aquí -->
                </div>
            </div>
        `;

        // Cargar widgets
        await this.loadWidgets();
    }

    async loadWidgets() {
        const grid = document.getElementById('widgetsGrid');
        grid.innerHTML = '';

        // Cargar datos necesarios
        const data = await this.loadDashboardData();

        // Crear cada widget
        for (const [widgetId, widget] of Object.entries(this.availableWidgets)) {
            if (widget.defaultEnabled) {
                const widgetElement = this.createWidget(widget);
                grid.appendChild(widgetElement);
                
                // Renderizar contenido después de un pequeño delay
                setTimeout(() => this.renderWidgetContent(widget.id, data), 100);
            }
        }
    }

    createWidget(widget) {
        const div = document.createElement('div');
        div.className = `widget widget-${widget.size}`;
        div.id = `widget-${widget.id}`;
        div.innerHTML = `
            <div class="widget-header">
                <h3>
                    <span class="widget-icon">${widget.icon}</span>
                    ${widget.name}
                </h3>
            </div>
            <div class="widget-content" id="content-${widget.id}">
                <div class="widget-loading">
                    <div class="spinner"></div>
                    <p>Cargando...</p>
                </div>
            </div>
        `;
        return div;
    }

    async renderWidgetContent(widgetId, data) {
        const contentEl = document.getElementById(`content-${widgetId}`);
        if (!contentEl) return;

        try {
            switch (widgetId) {
                case 'stats-overview':
                    contentEl.innerHTML = this.renderStatsOverview(data);
                    break;
                
                case 'weekly-evolution':
                    contentEl.innerHTML = '<canvas id="weeklyChart" style="max-height: 300px;"></canvas>';
                    await this.renderWeeklyChart(data);
                    break;
                
                case 'cohort-distribution':
                    contentEl.innerHTML = '<canvas id="cohortChart" style="max-height: 300px;"></canvas>';
                    await this.renderCohortChart(data);
                    break;
                
                case 'risk-analysis':
                    contentEl.innerHTML = this.renderRiskSummary(data);
                    break;
                
                case 'quick-actions':
                    contentEl.innerHTML = this.renderQuickActions();
                    break;
                
                default:
                    contentEl.innerHTML = '<p>Widget no implementado</p>';
            }
        } catch (error) {
            console.error(`Error renderizando widget ${widgetId}:`, error);
            contentEl.innerHTML = `
                <div class="widget-error">
                    <i class="fas fa-exclamation-triangle">⚠️</i>
                    <p>Error al cargar el widget</p>
                </div>
            `;
        }
    }

    renderStatsOverview(data) {
        const activeStudents = data.students.filter(s => s.active).length;
        const atRiskStudents = data.students.filter(s => (s.probability_pass || 50) < 50).length;
        const avgScore = data.students.length > 0 
            ? (data.students.reduce((acc, s) => acc + (s.average_score || 0), 0) / data.students.length).toFixed(1)
            : 0;
        const avgProb = data.students.length > 0
            ? Math.round(data.students.reduce((acc, s) => acc + (s.probability_pass || 50), 0) / data.students.length)
            : 50;

        const stats = [
            { 
                label: 'Total Estudiantes', 
                value: data.students.length,
                icon: '👥',
                color: 'blue'
            },
            { 
                label: 'Estudiantes Activos', 
                value: activeStudents,
                icon: '✅',
                color: 'green'
            },
            { 
                label: 'En Riesgo', 
                value: atRiskStudents,
                icon: '⚠️',
                color: 'orange'
            },
            { 
                label: 'Puntuación Media', 
                value: avgScore + '/10',
                icon: '📊',
                color: 'purple'
            },
            { 
                label: 'Probabilidad Media', 
                value: avgProb + '%',
                icon: '🎯',
                color: 'teal'
            },
            { 
                label: 'Simulacros Activos', 
                value: data.simulations.filter(s => s.status === 'active').length,
                icon: '🎮',
                color: 'indigo'
            }
        ];

        return `
            <div class="stats-grid">
                ${stats.map(stat => `
                    <div class="stat-card ${stat.color}">
                        <div class="stat-icon">${stat.icon}</div>
                        <div class="stat-value">${stat.value}</div>
                        <div class="stat-label">${stat.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderQuickActions() {
        return `
            <div class="quick-actions-grid">
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('bulk-users')">
                    <i class="icon">👥</i>
                    <span>Carga Masiva</span>
                </button>
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('elo-manual')">
                    <i class="icon">⚡</i>
                    <span>ELO Manual</span>
                </button>
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('simulations')">
                    <i class="icon">🎯</i>
                    <span>Simulacros</span>
                </button>
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('evolcampus')">
                    <i class="icon">🔄</i>
                    <span>Evolcampus</span>
                </button>
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('analytics')">
                    <i class="icon">📊</i>
                    <span>Análisis</span>
                </button>
                <button class="action-btn" onclick="window.dashboardAdmin.showPage('alerts')">
                    <i class="icon">🔔</i>
                    <span>Alertas</span>
                </button>
            </div>
        `;
    }

    renderRiskSummary(data) {
        const riskStudents = data.students
            .filter(s => (s.probability_pass || 50) < 50)
            .sort((a, b) => (a.probability_pass || 50) - (b.probability_pass || 50))
            .slice(0, 10);

        if (riskStudents.length === 0) {
            return '<p class="no-data">🎉 No hay estudiantes en riesgo</p>';
        }

        return `
            <div class="risk-list">
                ${riskStudents.map(student => {
                    const prob = student.probability_pass || 50;
                    const riskLevel = prob < 30 ? 'high' : prob < 40 ? 'medium' : 'low';
                    return `
                        <div class="risk-item" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')">
                            <div class="student-info">
                                <strong>${student.name || student.email}</strong>
                                <span class="cohort">${student.cohort || 'Sin asignar'}</span>
                            </div>
                            <div class="risk-indicator">
                                <div class="risk-bar">
                                    <div class="risk-fill ${riskLevel}" style="width: ${prob}%"></div>
                                </div>
                                <span class="risk-value">${prob}%</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="btn-link" onclick="window.dashboardAdmin.showPage('risk')">
                Ver análisis completo →
            </button>
        `;
    }

    async renderWeeklyChart(data) {
        // Preparar datos para el gráfico semanal
        const weeks = [...new Set(data.results.map(r => {
            const date = new Date(r.submitted_at);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return weekStart.toISOString().split('T')[0];
        }))].sort().slice(-8); // Últimas 8 semanas

        const weeklyData = weeks.map(week => {
            const weekResults = data.results.filter(r => {
                const date = new Date(r.submitted_at);
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                return weekStart.toISOString().split('T')[0] === week;
            });

            return {
                week,
                avgScore: weekResults.length > 0 
                    ? weekResults.reduce((acc, r) => acc + (r.score || 0), 0) / weekResults.length
                    : 0,
                count: weekResults.length
            };
        });

        const ctx = document.getElementById('weeklyChart')?.getContext('2d');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyData.map(w => new Date(w.week).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
                datasets: [{
                    label: 'Puntuación Media',
                    data: weeklyData.map(w => w.avgScore),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10
                    }
                }
            }
        });
    }

    async renderCohortChart(data) {
        const cohortData = {};
        const cohorts = ['20h', '36h', '48h', 'sin_asignar'];
        
        cohorts.forEach(cohort => {
            const cohortStudents = data.students.filter(s => s.cohort === cohort);
            cohortData[cohort] = {
                total: cohortStudents.length,
                active: cohortStudents.filter(s => s.active).length,
                avgScore: cohortStudents.length > 0
                    ? cohortStudents.reduce((acc, s) => acc + (s.average_score || 0), 0) / cohortStudents.length
                    : 0
            };
        });

        const ctx = document.getElementById('cohortChart')?.getContext('2d');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: cohorts.map(c => c === 'sin_asignar' ? 'Sin asignar' : c),
                datasets: [
                    {
                        label: 'Total',
                        data: cohorts.map(c => cohortData[c].total),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1
                    },
                    {
                        label: 'Activos',
                        data: cohorts.map(c => cohortData[c].active),
                        backgroundColor: 'rgba(34, 197, 94, 0.5)',
                        borderColor: 'rgb(34, 197, 94)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async loadDashboardData() {
        try {
            const [students, results, simulations] = await Promise.all([
                this.supabase.from('users').select('*'),
                this.supabase.from('exam_results').select('*, users(name, email)').order('submitted_at', { ascending: false }).limit(500),
                this.supabase.from('weekly_simulations').select('*').order('week_number', { ascending: false })
            ]);

            return {
                students: students.data || [],
                results: results.data || [],
                simulations: simulations.data || []
            };
        } catch (error) {
            console.error('Error cargando datos:', error);
            return {
                students: [],
                results: [],
                simulations: []
            };
        }
    }

    injectStyles() {
        // Verificar si ya existen los estilos
        if (document.getElementById('dashboard-modular-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'dashboard-modular-styles';
        style.textContent = `
            .modular-dashboard {
                padding: 1rem;
            }

            /* Grid de widgets */
            .widgets-grid {
                display: grid;
                grid-template-columns: repeat(12, 1fr);
                gap: 1.5rem;
                grid-auto-rows: minmax(350px, auto);
            }

            .widget {
                background: white;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .widget-full { grid-column: span 12; }
            .widget-half { grid-column: span 6; }
            .widget-third { grid-column: span 4; }

            @media (max-width: 1024px) {
                .widget-half { grid-column: span 12; }
                .widget-third { grid-column: span 12; }
            }

            .widget-header {
                padding: 1.25rem 1.5rem;
                border-bottom: 1px solid #e5e7eb;
                background: #f8fafc;
            }

            .widget-header h3 {
                margin: 0;
                font-size: 1.125rem;
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .widget-content {
                padding: 1.5rem;
                flex: 1;
                overflow: auto;
            }

            .widget-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: #64748b;
            }

            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #f3f4f6;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 1rem;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Estilos específicos de widgets */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
            }

            .stat-card {
                text-align: center;
                padding: 1.5rem 1rem;
                border-radius: 8px;
                background: #f8fafc;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }

            .stat-card.blue { background: #dbeafe; color: #1e40af; }
            .stat-card.green { background: #d1fae5; color: #065f46; }
            .stat-card.orange { background: #fed7aa; color: #9a3412; }
            .stat-card.purple { background: #e9d5ff; color: #6b21a8; }
            .stat-card.teal { background: #ccfbf1; color: #134e4a; }
            .stat-card.indigo { background: #e0e7ff; color: #3730a3; }

            .stat-icon {
                font-size: 2.5rem;
                margin-bottom: 0.75rem;
            }

            .stat-value {
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 0.25rem;
            }

            .stat-label {
                font-size: 0.875rem;
                opacity: 0.8;
            }

            /* Quick actions */
            .quick-actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 1rem;
            }

            .action-btn {
                background: #f8fafc;
                border: 2px solid #e2e8f0;
                padding: 1.5rem 1rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.75rem;
                text-align: center;
                color: #1e293b;
                text-decoration: none;
            }

            .action-btn:hover {
                background: white;
                border-color: #3b82f6;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            }

            .action-btn .icon {
                font-size: 1.75rem;
            }

            .action-btn span {
                font-size: 0.875rem;
                font-weight: 500;
            }

            /* Lista de riesgo */
            .risk-list {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                max-height: 400px;
                overflow-y: auto;
                padding-right: 0.5rem;
            }

            .risk-item {
                display: flex;
                align-items: center;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
                gap: 1rem;
                cursor: pointer;
                transition: all 0.2s;
            }

            .risk-item:hover {
                background: #e2e8f0;
                transform: translateX(4px);
            }

            .student-info {
                flex: 1;
            }

            .student-info strong {
                display: block;
                margin-bottom: 0.25rem;
                color: #1e293b;
            }

            .student-info .cohort {
                font-size: 0.875rem;
                color: #64748b;
            }

            .risk-indicator {
                text-align: right;
            }

            .risk-bar {
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 0.25rem;
                width: 120px;
            }

            .risk-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s;
            }

            .risk-fill.high {
                background: linear-gradient(90deg, #ef4444, #dc2626);
            }

            .risk-fill.medium {
                background: linear-gradient(90deg, #f59e0b, #d97706);
            }

            .risk-fill.low {
                background: linear-gradient(90deg, #f59e0b, #fbbf24);
            }

            .risk-value {
                font-size: 0.875rem;
                font-weight: 600;
                color: #1e293b;
            }

            .btn-link {
                background: none;
                border: none;
                color: #3b82f6;
                cursor: pointer;
                padding: 0.75rem 0;
                font-size: 0.875rem;
                text-decoration: none;
                transition: all 0.2s;
                display: inline-block;
                margin-top: 0.5rem;
            }

            .btn-link:hover {
                text-decoration: underline;
                color: #2563eb;
            }

            .no-data {
                text-align: center;
                color: #64748b;
                padding: 3rem;
                font-size: 1.125rem;
            }

            .widget-error {
                text-align: center;
                color: #ef4444;
                padding: 2rem;
            }

            /* Scrollbar personalizado para listas */
            .risk-list::-webkit-scrollbar {
                width: 6px;
            }

            .risk-list::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }

            .risk-list::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }

            .risk-list::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        `;
        
        document.head.appendChild(style);
    }
} 