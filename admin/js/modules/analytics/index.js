// admin/js/modules/analytics/index.js
// Orquestador principal del módulo de analytics - Versión refactorizada

import { StatisticsUtils, CNPStatistics } from '../utils/statistics.js';
import PatternDetector from './patterns.js';
import TopicInsights from './insights.js';

/**
 * Configuración centralizada del módulo
 */
const ANALYTICS_CONFIG = {
    periods: {
        month: 1,
        quarter: 3,
        semester: 6,
        year: 12
    },
    riskThresholds: {
        critical: 30,
        high: 50,
        medium: 70
    },
    chartUpdateDelay: 100,
    maxTrendsDisplay: 20,
    cacheExpiration: 5 * 60 * 1000 // 5 minutos
};

/**
 * Módulo principal de Analytics
 * Gestiona análisis estadísticos y visualizaciones avanzadas
 */
export default class AnalyticsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.charts = new Map();
        this.patternDetector = new PatternDetector();
        this.topicInsights = new TopicInsights(dashboardCore);
        
        // Configuración y estado
        this.cnpConfig = CNPStatistics.config;
        this.config = ANALYTICS_CONFIG;
        this.currentAnalysis = null;
        this.listeners = [];
        this.cache = new Map();
        this.isDestroyed = false;
    }

    /**
     * Renderizar página principal de analytics
     */
    async render(container) {
        try {
            // Validar contenedor
            if (!container || !(container instanceof HTMLElement)) {
                throw new Error('Contenedor inválido para módulo Analytics');
            }

            // Esperar a que Chart.js esté disponible
            await this.ensureChartJS();
            
            // Renderizar estructura inicial
            container.innerHTML = this.getInitialTemplate();
            
            // Guardar referencia global
            window.analyticsModule = this;
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Cargar análisis inicial con delay para asegurar DOM
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.updateAnalysis().catch(error => {
                        console.error('Error en análisis inicial:', error);
                        this.showError(error);
                    });
                }
            }, this.config.chartUpdateDelay);
            
        } catch (error) {
            console.error('Error en módulo de análisis:', error);
            this.showError(error, container);
        }
    }

    /**
     * Template inicial de la página
     */
    getInitialTemplate() {
        return `
            <div class="analytics-page">
                <div class="analytics-header card">
                    <h2>📊 Centro de Análisis Estadístico Avanzado</h2>
                    <p>Análisis completo de rendimiento y predicciones basadas en datos históricos</p>
                </div>
                
                <!-- Contenedores para secciones dinámicas -->
                <div id="executiveSummarySection" class="analytics-section"></div>
                <div id="predictiveAnalysisSection" class="analytics-section"></div>
                
                <!-- Controles -->
                <div class="analytics-controls card">
                    <div class="period-selector">
                        <label for="analyticsPeriod">Período de análisis:</label>
                        <select id="analyticsPeriod" class="form-control">
                            <option value="all">Todo el histórico</option>
                            <option value="month">Último mes</option>
                            <option value="quarter">Último trimestre</option>
                            <option value="semester">Último semestre</option>
                        </select>
                    </div>
                    <div class="comparison-toggle">
                        <label class="checkbox-label">
                            <input type="checkbox" id="compareCohorts">
                            <span>Comparar por cohortes</span>
                        </label>
                    </div>
                    <button id="refreshAnalyticsBtn" class="btn btn-secondary">
                        🔄 Actualizar análisis
                    </button>
                </div>
                
                <!-- Estadísticas globales -->
                <div class="global-stats-panel card">
                    <h3>📈 Estadísticas Globales del Sistema</h3>
                    <div id="globalStatsGrid" class="stats-grid loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                
                <!-- Contenedor de gráficos -->
                <div id="chartsContainer" class="charts-section"></div>
                
                <!-- Contenedor para análisis de temas (dinámico) -->
                <div id="topicAnalysisContainer"></div>
                
                <!-- Análisis de patrones -->
                <div class="patterns-analysis-section card">
                    <h3>🔍 Análisis de Patrones Globales</h3>
                    <div id="patternsGrid" class="patterns-grid loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                
                <!-- Insights -->
                <div class="insights-section card">
                    <h3>💡 Insights Detectados</h3>
                    <div id="insightsList" class="insights-list loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                
                <!-- Tabla de tendencias -->
                <div class="trends-table-section card">
                    <h3>📊 Análisis de Tendencias Individuales</h3>
                    <div class="table-controls">
                        <input type="text" id="trendsSearchInput" 
                               class="search-input" 
                               placeholder="Buscar estudiante...">
                        <button id="exportTrendsBtn" class="btn btn-secondary">
                            📊 Exportar tendencias
                        </button>
                    </div>
                    <div class="table-wrapper">
                        <table id="trendsTable">
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Cohorte</th>
                                    <th>Tendencia</th>
                                    <th>Cambio Score</th>
                                    <th>Cambio ELO</th>
                                    <th>Consistencia</th>
                                    <th>Predicción</th>
                                </tr>
                            </thead>
                            <tbody id="trendsTableBody">
                                <tr>
                                    <td colspan="7" class="text-center">
                                        <div class="loading-spinner"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Limpiar listeners anteriores
        this.removeEventListeners();
        
        // Period selector
        const periodSelect = document.getElementById('analyticsPeriod');
        if (periodSelect) {
            const periodHandler = () => this.handlePeriodChange();
            periodSelect.addEventListener('change', periodHandler);
            this.listeners.push({ element: periodSelect, event: 'change', handler: periodHandler });
        }
        
        // Cohort comparison
        const cohortCheckbox = document.getElementById('compareCohorts');
        if (cohortCheckbox) {
            const cohortHandler = () => this.handleCohortToggle();
            cohortCheckbox.addEventListener('change', cohortHandler);
            this.listeners.push({ element: cohortCheckbox, event: 'change', handler: cohortHandler });
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshAnalyticsBtn');
        if (refreshBtn) {
            const refreshHandler = () => this.handleRefresh();
            refreshBtn.addEventListener('click', refreshHandler);
            this.listeners.push({ element: refreshBtn, event: 'click', handler: refreshHandler });
        }
        
        // Search input
        const searchInput = document.getElementById('trendsSearchInput');
        if (searchInput) {
            const searchHandler = (e) => this.handleTrendsSearch(e.target.value);
            searchInput.addEventListener('input', searchHandler);
            this.listeners.push({ element: searchInput, event: 'input', handler: searchHandler });
        }
        
        // Export button
        const exportBtn = document.getElementById('exportTrendsBtn');
        if (exportBtn) {
            const exportHandler = () => this.exportTrends();
            exportBtn.addEventListener('click', exportHandler);
            this.listeners.push({ element: exportBtn, event: 'click', handler: exportHandler });
        }
    }

    /**
     * Remover event listeners
     */
    removeEventListeners() {
        this.listeners.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.listeners = [];
    }

    /**
     * Manejadores de eventos
     */
    async handlePeriodChange() {
        await this.updateAnalysis();
    }

    async handleCohortToggle() {
        await this.updateAnalysis();
    }

    async handleRefresh() {
        // Limpiar caché
        this.cache.clear();
        await this.updateAnalysis();
    }

    handleTrendsSearch(searchTerm) {
        const rows = document.querySelectorAll('#trendsTableBody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    /**
     * Actualizar análisis completo
     */
    async updateAnalysis() {
        if (this.isDestroyed) return;
        
        try {
            // Mostrar indicadores de carga
            this.showLoadingStates();
            
            // Obtener configuración actual
            const period = this.getCurrentPeriod();
            const compareCohorts = this.getCompareCohortsOption();
            
            // Cargar datos con caché
            const data = await this.loadAnalyticsDataWithCache(period);
            
            // Realizar análisis
            const analysis = await this.performComprehensiveAnalysis(data);
            
            // Análisis de temas problemáticos
            const topicAnalysis = await this.analyzeTopics(data);
            analysis.topicAnalysis = topicAnalysis;
            
            // Guardar análisis actual
            this.currentAnalysis = analysis;
            
            // Renderizar resultados
            await this.renderAnalysisResults(analysis, data, compareCohorts);
            
        } catch (error) {
            console.error('Error actualizando análisis:', error);
            this.showError(error);
        }
    }

    /**
     * Cargar datos con caché
     */
    async loadAnalyticsDataWithCache(period) {
        const cacheKey = `data_${period}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.config.cacheExpiration) {
            return cached.data;
        }
        
        const data = await this.loadAnalyticsData(period);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        
        return data;
    }

    /**
     * Cargar datos según período
     */
    async loadAnalyticsData(period) {
        const endDate = new Date();
        const startDate = new Date();
        
        const months = this.config.periods[period];
        if (months) {
            startDate.setMonth(startDate.getMonth() - months);
        } else {
            startDate.setFullYear(2024); // Default: todo el histórico
        }
        
        try {
            const [resultsResponse, eloHistoryResponse] = await Promise.all([
                this.supabase
                    .from('user_results')
                    .select(`
                        *,
                        users!inner(id, slug, username, email, cohort, current_elo, probability_pass, trend_direction)
                    `)
                    .gte('submitted_at', startDate.toISOString())
                    .order('submitted_at', { ascending: true }),
                
                this.supabase
                    .from('elo_history')
                    .select('*')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true })
            ]);
            
            if (resultsResponse.error) throw resultsResponse.error;
            if (eloHistoryResponse.error) throw eloHistoryResponse.error;
            
            return { 
                results: resultsResponse.data || [], 
                eloHistory: eloHistoryResponse.data || [], 
                startDate, 
                endDate,
                students: this.dashboard.data.students || []
            };
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            throw new Error('No se pudieron cargar los datos de análisis');
        }
    }

    /**
     * Realizar análisis completo
     */
    async performComprehensiveAnalysis(data) {
        const { results, students } = data;
        
        if (!results || !students) {
            throw new Error('Datos insuficientes para análisis');
        }
        
        try {
            // Análisis paralelo para mejor performance
            const [
                globalStats,
                riskDistribution,
                patterns,
                predictions,
                studentTrends
            ] = await Promise.all([
                this.calculateGlobalStatistics(results),
                this.analyzeRiskDistribution(students),
                this.analyzeGlobalPatterns(results),
                this.generateAggregatedPredictions(students),
                this.analyzeStudentTrends(students, results)
            ]);
            
            // Métricas adicionales
            const metrics = this.calculateAdditionalMetrics(students);
            
            return {
                globalStats,
                riskDistribution,
                patterns,
                predictions,
                studentTrends,
                ...metrics
            };
            
        } catch (error) {
            console.error('Error en análisis:', error);
            throw new Error('Error realizando análisis comprehensivo');
        }
    }

    /**
     * Calcular métricas adicionales
     */
    calculateAdditionalMetrics(students) {
        const totalStudents = students.length;
        const activeStudents = students.filter(s => s.active !== false).length;
        const improvingStudents = students.filter(s => s.trend_direction === 'up').length;
        const decliningStudents = students.filter(s => s.trend_direction === 'down').length;
        const averageProbability = students.reduce((sum, s) => sum + (s.probability_pass || 50), 0) / (totalStudents || 1);
        
        return {
            totalStudents,
            activeStudents,
            improvingStudents,
            decliningStudents,
            averageProbability
        };
    }

    /**
     * Analizar temas problemáticos
     */
    async analyzeTopics(data) {
        try {
            return await this.topicInsights.analyzeProblematicTopicsBySimulation(
                data.results, 
                this.dashboard.data.simulations || []
            );
        } catch (error) {
            console.error('Error analizando temas:', error);
            return null;
        }
    }

    /**
     * Renderizar resultados del análisis
     */
    async renderAnalysisResults(analysis, data, compareCohorts) {
        try {
            // Renderizar secciones principales
            this.renderExecutiveSummary(analysis);
            this.renderPredictiveAnalysis(analysis);
            this.renderGlobalStats(analysis.globalStats);
            
            // Renderizar gráficos
            await this.renderCharts(data, analysis, compareCohorts);
            
            // Renderizar análisis de patrones
            this.renderPatternsAnalysis(analysis.patterns);
            
            // Renderizar análisis de temas si está disponible
            if (analysis.topicAnalysis) {
                this.renderTopicAnalysis(analysis.topicAnalysis);
            }
            
            // Generar y renderizar insights
            await this.renderInsights(analysis);
            
            // Actualizar tabla de tendencias
            await this.updateTrendsTable(analysis.studentTrends);
            
        } catch (error) {
            console.error('Error renderizando resultados:', error);
            this.showError(error);
        }
    }

    /**
     * Renderizar resumen ejecutivo
     */
    renderExecutiveSummary(analysis) {
        const container = document.getElementById('executiveSummarySection');
        if (!container) return;
        
        const totalStudents = analysis.totalStudents || 0;
        const atRisk = (analysis.riskDistribution?.critical?.count || 0) + 
                       (analysis.riskDistribution?.high?.count || 0);
        const improving = analysis.improvingStudents || 0;
        const declining = analysis.decliningStudents || 0;
        const avgProbability = analysis.averageProbability || 50;
        
        container.innerHTML = `
            <div class="executive-summary card">
                <h3>📊 Resumen Ejecutivo - Oposiciones CNP</h3>
                <div class="summary-grid stats-grid">
                    <div class="stat-card danger">
                        <div class="stat-header">
                            <div class="stat-icon danger">${atRisk}</div>
                            <div class="stat-content">
                                <div class="stat-label">En riesgo de suspender</div>
                                <div class="stat-change">${totalStudents > 0 ? ((atRisk / totalStudents) * 100).toFixed(1) : 0}% del total</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-header">
                            <div class="stat-icon success">${improving}</div>
                            <div class="stat-content">
                                <div class="stat-label">Mejorando</div>
                                <div class="stat-change">Tendencia positiva</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-header">
                            <div class="stat-icon warning">${declining}</div>
                            <div class="stat-content">
                                <div class="stat-label">Empeorando</div>
                                <div class="stat-change">Requieren atención</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-header">
                            <div class="stat-icon info">${avgProbability.toFixed(0)}%</div>
                            <div class="stat-content">
                                <div class="stat-label">Probabilidad media</div>
                                <div class="stat-change">De aprobar</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar análisis predictivo
     */
    renderPredictiveAnalysis(analysis) {
        const container = document.getElementById('predictiveAnalysisSection');
        if (!container || !analysis.predictions) return;
        
        const predictions = analysis.predictions;
        
        container.innerHTML = `
            <div class="predictive-panel card">
                <h3>🎯 Análisis Predictivo Principal</h3>
                <div class="prediction-content">
                    <div class="prediction-main">
                        <div class="stat-value">${predictions.projectedPass || 0}</div>
                        <div class="stat-label">Proyección de aprobados</div>
                        <div class="stat-change">De ${predictions.totalActive || 0} estudiantes activos</div>
                    </div>
                    <div class="prediction-breakdown">
                        <div class="stat-box success">
                            <div class="stat-value">${predictions.highConfidence || 0}</div>
                            <div class="stat-label">Alta probabilidad (>70%)</div>
                        </div>
                        <div class="stat-box warning">
                            <div class="stat-value">${predictions.borderline || 0}</div>
                            <div class="stat-label">En el límite (45-55%)</div>
                        </div>
                        <div class="stat-box danger">
                            <div class="stat-value">${predictions.atRisk || 0}</div>
                            <div class="stat-label">En riesgo (<50%)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar estadísticas globales
     */
    renderGlobalStats(stats) {
        const grid = document.getElementById('globalStatsGrid');
        if (!grid || !stats) return;
        
        grid.classList.remove('loading');
        grid.innerHTML = `
            <div class="stat-box">
                <div class="stat-label">Resultados Analizados</div>
                <div class="stat-value">${stats.totalResults || 0}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Media Global</div>
                <div class="stat-value">${(stats.mean || 0).toFixed(2)}/10</div>
                <div class="stat-change">σ = ${(stats.stdDev || 0).toFixed(2)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Mediana</div>
                <div class="stat-value">${(stats.median || 0).toFixed(2)}/10</div>
            </div>
            <div class="stat-box ${(stats.cutoffDistance || 0) < 0 ? 'danger' : 'success'}">
                <div class="stat-label">Distancia a Nota de Corte</div>
                <div class="stat-value">${(stats.cutoffDistance || 0) > 0 ? '+' : ''}${(stats.cutoffDistance || 0).toFixed(2)}</div>
            </div>
        `;
    }

    /**
     * Renderizar análisis de patrones
     */
    renderPatternsAnalysis(patterns) {
        const grid = document.getElementById('patternsGrid');
        if (!grid || !patterns) return;
        
        grid.classList.remove('loading');
        grid.innerHTML = `
            <div class="pattern-card ${patterns.fatigue?.percentage > 30 ? 'warning' : ''}">
                <h4>😴 Fatiga Mental</h4>
                <div class="stat-value">${patterns.fatigue?.percentage || 0}%</div>
                <div class="stat-label">${patterns.fatigue?.affected || 0} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.rushing?.percentage > 25 ? 'warning' : ''}">
                <h4>⚡ Precipitación</h4>
                <div class="stat-value">${patterns.rushing?.percentage || 0}%</div>
                <div class="stat-label">${patterns.rushing?.affected || 0} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.abandonment?.percentage > 20 ? 'danger' : ''}">
                <h4>❌ Abandono Excesivo</h4>
                <div class="stat-value">${patterns.abandonment?.percentage || 0}%</div>
                <div class="stat-label">${patterns.abandonment?.affected || 0} estudiantes afectados</div>
            </div>
        `;
    }

    /**
 * Renderizar análisis de temas
 */
renderTopicAnalysis(topicAnalysis) {
    const container = document.getElementById('topicAnalysisContainer');
    if (!container || !topicAnalysis) return;
    
    // Crear o actualizar sección
    let section = container.querySelector('.topic-analysis-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'topic-analysis-section card';
        container.appendChild(section);
    }
    
    // Usar el método renderTopicAnalysisSection de esta clase, no de topicInsights
    section.innerHTML = this.renderTopicAnalysisSection(topicAnalysis);
    
    // Re-configurar event listeners para la sección de temas
    this.setupTopicEventListeners();
}

/**
 * Renderizar sección de análisis de temas
 */
renderTopicAnalysisSection(topicAnalysis) {
    return `
        <h3>🎯 Análisis de Temas Problemáticos por Simulacro</h3>
        
        <!-- Panel superior con métricas y filtros -->
        <div class="topic-analysis-header">
            <!-- Métricas principales en cards visuales -->
            <div class="topic-metrics-row">
                <div class="topic-metric-card">
                    <div class="metric-icon-large">📚</div>
                    <div class="metric-content">
                        <div class="metric-value">${Object.keys(topicAnalysis.globalTrends || {}).length}</div>
                        <div class="metric-label">Temas Únicos Detectados</div>
                        <div class="metric-trend">En todos los simulacros</div>
                    </div>
                </div>
                
                <div class="topic-metric-card critical">
                    <div class="metric-icon-large">⚠️</div>
                    <div class="metric-content">
                        <div class="metric-value">${
                            Object.values(topicAnalysis.globalTrends || {})
                                .filter(t => t.avgPercentage >= 30).length
                        }</div>
                        <div class="metric-label">Temas Críticos</div>
                        <div class="metric-trend">≥30% estudiantes afectados</div>
                    </div>
                </div>
                
                <div class="topic-metric-card impact">
                    <div class="metric-icon-large">📉</div>
                    <div class="metric-content">
                        <div class="metric-value">${
                            topicAnalysis.correlations?.averageImpact?.toFixed(2) || 'N/A'
                        }<span class="metric-unit">pts</span></div>
                        <div class="metric-label">Impacto Promedio</div>
                        <div class="metric-trend">Reducción en nota media</div>
                    </div>
                </div>
            </div>
            
            <!-- Filtros mejorados -->
            <div class="topic-filters-enhanced">
                <div class="filter-card">
                    <label>🎓 Cohorte</label>
                    <select id="topicCohortFilter" class="filter-select">
                        <option value="all">Todas las cohortes</option>
                        <option value="20h">20h - Base</option>
                        <option value="36h">36h - Intensivo</option>
                        <option value="48h">48h - Élite</option>
                    </select>
                </div>
                <div class="filter-card">
                    <label>📅 Período</label>
                    <select id="topicPeriodFilter" class="filter-select">
                        <option value="all">Histórico completo</option>
                        <option value="last5">Últimos 5 simulacros</option>
                        <option value="last3">Últimos 3 simulacros</option>
                        <option value="current">Simulacro actual</option>
                    </select>
                </div>
                <div class="filter-card">
                    <label>🎯 Umbral</label>
                    <select id="topicThresholdFilter" class="filter-select">
                        <option value="20">≥20% estudiantes</option>
                        <option value="30" selected>≥30% estudiantes</option>
                        <option value="40">≥40% estudiantes</option>
                        <option value="50">≥50% estudiantes</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Panel de correlaciones mejorado -->
        ${topicAnalysis.correlations && topicAnalysis.correlations.topImpactTopics?.length > 0 ? `
            <div class="correlation-analysis-panel">
                <div class="panel-header">
                    <h4>📊 Análisis de Impacto: Temas vs. Rendimiento</h4>
                    <span class="panel-subtitle">Cómo afecta cada tema a las notas medias</span>
                </div>
                <div class="correlation-visual-chart">
                    ${this.renderCorrelationChart(topicAnalysis.correlations.topImpactTopics)}
                </div>
            </div>
        ` : ''}
        
        <!-- Grid de simulacros en diseño horizontal -->
        <div class="simulations-timeline">
            <h4>📅 Evolución Temporal de Temas Problemáticos</h4>
            <div class="timeline-container">
                ${Object.values(topicAnalysis.bySimulation || {})
                    .sort((a, b) => b.weekNumber - a.weekNumber)
                    .slice(0, 6)
                    .map(sim => this.renderSimulationTopicCard(sim))
                    .join('')}
            </div>
        </div>
        
        <!-- Insights mejorados con iconos y diseño -->
        ${(topicAnalysis.insights || []).length > 0 ? `
            <div class="insights-panel">
                <h4>💡 Insights y Recomendaciones Clave</h4>
                <div class="insights-grid">
                    ${topicAnalysis.insights.slice(0, 4).map(insight => this.renderTopicInsight(insight)).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- Top temas problemáticos global -->
        ${this.renderGlobalTopicsRanking(topicAnalysis.globalTrends)}
        
        <!-- Modal para drill-down -->
        ${this.renderTopicDrillDownModal()}
    `;
}

/**
 * Renderizar gráfico de correlaciones
 */
renderCorrelationChart(topImpactTopics) {
    if (!topImpactTopics || topImpactTopics.length === 0) {
        return '<p class="no-data-message">No hay datos suficientes para mostrar correlaciones</p>';
    }
    
    const maxImpact = Math.max(...topImpactTopics.map(t => Math.abs(t.scoreImpact)));
    
    return `
        <div class="correlation-chart-enhanced">
            ${topImpactTopics.slice(0, 8).map((topic, index) => `
                <div class="correlation-row">
                    <div class="topic-info">
                        <span class="topic-rank">#${index + 1}</span>
                        <span class="topic-name">${topic.topic}</span>
                    </div>
                    
                    <div class="impact-visualization">
                        <div class="score-bars">
                            <div class="score-bar without-topic" style="width: ${(topic.avgScoreWithoutTopic/10)*100}%">
                                <span class="score-label">${topic.avgScoreWithoutTopic.toFixed(2)}</span>
                            </div>
                            <div class="score-bar with-topic" style="width: ${(topic.avgScoreWithTopic/10)*100}%">
                                <span class="score-label">${topic.avgScoreWithTopic.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="impact-indicator">
                            <div class="impact-bar" style="width: ${(Math.abs(topic.scoreImpact)/maxImpact)*100}%">
                                <span class="impact-value">-${topic.scoreImpact.toFixed(2)} pts</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="affected-students">
                        <div class="student-icon">👥</div>
                        <span>${topic.studentsAffected}</span>
                    </div>
                </div>
            `).join('')}
            
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color without-topic"></div>
                    <span>Sin dificultad en el tema</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color with-topic"></div>
                    <span>Con dificultad en el tema</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color impact"></div>
                    <span>Impacto negativo</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderizar card de simulacro con drill-down
 */
renderSimulationTopicCard(simData) {
    const criticalCount = simData.topProblematicTopics?.filter(t => t.percentage >= 30).length || 0;
    const totalTopics = simData.topProblematicTopics?.length || 0;
    
    return `
        <div class="simulation-card-enhanced" data-simulation-id="${simData.simulation?.id || ''}">
            <div class="card-header">
                <div class="simulation-badge">RF${simData.weekNumber || '?'}</div>
                <div class="simulation-date">${this.formatSimulationDate(simData.simulation?.start_date)}</div>
            </div>
            
            <div class="card-stats">
                <div class="stat">
                    <span class="stat-value">${simData.totalParticipants || 0}</span>
                    <span class="stat-label">Participantes</span>
                </div>
                <div class="stat ${criticalCount > 0 ? 'critical' : ''}">
                    <span class="stat-value">${criticalCount}</span>
                    <span class="stat-label">Temas críticos</span>
                </div>
            </div>
            
            <div class="topics-preview">
                ${simData.topProblematicTopics && simData.topProblematicTopics.length > 0 ? `
                    <div class="top-topics-list">
                        ${simData.topProblematicTopics.slice(0, 3).map((topic, index) => `
                            <div class="topic-pill ${topic.percentage >= 30 ? 'critical' : ''}"
                                 onclick="window.analyticsModule.topicInsights.showTopicDrillDown('${simData.simulation?.id || ''}', '${topic.topic}')">
                                <span class="pill-rank">${index + 1}</span>
                                <span class="pill-name">${this.truncateText(topic.topic, 20)}</span>
                                <span class="pill-percentage">${topic.percentage.toFixed(0)}%</span>
                            </div>
                        `).join('')}
                    </div>
                    ${totalTopics > 3 ? `
                        <div class="more-topics">+${totalTopics - 3} más</div>
                    ` : ''}
                ` : '<p class="no-topics">Sin temas problemáticos</p>'}
            </div>
            
            <button class="view-details-btn" 
                    onclick="window.analyticsModule.showSimulationDetails('${simData.simulation?.id || ''}')">
                Ver detalles →
            </button>
        </div>
    `;
}
/**
 * Renderizar modal de drill-down
 */
renderTopicDrillDownModal() {
    return `
        <div id="topicDrillDownModal" class="modal" style="display: none;">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3 id="drillDownTitle">Estudiantes que marcaron este tema</h3>
                    <button class="btn-icon" onclick="window.analyticsModule.closeDrillDownModal()">✖️</button>
                </div>
                <div class="modal-body" id="drillDownContent">
                    <!-- Se llenará dinámicamente -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.analyticsModule.exportTopicStudents()">
                        📊 Exportar lista
                    </button>
                    <button class="btn btn-primary" onclick="window.analyticsModule.createTopicIntervention()">
                        📧 Crear intervención grupal
                    </button>
                </div>
            </div>
        </div>
    `;
}
/**
 * Renderizar insight de tema mejorado
 */
renderTopicInsight(insight) {
    const icons = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        success: '✅'
    };
    
    const colors = {
        critical: '#dc2626',
        warning: '#f59e0b',
        info: '#3b82f6',
        success: '#10b981'
    };
    
    return `
        <div class="insight-card-enhanced ${insight.type}">
            <div class="insight-icon" style="background-color: ${colors[insight.type]}20; color: ${colors[insight.type]}">
                ${icons[insight.type]}
            </div>
            <div class="insight-content">
                <h5 class="insight-title">${insight.title}</h5>
                <p class="insight-message">${insight.message}</p>
                ${insight.action ? `
                    <div class="insight-action">
                        <span class="action-icon">→</span>
                        ${insight.action}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Renderizar ranking global de temas
 */
renderGlobalTopicsRanking(globalTrends) {
    if (!globalTrends || Object.keys(globalTrends).length === 0) {
        return '';
    }
    
    const sortedTopics = Object.values(globalTrends)
        .sort((a, b) => b.totalMentions - a.totalMentions)
        .slice(0, 10);
    
    return `
        <div class="global-topics-ranking">
            <h4>🏆 Top 10 Temas Más Problemáticos (Global)</h4>
            <div class="ranking-grid">
                ${sortedTopics.map((topic, index) => `
                    <div class="ranking-item ${topic.trend}">
                        <div class="rank-number">${index + 1}</div>
                        <div class="topic-details">
                            <div class="topic-name">${topic.topic}</div>
                            <div class="topic-stats">
                                <span class="mentions">${topic.totalMentions} menciones</span>
                                <span class="avg-percentage">${topic.avgPercentage.toFixed(1)}% promedio</span>
                            </div>
                        </div>
                        <div class="trend-indicator ${topic.trend}">
                            ${topic.trend === 'increasing' ? '📈' : topic.trend === 'decreasing' ? '📉' : '➡️'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Métodos auxiliares
formatSimulationDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

showSimulationDetails(simulationId) {
    // Implementar según necesites
    console.log('Ver detalles del simulacro:', simulationId);
}
/**
 * Configurar event listeners para análisis de temas
 */
setupTopicEventListeners() {
    // Filtros
    const filters = ['topicCohortFilter', 'topicPeriodFilter', 'topicThresholdFilter'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            const handler = () => this.filterTopicAnalysis();
            element.addEventListener('change', handler);
            this.listeners.push({ element, event: 'change', handler });
        }
    });
    
    // Click handlers para drill-down
    document.querySelectorAll('.topic-item.clickable').forEach(item => {
        const handler = () => {
            const simulationId = item.dataset.simulationId;
            const topic = item.dataset.topic;
            if (simulationId && topic) {
                this.topicInsights.showTopicDrillDown(simulationId, topic);
            }
        };
        item.addEventListener('click', handler);
        this.listeners.push({ element: item, event: 'click', handler });
    });
}

/**
 * Métodos adicionales para manejo de temas
 */
filterTopicAnalysis() {
    this.topicInsights.filterTopicAnalysis();
}

closeDrillDownModal() {
    const modal = document.getElementById('topicDrillDownModal');
    if (modal) modal.style.display = 'none';
}

async exportTopicStudents() {
    if (this.topicInsights.currentDrillDownData) {
        await this.topicInsights.exportTopicStudents();
    }
}

async createTopicIntervention() {
    if (this.topicInsights.currentDrillDownData) {
        await this.topicInsights.createTopicIntervention();
    }
}

    /**
     * Renderizar insights
     */
    async renderInsights(analysis) {
        const container = document.getElementById('insightsList');
        if (!container) return;
        
        container.classList.remove('loading');
        
        try {
            const insights = await this.generateInsights(analysis);
            
            if (insights.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay insights significativos en este momento.</p>';
                return;
            }
            
            container.innerHTML = insights
                .map(insight => this.renderInsight(insight))
                .join('');
                
        } catch (error) {
            console.error('Error generando insights:', error);
            container.innerHTML = '<p class="text-danger">Error al generar insights</p>';
        }
    }

    /**
     * Generar insights del análisis
     */
    async generateInsights(analysis) {
        const insights = [];
        
        // Insights de riesgo
        if (analysis.riskDistribution) {
            const criticalPercentage = (analysis.riskDistribution.critical.percentage || 0);
            if (criticalPercentage > 15) {
                insights.push({
                    type: 'critical',
                    title: 'Alto porcentaje en riesgo crítico',
                    message: `${criticalPercentage.toFixed(1)}% de estudiantes tienen probabilidad de aprobar menor al 30%`,
                    action: 'Implementar plan de intervención inmediata'
                });
            }
        }
        
        // Insights de patrones
        if (analysis.patterns) {
            if (analysis.patterns.fatigue?.percentage > 30) {
                insights.push({
                    type: 'warning',
                    title: 'Fatiga mental generalizada',
                    message: `${analysis.patterns.fatigue.percentage}% de estudiantes muestran signos de fatiga`,
                    action: 'Revisar carga de trabajo y tiempos de examen'
                });
            }
        }
        
        // Insights de temas
        if (analysis.topicAnalysis?.insights) {
            insights.push(...analysis.topicAnalysis.insights);
        }
        
        // Ordenar por prioridad
        insights.sort((a, b) => {
            const priority = { critical: 3, warning: 2, info: 1 };
            return (priority[b.type] || 0) - (priority[a.type] || 0);
        });
        
        return insights.slice(0, 10); // Máximo 10 insights
    }

    /**
     * Renderizar un insight individual
     */
    renderInsight(insight) {
        return `
            <div class="insight-card ${insight.type || ''}">
                <div class="insight-header">
                    <h5>${insight.title}</h5>
                    <span class="insight-type-badge ${insight.type}">${this.getInsightTypeLabel(insight.type)}</span>
                </div>
                <p class="insight-message">${insight.message}</p>
                ${insight.action ? `
                    <div class="insight-action">
                        <strong>Acción recomendada:</strong> ${insight.action}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Obtener etiqueta para tipo de insight
     */
    getInsightTypeLabel(type) {
        const labels = {
            critical: 'Crítico',
            warning: 'Advertencia',
            info: 'Información',
            success: 'Positivo'
        };
        return labels[type] || type;
    }

    /**
     * Actualizar tabla de tendencias
     */
    async updateTrendsTable(trends) {
        const tbody = document.getElementById('trendsTableBody');
        if (!tbody) return;
        
        if (!trends || trends.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos de tendencias disponibles</td></tr>';
            return;
        }
        
        // Limitar a los primeros N estudiantes
        const displayTrends = trends.slice(0, this.config.maxTrendsDisplay);
        
        tbody.innerHTML = displayTrends.map(trend => `
            <tr>
                <td>
                    <strong>${trend.student?.username || 'N/A'}</strong>
                    <div class="text-small text-muted">${trend.student?.email || ''}</div>
                </td>
                <td>
                    <span class="badge badge-${this.getCohortClass(trend.student?.cohort)}">
                        ${trend.student?.cohort || 'N/A'}
                    </span>
                </td>
                <td>
                    ${this.getTrendIcon(trend.direction)}
                    <span class="trend-label">${this.getTrendLabel(trend.direction)}</span>
                </td>
                <td class="${trend.slope > 0 ? 'text-success' : trend.slope < 0 ? 'text-danger' : ''}">
                    ${trend.slope > 0 ? '+' : ''}${(trend.slope || 0).toFixed(3)}
                </td>
                <td class="${trend.eloChange > 0 ? 'text-success' : trend.eloChange < 0 ? 'text-danger' : ''}">
                    ${trend.eloChange > 0 ? '+' : ''}${trend.eloChange || 0}
                </td>
                <td>
                    ${(trend.consistency || 0).toFixed(2)}
                    <div class="consistency-bar">
                        <div class="consistency-fill" style="width: ${Math.min(100, trend.consistency * 20)}%"></div>
                    </div>
                </td>
                <td>
                    ${trend.projection ? `${trend.projection.toFixed(2)}/10` : 'N/A'}
                </td>
            </tr>
        `).join('');
    }

    /**
     * Renderizar gráficos
     */
    async renderCharts(data, analysis, compareCohorts) {
        const container = document.getElementById('chartsContainer');
        if (!container) return;
        
        // Limpiar gráficos anteriores
        this.destroyCharts();
        
        container.innerHTML = `
            <div class="chart-card">
                <h3>📊 Evolución de Puntuaciones</h3>
                <div class="chart-body">
                    <canvas id="scoresEvolutionChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>📈 Distribución de Riesgo</h3>
                <div class="chart-body">
                    <canvas id="riskDistributionChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>🎯 Patrones de Participación</h3>
                <div class="chart-body">
                    <canvas id="participationPatternChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>⚡ Progresión ELO</h3>
                <div class="chart-body">
                    <canvas id="eloProgressionChart"></canvas>
                </div>
            </div>
        `;
        
        // Renderizar cada gráfico
        await this.renderScoresEvolution(data, compareCohorts);
        await this.renderRiskDistribution(analysis.riskDistribution);
        await this.renderParticipationPatterns(data);
        await this.renderEloProgression(data, compareCohorts);
    }

    /**
     * Métodos individuales para cada gráfico
     */
    async renderScoresEvolution(data, compareCohorts) {
        // Implementación del gráfico de evolución de scores
        // TODO: Implementar con Chart.js
    }

    async renderRiskDistribution(riskDistribution) {
        // Implementación del gráfico de distribución de riesgo
        // TODO: Implementar con Chart.js
    }

    async renderParticipationPatterns(data) {
        // Implementación del gráfico de patrones de participación
        // TODO: Implementar con Chart.js
    }

    async renderEloProgression(data, compareCohorts) {
        // Implementación del gráfico de progresión ELO
        // TODO: Implementar con Chart.js
    }

    /**
     * Métodos de cálculo y análisis
     */
    calculateGlobalStatistics(results) {
        if (!results || results.length === 0) {
            return this.getDefaultGlobalStats();
        }
        
        const scores = results.map(r => r.score).filter(s => s > 0);
        const stats = StatisticsUtils.calculateBasicStats(scores);
        const percentiles = StatisticsUtils.calculatePercentiles(scores);
        
        return {
            totalResults: scores.length,
            ...stats,
            percentiles,
            participationRate: this.calculateParticipationRate(results),
            averageTimeSpent: this.calculateAverageTimeSpent(results),
            stressImpact: this.analyzeOverallStressImpact(results),
            cutoffDistance: stats.mean - this.cnpConfig.historicalCutoff
        };
    }

    analyzeRiskDistribution(students) {
        const distribution = {
            critical: { count: 0, percentage: 0, students: [] },
            high: { count: 0, percentage: 0, students: [] },
            medium: { count: 0, percentage: 0, students: [] },
            low: { count: 0, percentage: 0, students: [] }
        };
        
        students.forEach(student => {
            const prob = student.probability_pass || 50;
            const level = this.getRiskLevel(prob);
            distribution[level].count++;
            distribution[level].students.push(student);
        });
        
        const total = students.length;
        if (total > 0) {
            Object.keys(distribution).forEach(level => {
                distribution[level].percentage = parseFloat(
                    (distribution[level].count / total * 100).toFixed(1)
                );
            });
        }
        
        return distribution;
    }

    async analyzeGlobalPatterns(results) {
        const patterns = {
            fatigue: { affected: 0, percentage: 0 },
            rushing: { affected: 0, percentage: 0 },
            abandonment: { affected: 0, percentage: 0 },
            timeManagement: { optimal: 0, tooFast: 0, tooSlow: 0 },
            stressResponse: { positive: 0, neutral: 0, negative: 0 }
        };
        
        // Agrupar por estudiante
        const studentResults = this.groupResultsByStudent(results);
        
        // Analizar patrones por estudiante
        for (const [userId, userResults] of Object.entries(studentResults)) {
            if (userResults.length < 2) continue;
            
            const student = this.dashboard.data.students.find(s => s.id === userId);
            const analysis = await this.patternDetector.analyzeStudentPatterns(
                student || { id: userId }, 
                userResults
            );
            
            this.updatePatternCounts(patterns, analysis);
        }
        
        // Calcular porcentajes
        const totalStudents = Object.keys(studentResults).length;
        if (totalStudents > 0) {
            patterns.fatigue.percentage = parseFloat((patterns.fatigue.affected / totalStudents * 100).toFixed(1));
            patterns.rushing.percentage = parseFloat((patterns.rushing.affected / totalStudents * 100).toFixed(1));
            patterns.abandonment.percentage = parseFloat((patterns.abandonment.affected / totalStudents * 100).toFixed(1));
        }
        
        return patterns;
    }

    generateAggregatedPredictions(students) {
        const activeStudents = students.filter(s => s.active !== false);
        
        return {
            totalActive: activeStudents.length,
            projectedPass: activeStudents.filter(s => (s.probability_pass || 50) >= 50).length,
            atRisk: activeStudents.filter(s => (s.probability_pass || 50) < 50).length,
            borderline: activeStudents.filter(s => 
                (s.probability_pass || 50) >= 45 && (s.probability_pass || 50) < 55
            ).length,
            highConfidence: activeStudents.filter(s => (s.probability_pass || 50) > 70).length
        };
    }

    async analyzeStudentTrends(students, results) {
        const trends = [];
        
        for (const student of students) {
            const studentResults = results
                .filter(r => r.user_id === student.id)
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            
            if (studentResults.length >= 3) {
                const trendAnalysis = this.analyzeTrend(studentResults);
                const consistency = StatisticsUtils.calculateConsistency(studentResults);
                
                trends.push({
                    student,
                    ...trendAnalysis,
                    consistency,
                    eloChange: student.current_elo - 1000
                });
            }
        }
        
        return trends.sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope));
    }

    /**
     * Análisis individual de estudiante
     */
    async analyzeIndividualStudent(student, studentResults) {
        if (!studentResults || studentResults.length === 0) {
            return this.getDefaultStudentMetrics();
        }
        
        try {
            // Análisis de tendencia
            const trendAnalysis = this.analyzeTrend(studentResults);
            
            // Análisis de patrones
            const responsePatterns = await this.patternDetector.analyzeStudentPatterns(student, studentResults);
            
            // Cálculo de métricas
            const scores = studentResults.map(r => r.score);
            const weighted_average = StatisticsUtils.calculateWeightedAverage(scores);
            const consistency = StatisticsUtils.calculateConsistency(studentResults);
            const stats = StatisticsUtils.calculateBasicStats(scores);
            const z_score = CNPStatistics.calculateZScore(stats.mean);
            const percentile = StatisticsUtils.calculatePercentileRank(stats.mean, this.getAllScores());
            
            // Análisis de riesgo
            const riskAnalysis = this.analyzeIndividualRisk(student, studentResults, responsePatterns);
            
            // Calcular probabilidad
            const probability_pass = CNPStatistics.calculatePassProbability(
                stats.mean,
                consistency,
                trendAnalysis.slope,
                student.total_simulations
            );
            
            // Generar recomendaciones
            const recommendations = this.generatePersonalizedRecommendations(
                student, 
                studentResults, 
                responsePatterns,
                riskAnalysis
            );
            
            return {
                weighted_average,
                consistency_coefficient: consistency,
                z_score,
                percentile,
                probability_pass,
                trendAnalysis,
                responsePatterns,
                risk_level: riskAnalysis.level,
                calculated_risk_level: riskAnalysis.level,
                recommendations,
                best_score: stats.max,
                worst_score: stats.min,
                average_score: stats.mean,
                probability_details: {
                    confidence: {
                        margin: Math.max(5, 20 - (studentResults.length * 2))
                    }
                }
            };
            
        } catch (error) {
            console.error('Error analizando estudiante:', error);
            return this.getDefaultStudentMetrics();
        }
    }

    /**
     * Métodos auxiliares
     */
    getCurrentPeriod() {
        const select = document.getElementById('analyticsPeriod');
        return select ? select.value : 'all';
    }

    getCompareCohortsOption() {
        const checkbox = document.getElementById('compareCohorts');
        return checkbox ? checkbox.checked : false;
    }

    getRiskLevel(probability) {
        if (probability < this.config.riskThresholds.critical) return 'critical';
        if (probability < this.config.riskThresholds.high) return 'high';
        if (probability < this.config.riskThresholds.medium) return 'medium';
        return 'low';
    }

    getCohortClass(cohort) {
        const classes = {
            '48h': 'danger',
            '36h': 'warning',
            '20h': 'info',
            'sin_asignar': 'secondary'
        };
        return classes[cohort] || 'secondary';
    }

    getTrendIcon(direction) {
        const icons = {
            'up': '📈',
            'down': '📉',
            'stable': '➡️',
            'neutral': '⚪'
        };
        return icons[direction] || '⚪';
    }

    getTrendLabel(direction) {
        const labels = {
            'up': 'Mejorando',
            'down': 'Empeorando',
            'stable': 'Estable',
            'neutral': 'Sin datos'
        };
        return labels[direction] || direction;
    }

    analyzeTrend(results) {
        const scores = results.map(r => r.score);
        const x = scores.map((_, i) => i);
        const regression = StatisticsUtils.calculateLinearRegression(x, scores);
        
        let direction = 'stable';
        if (regression.slope > 0.1) direction = 'up';
        else if (regression.slope < -0.1) direction = 'down';
        
        return {
            direction,
            slope: regression.slope,
            confidence: Math.abs(regression.r2 * 100),
            projection: StatisticsUtils.projectNextValue(scores)
        };
    }

    analyzeIndividualRisk(student, results, patterns) {
        const factors = {
            avgScore: student.average_score || 0,
            participation: student.total_simulations || 0,
            consistency: StatisticsUtils.calculateConsistency(results),
            trend: student.trend_direction || 'neutral',
            probability: student.probability_pass || 50,
            patterns: patterns.riskFactors || []
        };
        
        let riskScore = 0;
        
        if (factors.avgScore < 6) riskScore += 30;
        if (factors.participation < 3) riskScore += 20;
        if (factors.consistency > 2) riskScore += 15;
        if (factors.trend === 'down') riskScore += 20;
        if (factors.probability < 50) riskScore += 15;
        
        factors.patterns.forEach(p => {
            riskScore += p.impact * 20;
        });
        
        let level = 'low';
        if (riskScore >= 70) level = 'critical';
        else if (riskScore >= 50) level = 'high';
        else if (riskScore >= 30) level = 'medium';
        
        return { score: riskScore, level, factors };
    }

    generatePersonalizedRecommendations(student, results, patterns, riskAnalysis) {
        const recommendations = [];
        
        if (riskAnalysis.level === 'critical') {
            recommendations.push({
                priority: 'alta',
                category: 'intervention',
                action: 'Intervención urgente requerida',
                details: 'Contactar inmediatamente para plan de recuperación personalizado'
            });
        }
        
        if (patterns.hasEnoughData && patterns.recommendations) {
            recommendations.push(...patterns.recommendations);
        }
        
        if (student.average_score < 6) {
            recommendations.push({
                priority: 'alta',
                category: 'academic',
                action: 'Refuerzo de conceptos fundamentales',
                details: 'Revisar especialmente los temas del bloque jurídico'
            });
        }
        
        recommendations.sort((a, b) => {
            const priority = { 'alta': 3, 'media': 2, 'baja': 1 };
            return priority[b.priority] - priority[a.priority];
        });
        
        return recommendations.slice(0, 5);
    }

    /**
     * Utilidades adicionales
     */
    groupResultsByStudent(results) {
        const grouped = {};
        results.forEach(r => {
            if (!grouped[r.user_id]) {
                grouped[r.user_id] = [];
            }
            grouped[r.user_id].push(r);
        });
        return grouped;
    }

    updatePatternCounts(patterns, analysis) {
        if (analysis.patterns?.fatigue?.detected) patterns.fatigue.affected++;
        if (analysis.patterns?.rushing?.detected) patterns.rushing.affected++;
        if (analysis.patterns?.abandonment?.detected) patterns.abandonment.affected++;
        
        const timeData = analysis.patterns?.timeManagement;
        if (timeData?.hasData) {
            if (timeData.isOptimal) patterns.timeManagement.optimal++;
            else if (timeData.averageMinutes < 85) patterns.timeManagement.tooFast++;
            else patterns.timeManagement.tooSlow++;
        }
        
        const stressData = analysis.patterns?.stressImpact;
        if (stressData?.hasData) {
            patterns.stressResponse[stressData.responseType]++;
        }
    }

    calculateParticipationRate(results) {
        const uniqueUsers = new Set(results.map(r => r.user_id)).size;
        const totalStudents = this.dashboard.data.students?.length || 0;
        return totalStudents > 0 ? parseFloat((uniqueUsers / totalStudents * 100).toFixed(1)) : 0;
    }

    calculateAverageTimeSpent(results) {
        const times = results.map(r => r.time_taken || 0).filter(t => t > 0);
        if (times.length === 0) return 0;
        const stats = StatisticsUtils.calculateBasicStats(times);
        return Math.round(stats.mean / 60);
    }

    analyzeOverallStressImpact(results) {
        const stressData = results.filter(r => r.stress_level !== null);
        if (stressData.length < 10) {
            return { correlation: 0, type: 'insufficient_data' };
        }
        
        const correlation = StatisticsUtils.calculateCorrelation(
            stressData.map(r => r.stress_level),
            stressData.map(r => r.score)
        );
        
        let type = 'neutral';
        if (correlation < -0.2) type = 'negative';
        else if (correlation > 0.1) type = 'positive';
        
        return { 
            correlation: parseFloat(correlation.toFixed(3)), 
            type 
        };
    }

    getAllScores() {
        return this.dashboard.data.results?.map(r => r.score) || [];
    }

    getDefaultStudentMetrics() {
        return {
            weighted_average: 0,
            consistency_coefficient: 0,
            z_score: 0,
            percentile: 50,
            probability_pass: 50,
            trendAnalysis: { direction: 'neutral', confidence: 0 },
            responsePatterns: { hasEnoughData: false, patterns: {} },
            risk_level: 'unknown',
            calculated_risk_level: 'unknown',
            recommendations: [{
                priority: 'alta',
                category: 'start',
                action: 'Comenzar con simulacros',
                details: 'Necesitas realizar al menos 3 simulacros para obtener un análisis completo.'
            }],
            best_score: 0,
            worst_score: 0,
            average_score: 0,
            probability_details: { confidence: { margin: 20 } }
        };
    }

    getDefaultGlobalStats() {
        return {
            totalResults: 0,
            mean: 5.5,
            stdDev: 1.5,
            median: 5.5,
            min: 0,
            max: 10,
            percentiles: { p10: 3.5, p25: 4.5, p50: 5.5, p75: 6.5, p90: 7.5 },
            participationRate: 0,
            averageTimeSpent: 0,
            stressImpact: { correlation: 0, type: 'neutral' },
            cutoffDistance: -2.22
        };
    }

    /**
     * Mostrar estados de carga
     */
    showLoadingStates() {
        const elements = [
            'globalStatsGrid',
            'patternsGrid',
            'insightsList'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('loading');
                element.innerHTML = '<div class="loading-spinner"></div>';
            }
        });
    }

    /**
     * Mostrar error
     */
    showError(error, container = null) {
        const message = error.message || 'Error desconocido';
        
        if (container) {
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo</h3>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="window.dashboardAdmin.refreshData()">
                        🔄 Reintentar
                    </button>
                </div>
            `;
        } else {
            // Mostrar notificación si el dashboard lo soporta
            if (this.dashboard?.showNotification) {
                this.dashboard.showNotification('error', message);
            } else {
                console.error('Error:', message);
            }
        }
    }

    /**
     * Asegurar que Chart.js esté disponible
     */
    async ensureChartJS() {
        if (typeof Chart === 'undefined') {
            await window.ensureChartJS?.();
        }
    }

    /**
     * Exportar tendencias
     */
    async exportTrends() {
        try {
            const exportsModule = await this.dashboard.loadModule('exports');
            // TODO: Implementar exportación de tendencias
            this.dashboard.showNotification('info', 'Función de exportación en desarrollo');
        } catch (error) {
            this.showError(error);
        }
    }

    /**
     * Destruir gráficos
     */
    destroyCharts() {
        this.charts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts.clear();
    }

    /**
     * Limpiar módulo
     */
    destroy() {
        this.isDestroyed = true;
        this.removeEventListeners();
        this.destroyCharts();
        this.cache.clear();
        
        // Limpiar referencia global
        if (window.analyticsModule === this) {
            delete window.analyticsModule;
        }
    }
}