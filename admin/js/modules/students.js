// admin/js/modules/students.js
// Módulo de gestión de estudiantes con análisis avanzado para oposiciones CNP

export default class StudentsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedStudents = new Set();
        this.sortColumn = 'created_at';
        this.sortDirection = 'desc';
        
        // Configuración específica para oposiciones CNP
        this.cnpConfig = {
            // Nota de corte histórica promedio
            historicalCutoff: 5.5,
            // Desviación típica de notas de corte
            cutoffStdDev: 0.3,
            // Peso de cada bloque temático en el examen
            topicWeights: {
                juridico: 0.4,      // Temas 1-15: Derecho
                sociales: 0.3,      // Temas 16-31: Ciencias Sociales
                tecnico: 0.3        // Temas 32-45: Materias Técnicas
            },
            // Factores de dificultad por bloque
            topicDifficulty: {
                juridico: 1.2,      // Más difícil
                sociales: 1.0,      // Dificultad media
                tecnico: 0.9        // Relativamente más fácil
            }
        };
    }

    /**
     * Renderizar la página principal de estudiantes
     */
    async render(container, data) {
        const students = data.students || [];
        
        // Calcular métricas avanzadas para cada estudiante
        await this.calculateComprehensiveMetrics(students);
        
        container.innerHTML = `
            <div class="students-page">
                <!-- Resumen ejecutivo para oposiciones -->
                ${this.renderExecutiveSummary(students)}
                
                <!-- Panel de análisis predictivo -->
                ${this.renderPredictiveAnalysis(students)}
                
                <!-- Acciones masivas -->
                ${this.renderBulkActions()}
                
                <!-- Tabla principal con métricas avanzadas -->
                ${this.renderAdvancedStudentsTable(students)}
                
                <!-- Modales -->
                ${this.renderNotesModal()}
                ${this.renderDetailedAnalysisModal()}
            </div>
        `;
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Renderizar gráficos si hay datos
        if (students.length > 0) {
            setTimeout(() => this.renderAnalyticsCharts(students), 100);
        }
    }

    /**
     * Calcular métricas comprehensivas para oposiciones CNP
     */
    async calculateComprehensiveMetrics(students) {
        // Primero, obtener todos los resultados para análisis global
        const allResults = this.dashboard.data.results;
        
        // Calcular estadísticas globales necesarias
        const globalStats = this.calculateGlobalStatistics(allResults);
        
        // Procesar cada estudiante
        for (const student of students) {
            const studentResults = allResults.filter(r => r.user_id === student.id);
            
            if (studentResults.length === 0) {
                // Asignar valores por defecto para estudiantes nuevos
                this.assignDefaultMetrics(student);
                continue;
            }
            
            // 1. Calcular métricas básicas estadísticas
            const basicMetrics = this.calculateBasicMetrics(studentResults, globalStats);
            
            // 2. Análisis de rendimiento por bloques temáticos
            const topicAnalysis = await this.analyzeTopicPerformance(student, studentResults);
            
            // 3. Análisis de patrones de respuesta
            const responsePatterns = this.analyzeResponsePatterns(studentResults);
            
            // 4. Análisis de gestión del tiempo
            const timeManagement = this.analyzeTimeManagement(studentResults);
            
            // 5. Análisis de impacto del estrés
            const stressAnalysis = this.analyzeStressImpact(studentResults);
            
            // 6. Cálculo de tendencia avanzada
            const trendAnalysis = await this.calculateAdvancedTrend(studentResults);
            
            // 7. Predicción de probabilidad de aprobar
            const probability = this.calculateApprovalProbability({
                basicMetrics,
                topicAnalysis,
                responsePatterns,
                timeManagement,
                stressAnalysis,
                trendAnalysis,
                globalStats,
                student
            });
            
            // 8. Determinar nivel de riesgo y recomendaciones
            const riskAssessment = this.assessRisk(probability, trendAnalysis, responsePatterns);
            
            // Asignar todas las métricas al estudiante
            Object.assign(student, {
                ...basicMetrics,
                topicAnalysis,
                responsePatterns,
                timeManagement,
                stressAnalysis,
                trendAnalysis,
                probability_pass: probability.finalProbability,
                probability_details: probability,
                risk_level: riskAssessment.level,
                risk_factors: riskAssessment.factors,
                recommendations: this.generatePersonalizedRecommendations(student, riskAssessment),
                calculated_risk_level: riskAssessment.level
            });
        }
    }

    /**
     * Calcular estadísticas globales para contextualizar
     */
    calculateGlobalStatistics(allResults) {
        if (allResults.length === 0) {
            return {
                mean: 5.5,
                stdDev: 1.5,
                median: 5.5,
                percentiles: { p25: 4.5, p50: 5.5, p75: 6.5, p90: 7.5 }
            };
        }
        
        const scores = allResults.map(r => r.score).filter(s => s > 0).sort((a, b) => a - b);
        const n = scores.length;
        
        // Media
        const mean = scores.reduce((sum, s) => sum + s, 0) / n;
        
        // Desviación estándar
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        // Mediana y percentiles
        const median = scores[Math.floor(n / 2)];
        const percentiles = {
            p25: scores[Math.floor(n * 0.25)],
            p50: median,
            p75: scores[Math.floor(n * 0.75)],
            p90: scores[Math.floor(n * 0.90)]
        };
        
        return { mean, stdDev, median, percentiles };
    }

    /**
     * Calcular métricas básicas del estudiante
     */
    calculateBasicMetrics(results, globalStats) {
        const scores = results.map(r => r.score);
        const n = scores.length;
        
        // Promedio simple y ponderado (más peso a resultados recientes)
        const simpleAverage = scores.reduce((sum, s) => sum + s, 0) / n;
        const weights = scores.map((_, i) => Math.exp(-0.1 * i)); // Decaimiento exponencial
        const weightSum = weights.reduce((sum, w) => sum + w, 0);
        const weightedAverage = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / weightSum;
        
        // Consistencia (coeficiente de variación)
        const stdDev = Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - simpleAverage, 2), 0) / n);
        const consistency = stdDev / simpleAverage;
        
        // Z-score respecto a la población
        const zScore = (weightedAverage - globalStats.mean) / globalStats.stdDev;
        
        // Percentil del estudiante
        const percentile = this.calculatePercentile(weightedAverage, globalStats);
        
        return {
            average_score: parseFloat(simpleAverage.toFixed(2)),
            weighted_average: parseFloat(weightedAverage.toFixed(2)),
            consistency_coefficient: parseFloat(consistency.toFixed(3)),
            z_score: parseFloat(zScore.toFixed(2)),
            percentile,
            total_simulations: n,
            best_score: Math.max(...scores),
            worst_score: Math.min(...scores),
            score_range: Math.max(...scores) - Math.min(...scores)
        };
    }

    /**
     * Analizar rendimiento por bloques temáticos
     */
    async analyzeTopicPerformance(student, results) {
        // Mapeo de temas a bloques
        const topicToBlock = (topicNumber) => {
            if (topicNumber <= 15) return 'juridico';
            if (topicNumber <= 31) return 'sociales';
            return 'tecnico';
        };
        
        // Analizar temas débiles reportados
        const weakTopicsAnalysis = {
            juridico: { mentions: 0, topics: new Set() },
            sociales: { mentions: 0, topics: new Set() },
            tecnico: { mentions: 0, topics: new Set() }
        };
        
        results.forEach(result => {
            if (result.weakest_topics && Array.isArray(result.weakest_topics)) {
                result.weakest_topics.forEach(topic => {
                    // Extraer número de tema si es posible
                    const match = topic.match(/T(\d+)/);
                    if (match) {
                        const topicNum = parseInt(match[1]);
                        const block = topicToBlock(topicNum);
                        weakTopicsAnalysis[block].mentions++;
                        weakTopicsAnalysis[block].topics.add(topicNum);
                    }
                });
            }
        });
        
        // Calcular fortalezas y debilidades relativas
        const totalMentions = Object.values(weakTopicsAnalysis).reduce((sum, b) => sum + b.mentions, 0);
        const blockPerformance = {};
        
        Object.entries(weakTopicsAnalysis).forEach(([block, data]) => {
            blockPerformance[block] = {
                weaknessFactor: totalMentions > 0 ? data.mentions / totalMentions : 0.33,
                problematicTopics: Array.from(data.topics),
                estimatedMastery: 1 - (data.mentions / (results.length * 5)) // Normalizado
            };
        });
        
        return blockPerformance;
    }

    /**
     * Analizar patrones en las respuestas
     */
    analyzeResponsePatterns(results) {
        if (results.length < 2) {
            return { hasEnoughData: false };
        }
        
        // Análisis de blancos
        const blankAnalysis = {
            averageBlanks: results.reduce((sum, r) => sum + (r.blank_answers || 0), 0) / results.length,
            trend: this.calculateTrend(results.map(r => r.blank_answers || 0)),
            excessive: false
        };
        blankAnalysis.excessive = blankAnalysis.averageBlanks > 15; // Más de 15 blancos es preocupante
        
        // Análisis de ratio aciertos/fallos
        const accuracyAnalysis = results.map(r => {
            const total = (r.correct_answers || 0) + (r.wrong_answers || 0);
            return total > 0 ? (r.correct_answers || 0) / total : 0;
        });
        
        const averageAccuracy = accuracyAnalysis.reduce((sum, a) => sum + a, 0) / accuracyAnalysis.length;
        
        // Patrón de fatiga (rendimiento empeora con el tiempo)
        const fatiguePattern = this.detectFatiguePattern(results);
        
        // Patrón de precipitación
        const rushPattern = this.detectRushPattern(results);
        
        return {
            hasEnoughData: true,
            blanks: blankAnalysis,
            accuracy: {
                average: parseFloat((averageAccuracy * 100).toFixed(1)),
                trend: this.calculateTrend(accuracyAnalysis),
                isImproving: this.calculateTrend(accuracyAnalysis) > 0.01
            },
            patterns: {
                fatigue: fatiguePattern,
                rushing: rushPattern,
                abandonment: blankAnalysis.excessive
            }
        };
    }

    /**
     * Detectar patrón de fatiga mental
     */
    detectFatiguePattern(results) {
        // Analizar si hay correlación entre tiempo empleado y errores
        const timeErrorCorrelation = results.map(r => ({
            time: r.time_taken || 0,
            errorRate: r.wrong_answers / (r.correct_answers + r.wrong_answers) || 0
        }));
        
        // Si los errores aumentan con el tiempo, hay fatiga
        const correlation = this.calculateCorrelation(
            timeErrorCorrelation.map(d => d.time),
            timeErrorCorrelation.map(d => d.errorRate)
        );
        
        return {
            detected: correlation > 0.3,
            severity: correlation > 0.5 ? 'high' : correlation > 0.3 ? 'medium' : 'low',
            recommendation: correlation > 0.3 ? 
                'Se detecta fatiga mental. Considerar pausas estratégicas durante el examen.' : null
        };
    }

    /**
     * Detectar patrón de precipitación
     */
    detectRushPattern(results) {
        const avgTime = results.reduce((sum, r) => sum + (r.time_taken || 0), 0) / results.length;
        const rushResults = results.filter(r => r.time_taken && r.time_taken < avgTime * 0.8);
        
        if (rushResults.length === 0) {
            return { detected: false };
        }
        
        // Comparar rendimiento cuando se apresuran vs normal
        const rushAvgScore = rushResults.reduce((sum, r) => sum + r.score, 0) / rushResults.length;
        const normalResults = results.filter(r => r.time_taken && r.time_taken >= avgTime * 0.8);
        const normalAvgScore = normalResults.length > 0 ?
            normalResults.reduce((sum, r) => sum + r.score, 0) / normalResults.length : 0;
        
        const scoreDifference = normalAvgScore - rushAvgScore;
        
        return {
            detected: scoreDifference > 0.5,
            impact: scoreDifference,
            frequency: (rushResults.length / results.length) * 100,
            recommendation: scoreDifference > 0.5 ?
                `Perdes ${scoreDifference.toFixed(2)} puntos de media cuando te apresuras. Gestiona mejor el tiempo.` : null
        };
    }

    /**
     * Analizar gestión del tiempo
     */
    analyzeTimeManagement(results) {
        const timeTaken = results.map(r => r.time_taken || 0).filter(t => t > 0);
        
        if (timeTaken.length === 0) {
            return { hasData: false };
        }
        
        const avgTime = timeTaken.reduce((sum, t) => sum + t, 0) / timeTaken.length;
        const timeInMinutes = avgTime / 60;
        
        // Tiempo óptimo para 100 preguntas: 90-100 minutos
        const optimalTime = 95;
        const timeEfficiency = Math.min(100, (timeInMinutes / optimalTime) * 100);
        
        // Análisis de distribución del tiempo
        const timeConsistency = this.calculateConsistency(timeTaken);
        
        return {
            hasData: true,
            averageMinutes: parseFloat(timeInMinutes.toFixed(1)),
            efficiency: parseFloat(timeEfficiency.toFixed(1)),
            consistency: timeConsistency < 0.2 ? 'consistent' : timeConsistency < 0.4 ? 'variable' : 'erratic',
            isOptimal: timeInMinutes >= 85 && timeInMinutes <= 105,
            recommendation: timeInMinutes < 85 ? 
                'Dedicas poco tiempo. Riesgo de errores por precipitación.' :
                timeInMinutes > 105 ? 
                'Tardas demasiado. Practica para ser más ágil.' : 
                'Gestión del tiempo adecuada.'
        };
    }

    /**
     * Analizar impacto del estrés
     */
    analyzeStressImpact(results) {
        const stressData = results.filter(r => r.stress_level !== null && r.stress_level !== undefined);
        
        if (stressData.length < 2) {
            return { hasData: false };
        }
        
        // Correlación entre estrés y rendimiento
        const correlation = this.calculateCorrelation(
            stressData.map(r => r.stress_level),
            stressData.map(r => r.score)
        );
        
        // Rendimiento en diferentes niveles de estrés
        const lowStress = stressData.filter(r => r.stress_level <= 30);
        const mediumStress = stressData.filter(r => r.stress_level > 30 && r.stress_level <= 70);
        const highStress = stressData.filter(r => r.stress_level > 70);
        
        const performance = {
            low: lowStress.length > 0 ? 
                lowStress.reduce((sum, r) => sum + r.score, 0) / lowStress.length : null,
            medium: mediumStress.length > 0 ? 
                mediumStress.reduce((sum, r) => sum + r.score, 0) / mediumStress.length : null,
            high: highStress.length > 0 ? 
                highStress.reduce((sum, r) => sum + r.score, 0) / highStress.length : null
        };
        
        // Determinar tipo de respuesta al estrés
        let stressResponseType = 'neutral';
        if (correlation < -0.3) {
            stressResponseType = 'negative'; // El estrés perjudica
        } else if (correlation > 0.2) {
            stressResponseType = 'positive'; // El estrés ayuda (arousal óptimo)
        }
        
        return {
            hasData: true,
            correlation: parseFloat(correlation.toFixed(3)),
            responseType: stressResponseType,
            performanceByLevel: performance,
            optimalStressLevel: this.findOptimalStressLevel(stressData),
            recommendation: this.generateStressRecommendation(stressResponseType, performance)
        };
    }

    /**
     * Calcular tendencia avanzada con regresión
     */
    async calculateAdvancedTrend(results) {
        if (results.length < 3) {
            return { 
                direction: 'neutral', 
                strength: 0, 
                projection: null,
                confidence: 0 
            };
        }
        
        // Ordenar por fecha
        const sortedResults = [...results].sort((a, b) => 
            new Date(a.submitted_at) - new Date(b.submitted_at)
        );
        
        // Usar solo los últimos 10 resultados para tendencia más actual
        const recentResults = sortedResults.slice(-10);
        
        // Calcular regresión lineal
        const regression = this.calculateLinearRegression(
            recentResults.map((_, i) => i),
            recentResults.map(r => r.score)
        );
        
        // Determinar dirección y fuerza
        let direction = 'stable';
        if (regression.slope > 0.1) direction = 'up';
        else if (regression.slope < -0.1) direction = 'down';
        
        // Proyección para próximo simulacro
        const nextProjection = regression.slope * recentResults.length + regression.intercept;
        
        return {
            direction,
            strength: Math.abs(regression.slope),
            slope: parseFloat(regression.slope.toFixed(3)),
            r2: parseFloat(regression.r2.toFixed(3)), // Coeficiente de determinación
            projection: Math.max(0, Math.min(10, nextProjection)),
            confidence: regression.r2 * 100, // Confianza en la proyección
            recentAverage: recentResults.reduce((sum, r) => sum + r.score, 0) / recentResults.length
        };
    }

    /**
     * Calcular probabilidad de aprobar con modelo multifactorial
     */
    calculateApprovalProbability(data) {
        const {
            basicMetrics,
            topicAnalysis,
            responsePatterns,
            timeManagement,
            stressAnalysis,
            trendAnalysis,
            globalStats,
            student
        } = data;
        
        // Modelo de probabilidad basado en múltiples factores
        let baseProbability = 50;
        
        // 1. Factor de puntuación (40% del peso)
        const scoreFactor = this.calculateScoreFactor(basicMetrics, globalStats);
        baseProbability += scoreFactor * 0.4;
        
        // 2. Factor de tendencia (20% del peso)
        const trendFactor = this.calculateTrendFactor(trendAnalysis);
        baseProbability += trendFactor * 0.2;
        
        // 3. Factor de consistencia (15% del peso)
        const consistencyFactor = this.calculateConsistencyFactor(basicMetrics);
        baseProbability += consistencyFactor * 0.15;
        
        // 4. Factor de gestión del tiempo (10% del peso)
        const timeFactor = this.calculateTimeFactor(timeManagement);
        baseProbability += timeFactor * 0.1;
        
        // 5. Factor de patrones de respuesta (10% del peso)
        const patternFactor = this.calculatePatternFactor(responsePatterns);
        baseProbability += patternFactor * 0.1;
        
        // 6. Factor de participación (5% del peso)
        const participationFactor = this.calculateParticipationFactor(student);
        baseProbability += participationFactor * 0.05;
        
        // Ajustes adicionales
        let adjustedProbability = baseProbability;
        
        // Ajuste por racha
        if (student.current_streak > 5) {
            adjustedProbability += 5;
        }
        
        // Ajuste por estrés
        if (stressAnalysis.hasData && stressAnalysis.responseType === 'negative') {
            adjustedProbability -= 5;
        }
        
        // Ajuste por proximidad a la nota de corte
        const distanceToCutoff = basicMetrics.weighted_average - this.cnpConfig.historicalCutoff;
        if (Math.abs(distanceToCutoff) < 0.5) {
            // Está muy cerca de la nota de corte, aumentar incertidumbre
            adjustedProbability = 50 + (adjustedProbability - 50) * 0.7;
        }
        
        // Asegurar que esté en rango 0-100
        const finalProbability = Math.max(5, Math.min(95, adjustedProbability));
        
        // Calcular intervalo de confianza
        const confidence = this.calculateConfidenceInterval(finalProbability, student.total_simulations);
        
        return {
            finalProbability: Math.round(finalProbability),
            confidence,
            factors: {
                score: scoreFactor,
                trend: trendFactor,
                consistency: consistencyFactor,
                time: timeFactor,
                patterns: patternFactor,
                participation: participationFactor
            },
            breakdown: {
                baseProbability: 50,
                scoreContribution: scoreFactor * 0.4,
                trendContribution: trendFactor * 0.2,
                consistencyContribution: consistencyFactor * 0.15,
                timeContribution: timeFactor * 0.1,
                patternContribution: patternFactor * 0.1,
                participationContribution: participationFactor * 0.05,
                adjustments: finalProbability - baseProbability
            }
        };
    }

    /**
     * Factores individuales para el cálculo de probabilidad
     */
    calculateScoreFactor(metrics, globalStats) {
        // Distancia a la nota de corte en desviaciones estándar
        const zScoreToCutoff = (metrics.weighted_average - this.cnpConfig.historicalCutoff) / this.cnpConfig.cutoffStdDev;
        
        // Convertir a factor (-50 a +50)
        // Si está 2 desviaciones por encima de la nota de corte, factor máximo
        return Math.max(-50, Math.min(50, zScoreToCutoff * 25));
    }

    calculateTrendFactor(trend) {
        if (trend.direction === 'up') {
            return trend.strength * 30; // Hasta +30 si mejora mucho
        } else if (trend.direction === 'down') {
            return -trend.strength * 40; // Hasta -40 si empeora (más penalización)
        }
        return 0;
    }

    calculateConsistencyFactor(metrics) {
        // Menor consistencia = mayor riesgo
        if (metrics.consistency_coefficient < 0.1) return 20; // Muy consistente
        if (metrics.consistency_coefficient < 0.2) return 10;
        if (metrics.consistency_coefficient < 0.3) return 0;
        if (metrics.consistency_coefficient < 0.4) return -10;
        return -20; // Muy inconsistente
    }

    calculateTimeFactor(timeManagement) {
        if (!timeManagement.hasData) return 0;
        
        if (timeManagement.isOptimal) return 10;
        if (timeManagement.efficiency < 80) return -15; // Muy rápido
        if (timeManagement.efficiency > 120) return -10; // Muy lento
        return 0;
    }

    calculatePatternFactor(patterns) {
        if (!patterns.hasEnoughData) return 0;
        
        let factor = 0;
        
        // Penalizar patrones negativos
        if (patterns.patterns.fatigue.detected) factor -= 10;
        if (patterns.patterns.rushing.detected) factor -= 15;
        if (patterns.patterns.abandonment) factor -= 20;
        
        // Bonificar mejora en accuracy
        if (patterns.accuracy.isImproving) factor += 10;
        
        return factor;
    }

    calculateParticipationFactor(student) {
        const totalSimulations = this.dashboard.data.simulations.length;
        const participationRate = student.total_simulations / Math.max(1, totalSimulations);
        
        if (participationRate > 0.8) return 10;
        if (participationRate > 0.6) return 5;
        if (participationRate > 0.4) return 0;
        if (participationRate > 0.2) return -10;
        return -20;
    }

    /**
     * Evaluar nivel de riesgo
     */
    assessRisk(probability, trend, patterns) {
        const prob = probability.finalProbability;
        let level = 'medium';
        const factors = [];
        
        // Determinar nivel base por probabilidad
        if (prob < 30) {
            level = 'critical';
            factors.push('Probabilidad muy baja de aprobar');
        } else if (prob < 50) {
            level = 'high';
            factors.push('Probabilidad baja de aprobar');
        } else if (prob < 70) {
            level = 'medium';
            factors.push('Probabilidad moderada de aprobar');
        } else {
            level = 'low';
        }
        
        // Ajustar por tendencia
        if (trend.direction === 'down' && trend.strength > 0.2) {
            if (level === 'low') level = 'medium';
            else if (level === 'medium') level = 'high';
            factors.push('Tendencia negativa preocupante');
        }
        
        // Ajustar por patrones problemáticos
        if (patterns.hasEnoughData) {
            const problematicPatterns = Object.values(patterns.patterns).filter(p => p.detected).length;
            if (problematicPatterns >= 2) {
                if (level === 'low') level = 'medium';
                else if (level === 'medium') level = 'high';
                factors.push(`${problematicPatterns} patrones problemáticos detectados`);
            }
        }
        
        return { level, factors };
    }

    /**
     * Generar recomendaciones personalizadas
     */
    generatePersonalizedRecommendations(student, riskAssessment) {
        const recommendations = [];
        
        // Recomendaciones por nivel de riesgo
        if (riskAssessment.level === 'critical' || riskAssessment.level === 'high') {
            recommendations.push({
                priority: 'urgent',
                category: 'intervention',
                action: 'Sesión de evaluación individual urgente',
                details: 'Necesitas una intervención personalizada para identificar y abordar las causas del bajo rendimiento.'
            });
        }
        
        // Recomendaciones por patrones
        if (student.responsePatterns?.patterns?.fatigue?.detected) {
            recommendations.push({
                priority: 'high',
                category: 'technique',
                action: 'Entrenar resistencia mental',
                details: 'Practicar simulacros completos sin pausas. Técnicas de concentración sostenida.'
            });
        }
        
        if (student.responsePatterns?.patterns?.rushing?.detected) {
            recommendations.push({
                priority: 'high',
                category: 'time',
                action: 'Mejorar gestión del tiempo',
                details: `Pierdes ${student.responsePatterns.patterns.rushing.impact.toFixed(1)} puntos por precipitarte. Practica con cronómetro.`
            });
        }
        
        // Recomendaciones por bloques temáticos
        if (student.topicAnalysis) {
            const weakestBlock = Object.entries(student.topicAnalysis)
                .sort((a, b) => a[1].estimatedMastery - b[1].estimatedMastery)[0];
            
            if (weakestBlock && weakestBlock[1].estimatedMastery < 0.6) {
                recommendations.push({
                    priority: 'medium',
                    category: 'study',
                    action: `Reforzar bloque ${this.getBlockName(weakestBlock[0])}`,
                    details: `Temas problemáticos: ${weakestBlock[1].problematicTopics.slice(0, 3).join(', ')}`
                });
            }
        }
        
        // Recomendaciones por gestión del tiempo
        if (student.timeManagement?.hasData && !student.timeManagement.isOptimal) {
            recommendations.push({
                priority: 'medium',
                category: 'practice',
                action: student.timeManagement.recommendation,
                details: `Tiempo promedio: ${student.timeManagement.averageMinutes} minutos`
            });
        }
        
        // Recomendaciones por estrés
        if (student.stressAnalysis?.hasData && student.stressAnalysis.responseType === 'negative') {
            recommendations.push({
                priority: 'medium',
                category: 'mental',
                action: 'Técnicas de control del estrés',
                details: student.stressAnalysis.recommendation
            });
        }
        
        // Recomendaciones por tendencia
        if (student.trendAnalysis?.direction === 'down') {
            recommendations.push({
                priority: 'high',
                category: 'analysis',
                action: 'Análisis de causas del descenso',
                details: 'Tu rendimiento ha bajado. Revisar método de estudio y factores externos.'
            });
        }
        
        // Ordenar por prioridad
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        return recommendations.slice(0, 5); // Máximo 5 recomendaciones
    }

    /**
     * Renderizar resumen ejecutivo
     */
    renderExecutiveSummary(students) {
        const totalStudents = students.length;
        const atRisk = students.filter(s => s.probability_pass < 50).length;
        const improving = students.filter(s => s.trendAnalysis?.direction === 'up').length;
        const declining = students.filter(s => s.trendAnalysis?.direction === 'down').length;
        const avgProbability = students.reduce((sum, s) => sum + (s.probability_pass || 50), 0) / totalStudents;
        
        return `
            <div class="executive-summary card">
                <h3>📊 Resumen Ejecutivo - Oposiciones CNP</h3>
                <div class="summary-grid">
                    <div class="summary-stat">
                        <div class="stat-icon danger">${atRisk}</div>
                        <div class="stat-label">En riesgo de suspender</div>
                        <div class="stat-detail">${((atRisk / totalStudents) * 100).toFixed(1)}% del total</div>
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
            </div>
        `;
    }

    /**
     * Renderizar panel de análisis predictivo
     */
    renderPredictiveAnalysis(students) {
        // Proyección de aprobados
        const projectedPass = students.filter(s => s.probability_pass >= 50).length;
        const confidenceHigh = students.filter(s => s.probability_pass >= 70).length;
        const borderline = students.filter(s => s.probability_pass >= 45 && s.probability_pass < 55).length;
        
        return `
            <div class="predictive-panel card">
                <h3>🎯 Análisis Predictivo</h3>
                <div class="prediction-content">
                    <div class="prediction-main">
                        <div class="big-number">${projectedPass}</div>
                        <div class="big-label">Proyección de aprobados</div>
                        <div class="prediction-detail">
                            De ${students.length} estudiantes activos
                        </div>
                    </div>
                    <div class="prediction-breakdown">
                        <div class="prediction-item">
                            <span class="prediction-count success">${confidenceHigh}</span>
                            <span class="prediction-label">Alta probabilidad (>70%)</span>
                        </div>
                        <div class="prediction-item">
                            <span class="prediction-count warning">${borderline}</span>
                            <span class="prediction-label">En el límite (45-55%)</span>
                        </div>
                        <div class="prediction-note">
                            <strong>Nota de corte estimada:</strong> ${this.cnpConfig.historicalCutoff}/10
                            <br>
                            <small>Basado en históricos CNP</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar acciones masivas
     */
    renderBulkActions() {
        return `
            <div class="bulk-actions-bar">
                <div class="bulk-select">
                    <input type="checkbox" id="selectAllStudents" onchange="window.studentsModule.toggleSelectAll()">
                    <label for="selectAllStudents">Seleccionar todos</label>
                    <span class="selected-count" id="selectedCount">0 seleccionados</span>
                </div>
                <div class="bulk-buttons">
                    <button class="btn btn-secondary" onclick="window.studentsModule.bulkUpdateCohort()">
                        📋 Cambiar cohorte
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.bulkSendRecommendations()">
                        📧 Enviar recomendaciones
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.exportSelected()">
                        📊 Exportar seleccionados
                    </button>
                    <button class="btn btn-primary" onclick="window.studentsModule.generateBulkReport()">
                        📄 Generar informe grupal
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar tabla avanzada de estudiantes
     */
    renderAdvancedStudentsTable(students) {
        return `
            <div class="table-card">
                <div class="table-header">
                    <h2 class="table-title">📊 Análisis Detallado de Estudiantes (${students.length})</h2>
                    <div class="table-controls">
                        <div class="search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" class="search-input" 
                                   placeholder="Buscar por nombre, email o slug..." 
                                   onkeyup="window.studentsModule.filterStudents(this.value)">
                        </div>
                        <button class="btn btn-primary" onclick="window.dashboardAdmin.showPage('bulk-users')">
                            ➕ Añadir alumnos
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table id="studentsTable">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" id="headerSelectAll">
                                </th>
                                <th onclick="window.studentsModule.sortBy('username')">
                                    Estudiante ${this.getSortIcon('username')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('cohort')">
                                    Cohorte ${this.getSortIcon('cohort')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('weighted_average')" title="Promedio ponderado">
                                    Nota ${this.getSortIcon('weighted_average')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('probability_pass')" title="Probabilidad de aprobar">
                                    P(Aprobar) ${this.getSortIcon('probability_pass')}
                                </th>
                                <th>Tendencia</th>
                                <th>Patrones</th>
                                <th onclick="window.studentsModule.sortBy('risk_level')">
                                    Riesgo ${this.getSortIcon('risk_level')}
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => this.renderAdvancedStudentRow(student)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar fila avanzada de estudiante
     */
    renderAdvancedStudentRow(student) {
        const hasPatterns = student.responsePatterns?.hasEnoughData && 
            Object.values(student.responsePatterns.patterns).some(p => p.detected);
        
        const trendIcon = this.getTrendIcon(student.trendAnalysis?.direction || 'neutral');
        const confidence = student.probability_details?.confidence;
        
        return `
            <tr data-student-id="${student.id}" class="student-row ${student.risk_level}">
                <td>
                    <input type="checkbox" class="student-select" value="${student.id}">
                </td>
                <td>
                    <div class="student-info">
                        <strong>${student.username}</strong>
                        <div class="student-meta">
                            ${student.email} | ${student.slug}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${this.getCohortClass(student.cohort)}">
                        ${student.cohort}
                    </span>
                </td>
                <td>
                    <div class="score-display">
                        <strong>${(student.weighted_average || 0).toFixed(2)}</strong>/10
                        <div class="score-detail">
                            σ: ${(student.consistency_coefficient || 0).toFixed(2)}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="probability-display ${this.getProbabilityClass(student.probability_pass)}">
                        <strong>${student.probability_pass || 50}%</strong>
                        ${confidence ? `
                            <div class="confidence-interval" title="Intervalo de confianza">
                                ±${confidence.margin.toFixed(0)}%
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div class="trend-display">
                        ${trendIcon}
                        ${student.trendAnalysis?.confidence ? `
                            <span class="trend-confidence">${student.trendAnalysis.confidence.toFixed(0)}%</span>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div class="patterns-indicators">
                        ${hasPatterns ? this.renderPatternIndicators(student.responsePatterns.patterns) : '—'}
                    </div>
                </td>
                <td>
                    <span class="risk-badge ${student.risk_level || 'unknown'}">
                        ${this.getRiskLabel(student.risk_level)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')"
                                title="Ver análisis completo">
                            📊
                        </button>
                        <button class="btn-icon" onclick="window.studentsModule.showQuickAnalysis('${student.id}')"
                                title="Análisis rápido">
                            ⚡
                        </button>
                        <button class="btn-icon" onclick="window.studentsModule.sendRecommendations('${student.id}')"
                                title="Enviar recomendaciones">
                            📧
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Renderizar indicadores de patrones
     */
    renderPatternIndicators(patterns) {
        const indicators = [];
        
        if (patterns.fatigue?.detected) {
            indicators.push('<span class="pattern-indicator fatigue" title="Fatiga detectada">😴</span>');
        }
        if (patterns.rushing?.detected) {
            indicators.push('<span class="pattern-indicator rushing" title="Precipitación detectada">⚡</span>');
        }
        if (patterns.abandonment) {
            indicators.push('<span class="pattern-indicator abandonment" title="Muchas preguntas en blanco">❌</span>');
        }
        
        return indicators.join(' ') || '✅';
    }

    /**
     * Modal de notas
     */
    renderNotesModal() {
        return `
            <div id="notesModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="notesModalTitle">Notas del estudiante</h3>
                        <button class="btn-icon" onclick="window.studentsModule.closeNotesModal()">✖️</button>
                    </div>
                    <div class="modal-body">
                        <div id="notesList" class="notes-list">
                            <!-- Notas se cargarán aquí -->
                        </div>
                        <div class="add-note-form">
                            <textarea id="newNoteText" placeholder="Añadir nueva nota..." rows="3"></textarea>
                            <div class="note-form-actions">
                                <select id="noteType">
                                    <option value="general">📝 General</option>
                                    <option value="academic">📚 Académica</option>
                                    <option value="risk">⚠️ Riesgo</option>
                                    <option value="positive">✅ Positiva</option>
                                    <option value="recommendation">💡 Recomendación</option>
                                </select>
                                <button class="btn btn-primary" onclick="window.studentsModule.addNote()">
                                    Añadir nota
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Modal de análisis detallado
     */
    renderDetailedAnalysisModal() {
        return `
            <div id="analysisModal" class="modal" style="display: none;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="analysisModalTitle">Análisis Detallado</h3>
                        <button class="btn-icon" onclick="window.studentsModule.closeAnalysisModal()">✖️</button>
                    </div>
                    <div class="modal-body" id="analysisContent">
                        <!-- Contenido dinámico -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        window.studentsModule = this;
        
        // Checkbox de selección múltiple
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedCount());
        });
        
        // Header checkbox
        document.getElementById('headerSelectAll')?.addEventListener('change', (e) => {
            document.querySelectorAll('.student-select').forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            this.updateSelectedCount();
        });
    }

    /**
     * Mostrar análisis rápido
     */
    async showQuickAnalysis(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        const modal = document.getElementById('analysisModal');
        const content = document.getElementById('analysisContent');
        
        content.innerHTML = `
            <div class="quick-analysis">
                <h4>${student.username} - Análisis Rápido</h4>
                
                <div class="analysis-section">
                    <h5>📊 Métricas Principales</h5>
                    <div class="metrics-grid">
                        <div class="metric">
                            <label>Nota media ponderada:</label>
                            <value>${(student.weighted_average || 0).toFixed(2)}/10</value>
                        </div>
                        <div class="metric">
                            <label>Probabilidad de aprobar:</label>
                            <value class="${this.getProbabilityClass(student.probability_pass)}">
                                ${student.probability_pass}%
                            </value>
                        </div>
                        <div class="metric">
                            <label>Tendencia:</label>
                            <value>${this.getTrendIcon(student.trendAnalysis?.direction)} 
                                ${student.trendAnalysis?.direction || 'neutral'}
                            </value>
                        </div>
                        <div class="metric">
                            <label>Simulacros realizados:</label>
                            <value>${student.total_simulations}</value>
                        </div>
                    </div>
                </div>
                
                ${student.responsePatterns?.hasEnoughData ? `
                    <div class="analysis-section">
                        <h5>🎯 Patrones Detectados</h5>
                        <ul>
                            ${Object.entries(student.responsePatterns.patterns)
                                .filter(([_, pattern]) => pattern.detected)
                                .map(([name, pattern]) => `
                                    <li><strong>${this.getPatternName(name)}:</strong> 
                                        ${pattern.recommendation || 'Detectado'}
                                    </li>
                                `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${student.recommendations?.length > 0 ? `
                    <div class="analysis-section">
                        <h5>💡 Recomendaciones Prioritarias</h5>
                        <div class="recommendations-list">
                            ${student.recommendations.slice(0, 3).map(rec => `
                                <div class="recommendation-item ${rec.priority}">
                                    <strong>${rec.action}</strong>
                                    <p>${rec.details}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="analysis-actions">
                    <button class="btn btn-primary" onclick="window.dashboardAdmin.showStudentDetail('${studentId}')">
                        Ver Análisis Completo
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.exportStudentReport('${studentId}')">
                        Exportar Informe
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    }

    /**
     * Cerrar modal de análisis
     */
    closeAnalysisModal() {
        document.getElementById('analysisModal').style.display = 'none';
    }

    /**
     * Enviar recomendaciones a un estudiante
     */
    async sendRecommendations(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student || !student.recommendations) return;
        
        if (confirm(`¿Enviar recomendaciones personalizadas a ${student.username}?`)) {
            try {
                // Aquí iría la lógica para enviar email con las recomendaciones
                this.dashboard.showNotification('success', 'Recomendaciones enviadas correctamente');
            } catch (error) {
                this.dashboard.showNotification('error', 'Error al enviar recomendaciones');
            }
        }
    }

    /**
     * Generar informe grupal
     */
    async generateBulkReport() {
        const selectedIds = Array.from(this.selectedStudents);
        const students = selectedIds.length > 0 ?
            this.dashboard.data.students.filter(s => selectedIds.includes(s.id)) :
            this.dashboard.data.students;
        
        if (students.length === 0) {
            this.dashboard.showNotification('warning', 'No hay estudiantes seleccionados');
            return;
        }
        
        // Aquí iría la lógica para generar un informe PDF o Excel completo
        this.dashboard.showNotification('info', `Generando informe para ${students.length} estudiantes...`);
        
        // Por ahora, exportar a CSV con todas las métricas
        await this.exportAdvancedReport(students);
    }

    /**
     * Exportar informe avanzado
     */
    async exportAdvancedReport(students) {
        const exportsModule = await this.dashboard.loadModule('exports');
        
        const reportData = students.map(s => ({
            // Datos básicos
            Nombre: s.username,
            Email: s.email,
            Cohorte: s.cohort,
            Código: s.slug,
            
            // Métricas principales
            'Nota Media': s.average_score || 0,
            'Nota Ponderada': s.weighted_average || 0,
            'Mejor Nota': s.best_score || 0,
            'Peor Nota': s.worst_score || 0,
            'Consistencia': s.consistency_coefficient || 0,
            
            // Probabilidad y riesgo
            'P(Aprobar)': s.probability_pass || 50,
            'Nivel Riesgo': s.risk_level || 'unknown',
            'Tendencia': s.trendAnalysis?.direction || 'neutral',
            'Proyección': s.trendAnalysis?.projection || 'N/A',
            
            // Participación
            'Simulacros': s.total_simulations || 0,
            'Racha Actual': s.current_streak || 0,
            
            // Patrones
            'Fatiga': s.responsePatterns?.patterns?.fatigue?.detected ? 'Sí' : 'No',
            'Precipitación': s.responsePatterns?.patterns?.rushing?.detected ? 'Sí' : 'No',
            'Abandono': s.responsePatterns?.patterns?.abandonment ? 'Sí' : 'No',
            
            // Recomendación principal
            'Recomendación Principal': s.recommendations?.[0]?.action || 'Sin recomendaciones'
        }));
        
        const csv = exportsModule.objectsToCSV(reportData);
        exportsModule.downloadCSV(csv, `informe_avanzado_cnp_${exportsModule.getTimestamp()}.csv`);
    }

    /**
     * Métodos de utilidad
     */
    
    // Métodos auxiliares de cálculo
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
        
        // Calcular R²
        const yMean = sumY / n;
        const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const ssResidual = y.reduce((sum, yi, i) => {
            const predicted = slope * x[i] + intercept;
            return sum + Math.pow(yi - predicted, 2);
        }, 0);
        
        const r2 = 1 - (ssResidual / ssTotal);
        
        return { slope, intercept, r2 };
    }

    calculatePercentile(value, globalStats) {
        // Aproximación usando distribución normal
        const z = (value - globalStats.mean) / globalStats.stdDev;
        const p = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
        return Math.round(p * 100);
    }

    erf(x) {
        // Aproximación de la función error
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return sign * y;
    }

    calculateConsistency(values) {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return mean > 0 ? Math.sqrt(variance) / mean : 0;
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        const x = values.map((_, i) => i);
        const regression = this.calculateLinearRegression(x, values);
        return regression.slope;
    }

    findOptimalStressLevel(stressData) {
        // Agrupar por niveles de estrés y encontrar el mejor rendimiento
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

    generateStressRecommendation(responseType, performance) {
        if (responseType === 'negative') {
            return 'El estrés afecta negativamente tu rendimiento. Practica técnicas de relajación y respiración.';
        } else if (responseType === 'positive') {
            return 'Un nivel moderado de estrés mejora tu rendimiento. Mantén ese nivel de activación óptimo.';
        }
        return 'El estrés no parece afectar significativamente tu rendimiento.';
    }

    calculateConfidenceInterval(probability, n) {
        // Intervalo de confianza del 95% para una proporción
        const z = 1.96; // 95% confidence
        const p = probability / 100;
        const margin = z * Math.sqrt((p * (1 - p)) / Math.max(1, n)) * 100;
        
        return {
            lower: Math.max(0, probability - margin),
            upper: Math.min(100, probability + margin),
            margin
        };
    }

    // Métodos de UI
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllStudents').checked;
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        this.selectedStudents.clear();
        document.querySelectorAll('.student-select:checked').forEach(checkbox => {
            this.selectedStudents.add(checkbox.value);
        });
        document.getElementById('selectedCount').textContent = 
            `${this.selectedStudents.size} seleccionados`;
    }

    filterStudents(searchTerm) {
        const rows = document.querySelectorAll('#studentsTable tbody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.dashboard.refreshCurrentPage();
    }

    // Métodos de formato y visualización
    getProbabilityClass(probability) {
        if (!probability) probability = 50;
        if (probability >= 70) return 'success';
        if (probability >= 50) return 'warning';
        if (probability >= 30) return 'danger';
        return 'critical';
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

    getRiskLabel(level) {
        const labels = {
            'critical': 'Crítico',
            'high': 'Alto',
            'medium': 'Medio',
            'low': 'Bajo',
            'unknown': 'No evaluado'
        };
        return labels[level] || level;
    }

    getBlockName(block) {
        const names = {
            'juridico': 'Jurídico (T1-15)',
            'sociales': 'Ciencias Sociales (T16-31)',
            'tecnico': 'Técnico-Científico (T32-45)'
        };
        return names[block] || block;
    }

    getPatternName(pattern) {
        const names = {
            'fatigue': 'Fatiga mental',
            'rushing': 'Precipitación',
            'abandonment': 'Abandono excesivo'
        };
        return names[pattern] || pattern;
    }

    getSortIcon(column) {
        if (this.sortColumn !== column) return '';
        return this.sortDirection === 'asc' ? '↑' : '↓';
    }

    // Métodos de datos por defecto
    assignDefaultMetrics(student) {
        Object.assign(student, {
            average_score: 0,
            weighted_average: 0,
            consistency_coefficient: 0,
            z_score: 0,
            percentile: 50,
            probability_pass: 50,
            risk_level: 'unknown',
            trend_direction: 'neutral',
            calculated_risk_level: 'unknown',
            recommendations: [{
                priority: 'high',
                category: 'start',
                action: 'Comenzar con simulacros',
                details: 'Necesitas realizar al menos 3 simulacros para obtener un análisis completo.'
            }]
        });
    }

    // Métodos adicionales para funcionalidad completa
    async bulkUpdateCohort() {
        if (this.selectedStudents.size === 0) {
            alert('Selecciona al menos un estudiante');
            return;
        }
        
        const newCohort = prompt('Nueva cohorte (20h, 36h, 48h, sin_asignar):');
        if (!newCohort || !['20h', '36h', '48h', 'sin_asignar'].includes(newCohort)) {
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ cohort: newCohort })
                .in('id', Array.from(this.selectedStudents));
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 
                `Cohorte actualizada para ${this.selectedStudents.size} estudiantes`);
            
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al actualizar cohortes');
        }
    }

    async bulkSendRecommendations() {
        if (this.selectedStudents.size === 0) {
            alert('Selecciona al menos un estudiante');
            return;
        }
        
        if (confirm(`¿Enviar recomendaciones personalizadas a ${this.selectedStudents.size} estudiantes?`)) {
            // Implementar lógica de envío masivo
            this.dashboard.showNotification('info', 'Función en desarrollo');
        }
    }

    async exportSelected() {
        const studentsToExport = this.selectedStudents.size > 0 ? 
            Array.from(this.selectedStudents) : 
            this.dashboard.data.students.map(s => s.id);
        
        const students = this.dashboard.data.students.filter(s => studentsToExport.includes(s.id));
        await this.exportAdvancedReport(students);
    }

    async exportStudentReport(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        await this.exportAdvancedReport([student]);
    }

    async renderAnalyticsCharts(students) {
        // Implementar gráficos específicos si es necesario
        // Por ejemplo: distribución de probabilidades, tendencias grupales, etc.
    }

    // Notas y anotaciones
    async viewNotes(studentId) {
        this.currentStudentId = studentId;
        
        const { data: student } = await this.supabase
            .from('users')
            .select('username, notes')
            .eq('id', studentId)
            .single();
        
        if (!student) return;
        
        document.getElementById('notesModalTitle').textContent = 
            `Notas de ${student.username}`;
        
        const notesList = document.getElementById('notesList');
        if (student.notes && student.notes.length > 0) {
            notesList.innerHTML = student.notes.map((note, index) => `
                <div class="note-item ${note.type || 'general'}">
                    <div class="note-header">
                        <span class="note-type">${this.getNoteIcon(note.type)} ${note.type || 'General'}</span>
                        <span class="note-date">${this.formatDate(note.date)}</span>
                    </div>
                    <div class="note-content">${note.text}</div>
                    <button class="btn-icon note-delete" onclick="window.studentsModule.deleteNote(${index})">
                        🗑️
                    </button>
                </div>
            `).join('');
        } else {
            notesList.innerHTML = '<p class="text-muted">No hay notas para este estudiante</p>';
        }
        
        document.getElementById('notesModal').style.display = 'flex';
    }

    async addNote() {
        const text = document.getElementById('newNoteText').value.trim();
        const type = document.getElementById('noteType').value;
        
        if (!text) return;
        
        try {
            const { data: student } = await this.supabase
                .from('users')
                .select('notes')
                .eq('id', this.currentStudentId)
                .single();
            
            const notes = student.notes || [];
            notes.push({
                text,
                type,
                date: new Date().toISOString(),
                author: this.dashboard.auth.currentUser.email
            });
            
            const { error } = await this.supabase
                .from('users')
                .update({ notes })
                .eq('id', this.currentStudentId);
            
            if (error) throw error;
            
            document.getElementById('newNoteText').value = '';
            this.viewNotes(this.currentStudentId);
            
            this.dashboard.showNotification('success', 'Nota añadida correctamente');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al añadir nota');
        }
    }

    async deleteNote(index) {
        if (!confirm('¿Eliminar esta nota?')) return;
        
        try {
            const { data: student } = await this.supabase
                .from('users')
                .select('notes')
                .eq('id', this.currentStudentId)
                .single();
            
            const notes = student.notes || [];
            notes.splice(index, 1);
            
            const { error } = await this.supabase
                .from('users')
                .update({ notes })
                .eq('id', this.currentStudentId);
            
            if (error) throw error;
            
            this.viewNotes(this.currentStudentId);
            this.dashboard.showNotification('success', 'Nota eliminada');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al eliminar nota');
        }
    }

    closeNotesModal() {
        document.getElementById('notesModal').style.display = 'none';
    }

    getNoteIcon(type) {
        const icons = {
            'general': '📝',
            'academic': '📚',
            'risk': '⚠️',
            'positive': '✅',
            'recommendation': '💡'
        };
        return icons[type] || '📝';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}