// admin/js/modules/analytics/patterns.js
// Módulo especializado en detección de patrones de comportamiento

import { StatisticsUtils } from '../utils/statistics.js';

export class PatternDetector {
    constructor() {
        // Umbrales configurables para detección
        this.thresholds = {
            fatigue: {
                correlation: 0.3,
                severity: { high: 0.5, medium: 0.3 }
            },
            rushing: {
                timeFactor: 0.8,
                scoreDifference: 0.5
            },
            abandonment: {
                blanks: { critical: 25, high: 15 }
            },
            stress: {
                negativeCorrelation: -0.3,
                positiveCorrelation: 0.2
            }
        };
    }

    /**
     * Analizar todos los patrones de un estudiante
     */
    async analyzeStudentPatterns(student, results) {
        if (!results || results.length < 2) {
            return {
                hasEnoughData: false,
                patterns: {},
                summary: 'Datos insuficientes para análisis de patrones',
                recommendations: []
            };
        }

        const patterns = {
            fatigue: this.detectFatiguePattern(results),
            rushing: this.detectRushPattern(results),
            abandonment: this.detectAbandonmentPattern(results),
            topicWeakness: this.analyzeTopicFailures(results),
            confidenceAlignment: this.analyzeConfidenceAccuracy(results),
            stressImpact: this.analyzeStressImpact(results),
            timeManagement: this.analyzeTimeManagement(results),
            consistencyPattern: this.analyzeConsistencyPattern(results)
        };

        return {
            hasEnoughData: true,
            patterns,
            summary: this.generatePatternSummary(patterns),
            recommendations: this.generatePatternRecommendations(patterns),
            riskFactors: this.identifyRiskFactors(patterns)
        };
    }

    /**
     * Detectar patrón de fatiga mental
     */
    detectFatiguePattern(results) {
        if (results.length < 2) {
            return { detected: false, message: 'Datos insuficientes' };
        }

        // Analizar correlación entre tiempo y tasa de error
        const timeErrorData = results.map(r => ({
            time: r.time_taken || 0,
            errorRate: r.wrong_answers / (r.correct_answers + r.wrong_answers) || 0,
            position: r.position_in_exam || 0
        }));

        const timeCorrelation = StatisticsUtils.calculateCorrelation(
            timeErrorData.map(d => d.time),
            timeErrorData.map(d => d.errorRate)
        );

        // Analizar rendimiento por cuartiles del examen
        const quartileAnalysis = this.analyzeQuartilePerformance(results);

        const severity = this.calculateFatigueSeverity(timeCorrelation, quartileAnalysis);

        return {
            detected: timeCorrelation > this.thresholds.fatigue.correlation,
            severity,
            correlation: parseFloat(timeCorrelation.toFixed(3)),
            quartileDropoff: quartileAnalysis.dropoffPercentage,
            affectedQuestions: quartileAnalysis.worstQuartile,
            recommendation: this.getFatigueRecommendation(severity, quartileAnalysis),
            metadata: {
                avgTimeSpent: StatisticsUtils.calculateBasicStats(timeErrorData.map(d => d.time)).mean,
                errorTrend: quartileAnalysis.trend
            }
        };
    }

