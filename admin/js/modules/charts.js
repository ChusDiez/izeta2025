// /admin/js/modules/charts.js
// Módulo de gráficos y visualizaciones con Chart.js

export default class ChartsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.charts = new Map();
        this.chartColors = {
            primary: '#1E3A8A',
            success: '#10B981',
            warning: '#F59E0B',
            danger: '#DC2626',
            info: '#3B82F6',
            secondary: '#6B7280'
        };
    }

    /**
     * Renderizar gráfico de evolución semanal
     */
    async renderWeeklyChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Preparar datos
        const weeklyData = this.prepareWeeklyData(data.results);
        
        // Crear estructura moderna del gráfico
        container.innerHTML = `
            <div class="chart-container performance-chart">
                <div class="chart-header">
                    <div>
                        <h3 class="chart-title">Evolución de Resultados</h3>
                        <p class="chart-subtitle">Rendimiento y participación semanal</p>
                    </div>
                    <div class="chart-controls">
                        <button class="chart-control-btn active" data-range="month">Mes</button>
                        <button class="chart-control-btn" data-range="quarter">Trimestre</button>
                        <button class="chart-control-btn" data-range="year">Año</button>
                    </div>
                </div>
                <div class="chart-body">
                    <canvas id="${containerId}_canvas"></canvas>
                </div>
                <div class="chart-footer">
                    <div class="chart-stat">
                        <span class="chart-stat-value">${weeklyData.avgScores[weeklyData.avgScores.length - 1] || 0}</span>
                        <span class="chart-stat-label">Última media</span>
                    </div>
                    <div class="chart-stat">
                        <span class="chart-stat-value">${weeklyData.participation[weeklyData.participation.length - 1] || 0}</span>
                        <span class="chart-stat-label">Última participación</span>
                    </div>
                    <div class="chart-stat">
                        <span class="chart-stat-value">${this.calculateTrend(weeklyData.avgScores)}</span>
                        <span class="chart-stat-label">Tendencia</span>
                    </div>
                </div>
            </div>
        `;
        
        const ctx = document.getElementById(`${containerId}_canvas`).getContext('2d');

        // Destruir gráfico existente si existe
        if (this.charts.has('weekly')) {
            this.charts.get('weekly').destroy();
        }

        // Crear nuevo gráfico
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [
                    {
                        label: 'Puntuación Media',
                        data: weeklyData.avgScores,
                        borderColor: this.chartColors.primary,
                        backgroundColor: this.hexToRgba(this.chartColors.primary, 0.1),
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Participación',
                        data: weeklyData.participation,
                        borderColor: this.chartColors.success,
                        backgroundColor: this.hexToRgba(this.chartColors.success, 0.1),
                        tension: 0.4,
                        yAxisID: 'y1',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    if (context.dataset.label === 'Puntuación Media') {
                                        label += context.parsed.y.toFixed(2) + '/10';
                                    } else {
                                        label += context.parsed.y + ' alumnos';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Puntuación Media'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Participantes'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Semana'
                        }
                    }
                }
            }
        });

        this.charts.set('weekly', chart);
    }

    /**
     * Renderizar gráfico de distribución por cohortes
     */
    async renderCohortDistribution(containerId, cohortStats) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Crear canvas con ID único
        const canvasId = `${containerId}_canvas`;
        container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
        const ctx = document.getElementById(canvasId).getContext('2d');

        if (this.charts.has('cohort')) {
            this.charts.get('cohort').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(cohortStats).map(c => this.formatCohortName(c)),
                datasets: [{
                    data: Object.values(cohortStats).map(s => s.total),
                    backgroundColor: [
                        this.chartColors.primary,
                        this.chartColors.success,
                        this.chartColors.warning,
                        this.chartColors.secondary
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Distribución por Cohortes'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set('cohort', chart);
    }

    /**
     * Renderizar gráfico de análisis de riesgo
     */
// En charts.js, modificar el método renderRiskAnalysis:
async renderRiskAnalysis(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Contenedor ${containerId} no encontrado`);
        return;
    }

    // Agrupar por niveles de riesgo
    const riskLevels = this.calculateRiskDistribution(students);
    const totalStudents = students.length;
    const avgRisk = students.reduce((sum, s) => sum + (s.probability_pass || 50), 0) / totalStudents;

    // Crear estructura moderna del gráfico
    container.innerHTML = `
        <div class="chart-container risk-chart">
            <div class="chart-header">
                <div>
                    <h3 class="chart-title">Análisis de Riesgo</h3>
                    <p class="chart-subtitle">Probabilidad de aprobar por grupos</p>
                </div>
                <div class="chart-controls">
                    <button class="chart-control-btn active" data-view="count">Cantidad</button>
                    <button class="chart-control-btn" data-view="percentage">Porcentaje</button>
                </div>
            </div>
            <div class="chart-body">
                <canvas id="${containerId}_canvas"></canvas>
            </div>
            <div class="chart-footer">
                <div class="chart-stat">
                    <span class="chart-stat-value">${riskLevels.critical}</span>
                    <span class="chart-stat-label">En riesgo crítico</span>
                </div>
                <div class="chart-stat">
                    <span class="chart-stat-value">${avgRisk.toFixed(1)}%</span>
                    <span class="chart-stat-label">Probabilidad media</span>
                </div>
                <div class="chart-stat">
                    <span class="chart-stat-value">${riskLevels.low}</span>
                    <span class="chart-stat-label">Riesgo bajo</span>
                </div>
            </div>
        </div>
    `;
    
    const ctx = document.getElementById(`${containerId}_canvas`).getContext('2d');

    if (this.charts.has('risk')) {
        this.charts.get('risk').destroy();
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Crítico (<30%)', 'Alto (30-50%)', 'Medio (50-70%)', 'Bajo (>70%)'],
            datasets: [{
                label: 'Número de Estudiantes',
                data: [
                    riskLevels.critical,
                    riskLevels.high,
                    riskLevels.medium,
                    riskLevels.low
                ],
                backgroundColor: [
                    this.chartColors.danger,
                    this.chartColors.warning,
                    this.chartColors.info,
                    this.chartColors.success
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Estudiantes'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Nivel de Riesgo'
                    }
                }
            }
        }
    });

    this.charts.set('risk', chart);
}

    /**
     * Renderizar gráfico de tendencias de ELO
     */
    async renderEloTrends(containerId, eloHistory) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Preparar datos de tendencias
        const trendData = this.prepareEloTrendData(eloHistory);

        container.innerHTML = '<canvas id="eloTrendChart"></canvas>';
        const ctx = document.getElementById('eloTrendChart').getContext('2d');

        if (this.charts.has('eloTrend')) {
            this.charts.get('eloTrend').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.weeks,
                datasets: trendData.cohorts.map((cohort, index) => ({
                    label: this.formatCohortName(cohort.name),
                    data: cohort.avgElos,
                    borderColor: Object.values(this.chartColors)[index],
                    backgroundColor: this.hexToRgba(Object.values(this.chartColors)[index], 0.1),
                    tension: 0.4,
                    fill: false
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Evolución de ELO por Cohorte'
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'ELO Promedio'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Semana'
                        }
                    }
                }
            }
        });

        this.charts.set('eloTrend', chart);
    }

    /**
     * Renderizar heatmap de participación
     */
    async renderParticipationHeatmap(containerId, data) {
        // Este sería más complejo, quizás usar una librería adicional
        // Por ahora, usar un gráfico de barras apiladas
        const container = document.getElementById(containerId);
        if (!container) return;

        const heatmapData = this.prepareParticipationData(data);

        container.innerHTML = '<canvas id="participationChart"></canvas>';
        const ctx = document.getElementById('participationChart').getContext('2d');

        if (this.charts.has('participation')) {
            this.charts.get('participation').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: heatmapData.weeks,
                datasets: [
                    {
                        label: 'Sábado (En directo)',
                        data: heatmapData.saturday,
                        backgroundColor: this.chartColors.danger
                    },
                    {
                        label: 'Domingo',
                        data: heatmapData.sunday,
                        backgroundColor: this.chartColors.warning
                    },
                    {
                        label: 'Entre semana',
                        data: heatmapData.weekday,
                        backgroundColor: this.chartColors.info
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Semana'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Participantes'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Patrón de Participación Semanal'
                    }
                }
            }
        });

        this.charts.set('participation', chart);
    }

    /**
     * Preparar datos semanales
     */
    prepareWeeklyData(results) {
        const weeklyMap = new Map();

        results.forEach(result => {
            const date = new Date(result.submitted_at);
            const weekKey = `S${this.getWeekNumber(date)}`;
            
            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                    scores: [],
                    count: 0
                });
            }
            
            const week = weeklyMap.get(weekKey);
            week.scores.push(result.score);
            week.count++;
        });

        const sortedWeeks = Array.from(weeklyMap.keys()).sort();
        
        return {
            labels: sortedWeeks,
            avgScores: sortedWeeks.map(week => {
                const data = weeklyMap.get(week);
                const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
                return parseFloat(avg.toFixed(2));
            }),
            participation: sortedWeeks.map(week => weeklyMap.get(week).count)
        };
    }

    /**
     * Calcular distribución de riesgo
     */
    calculateRiskDistribution(students) {
        const distribution = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        students.forEach(student => {
            const prob = student.probability_pass || 50;
            if (prob < 30) distribution.critical++;
            else if (prob < 50) distribution.high++;
            else if (prob < 70) distribution.medium++;
            else distribution.low++;
        });

        return distribution;
    }

    /**
     * Preparar datos de tendencia ELO
     */
    prepareEloTrendData(eloHistory) {
        // Agrupar por semana y cohorte
        const trendMap = new Map();
        
        // Implementación simplificada
        // En producción, esto sería más complejo
        
        return {
            weeks: ['S1', 'S2', 'S3', 'S4', 'S5'],
            cohorts: [
                {
                    name: '20h',
                    avgElos: [1000, 1020, 1035, 1040, 1055]
                },
                {
                    name: '36h',
                    avgElos: [1000, 1025, 1045, 1060, 1075]
                },
                {
                    name: '48h',
                    avgElos: [1000, 1030, 1055, 1080, 1095]
                }
            ]
        };
    }

    /**
     * Preparar datos de participación
     */
    prepareParticipationData(data) {
        // Simplificado para el ejemplo
        return {
            weeks: ['S1', 'S2', 'S3', 'S4', 'S5'],
            saturday: [45, 48, 52, 50, 55],
            sunday: [30, 35, 38, 40, 42],
            weekday: [25, 22, 20, 18, 15]
        };
    }

    /**
     * Calcular tendencia de una serie de datos
     */
    calculateTrend(data) {
        if (!data || data.length < 2) return '→';
        
        const lastValue = data[data.length - 1];
        const prevValue = data[data.length - 2];
        const diff = lastValue - prevValue;
        const percentage = ((diff / prevValue) * 100).toFixed(1);
        
        if (diff > 0) {
            return `↑ +${percentage}%`;
        } else if (diff < 0) {
            return `↓ ${percentage}%`;
        }
        return '→ 0%';
    }

    /**
     * Utilidades
     */
    formatCohortName(cohort) {
        const names = {
            '20h': '20h - Base',
            '36h': '36h - Intensivo',
            '48h': '48h - Élite',
            'sin_asignar': 'Sin asignar'
        };
        return names[cohort] || cohort;
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    }

    /**
     * Destruir todos los gráficos
     */
    destroy() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}