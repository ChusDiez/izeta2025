// admin/js/modules/analytics.js
export default class AnalyticsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.charts = new Map();
        
        // Configuración específica para oposiciones CNP
        this.cnpConfig = {
            historicalCutoff: 7.72,
            cutoffStdDev: 0.25,
            topicWeights: {
                juridico: 0.77,
                sociales: 0.15,
                tecnico: 0.08
            },
            topicDifficulty: {
                juridico: 1.0,
                sociales: 1.1,
                tecnico: 1.2
            }
        };
    }

    async render(container) {
        try {
            container.innerHTML = `
                <div class="analytics-page">
                    <h2>📊 Centro de Análisis Estadístico Avanzado</h2>
                    
                    <!-- Resumen ejecutivo para oposiciones (NUEVO) -->
                    <div id="executiveSummarySection">
                        <!-- Se llenará dinámicamente -->
                    </div>
                    
                    <!-- Panel de análisis predictivo (NUEVO) -->
                    <div id="predictiveAnalysisSection">
                        <!-- Se llenará dinámicamente -->
                    </div>
                    
                    <!-- Selector de período -->
                    <div class="analytics-controls">
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
                    
                    <!-- Panel de estadísticas globales -->
                    <div class="global-stats-panel">
                        <h3>📈 Estadísticas Globales del Sistema</h3>
                        <div id="globalStatsGrid" class="stats-grid">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Gráficos principales -->
                    <div class="charts-grid">
                        <div class="chart-card">
                            <h3>📊 Evolución de Puntuaciones</h3>
                            <canvas id="scoresEvolutionChart"></canvas>
                        </div>
                        
                        <div class="chart-card">
                            <h3>📈 Distribución de Riesgo</h3>
                            <canvas id="riskDistributionChart"></canvas>
                        </div>
                        
                        <div class="chart-card">
                            <h3>🎯 Patrones de Participación</h3>
                            <canvas id="participationPatternChart"></canvas>
                        </div>
                        
                        <div class="chart-card">
                            <h3>⚡ Progresión ELO</h3>
                            <canvas id="eloProgressionChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Análisis de patrones detectados -->
                    <div class="patterns-analysis-section">
                        <h3>🔍 Análisis de Patrones Globales</h3>
                        <div id="patternsGrid" class="patterns-grid">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Análisis predictivo detallado -->
                    <div class="predictive-analysis-section">
                        <h3>🎯 Análisis Predictivo Detallado</h3>
                        <div id="predictiveAnalysisDetailed">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Insights automáticos -->
                    <div class="insights-section">
                        <h3>💡 Insights Detectados</h3>
                        <div id="insightsList" class="insights-list">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Tabla de tendencias -->
                    <div class="trends-table-section">
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
            await this.updateAnalysis();
            
        } catch (error) {
            console.error('Error en módulo de análisis:', error);
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async updateAnalysis() {
        const period = document.getElementById('analyticsPeriod').value;
        const compareCohorts = document.getElementById('compareCohorts').checked;
        
        // Cargar datos según el período
        const data = await this.loadAnalyticsData(period);
        
        // Realizar análisis completo
        const analysis = await this.performComprehensiveAnalysis(data);
        
        // Renderizar resumen ejecutivo (NUEVO)
        this.renderExecutiveSummary(analysis);
        
        // Renderizar análisis predictivo principal (NUEVO)
        this.renderMainPredictiveAnalysis(analysis);
        
        // Renderizar estadísticas globales
        this.renderGlobalStats(analysis.globalStats);
        
        // Renderizar gráficos
        await this.renderScoresEvolution(data, compareCohorts);
        await this.renderRiskDistribution(analysis.riskDistribution);
        await this.renderParticipationPattern(data);
        await this.renderEloProgression(data, compareCohorts);
        
        // Renderizar análisis de patrones
        this.renderPatternsAnalysis(analysis.patterns);
        
        // Renderizar análisis predictivo detallado
        this.renderDetailedPredictiveAnalysis(analysis.predictions);
        
        // Generar insights
        await this.generateInsights(analysis);
        
        // Actualizar tabla de tendencias
        await this.updateTrendsTable(analysis.studentTrends);
    }

    /**
     * Renderizar resumen ejecutivo (INCORPORADO DE students.js)
     */
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
                <div class="summary-grid">
                    <div class="summary-stat">
                        <div class="stat-icon danger">${atRisk}</div>
                        <div class="stat-label">En riesgo de suspender</div>
                        <div class="stat-detail">${totalStudents > 0 ? ((atRisk / totalStudents) * 100).toFixed(1) : 0}% del total</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-icon success">${improving}</div>
                        <div class="stat-label">Mejorando</div>
                        <div class="stat-detail">Tendencia positiva</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-icon warning">${declining}</div>
                        <div class="stat-label">Empeorando</div>
                        <div class="stat-detail">Requieren atención</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-icon info">${avgProbability.toFixed(0)}%</div>
                        <div class="stat-label">Probabilidad media</div>
                        <div class="stat-detail">De aprobar</div>
                    </div>
                </div>
                
                <!-- Métricas adicionales del resumen ejecutivo -->
                <div class="executive-metrics">
                    <div class="metric-row">
                        <span class="metric-label">Distancia media a nota de corte:</span>
                        <span class="metric-value ${analysis.globalStats.cutoffDistance < 0 ? 'danger' : 'success'}">
                            ${analysis.globalStats.cutoffDistance > 0 ? '+' : ''}${analysis.globalStats.cutoffDistance.toFixed(2)}
                        </span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Participación activa:</span>
                        <span class="metric-value">${analysis.globalStats.participationRate}%</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Tiempo promedio por examen:</span>
                        <span class="metric-value">${analysis.globalStats.averageTimeSpent} minutos</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar panel de análisis predictivo principal (INCORPORADO DE students.js)
     */
    renderMainPredictiveAnalysis(analysis) {
        const container = document.getElementById('predictiveAnalysisSection');
        const predictions = analysis.predictions;
        
        container.innerHTML = `
            <div class="predictive-panel card">
                <h3>🎯 Análisis Predictivo Principal</h3>
                <div class="prediction-content">
                    <div class="prediction-main">
                        <div class="big-number">${predictions.projectedPass}</div>
                        <div class="big-label">Proyección de aprobados</div>
                        <div class="prediction-detail">
                            De ${predictions.totalActive} estudiantes activos
                        </div>
                    </div>
                    <div class="prediction-breakdown">
                        <div class="prediction-item">
                            <span class="prediction-count success">${predictions.highConfidence}</span>
                            <span class="prediction-label">Alta probabilidad (>70%)</span>
                        </div>
                        <div class="prediction-item">
                            <span class="prediction-count warning">${predictions.borderline}</span>
                            <span class="prediction-label">En el límite (45-55%)</span>
                        </div>
                        <div class="prediction-item">
                            <span class="prediction-count danger">${predictions.atRisk}</span>
                            <span class="prediction-label">En riesgo (<50%)</span>
                        </div>
                        <div class="prediction-note">
                            <strong>Nota de corte estimada:</strong> ${this.cnpConfig.historicalCutoff}/10
                            <br>
                            <small>Basado en históricos CNP (σ = ${this.cnpConfig.cutoffStdDev})</small>
                        </div>
                    </div>
                </div>
                
                <!-- Factores predictivos clave -->
                ${predictions.keyFactors && predictions.keyFactors.length > 0 ? `
                    <div class="predictive-factors">
                        <h4>Factores Clave Identificados:</h4>
                        <ul>
                            ${predictions.keyFactors.map(factor => `<li>${factor}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
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
                users!inner(id, slug, username, email, cohort, current_elo, probability_pass, trend_direction)
            `)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: true });
        
        // Cargar historial ELO
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

    async performComprehensiveAnalysis(data) {
        const { results, students } = data;
        
        // 1. Estadísticas globales
        const globalStats = this.calculateGlobalStatistics(results);
        
        // 2. Análisis de distribución de riesgo
        const riskDistribution = this.analyzeRiskDistribution(students);
        
        // 3. Análisis de patrones globales
        const patterns = await this.analyzeGlobalPatterns(results);
        
        // 4. Predicciones agregadas
        const predictions = this.generateAggregatedPredictions(students);
        
        // 5. Tendencias individuales
        const studentTrends = await this.analyzeStudentTrends(students, results);
        
        // 6. Calcular métricas adicionales para el resumen ejecutivo
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
     * Método para análisis individual de estudiante (usado por students.js)
     */
    async analyzeIndividualStudent(student, studentResults) {
        if (!studentResults || studentResults.length === 0) {
            return this.getDefaultStudentMetrics();
        }
        
        // Análisis de tendencia
        const trendAnalysis = this.analyzeTrend(studentResults);
        
        // Análisis de patrones de respuesta
        const responsePatterns = await this.analyzeResponsePatterns(student, studentResults);
        
        // Cálculo de métricas avanzadas
        const weighted_average = this.calculateWeightedAverage(studentResults);
        const consistency = this.calculateConsistency(studentResults);
        const z_score = this.calculateZScore(student.average_score || 0);
        const percentile = this.calculatePercentile(student.average_score || 0);
        
        // Análisis de riesgo personalizado
        const riskAnalysis = this.analyzeIndividualRisk(student, studentResults);
        
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
            trendAnalysis,
            responsePatterns,
            risk_level: riskAnalysis.level,
            calculated_risk_level: riskAnalysis.level,
            recommendations,
            best_score: Math.max(...studentResults.map(r => r.score)),
            worst_score: Math.min(...studentResults.map(r => r.score)),
            probability_details: {
                confidence: {
                    margin: 10 - (studentResults.length * 2) // Simplificado
                }
            }
        };
    }

    // =====================================================
    // MÉTODOS DE ANÁLISIS ESTADÍSTICO
    // =====================================================

    calculateGlobalStatistics(results) {
        if (results.length === 0) {
            return this.getDefaultGlobalStats();
        }
        
        const scores = results.map(r => r.score).filter(s => s > 0).sort((a, b) => a - b);
        const n = scores.length;
        
        // Estadísticas básicas
        const mean = scores.reduce((sum, s) => sum + s, 0) / n;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        // Mediana y percentiles
        const median = scores[Math.floor(n / 2)];
        const percentiles = {
            p10: scores[Math.floor(n * 0.10)],
            p25: scores[Math.floor(n * 0.25)],
            p50: median,
            p75: scores[Math.floor(n * 0.75)],
            p90: scores[Math.floor(n * 0.90)]
        };
        
        // Análisis adicional
        const participationRate = this.calculateParticipationRate(results);
        const averageTimeSpent = this.calculateAverageTimeSpent(results);
        const stressImpact = this.analyzeOverallStressImpact(results);
        
        return {
            totalResults: n,
            mean: parseFloat(mean.toFixed(2)),
            stdDev: parseFloat(stdDev.toFixed(2)),
            median: parseFloat(median.toFixed(2)),
            percentiles,
            participationRate,
            averageTimeSpent,
            stressImpact,
            cutoffDistance: mean - this.cnpConfig.historicalCutoff
        };
    }

    getDefaultGlobalStats() {
        return {
            totalResults: 0,
            mean: 5.5,
            stdDev: 1.5,
            median: 5.5,
            percentiles: { p10: 3.5, p25: 4.5, p50: 5.5, p75: 6.5, p90: 7.5 },
            participationRate: 0,
            averageTimeSpent: 0,
            stressImpact: { correlation: 0, type: 'neutral' },
            cutoffDistance: -2.22
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
                (distribution[level].count / total * 100).toFixed(1) : 0;
        });
        
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
        const studentResults = {};
        results.forEach(r => {
            if (!studentResults[r.user_id]) {
                studentResults[r.user_id] = [];
            }
            studentResults[r.user_id].push(r);
        });
        
        // Analizar patrones por estudiante
        Object.values(studentResults).forEach(userResults => {
            const analysis = this.analyzeStudentPatterns(userResults);
            
            if (analysis.patterns.fatigue?.detected) patterns.fatigue.affected++;
            if (analysis.patterns.rushing?.detected) patterns.rushing.affected++;
            if (analysis.patterns.abandonment?.detected) patterns.abandonment.affected++;
            
            if (analysis.timeManagement.isOptimal) patterns.timeManagement.optimal++;
            else if (analysis.timeManagement.efficiency < 85) patterns.timeManagement.tooFast++;
            else if (analysis.timeManagement.efficiency > 105) patterns.timeManagement.tooSlow++;
            
            if (analysis.stressAnalysis.responseType === 'positive') patterns.stressResponse.positive++;
            else if (analysis.stressAnalysis.responseType === 'negative') patterns.stressResponse.negative++;
            else patterns.stressResponse.neutral++;
        });
        
        // Calcular porcentajes
        const totalStudents = Object.keys(studentResults).length;
        if (totalStudents > 0) {
            patterns.fatigue.percentage = (patterns.fatigue.affected / totalStudents * 100).toFixed(1);
            patterns.rushing.percentage = (patterns.rushing.affected / totalStudents * 100).toFixed(1);
            patterns.abandonment.percentage = (patterns.abandonment.affected / totalStudents * 100).toFixed(1);
        }
        
        return patterns;
    }

    // =====================================================
    // MÉTODOS DE ANÁLISIS DE PATRONES INDIVIDUALES
    // =====================================================

    analyzeStudentPatterns(results) {
        return {
            patterns: {
                fatigue: this.detectFatiguePattern(results),
                rushing: this.detectRushPattern(results),
                abandonment: this.detectAbandonmentPattern(results)
            },
            timeManagement: this.analyzeTimeManagement(results),
            stressAnalysis: this.analyzeStressImpact(results)
        };
    }

    /**
     * Analiza patrones de respuesta del estudiante para detectar problemas específicos
     */
    async analyzeResponsePatterns(student, results) {
        if (!results || results.length < 2) {
            return {
                hasEnoughData: false,
                patterns: {}
            };
        }
        
        const patterns = {
            // 1. Patrón de fatiga: ¿El rendimiento empeora hacia el final del examen?
            fatigue: this.detectFatiguePattern(results),
            
            // 2. Patrón de abandono: ¿Deja muchas preguntas sin contestar?
            abandonment: this.detectAbandonmentPattern(results),
            
            // 3. Patrón de prisa: ¿Termina muy rápido comprometiendo calidad?
            rushing: this.detectRushPattern(results),
            
            // 4. Patrón de temas débiles: ¿Falla consistentemente en ciertos temas?
            topicWeakness: this.analyzeTopicFailures(results),
            
            // 5. Patrón de confianza: ¿Su confianza se alinea con su rendimiento?
            confidenceAlignment: this.analyzeConfidenceAccuracy(results),
            
            // 6. Patrón de estrés: ¿Cómo afecta el estrés a su rendimiento?
            stressImpact: this.analyzeStressImpact(results)
        };
        
        return {
            hasEnoughData: true,
            patterns: patterns,
            summary: this.generatePatternSummary(patterns),
            recommendations: this.generatePatternRecommendations(patterns)
        };
    }

    detectFatiguePattern(results) {
        if (results.length < 2) return { detected: false };
        
        const timeErrorData = results.map(r => ({
            time: r.time_taken || 0,
            errorRate: r.wrong_answers / (r.correct_answers + r.wrong_answers) || 0
        }));
        
        const correlation = this.calculateCorrelation(
            timeErrorData.map(d => d.time),
            timeErrorData.map(d => d.errorRate)
        );
        
        return {
            detected: correlation > 0.3,
            severity: correlation > 0.5 ? 'high' : correlation > 0.3 ? 'medium' : 'low',
            correlation: parseFloat(correlation.toFixed(3)),
            recommendation: correlation > 0.3 ? 
                'Se detecta fatiga mental. Considerar pausas estratégicas durante el examen.' : null
        };
    }

    detectRushPattern(results) {
        const avgTime = results.reduce((sum, r) => sum + (r.time_taken || 0), 0) / results.length;
        const rushResults = results.filter(r => r.time_taken && r.time_taken < avgTime * 0.8);
        
        if (rushResults.length === 0) {
            return { detected: false };
        }
        
        const rushAvgScore = rushResults.reduce((sum, r) => sum + r.score, 0) / rushResults.length;
        const normalResults = results.filter(r => r.time_taken && r.time_taken >= avgTime * 0.8);
        const normalAvgScore = normalResults.length > 0 ?
            normalResults.reduce((sum, r) => sum + r.score, 0) / normalResults.length : 0;
        
        const scoreDifference = normalAvgScore - rushAvgScore;
        
        return {
            detected: scoreDifference > 0.5,
            impact: parseFloat(scoreDifference.toFixed(2)),
            frequency: (rushResults.length / results.length) * 100,
            recommendation: scoreDifference > 0.5 ?
                `Perdes ${scoreDifference.toFixed(2)} puntos de media cuando te apresuras.` : null
        };
    }

    detectAbandonmentPattern(results) {
        const avgBlanks = results.reduce((sum, r) => sum + (r.blank_answers || 0), 0) / results.length;
        const trend = this.calculateTrend(results.map(r => r.blank_answers || 0));
        
        return {
            detected: avgBlanks > 15,
            averageBlanks: parseFloat(avgBlanks.toFixed(1)),
            trend: parseFloat(trend.toFixed(3)),
            severity: avgBlanks > 25 ? 'critical' : avgBlanks > 15 ? 'high' : 'normal',
            recommendation: avgBlanks > 15 ?
                'Alto número de preguntas sin responder. Practicar gestión del tiempo.' : null
        };
    }

    analyzeTopicFailures(results) {
        const topicFrequency = {};
        let totalMentions = 0;
        
        results.forEach(result => {
            if (result.weakest_topics && Array.isArray(result.weakest_topics)) {
                result.weakest_topics.forEach(topic => {
                    topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
                    totalMentions++;
                });
            }
        });
        
        // Identificar temas persistentemente problemáticos
        const persistentWeaknesses = Object.entries(topicFrequency)
            .filter(([topic, count]) => count >= results.length * 0.3) // Aparece en 30% o más
            .sort(([,a], [,b]) => b - a);
        
        return {
            detected: persistentWeaknesses.length > 0,
            persistentTopics: persistentWeaknesses.map(([topic, count]) => ({
                topic: topic,
                frequency: count / results.length,
                severity: 'high'
            })),
            totalUniqueWeaknesses: Object.keys(topicFrequency).length,
            message: persistentWeaknesses.length > 0 ?
                `Debilidades persistentes en: ${persistentWeaknesses.slice(0, 3).map(([t]) => t).join(', ')}` :
                'No hay patrones claros de debilidad en temas específicos'
        };
    }

    analyzeConfidenceAccuracy(results) {
        const confidenceData = results.filter(r => r.confidence_score !== null);
        
        if (confidenceData.length < 2) {
            return { hasData: false };
        }
        
        const correlation = this.calculateCorrelation(
            confidenceData.map(r => r.confidence_score),
            confidenceData.map(r => r.score)
        );
        
        return {
            hasData: true,
            correlation: parseFloat(correlation.toFixed(3)),
            isWellCalibrated: Math.abs(correlation) > 0.6,
            tendency: correlation < -0.3 ? 'overconfident' : correlation > 0.3 ? 'underconfident' : 'balanced'
        };
    }

    analyzeTimeManagement(results) {
        const timeTaken = results.map(r => r.time_taken || 0).filter(t => t > 0);
        
        if (timeTaken.length === 0) {
            return { hasData: false };
        }
        
        const avgTime = timeTaken.reduce((sum, t) => sum + t, 0) / timeTaken.length;
        const timeInMinutes = avgTime / 60;
        const optimalTime = 95;
        const timeEfficiency = Math.min(100, (timeInMinutes / optimalTime) * 100);
        
        return {
            hasData: true,
            averageMinutes: parseFloat(timeInMinutes.toFixed(1)),
            efficiency: parseFloat(timeEfficiency.toFixed(1)),
            isOptimal: timeInMinutes >= 85 && timeInMinutes <= 105,
            recommendation: timeInMinutes < 85 ? 
                'Tiempo insuficiente. Riesgo de errores.' :
                timeInMinutes > 105 ? 'Demasiado tiempo. Practicar agilidad.' : 
                'Gestión del tiempo adecuada.'
        };
    }

    analyzeStressImpact(results) {
        const stressData = results.filter(r => r.stress_level !== null);
        
        if (stressData.length < 2) {
            return { hasData: false, responseType: 'neutral' };
        }
        
        const correlation = this.calculateCorrelation(
            stressData.map(r => r.stress_level),
            stressData.map(r => r.score)
        );
        
        let responseType = 'neutral';
        if (correlation < -0.3) responseType = 'negative';
        else if (correlation > 0.2) responseType = 'positive';
        
        return {
            hasData: true,
            correlation: parseFloat(correlation.toFixed(3)),
            responseType,
            optimalLevel: this.findOptimalStressLevel(stressData),
            recommendation: responseType === 'negative' ?
                'El estrés afecta negativamente tu rendimiento. Practicar técnicas de relajación.' : null
        };
    }

    generatePatternSummary(patterns) {
        const issues = [];
        
        if (patterns.fatigue?.detected) issues.push('fatiga mental');
        if (patterns.rushing?.detected) issues.push('precipitación');
        if (patterns.abandonment?.detected) issues.push('abandono excesivo');
        if (patterns.stressImpact?.responseType === 'negative') issues.push('gestión del estrés');
        
        if (issues.length === 0) {
            return 'No se detectan patrones problemáticos significativos';
        }
        
        return `Patrones detectados: ${issues.join(', ')}`;
    }

    generatePatternRecommendations(patterns) {
        const recommendations = [];
        
        if (patterns.fatigue?.detected) {
            recommendations.push({
                type: 'fatigue',
                priority: patterns.fatigue.severity === 'high' ? 'alta' : 'media',
                action: 'Gestión de la fatiga',
                details: patterns.fatigue.recommendation
            });
        }
        
        if (patterns.rushing?.detected) {
            recommendations.push({
                type: 'rushing',
                priority: 'alta',
                action: 'Control del ritmo',
                details: patterns.rushing.recommendation
            });
        }
        
        if (patterns.abandonment?.detected) {
            recommendations.push({
                type: 'abandonment',
                priority: patterns.abandonment.severity === 'critical' ? 'alta' : 'media',
                action: 'Gestión del tiempo',
                details: patterns.abandonment.recommendation
            });
        }
        
        if (patterns.stressImpact?.responseType === 'negative') {
            recommendations.push({
                type: 'stress',
                priority: 'media',
                action: 'Manejo del estrés',
                details: patterns.stressImpact.recommendation
            });
        }
        
        return recommendations;
    }

    // =====================================================
    // MÉTODOS DE ANÁLISIS INDIVIDUAL
    // =====================================================

    calculateWeightedAverage(results) {
        if (results.length === 0) return 0;
        
        // Dar más peso a resultados recientes
        const weights = results.map((_, index) => Math.exp(-index * 0.1));
        const weightSum = weights.reduce((a, b) => a + b, 0);
        
        const weightedSum = results.reduce((sum, result, index) => 
            sum + result.score * weights[index], 0
        );
        
        return weightedSum / weightSum;
    }

    analyzeTrend(results) {
        if (results.length < 3) {
            return { direction: 'neutral', confidence: 0 };
        }
        
        const scores = results.map(r => r.score);
        const x = scores.map((_, i) => i);
        const regression = this.calculateLinearRegression(x, scores);
        
        let direction = 'stable';
        if (regression.slope > 0.1) direction = 'up';
        else if (regression.slope < -0.1) direction = 'down';
        
        return {
            direction,
            slope: regression.slope,
            confidence: Math.abs(regression.r2 * 100),
            projection: this.projectNextScore(results)
        };
    }

    analyzeIndividualRisk(student, results) {
        const factors = {
            avgScore: student.average_score || 0,
            participation: student.total_simulations || 0,
            consistency: this.calculateConsistency(results),
            trend: student.trend_direction || 'neutral',
            probability: student.probability_pass || 50
        };
        
        let riskScore = 0;
        
        // Evaluar cada factor
        if (factors.avgScore < 6) riskScore += 30;
        if (factors.participation < 3) riskScore += 20;
        if (factors.consistency > 2) riskScore += 15;
        if (factors.trend === 'down') riskScore += 20;
        if (factors.probability < 50) riskScore += 15;
        
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
        if (patterns.hasEnoughData) {
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
        
        // Recomendaciones basadas en participación
        if (student.total_simulations < 5) {
            recommendations.push({
                priority: 'media',
                category: 'participation',
                action: 'Aumentar frecuencia de práctica',
                details: 'Realizar al menos un simulacro semanal'
            });
        }
        
        // Ordenar por prioridad
        recommendations.sort((a, b) => {
            const priority = { 'alta': 3, 'media': 2, 'baja': 1 };
            return priority[b.priority] - priority[a.priority];
        });
        
        return recommendations.slice(0, 5); // Máximo 5 recomendaciones
    }

    getDefaultStudentMetrics() {
        return {
            weighted_average: 0,
            consistency_coefficient: 0,
            z_score: 0,
            percentile: 50,
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
            probability_details: { confidence: { margin: 10 } }
        };
    }

    // =====================================================
    // MÉTODOS DE CÁLCULO Y UTILIDADES
    // =====================================================

    calculateCorrelation(x, y) {
        const n = x.length;
        if (n !== y.length || n < 2) return 0;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const num = n * sumXY - sumX * sumY;
        const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return den === 0 ? 0 : num / den;
    }

    calculateLinearRegression(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const yMean = sumY / n;
        const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const ssResidual = y.reduce((sum, yi, i) => {
            const predicted = slope * x[i] + intercept;
            return sum + Math.pow(yi - predicted, 2);
        }, 0);
        
        const r2 = 1 - (ssResidual / ssTotal);
        
        return { slope, intercept, r2 };
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        const x = values.map((_, i) => i);
        const regression = this.calculateLinearRegression(x, values);
        return regression.slope;
    }

    calculateConsistency(results) {
        if (results.length < 3) return 0;
        
        const scores = results.slice(0, 10).map(r => r.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
        
        return Math.sqrt(variance);
    }

    calculateZScore(score) {
        // Basado en distribución histórica CNP
        const mean = 6.5;
        const stdDev = 1.5;
        return (score - mean) / stdDev;
    }

    calculatePercentile(score) {
        // Aproximación basada en distribución normal
        const z = this.calculateZScore(score);
        const percentile = 50 + (z * 33.33); // Simplificado
        return Math.max(0, Math.min(100, Math.round(percentile)));
    }

    calculateParticipationRate(results) {
        const uniqueUsers = new Set(results.map(r => r.user_id)).size;
        const totalStudents = this.dashboard.data.students.length;
        return totalStudents > 0 ? (uniqueUsers / totalStudents * 100).toFixed(1) : 0;
    }

    calculateAverageTimeSpent(results) {
        const times = results.map(r => r.time_taken || 0).filter(t => t > 0);
        if (times.length === 0) return 0;
        return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length / 60);
    }

    analyzeOverallStressImpact(results) {
        const stressData = results.filter(r => r.stress_level !== null);
        if (stressData.length < 10) {
            return { correlation: 0, type: 'insufficient_data' };
        }
        
        const correlation = this.calculateCorrelation(
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

    findOptimalStressLevel(stressData) {
        const levels = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        let bestLevel = 50;
        let bestScore = 0;
        
        levels.forEach(level => {
            const nearLevel = stressData.filter(r => 
                Math.abs(r.stress_level - level) < 10
            );
            if (nearLevel.length > 0) {
                const avgScore = nearLevel.reduce((sum, r) => sum + r.score, 0) / nearLevel.length;
                if (avgScore > bestScore) {
                    bestScore = avgScore;
                    bestLevel = level;
                }
            }
        });
        
        return bestLevel;
    }

    // =====================================================
    // MÉTODOS DE RENDERIZADO
    // =====================================================

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
                <div class="stat-detail">σ = ${stats.stdDev}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Mediana</div>
                <div class="stat-value">${stats.median}/10</div>
                <div class="stat-detail">P25: ${stats.percentiles.p25} | P75: ${stats.percentiles.p75}</div>
            </div>
            <div class="stat-box ${stats.cutoffDistance < 0 ? 'danger' : 'success'}">
                <div class="stat-label">Distancia a Nota de Corte</div>
                <div class="stat-value">${stats.cutoffDistance > 0 ? '+' : ''}${stats.cutoffDistance.toFixed(2)}</div>
                <div class="stat-detail">Corte histórico: ${this.cnpConfig.historicalCutoff}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Participación</div>
                <div class="stat-value">${stats.participationRate}%</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Tiempo Promedio</div>
                <div class="stat-value">${stats.averageTimeSpent} min</div>
            </div>
        `;
    }

    renderPatternsAnalysis(patterns) {
        const grid = document.getElementById('patternsGrid');
        grid.innerHTML = `
            <div class="pattern-card ${patterns.fatigue.percentage > 30 ? 'warning' : ''}">
                <h4>😴 Fatiga Mental</h4>
                <div class="pattern-stat">${patterns.fatigue.percentage}%</div>
                <div class="pattern-detail">${patterns.fatigue.affected} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.rushing.percentage > 25 ? 'warning' : ''}">
                <h4>⚡ Precipitación</h4>
                <div class="pattern-stat">${patterns.rushing.percentage}%</div>
                <div class="pattern-detail">${patterns.rushing.affected} estudiantes afectados</div>
            </div>
            <div class="pattern-card ${patterns.abandonment.percentage > 20 ? 'danger' : ''}">
                <h4>❌ Abandono Excesivo</h4>
                <div class="pattern-stat">${patterns.abandonment.percentage}%</div>
                <div class="pattern-detail">${patterns.abandonment.affected} estudiantes afectados</div>
            </div>
            <div class="pattern-card">
                <h4>⏱️ Gestión del Tiempo</h4>
                <div class="time-distribution">
                    <div>Óptimo: ${patterns.timeManagement.optimal}</div>
                    <div>Muy rápido: ${patterns.timeManagement.tooFast}</div>
                    <div>Muy lento: ${patterns.timeManagement.tooSlow}</div>
                </div>
            </div>
        `;
    }

    renderDetailedPredictiveAnalysis(predictions) {
        const container = document.getElementById('predictiveAnalysisDetailed');
        container.innerHTML = `
            <div class="predictions-grid">
                <div class="prediction-card">
                    <h4>Proyección de Aprobados</h4>
                    <div class="prediction-number">${predictions.projectedPass}</div>
                    <div class="prediction-percentage">${predictions.passRate}%</div>
                    <div class="prediction-detail">de ${predictions.totalActive} estudiantes activos</div>
                </div>
                <div class="prediction-card">
                    <h4>En Zona de Riesgo</h4>
                    <div class="prediction-number danger">${predictions.atRisk}</div>
                    <div class="prediction-detail">Probabilidad < 50%</div>
                </div>
                <div class="prediction-card">
                    <h4>En el Límite</h4>
                    <div class="prediction-number warning">${predictions.borderline}</div>
                    <div class="prediction-detail">Entre 45% y 55%</div>
                </div>
                <div class="prediction-card">
                    <h4>Confianza Alta</h4>
                    <div class="prediction-number success">${predictions.highConfidence}</div>
                    <div class="prediction-detail">Probabilidad > 70%</div>
                </div>
            </div>
            <div class="prediction-insights">
                <h5>Factores Clave:</h5>
                <ul>
                    ${predictions.keyFactors.map(factor => `<li>${factor}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    generateAggregatedPredictions(students) {
        const activeStudents = students.filter(s => s.active);
        const projectedPass = activeStudents.filter(s => (s.probability_pass || 50) >= 50).length;
        const atRisk = activeStudents.filter(s => (s.probability_pass || 50) < 50).length;
        const borderline = activeStudents.filter(s => 
            (s.probability_pass || 50) >= 45 && (s.probability_pass || 50) < 55
        ).length;
        const highConfidence = activeStudents.filter(s => (s.probability_pass || 50) > 70).length;
        
        const keyFactors = [];
        
        // Identificar factores clave
        const avgProbability = activeStudents.reduce((sum, s) => 
            sum + (s.probability_pass || 50), 0) / activeStudents.length;
        
        if (avgProbability < 50) {
            keyFactors.push('La probabilidad media está por debajo del 50%');
        }
        
        const criticalCount = activeStudents.filter(s => (s.probability_pass || 50) < 30).length;
        if (criticalCount > activeStudents.length * 0.1) {
            keyFactors.push(`${criticalCount} estudiantes en situación crítica`);
        }
        
        const decliningCount = activeStudents.filter(s => s.trend_direction === 'down').length;
        if (decliningCount > activeStudents.length * 0.3) {
            keyFactors.push('Alto porcentaje con tendencia negativa');
        }
        
        const lowParticipation = activeStudents.filter(s => s.total_simulations < 3).length;
        if (lowParticipation > activeStudents.length * 0.2) {
            keyFactors.push(`${lowParticipation} estudiantes con baja participación`);
        }
        
        return {
            totalActive: activeStudents.length,
            projectedPass,
            passRate: activeStudents.length > 0 ? 
                (projectedPass / activeStudents.length * 100).toFixed(1) : 0,
            atRisk,
            borderline,
            highConfidence,
            keyFactors
        };
    }

    async analyzeStudentTrends(students, results) {
        const trends = [];
        
        for (const student of students) {
            const studentResults = results
                .filter(r => r.user_id === student.id)
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            
            if (studentResults.length >= 3) {
                const recent3 = studentResults.slice(0, 3);
                const scoreChange = recent3[0].score - recent3[2].score;
                
                const scores = recent3.map(r => r.score);
                const avg = scores.reduce((a, b) => a + b) / scores.length;
                const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
                const consistency = Math.sqrt(variance);
                
                const trend = scoreChange > 0 ? 'up' : scoreChange < 0 ? 'down' : 'stable';
                const prediction = this.predictNextScore(studentResults);
                
                trends.push({
                    student,
                    scoreChange,
                    consistency,
                    trend,
                    prediction,
                    eloChange: student.current_elo - 1000 // Cambio desde ELO inicial
                });
            }
        }
        
        // Ordenar por cambio de score
        trends.sort((a, b) => b.scoreChange - a.scoreChange);
        
        return trends;
    }

    predictNextScore(results) {
        if (results.length < 3) return results[0]?.score || 5;
        
        const recent = results.slice(0, 5).map(r => r.score);
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
        
        let prediction = 0;
        recent.forEach((score, i) => {
            if (i < weights.length) {
                prediction += score * weights[i];
            }
        });
        
        return Math.max(0, Math.min(10, prediction));
    }

    // =====================================================
    // MÉTODOS DE GRÁFICOS
    // =====================================================

    async renderScoresEvolution(data, compareCohorts) {
        const ctx = document.getElementById('scoresEvolutionChart').getContext('2d');
        
        if (this.charts.has('scores')) {
            this.charts.get('scores').destroy();
        }
        
        const weeklyData = this.groupByWeek(data.results);
        let datasets = [];
        
        if (compareCohorts) {
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

    async renderRiskDistribution(distribution) {
        const ctx = document.getElementById('riskDistributionChart').getContext('2d');
        
        if (this.charts.has('risk')) {
            this.charts.get('risk').destroy();
        }
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Crítico', 'Alto', 'Medio', 'Bajo'],
                datasets: [{
                    data: [
                        distribution.critical.count,
                        distribution.high.count,
                        distribution.medium.count,
                        distribution.low.count
                    ],
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
                                const label = context.label;
                                const value = context.parsed;
                                const percentage = distribution[label.toLowerCase()].percentage;
                                return `${label}: ${value} (${percentage}%)`;
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
        
        const eloByWeek = {};
        
        data.eloHistory.forEach(record => {
            const week = `S${record.week_number}`;
            if (!eloByWeek[week]) {
                eloByWeek[week] = { '20h': [], '36h': [], '48h': [] };
            }
            
            const user = data.students.find(s => s.id === record.user_id);
            if (user && eloByWeek[week][user.cohort]) {
                eloByWeek[week][user.cohort].push(record.elo_after);
            }
        });
        
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

    async generateInsights(analysis) {
        const insights = [];
        
        // Insight sobre distancia a nota de corte
        if (analysis.globalStats.cutoffDistance < 0) {
            insights.push({
                type: 'negative',
                title: 'Media por debajo de la nota de corte',
                message: `La media actual está ${Math.abs(analysis.globalStats.cutoffDistance).toFixed(2)} puntos por debajo del corte histórico`
            });
        } else {
            insights.push({
                type: 'positive',
                title: 'Media por encima de la nota de corte',
                message: `La media actual supera el corte histórico en ${analysis.globalStats.cutoffDistance.toFixed(2)} puntos`
            });
        }
        
        // Insight sobre patrones problemáticos
        if (analysis.patterns.fatigue.percentage > 30) {
            insights.push({
                type: 'warning',
                title: 'Alta incidencia de fatiga mental',
                message: `${analysis.patterns.fatigue.percentage}% de estudiantes muestran signos de fatiga durante los exámenes`
            });
        }
        
        // Insight sobre distribución de riesgo
        const criticalPercentage = parseFloat(analysis.riskDistribution.critical.percentage);
        if (criticalPercentage > 10) {
            insights.push({
                type: 'negative',
                title: 'Situación crítica',
                message: `${criticalPercentage}% de estudiantes en riesgo crítico de suspender`
            });
        }
        
        // Insight sobre participación
        if (analysis.globalStats.participationRate < 60) {
            insights.push({
                type: 'warning',
                title: 'Baja participación',
                message: `Solo el ${analysis.globalStats.participationRate}% de estudiantes están participando activamente`
            });
        }
        
        // Insight sobre tendencias
        if (analysis.decliningStudents > analysis.improvingStudents) {
            insights.push({
                type: 'warning',
                title: 'Tendencia general negativa',
                message: `Más estudiantes empeorando (${analysis.decliningStudents}) que mejorando (${analysis.improvingStudents})`
            });
        }
        
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

    async updateTrendsTable(trends) {
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

    // =====================================================
    // UTILIDADES
    // =====================================================

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
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
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

    destroy() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}