    /**
     * Detectar patrón de precipitación
     */
    detectRushPattern(results) {
        const timeData = results.filter(r => r.time_taken).map(r => ({
            time: r.time_taken,
            score: r.score,
            blanks: r.blank_answers || 0
        }));

        if (timeData.length < 2) {
            return { detected: false, message: 'Datos de tiempo insuficientes' };
        }

        const stats = StatisticsUtils.calculateBasicStats(timeData.map(d => d.time));
        const rushThreshold = stats.mean * this.thresholds.rushing.timeFactor;

        const rushResults = timeData.filter(d => d.time < rushThreshold);
        const normalResults = timeData.filter(d => d.time >= rushThreshold);

        if (rushResults.length === 0) {
            return { detected: false, message: 'No se detecta precipitación' };
        }

        const rushAvgScore = StatisticsUtils.calculateBasicStats(rushResults.map(r => r.score)).mean;
        const normalAvgScore = normalResults.length > 0 
            ? StatisticsUtils.calculateBasicStats(normalResults.map(r => r.score)).mean 
            : 0;

        const scoreDifference = normalAvgScore - rushAvgScore;
        const rushFrequency = (rushResults.length / timeData.length) * 100;

        return {
            detected: scoreDifference > this.thresholds.rushing.scoreDifference,
            impact: parseFloat(scoreDifference.toFixed(2)),
            frequency: parseFloat(rushFrequency.toFixed(1)),
            avgTimeReduction: parseFloat(((rushThreshold - stats.mean) / stats.mean * 100).toFixed(1)),
            recommendation: this.getRushRecommendation(scoreDifference, rushFrequency),
            metadata: {
                optimalTime: stats.mean,
                rushTime: rushResults.length > 0 
                    ? StatisticsUtils.calculateBasicStats(rushResults.map(r => r.time)).mean 
                    : 0
            }
        };
    }

    /**
     * Detectar patrón de abandono
     */
    detectAbandonmentPattern(results) {
        const blanksData = results.map(r => ({
            blanks: r.blank_answers || 0,
            total: (r.correct_answers || 0) + (r.wrong_answers || 0) + (r.blank_answers || 0),
            score: r.score
        }));

        const stats = StatisticsUtils.calculateBasicStats(blanksData.map(d => d.blanks));
        const trend = StatisticsUtils.calculateTrend(blanksData.map(d => d.blanks));

        // Analizar distribución de blancos
        const blankDistribution = this.analyzeBlankDistribution(results);

        const severity = stats.mean > this.thresholds.abandonment.blanks.critical ? 'critical' :
                        stats.mean > this.thresholds.abandonment.blanks.high ? 'high' : 'normal';

        return {
            detected: stats.mean > this.thresholds.abandonment.blanks.high,
            averageBlanks: parseFloat(stats.mean.toFixed(1)),
            trend: parseFloat(trend.toFixed(3)),
            severity,
            distribution: blankDistribution,
            impactOnScore: this.calculateBlankImpact(blanksData),
            recommendation: this.getAbandonmentRecommendation(severity, blankDistribution),
            metadata: {
                worstCase: stats.max,
                improving: trend < 0
            }
        };
    }

    /**
     * Analizar debilidades por temas
     */
    analyzeTopicFailures(results) {
        const topicFrequency = {};
        const topicScores = {};
        let totalMentions = 0;

        results.forEach(result => {
            if (result.weakest_topics && Array.isArray(result.weakest_topics)) {
                result.weakest_topics.forEach(topic => {
                    topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
                    if (!topicScores[topic]) topicScores[topic] = [];
                    topicScores[topic].push(result.score);
                    totalMentions++;
                });
            }
        });

        // Identificar temas persistentemente problemáticos
        const persistentWeaknesses = Object.entries(topicFrequency)
            .filter(([topic, count]) => count >= results.length * 0.3)
            .map(([topic, count]) => ({
                topic,
                frequency: count / results.length,
                avgScoreImpact: topicScores[topic] 
                    ? StatisticsUtils.calculateBasicStats(topicScores[topic]).mean 
                    : 0,
                severity: count >= results.length * 0.5 ? 'high' : 'medium'
            }))
            .sort((a, b) => b.frequency - a.frequency);

        return {
            detected: persistentWeaknesses.length > 0,
            persistentTopics: persistentWeaknesses,
            totalUniqueWeaknesses: Object.keys(topicFrequency).length,
            recommendedFocus: persistentWeaknesses.slice(0, 3).map(t => t.topic),
            message: this.getTopicWeaknessMessage(persistentWeaknesses)
        };
    }

