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
                    
                    <!-- Análisis predictivo -->
                    <div class="predictive-analysis-section">
                        <h3>🎯 Análisis Predictivo</h3>
                        <div id="predictiveAnalysis">
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
        
        // Renderizar estadísticas globales
        this.renderGlobalStats(analysis.globalStats);
        
        // Renderizar gráficos
        await this.renderScoresEvolution(data, compareCohorts);
        await this.renderRiskDistribution(analysis.riskDistribution);
        await this.renderParticipationPattern(data);
        await this.renderEloProgression(data, compareCohorts);
        
        // Renderizar análisis de patrones
        this.renderPatternsAnalysis(analysis.patterns);
        
        // Renderizar análisis predictivo
        this.renderPredictiveAnalysis(analysis.predictions);
        
        // Generar insights
        await this.generateInsights(analysis);
        
        // Actualizar tabla de tendencias
        await this.updateTrendsTable(analysis.studentTrends);
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
                users!inner(id, slug, username, email, cohort, current_elo)
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
        
        return {
            globalStats,
            riskDistribution,
            patterns,
            predictions,
            studentTrends
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
            
            if (analysis.patterns.fatigue.detected) patterns.fatigue.affected++;
            if (analysis.patterns.rushing.detected) patterns.rushing.affected++;
            if (analysis.patterns.abandonment) patterns.abandonment.affected++;
            
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
            severity: avgBlanks > 25 ? 'critical' : avgBlanks > 15 ? 'high' : 'normal'
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
            optimalLevel: this.findOptimalStressLevel(stressData)
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

    renderPredictiveAnalysis(predictions) {
        const container = document.getElementById('predictiveAnalysis');
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
                
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                
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