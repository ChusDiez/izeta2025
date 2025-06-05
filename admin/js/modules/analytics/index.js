// admin/js/modules/analytics/index.js
// Orquestador principal del módulo de analytics

import { StatisticsUtils, CNPStatistics } from '../utils/statistics.js';
import PatternDetector from './patterns.js';

export default class AnalyticsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.charts = new Map();
        this.patternDetector = new PatternDetector();
        
        // Usar configuración de CNPStatistics
        this.cnpConfig = CNPStatistics.config;
    }

    /**
     * Renderizar página principal de analytics
     */
    async render(container) {
        try {
            // Esperar a que Chart.js esté disponible
            await window.ensureChartJS();
            
            container.innerHTML = `
                <div class="analytics-page">
                    <div class="analytics-header card">
                        <h2>📊 Centro de Análisis Estadístico Avanzado</h2>
                        <p>Análisis completo de rendimiento y predicciones basadas en datos históricos</p>
                    </div>
                    
                    <!-- Resumen ejecutivo -->
                    <div id="executiveSummarySection">
                        <!-- Se llenará dinámicamente -->
                    </div>
                    
                    <!-- Panel predictivo -->
                    <div id="predictiveAnalysisSection">
                        <!-- Se llenará dinámicamente -->
                    </div>
                    
                    <!-- Controles -->
                    <div class="analytics-controls card">
                        <div class="period-selector">
                            <label>Período de análisis:</label>
                            <select id="analyticsPeriod" onchange="window.analyticsModule.updateAnalysis()">
                                <option value="all">Todo el histórico</option>
                                <option value="month">Último mes</option>
                                <option value="quarter">Último trimestre</option>
                                <option value="semester">Último semestre</option>
                            </select>
                        </div>
                        <div class="comparison-toggle">
                            <label>
                                <input type="checkbox" id="compareCohorts" onchange="window.analyticsModule.updateAnalysis()">
                                Comparar por cohortes
                            </label>
                        </div>
                    </div>
                    
                    <!-- Estadísticas globales -->
                    <div class="global-stats-panel card">
                        <h3>📈 Estadísticas Globales del Sistema</h3>
                        <div id="globalStatsGrid" class="stats-grid">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Gráficos principales -->
                    <div class="charts-section">
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
                    </div>
                    
                    <!-- Análisis de patrones -->
                    <div class="patterns-analysis-section card">
                        <h3>🔍 Análisis de Patrones Globales</h3>
                        <div id="patternsGrid" class="patterns-grid">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Insights -->
                    <div class="insights-section card">
                        <h3>💡 Insights Detectados</h3>
                        <div id="insightsList" class="insights-list">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Tabla de tendencias -->
                    <div class="trends-table-section card">
                        <h3>📊 Análisis de Tendencias Individuales</h3>
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
                                <!-- Se llenará dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            window.analyticsModule = this;
            
            // Cargar análisis inicial
            setTimeout(() => this.updateAnalysis(), 100);
            
        } catch (error) {
            console.error('Error en módulo de análisis:', error);
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="window.dashboardAdmin.refreshData()">
                        🔄 Reintentar
                    </button>
                </div>
            `;
        }
    }

    /**
     * Actualizar todo el análisis
     */
    async updateAnalysis() {
        const period = document.getElementById('analyticsPeriod').value;
        const compareCohorts = document.getElementById('compareCohorts').checked;
        
        // Cargar datos según el período
        const data = await this.loadAnalyticsData(period);
        
        // Realizar análisis completo
        const analysis = await this.performComprehensiveAnalysis(data);
        
        // Renderizar todas las secciones
        this.renderExecutiveSummary(analysis);
        this.renderMainPredictiveAnalysis(analysis);
        this.renderGlobalStats(analysis.globalStats);
        
        // Renderizar gráficos (delegado a charts.js cuando se implemente)
        await this.renderCharts(data, analysis, compareCohorts);
        
        // Renderizar análisis de patrones
        this.renderPatternsAnalysis(analysis.patterns);
        
        // Generar insights
        await this.generateInsights(analysis);
        
        // Actualizar tabla de tendencias
        await this.updateTrendsTable(analysis.studentTrends);
    }

    /**
     * Análisis individual de estudiante (usado por students.js)
     */
    async analyzeIndividualStudent(student, studentResults) {
        if (!studentResults || studentResults.length === 0) {
            return this.getDefaultStudentMetrics();
        }
        
        // Análisis de tendencia usando utilidades compartidas
        const trendAnalysis = this.analyzeTrend(studentResults);
        
        // Análisis de patrones usando el detector
        const responsePatterns = await this.patternDetector.analyzeStudentPatterns(student, studentResults);
        
        // Cálculo de métricas avanzadas usando utilidades
        const scores = studentResults.map(r => r.score);
        const weighted_average = StatisticsUtils.calculateWeightedAverage(scores);
        const consistency = StatisticsUtils.calculateConsistency(studentResults);
        const stats = StatisticsUtils.calculateBasicStats(scores);
        const z_score = CNPStatistics.calculateZScore(stats.mean);
        const percentile = StatisticsUtils.calculatePercentileRank(stats.mean, this.getAllScores());
        
        // Análisis de riesgo personalizado
        const riskAnalysis = this.analyzeIndividualRisk(student, studentResults, responsePatterns);
        
        // Calcular probabilidad usando CNPStatistics
        const probability_pass = CNPStatistics.calculatePassProbability(
            stats.mean,
            consistency,
            trendAnalysis.slope,
            student.total_simulations
        );
        
        // Generar recomendaciones personalizadas
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
    }

    /**
     * Cargar datos según período
     */
    async loadAnalyticsData(period) {
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
            default:
                startDate.setFullYear(2024);
        }
        
        const { data: results } = await this.supabase
            .from('user_results')
            .select(`
                *,
                users!inner(id, slug, username, email, cohort, current_elo, probability_pass, trend_direction)
            `)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: true });
        
        const { data: eloHistory } = await this.supabase
            .from('elo_history')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });
        
        return { 
            results: results || [], 
            eloHistory: eloHistory || [], 
            startDate, 
            endDate,
            students: this.dashboard.data.students 
        };
    }

    /**
     * Realizar análisis completo
     */
    async performComprehensiveAnalysis(data) {
        const { results, students } = data;
        
        // 1. Estadísticas globales usando utilidades
        const globalStats = this.calculateGlobalStatistics(results);
        
        // 2. Análisis de distribución de riesgo
        const riskDistribution = this.analyzeRiskDistribution(students);
        
        // 3. Análisis de patrones globales
        const patterns = await this.analyzeGlobalPatterns(results);
        
        // 4. Predicciones agregadas
        const predictions = this.generateAggregatedPredictions(students);
        
        // 5. Tendencias individuales
        const studentTrends = await this.analyzeStudentTrends(students, results);
        
        // 6. Métricas adicionales
        const totalStudents = students.length;
        const activeStudents = students.filter(s => s.active).length;
        const improvingStudents = students.filter(s => s.trend_direction === 'up').length;
        const decliningStudents = students.filter(s => s.trend_direction === 'down').length;
        const averageProbability = students.reduce((sum, s) => sum + (s.probability_pass || 50), 0) / (totalStudents || 1);
        
        return {
            globalStats,
            riskDistribution,
            patterns,
            predictions,
            studentTrends,
            totalStudents,
            activeStudents,
            improvingStudents,
            decliningStudents,
            averageProbability
        };
    }

    /**
     * Calcular estadísticas globales
     */
    calculateGlobalStatistics(results) {
        if (results.length === 0) {
            return this.getDefaultGlobalStats();
        }
        
        const scores = results.map(r => r.score).filter(s => s > 0);
        const stats = StatisticsUtils.calculateBasicStats(scores);
        const percentiles = StatisticsUtils.calculatePercentiles(scores);
        
        // Análisis adicional
        const participationRate = this.calculateParticipationRate(results);
        const averageTimeSpent = this.calculateAverageTimeSpent(results);
        const stressImpact = this.analyzeOverallStressImpact(results);
        
        return {
            totalResults: scores.length,
            ...stats,
            percentiles,
            participationRate,
            averageTimeSpent,
            stressImpact,
            cutoffDistance: stats.mean - this.cnpConfig.historicalCutoff
        };
    }

    /**
     * Analizar distribución de riesgo
     */
    analyzeRiskDistribution(students) {
        const distribution = {
            critical: { count: 0, percentage: 0, students: [] },
            high: { count: 0, percentage: 0, students: [] },
            medium: { count: 0, percentage: 0, students: [] },
            low: { count: 0, percentage: 0, students: [] }
        };
        
        students.forEach(student => {
            const prob = student.probability_pass || 50;
            if (prob < 30) {
                distribution.critical.count++;
                distribution.critical.students.push(student);
            } else if (prob < 50) {
                distribution.high.count++;
                distribution.high.students.push(student);
            } else if (prob < 70) {
                distribution.medium.count++;
                distribution.medium.students.push(student);
            } else {
                distribution.low.count++;
                distribution.low.students.push(student);
            }
        });
        
        const total = students.length;
        Object.keys(distribution).forEach(level => {
            distribution[level].percentage = total > 0 ? 
                parseFloat((distribution[level].count / total * 100).toFixed(1)) : 0;
        });
        
        return distribution;
    }

    /**
     * Analizar patrones globales
     */
    async analyzeGlobalPatterns(results) {
        const patterns = {
            fatigue: { affected: 0, percentage: 0 },
            rushing: { affected: 0, percentage: 0 },
            abandonment: { affected: 0, percentage: 0 },
            timeManagement: { optimal: 0, tooFast: 0, tooSlow: 0 },
            stressResponse: { positive: 0, neutral: 0, negative: 0 }
        };
        
        // Agrupar por estudiante
        const studentResults = {};
        results.forEach(r => {
            if (!studentResults[r.user_id]) {
                studentResults[r.user_id] = [];
            }
            studentResults[r.user_id].push(r);
        });
        
        // Analizar patrones por estudiante usando el detector
        for (const [userId, userResults] of Object.entries(studentResults)) {
            const analysis = await this.patternDetector.analyzeStudentPatterns(
                { id: userId }, 
                userResults
            );
            
            if (analysis.patterns.fatigue?.detected) patterns.fatigue.affected++;
            if (analysis.patterns.rushing?.detected) patterns.rushing.affected++;
            if (analysis.patterns.abandonment?.detected) patterns.abandonment.affected++;
            
            const timeData = analysis.patterns.timeManagement;
            if (timeData?.hasData) {
                if (timeData.isOptimal) patterns.timeManagement.optimal++;
                else if (timeData.averageMinutes < 85) patterns.timeManagement.tooFast++;
                else patterns.timeManagement.tooSlow++;
            }
            
            const stressData = analysis.patterns.stressImpact;
            if (stressData?.hasData) {
                patterns.stressResponse[stressData.responseType]++;
            }
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

    // ===== MÉTODOS DE RENDERIZADO (simplificados) =====

    renderExecutiveSummary(analysis) {
        const container = document.getElementById('executiveSummarySection');
        
        const totalStudents = analysis.totalStudents || 0;
        const atRisk = analysis.riskDistribution.critical.count + analysis.riskDistribution.high.count;
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

    renderMainPredictiveAnalysis(analysis) {
        const container = document.getElementById('predictiveAnalysisSection');
        const predictions = analysis.predictions;
        
        container.innerHTML = `
            <div class="predictive-panel card">
                <h3>🎯 Análisis Predictivo Principal</h3>
                <div class="prediction-content">
                    <div class="prediction-main">
                        <div class="stat-value">${predictions.projectedPass}</div>
                        <div class="stat-label">Proyección de aprobados</div>
                        <div class="stat-change">De ${predictions.totalActive} estudiantes activos</div>
                    </div>
                    <div class="prediction-breakdown">
                        <div class="stat-box success">
                            <div class="stat-value">${predictions.highConfidence}</div>
                            <div class="stat-label">Alta probabilidad (>70%)</div>
                        </div>
                        <div class="stat-box warning">
                            <div class="stat-value">${predictions.borderline}</div>
                            <div class="stat-label">En el límite (45-55%)</div>
                        </div>
                        <div class="stat-box danger">
                            <div class="stat-value">${predictions.atRisk}</div>
                            <div class="stat-label">En riesgo (<50%)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderGlobalStats(stats) {
        const grid = document.getElementById('globalStatsGrid');
        grid.innerHTML = `
            <div class="stat-box">
                <div class="stat-label">Resultados Analizados</div>
                <div class="stat-value">${stats.totalResults}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Media Global</div>
                <div class="stat-value">${stats.mean}/10</div>
                <div class="stat-change">σ = ${stats.stdDev}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Mediana</div>
                <div class="stat-value">${stats.median}/10</div>
            </div>
            <div class="stat-box ${stats.cutoffDistance < 0 ? 'danger' : 'success'}">
                <div class="stat-label">Distancia a Nota de Corte</div>
                <div class="stat-value">${stats.cutoffDistance > 0 ? '+' : ''}${stats.cutoffDistance.toFixed(2)}</div>
            </div>
        `;
    }

    renderPatternsAnalysis(patterns) {
        const grid = document.getElementById('patternsGrid');
        grid.innerHTML = `
            <div class="pattern-card ${patterns.fatigue.percentage > 30 ? 'warning' : ''}">
                <h4>😴 Fatiga Mental</h4>
                <div class="stat-value">${patterns.fatigue.percentage}%</div>
                <div class="stat-label">${patterns.fatigue.affected} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.rushing.percentage > 25 ? 'warning' : ''}">
                <h4>⚡ Precipitación</h4>
                <div class="stat-value">${patterns.rushing.percentage}%</div>
                <div class="stat-label">${patterns.rushing.affected} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.abandonment.percentage > 20 ? 'danger' : ''}">
                <h4>❌ Abandono Excesivo</h4>
                <div class="stat-value">${patterns.abandonment.percentage}%</div>
                <div class="stat-label">${patterns.abandonment.affected} estudiantes afectados</div>
            </div>
        `;
    }

    // Implementar resto de métodos necesarios...
    // (Los métodos de gráficos se moverían a un módulo charts.js separado)

    /**
     * Métodos auxiliares
     */
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
        
        // Evaluar cada factor
        if (factors.avgScore < 6) riskScore += 30;
        if (factors.participation < 3) riskScore += 20;
        if (factors.consistency > 2) riskScore += 15;
        if (factors.trend === 'down') riskScore += 20;
        if (factors.probability < 50) riskScore += 15;
        
        // Añadir riesgo por patrones
        factors.patterns.forEach(p => {
            riskScore += p.impact * 20;
        });
        
        let level = 'low';
        if (riskScore >= 70) level = 'critical';
        else if (riskScore >= 50) level = 'high';
        else if (riskScore >= 30) level = 'medium';
        
        return {
            score: riskScore,
            level,
            factors
        };
    }

    generatePersonalizedRecommendations(student, results, patterns, riskAnalysis) {
        const recommendations = [];
        
        // Recomendaciones basadas en riesgo
        if (riskAnalysis.level === 'critical') {
            recommendations.push({
                priority: 'alta',
                category: 'intervention',
                action: 'Intervención urgente requerida',
                details: 'Contactar inmediatamente para plan de recuperación personalizado'
            });
        }
        
        // Recomendaciones basadas en patrones
        if (patterns.hasEnoughData && patterns.recommendations) {
            recommendations.push(...patterns.recommendations);
        }
        
        // Recomendaciones basadas en rendimiento
        if (student.average_score < 6) {
            recommendations.push({
                priority: 'alta',
                category: 'academic',
                action: 'Refuerzo de conceptos fundamentales',
                details: 'Revisar especialmente los temas del bloque jurídico'
            });
        }
        
        // Ordenar por prioridad
        recommendations.sort((a, b) => {
            const priority = { 'alta': 3, 'media': 2, 'baja': 1 };
            return priority[b.priority] - priority[a.priority];
        });
        
        return recommendations.slice(0, 5);
    }

    // Métodos por implementar (delegados a otros submódulos cuando se creen)
    async renderCharts(data, analysis, compareCohorts) {
        // TODO: Delegar a módulo charts.js
        console.log('Charts rendering pendiente de implementación en módulo separado');
    }

    async generateInsights(analysis) {
        // TODO: Mover a módulo insights.js
        const container = document.getElementById('insightsList');
        container.innerHTML = '<p>Sistema de insights en desarrollo...</p>';
    }

    async updateTrendsTable(trends) {
        // TODO: Implementar o mover a módulo tables.js
        const tbody = document.getElementById('trendsTableBody');
        tbody.innerHTML = '<tr><td colspan="7">Cargando tendencias...</td></tr>';
    }

    // Métodos auxiliares
    calculateParticipationRate(results) {
        const uniqueUsers = new Set(results.map(r => r.user_id)).size;
        const totalStudents = this.dashboard.data.students.length;
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

    generateAggregatedPredictions(students) {
        const activeStudents = students.filter(s => s.active);
        const projectedPass = activeStudents.filter(s => (s.probability_pass || 50) >= 50).length;
        const atRisk = activeStudents.filter(s => (s.probability_pass || 50) < 50).length;
        const borderline = activeStudents.filter(s => 
            (s.probability_pass || 50) >= 45 && (s.probability_pass || 50) < 55
        ).length;
        const highConfidence = activeStudents.filter(s => (s.probability_pass || 50) > 70).length;
        
        return {
            totalActive: activeStudents.length,
            projectedPass,
            atRisk,
            borderline,
            highConfidence
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
        
        return trends.sort((a, b) => b.slope - a.slope);
    }

    getAllScores() {
        // Obtener todos los scores para cálculos de percentil
        return this.dashboard.data.results.map(r => r.score);
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

    destroy() {
        // Limpiar gráficos si existen
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}