    /**
     * Analizar alineación de confianza con rendimiento
     */
    analyzeConfidenceAccuracy(results) {
        const confidenceData = results.filter(r => 
            r.confidence_score !== null && r.confidence_score !== undefined
        );

        if (confidenceData.length < 2) {
            return { hasData: false, message: 'Sin datos de confianza' };
        }

        const correlation = StatisticsUtils.calculateCorrelation(
            confidenceData.map(r => r.confidence_score),
            confidenceData.map(r => r.score)
        );

        // Analizar tendencia de sobre/sub estimación
        const calibration = this.analyzeConfidenceCalibration(confidenceData);

        return {
            hasData: true,
            correlation: parseFloat(correlation.toFixed(3)),
            isWellCalibrated: Math.abs(correlation) > 0.6,
            tendency: calibration.tendency,
            averageDeviation: calibration.avgDeviation,
            recommendation: this.getConfidenceRecommendation(calibration),
            metadata: calibration
        };
    }

    /**
     * Analizar impacto del estrés
     */
    analyzeStressImpact(results) {
        const stressData = results.filter(r => 
            r.stress_level !== null && r.stress_level !== undefined
        );

        if (stressData.length < 2) {
            return { 
                hasData: false, 
                responseType: 'neutral',
                message: 'Sin datos de estrés' 
            };
        }

        const correlation = StatisticsUtils.calculateCorrelation(
            stressData.map(r => r.stress_level),
            stressData.map(r => r.score)
        );

        const optimalLevel = this.findOptimalStressLevel(stressData);
        const currentAvgStress = StatisticsUtils.calculateBasicStats(
            stressData.map(r => r.stress_level)
        ).mean;

        let responseType = 'neutral';
        if (correlation < this.thresholds.stress.negativeCorrelation) responseType = 'negative';
        else if (correlation > this.thresholds.stress.positiveCorrelation) responseType = 'positive';

        return {
            hasData: true,
            correlation: parseFloat(correlation.toFixed(3)),
            responseType,
            optimalLevel,
            currentAverage: currentAvgStress,
            deviationFromOptimal: Math.abs(currentAvgStress - optimalLevel),
            recommendation: this.getStressRecommendation(responseType, optimalLevel, currentAvgStress)
        };
    }

    /**
     * Analizar gestión del tiempo
     */
    analyzeTimeManagement(results) {
        const timeData = results
            .filter(r => r.time_taken && r.time_taken > 0)
            .map(r => ({
                time: r.time_taken / 60, // Convertir a minutos
                score: r.score,
                efficiency: r.score / (r.time_taken / 60) // Puntos por minuto
            }));

        if (timeData.length === 0) {
            return { hasData: false };
        }

        const stats = StatisticsUtils.calculateBasicStats(timeData.map(d => d.time));
        const efficiencyStats = StatisticsUtils.calculateBasicStats(timeData.map(d => d.efficiency));

        const optimalRange = { min: 85, max: 105 }; // Minutos
        const inOptimalRange = timeData.filter(d => 
            d.time >= optimalRange.min && d.time <= optimalRange.max
        ).length / timeData.length * 100;

        return {
            hasData: true,
            averageMinutes: parseFloat(stats.mean.toFixed(1)),
            efficiency: parseFloat(efficiencyStats.mean.toFixed(2)),
            inOptimalRange: parseFloat(inOptimalRange.toFixed(1)),
            isOptimal: stats.mean >= optimalRange.min && stats.mean <= optimalRange.max,
            distribution: this.categorizeTimeManagement(timeData),
            recommendation: this.getTimeManagementRecommendation(stats.mean, efficiencyStats.mean)
        };
    }

    /**
     * Analizar patrón de consistencia
     */
    analyzeConsistencyPattern(results) {
        if (results.length < 3) {
            return { hasData: false };
        }

        const scores = results.map(r => r.score);
        const consistency = StatisticsUtils.calculateConsistency(results);
        const cv = StatisticsUtils.calculateCoefficientOfVariation(scores);
        
        // Analizar tendencias de consistencia
        const windows = [];
        for (let i = 0; i <= results.length - 3; i++) {
            const window = results.slice(i, i + 3);
            windows.push(StatisticsUtils.calculateConsistency(window));
        }
        
        const consistencyTrend = windows.length > 1 
            ? StatisticsUtils.calculateTrend(windows) 
            : 0;

        return {
            hasData: true,
            coefficient: parseFloat(consistency.toFixed(2)),
            coefficientOfVariation: parseFloat(cv.toFixed(1)),
            trend: consistencyTrend,
            improving: consistencyTrend < -0.05,
            level: cv < 15 ? 'excellent' : cv < 25 ? 'good' : cv < 35 ? 'moderate' : 'poor',
            recommendation: this.getConsistencyRecommendation(cv, consistencyTrend)
        };
    }

    // ===== MÉTODOS AUXILIARES =====

    analyzeQuartilePerformance(results) {
        // Simular análisis por cuartiles del examen
        // En un caso real, necesitaríamos datos de qué preguntas fallaron
        const dropoff = Math.random() * 20; // Simulado
        return {
            dropoffPercentage: dropoff,
            worstQuartile: 'Q4',
            trend: dropoff > 15 ? 'severe' : dropoff > 10 ? 'moderate' : 'mild'
        };
    }

    calculateFatigueSeverity(correlation, quartileAnalysis) {
        if (correlation > this.thresholds.fatigue.severity.high || 
            quartileAnalysis.dropoffPercentage > 20) {
            return 'high';
        }
        if (correlation > this.thresholds.fatigue.severity.medium || 
            quartileAnalysis.dropoffPercentage > 10) {
            return 'medium';
        }
        return 'low';
    }

    analyzeBlankDistribution(results) {
        // Analizar en qué parte del examen se concentran los blancos
        // Simulado por ahora
        return {
            beginning: 10,
            middle: 30,
            end: 60,
            pattern: 'increasing'
        };
    }

    calculateBlankImpact(blanksData) {
        const withBlanks = blanksData.filter(d => d.blanks > 0);
        const withoutBlanks = blanksData.filter(d => d.blanks === 0);
        
        if (withBlanks.length === 0 || withoutBlanks.length === 0) return 0;
        
        const avgWithBlanks = StatisticsUtils.calculateBasicStats(withBlanks.map(d => d.score)).mean;
        const avgWithoutBlanks = StatisticsUtils.calculateBasicStats(withoutBlanks.map(d => d.score)).mean;
        
        return parseFloat((avgWithoutBlanks - avgWithBlanks).toFixed(2));
    }

    analyzeConfidenceCalibration(confidenceData) {
        const deviations = confidenceData.map(r => ({
            expected: r.confidence_score / 10,
            actual: r.score,
            deviation: (r.confidence_score / 10) - r.score
        }));
        
        const avgDeviation = StatisticsUtils.calculateBasicStats(deviations.map(d => d.deviation)).mean;
        
        return {
            tendency: avgDeviation > 0.5 ? 'overconfident' : 
                     avgDeviation < -0.5 ? 'underconfident' : 'balanced',
            avgDeviation: Math.abs(avgDeviation),
            distribution: deviations
        };
    }

    findOptimalStressLevel(stressData) {
        // Encontrar el nivel de estrés con mejores resultados
        const levels = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        let bestLevel = 50;
        let bestScore = 0;
        
        levels.forEach(level => {
            const nearLevel = stressData.filter(r => 
                Math.abs(r.stress_level - level) < 10
            );
            if (nearLevel.length > 0) {
                const avgScore = StatisticsUtils.calculateBasicStats(
                    nearLevel.map(r => r.score)
                ).mean;
                if (avgScore > bestScore) {
                    bestScore = avgScore;
                    bestLevel = level;
                }
            }
        });
        
        return bestLevel;
    }

    categorizeTimeManagement(timeData) {
        const categories = {
            tooFast: timeData.filter(d => d.time < 85).length,
            optimal: timeData.filter(d => d.time >= 85 && d.time <= 105).length,
            tooSlow: timeData.filter(d => d.time > 105).length
        };
        
        const total = timeData.length;
        return {
            tooFast: (categories.tooFast / total * 100).toFixed(1),
            optimal: (categories.optimal / total * 100).toFixed(1),
            tooSlow: (categories.tooSlow / total * 100).toFixed(1)
        };
    }

    generatePatternSummary(patterns) {
        const issues = [];
        
        if (patterns.fatigue?.detected) issues.push('fatiga mental');
        if (patterns.rushing?.detected) issues.push('precipitación');
        if (patterns.abandonment?.detected) issues.push('abandono excesivo');
        if (patterns.stressImpact?.responseType === 'negative') issues.push('gestión del estrés');
        if (patterns.consistencyPattern?.level === 'poor') issues.push('inconsistencia');
        
        if (issues.length === 0) {
            return 'No se detectan patrones problemáticos significativos. Rendimiento estable.';
        }
        
        return `Patrones detectados: ${issues.join(', ')}. Se requiere atención.`;
    }

    generatePatternRecommendations(patterns) {
        const recommendations = [];
        
        // Recomendaciones por fatiga
        if (patterns.fatigue?.detected) {
            recommendations.push({
                type: 'fatigue',
                priority: patterns.fatigue.severity === 'high' ? 'alta' : 'media',
                action: 'Gestión de la fatiga mental',
                details: patterns.fatigue.recommendation,
                category: 'performance'
            });
        }
        
        // Recomendaciones por precipitación
        if (patterns.rushing?.detected) {
            recommendations.push({
                type: 'rushing',
                priority: patterns.rushing.impact > 1 ? 'alta' : 'media',
                action: 'Control del ritmo de examen',
                details: patterns.rushing.recommendation,
                category: 'technique'
            });
        }
        
        // Recomendaciones por abandono
        if (patterns.abandonment?.detected) {
            recommendations.push({
                type: 'abandonment',
                priority: patterns.abandonment.severity === 'critical' ? 'alta' : 'media',
                action: 'Estrategia de gestión del tiempo',
                details: patterns.abandonment.recommendation,
                category: 'strategy'
            });
        }
        
        // Recomendaciones por estrés
        if (patterns.stressImpact?.responseType === 'negative') {
            recommendations.push({
                type: 'stress',
                priority: 'media',
                action: 'Técnicas de manejo del estrés',
                details: patterns.stressImpact.recommendation,
                category: 'mental'
            });
        }
        
        // Recomendaciones por inconsistencia
        if (patterns.consistencyPattern?.level === 'poor' && !patterns.consistencyPattern.improving) {
            recommendations.push({
                type: 'consistency',
                priority: 'alta',
                action: 'Mejorar consistencia en el rendimiento',
                details: patterns.consistencyPattern.recommendation,
                category: 'methodology'
            });
        }
        
        // Ordenar por prioridad
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'alta': 3, 'media': 2, 'baja': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    identifyRiskFactors(patterns) {
        const riskFactors = [];
        
        if (patterns.fatigue?.severity === 'high') {
            riskFactors.push({ factor: 'fatigue', level: 'high', impact: 0.8 });
        }
        
        if (patterns.rushing?.frequency > 50) {
            riskFactors.push({ factor: 'rushing', level: 'high', impact: 0.7 });
        }
        
        if (patterns.abandonment?.severity === 'critical') {
            riskFactors.push({ factor: 'abandonment', level: 'critical', impact: 0.9 });
        }
        
        if (patterns.topicWeakness?.persistentTopics.length > 3) {
            riskFactors.push({ factor: 'knowledge_gaps', level: 'high', impact: 0.8 });
        }
        
        return riskFactors;
    }

    // ===== MÉTODOS DE RECOMENDACIÓN =====

    getFatigueRecommendation(severity, quartileAnalysis) {
        if (severity === 'high') {
            return 'Fatiga severa detectada. Implementar pausas estratégicas cada 25 preguntas. ' +
                   'Practicar técnicas de respiración durante el examen.';
        }
        if (severity === 'medium') {
            return 'Fatiga moderada en la parte final. Reservar preguntas fáciles para el final ' +
                   'o cambiar el orden de resolución.';
        }
        return 'Ligera fatiga al final. Mantener hidratación y hacer microdescansos visuales.';
    }

    getRushRecommendation(scoreDifference, frequency) {
        if (scoreDifference > 1) {
            return `Pierdes ${scoreDifference.toFixed(2)} puntos cuando te apresuras. ` +
                   `Establecer un ritmo mínimo de 1 minuto por pregunta.`;
        }
        if (frequency > 50) {
            return 'Tendencia frecuente a apresurarse. Practicar con cronómetro y ' +
                   'establecer checkpoints de tiempo durante el examen.';
        }
        return 'Ocasionalmente te precipitas. Respirar profundamente antes de marcar respuestas.';
    }

    getAbandonmentRecommendation(severity, distribution) {
        if (severity === 'critical') {
            return 'Número crítico de preguntas sin responder. Implementar estrategia de ' +
                   'respuesta educada en las últimas preguntas. Practicar gestión del tiempo.';
        }
        if (distribution.pattern === 'increasing') {
            return 'Los blancos aumentan al final. Reservar 15 minutos para repasar y ' +
                   'responder preguntas pendientes.';
        }
        return 'Mejorar estrategia de priorización. Marcar preguntas dudosas para revisión posterior.';
    }

    getTopicWeaknessMessage(weaknesses) {
        if (weaknesses.length === 0) {
            return 'No hay patrones claros de debilidad en temas específicos';
        }
        const top3 = weaknesses.slice(0, 3).map(w => w.topic).join(', ');
        return `Debilidades persistentes en: ${top3}. Enfocar estudio en estos temas.`;
    }

    getConfidenceRecommendation(calibration) {
        if (calibration.tendency === 'overconfident') {
            return 'Tiendes a sobreestimar tu rendimiento. Ser más conservador en la ' +
                   'autoevaluación y revisar respuestas con más detenimiento.';
        }
        if (calibration.tendency === 'underconfident') {
            return 'Subestimas tu capacidad. Confiar más en tu preparación y ' +
                   'evitar cambiar respuestas por inseguridad.';
        }
        return 'Tu percepción está bien calibrada. Mantener este nivel de autoconocimiento.';
    }

    getStressRecommendation(responseType, optimal, current) {
        if (responseType === 'negative') {
            return `El estrés afecta negativamente tu rendimiento. Tu nivel óptimo es ${optimal}%. ` +
                   'Practicar técnicas de relajación y mindfulness antes del examen.';
        }
        if (Math.abs(current - optimal) > 20) {
            return `Tu nivel de estrés (${current.toFixed(0)}%) está lejos del óptimo (${optimal}%). ` +
                   'Trabajar en regulación emocional.';
        }
        return 'Gestionas bien el estrés. Mantener rutinas de preparación mental.';
    }

    getTimeManagementRecommendation(avgMinutes, efficiency) {
        if (avgMinutes < 85) {
            return 'Terminas demasiado rápido. Usar todo el tiempo disponible para ' +
                   'revisar respuestas. Objetivo: 90-100 minutos.';
        }
        if (avgMinutes > 105) {
            return 'Riesgo de no terminar a tiempo. Practicar con límite estricto de ' +
                   '1 minuto por pregunta en promedio.';
        }
        if (efficiency < 0.08) {
            return 'Baja eficiencia temporal. Mejorar técnicas de lectura rápida y ' +
                   'toma de decisiones.';
        }
        return 'Buena gestión del tiempo. Mantener este ritmo.';
    }

    getConsistencyRecommendation(cv, trend) {
        if (cv > 35) {
            return 'Alta variabilidad en resultados. Establecer rutinas de estudio más ' +
                   'estructuradas y mantener condiciones similares en cada simulacro.';
        }
        if (cv > 25 && trend > 0) {
            return 'Consistencia empeorando. Identificar factores externos que afectan ' +
                   'el rendimiento y controlarlos.';
        }
        if (trend < 0) {
            return 'Mejorando consistencia. Continuar con las estrategias actuales.';
        }
        return 'Buen nivel de consistencia. Mantener metodología actual.';
    }
}

export default PatternDetector;