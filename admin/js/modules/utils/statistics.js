// admin/js/modules/utils/statistics.js
// Utilidades estadísticas compartidas para evitar duplicación

export class StatisticsUtils {
    /**
     * Calcular correlación de Pearson entre dos arrays
     */
    static calculateCorrelation(x, y) {
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

    /**
     * Calcular regresión lineal
     */
    static calculateLinearRegression(x, y) {
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

    /**
     * Calcular consistencia (desviación estándar)
     */
    static calculateConsistency(results) {
        if (results.length < 3) return 0;
        
        const scores = results.slice(0, 10).map(r => r.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Calcular tendencia simple
     */
    static calculateTrend(values) {
        if (values.length < 2) return 0;
        const x = values.map((_, i) => i);
        const regression = StatisticsUtils.calculateLinearRegression(x, values);
        return regression.slope;
    }

    /**
     * Calcular promedio ponderado (más peso a valores recientes)
     */
    static calculateWeightedAverage(values, decayFactor = 0.1) {
        if (values.length === 0) return 0;
        
        const weights = values.map((_, index) => Math.exp(-index * decayFactor));
        const weightSum = weights.reduce((a, b) => a + b, 0);
        
        const weightedSum = values.reduce((sum, value, index) => 
            sum + value * weights[index], 0
        );
        
        return weightedSum / weightSum;
    }

    /**
     * Calcular percentiles
     */
    static calculatePercentiles(data, percentiles = [10, 25, 50, 75, 90]) {
        const sorted = [...data].sort((a, b) => a - b);
        const n = sorted.length;
        
        const result = {};
        percentiles.forEach(p => {
            const index = Math.floor(n * p / 100);
            result[`p${p}`] = sorted[index];
        });
        
        return result;
    }

    /**
     * Calcular estadísticas básicas
     */
    static calculateBasicStats(data) {
        if (data.length === 0) {
            return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
        }
        
        const sorted = [...data].sort((a, b) => a - b);
        const n = data.length;
        
        const mean = data.reduce((sum, x) => sum + x, 0) / n;
        const median = n % 2 === 0 
            ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
            : sorted[Math.floor(n/2)];
        
        const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        return {
            mean: parseFloat(mean.toFixed(2)),
            median: parseFloat(median.toFixed(2)),
            stdDev: parseFloat(stdDev.toFixed(2)),
            min: Math.min(...data),
            max: Math.max(...data)
        };
    }

    /**
     * Calcular Z-Score
     */
    static calculateZScore(value, mean, stdDev) {
        if (stdDev === 0) return 0;
        return (value - mean) / stdDev;
    }

    /**
     * Calcular percentil de un valor en una distribución
     */
    static calculatePercentileRank(value, data) {
        const sorted = [...data].sort((a, b) => a - b);
        const index = sorted.findIndex(x => x >= value);
        
        if (index === -1) return 100;
        if (index === 0) return 0;
        
        return Math.round((index / sorted.length) * 100);
    }

    /**
     * Detectar outliers usando IQR
     */
    static detectOutliers(data) {
        const sorted = [...data].sort((a, b) => a - b);
        const n = sorted.length;
        
        const q1 = sorted[Math.floor(n * 0.25)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        return {
            outliers: data.filter(x => x < lowerBound || x > upperBound),
            bounds: { lower: lowerBound, upper: upperBound }
        };
    }

    /**
     * Calcular moving average
     */
    static calculateMovingAverage(data, window = 3) {
        const result = [];
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - window + 1);
            const subset = data.slice(start, i + 1);
            const avg = subset.reduce((sum, x) => sum + x, 0) / subset.length;
            result.push(avg);
        }
        
        return result;
    }

    /**
     * Proyectar siguiente valor basado en tendencia
     */
    static projectNextValue(data, method = 'weighted') {
        if (data.length < 3) return data[data.length - 1] || 0;
        
        if (method === 'weighted') {
            // Promedio ponderado de los últimos valores
            const recent = data.slice(-5);
            const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
            
            let projection = 0;
            recent.reverse().forEach((value, i) => {
                if (i < weights.length) {
                    projection += value * weights[i];
                }
            });
            
            return projection;
        } else if (method === 'linear') {
            // Regresión lineal
            const x = data.map((_, i) => i);
            const regression = StatisticsUtils.calculateLinearRegression(x, data);
            return regression.slope * data.length + regression.intercept;
        }
        
        return data[data.length - 1];
    }

    /**
     * Calcular coeficiente de variación
     */
    static calculateCoefficientOfVariation(data) {
        const stats = StatisticsUtils.calculateBasicStats(data);
        if (stats.mean === 0) return 0;
        return (stats.stdDev / stats.mean) * 100;
    }

    /**
     * Test estadístico simple para diferencia significativa
     */
    static isSignificantDifference(group1, group2, threshold = 0.05) {
        const stats1 = StatisticsUtils.calculateBasicStats(group1);
        const stats2 = StatisticsUtils.calculateBasicStats(group2);
        
        // T-test simplificado
        const pooledStdDev = Math.sqrt(
            (stats1.stdDev ** 2 / group1.length) + 
            (stats2.stdDev ** 2 / group2.length)
        );
        
        if (pooledStdDev === 0) return false;
        
        const tStat = Math.abs(stats1.mean - stats2.mean) / pooledStdDev;
        
        // Umbral simplificado para significancia
        return tStat > 1.96; // ~95% confianza
    }
}

// Utilidades específicas para CNP
export class CNPStatistics {
    // Configuración específica para oposiciones CNP
    static config = {
        historicalCutoff: 7.72,
        cutoffStdDev: 0.25,
        passingScore: 5.0,
        totalQuestions: 100,
        penaltyFactor: 0.33, // Penalización por respuesta incorrecta
        topicWeights: {
            juridico: 0.77,    // Temas 1-26
            sociales: 0.15,    // Temas 27-37
            tecnico: 0.08      // Temas 38-45
        }
    };

    /**
     * Calcular probabilidad de aprobar basada en históricos CNP
     * Modelo mejorado con más factores predictivos
     */
    static calculatePassProbability(avgScore, consistency, trend, simulations, additionalFactors = {}) {
        // Sistema de pesos dinámicos basado en la cantidad de datos
        const dataReliability = Math.min(1, simulations / 10);
        
        // 1. Factor de puntuación media (peso base 35%)
        const scoreWeight = 35 + (dataReliability * 5); // Hasta 40% con más datos
        const scoreFactor = (avgScore / this.config.historicalCutoff) * scoreWeight;
        
        // 2. Factor de consistencia mejorado (peso 15%)
        let consistencyFactor = 0;
        if (consistency < 1.0) {
            consistencyFactor = 15; // Muy consistente
        } else if (consistency < 1.5) {
            consistencyFactor = 12;
        } else if (consistency < 2.0) {
            consistencyFactor = 8;
        } else if (consistency < 2.5) {
            consistencyFactor = 4;
        } else {
            consistencyFactor = -5; // Penalización por alta inconsistencia
        }
        
        // 3. Factor de tendencia con análisis de momentum (peso 20%)
        let trendFactor = 0;
        if (trend > 0.1) {
            trendFactor = 20; // Tendencia fuertemente positiva
        } else if (trend > 0.05) {
            trendFactor = 15;
        } else if (trend > 0) {
            trendFactor = 10;
        } else if (trend > -0.05) {
            trendFactor = 5; // Estable
        } else if (trend > -0.1) {
            trendFactor = -5; // Ligera caída
        } else {
            trendFactor = -10; // Caída pronunciada
        }
        
        // 4. Factor de experiencia con rendimientos decrecientes (peso 15%)
        const experienceBase = Math.sqrt(simulations); // Rendimientos decrecientes
        const experienceFactor = Math.min(15, experienceBase * 3);
        
        // 5. Factores adicionales (peso 15%)
        let additionalScore = 0;
        
        // Distancia al corte histórico
        const distanceToHistorical = avgScore - this.config.historicalCutoff;
        if (distanceToHistorical > 1) {
            additionalScore += 8;
        } else if (distanceToHistorical > 0.5) {
            additionalScore += 5;
        } else if (distanceToHistorical > 0) {
            additionalScore += 3;
        } else if (distanceToHistorical > -0.5) {
            additionalScore += 0;
        } else {
            additionalScore -= 5;
        }
        
        // Análisis de últimos resultados (si están disponibles)
        if (additionalFactors.recentScores && additionalFactors.recentScores.length >= 3) {
            const recentAvg = additionalFactors.recentScores.slice(0, 3).reduce((a, b) => a + b) / 3;
            if (recentAvg > avgScore + 0.5) {
                additionalScore += 5; // Mejora reciente significativa
            } else if (recentAvg < avgScore - 0.5) {
                additionalScore -= 3; // Empeoramiento reciente
            }
        }
        
        // Factor de tiempo (si está disponible)
        if (additionalFactors.avgTimeRatio) {
            if (additionalFactors.avgTimeRatio < 0.8) {
                additionalScore -= 3; // Posible precipitación
            } else if (additionalFactors.avgTimeRatio > 1.2) {
                additionalScore -= 2; // Posible lentitud excesiva
            } else {
                additionalScore += 2; // Tiempo óptimo
            }
        }
        
        // Cálculo final con normalización
        let probability = scoreFactor + consistencyFactor + trendFactor + 
                         experienceFactor + additionalScore;
        
        // Aplicar función sigmoidea suave para evitar extremos
        probability = 100 / (1 + Math.exp(-0.05 * (probability - 50)));
        
        // Ajuste final basado en número de simulacros
        if (simulations < 3) {
            // Con pocos datos, tender hacia el centro
            probability = probability * 0.7 + 50 * 0.3;
        }
        
        // Asegurar rango 0-100
        return Math.max(0, Math.min(100, Math.round(probability)));
    }

    /**
     * Calcular puntuación neta con penalización CNP
     */
    static calculateNetScore(correct, wrong, blank) {
        const total = correct + wrong + blank;
        const netScore = (correct - (wrong * this.config.penaltyFactor)) / total * 10;
        return Math.max(0, parseFloat(netScore.toFixed(2)));
    }

    /**
     * Estimar posición en el ranking nacional
     */
    static estimateNationalRanking(score, totalCandidates = 30000) {
        // Basado en distribución normal histórica
        const mean = 6.5;
        const stdDev = 1.5;
        
        const zScore = StatisticsUtils.calculateZScore(score, mean, stdDev);
        const percentile = this.normalCDF(zScore) * 100;
        
        const position = Math.round(totalCandidates * (1 - percentile / 100));
        
        return {
            position,
            percentile: Math.round(percentile),
            betterThan: Math.round(percentile)
        };
    }

    /**
     * Función de distribución acumulativa normal
     */
    static normalCDF(z) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        
        const sign = z < 0 ? -1 : 1;
        z = Math.abs(z) / Math.sqrt(2);
        
        const t = 1 / (1 + p * z);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
        
        return 0.5 * (1 + sign * y);
    }

    /**
     * Modelo predictivo avanzado usando múltiples indicadores
     * Retorna predicción detallada con intervalos de confianza
     */
    static calculateAdvancedPrediction(studentData, allResults) {
        const prediction = {
            probability: 50,
            confidence: 'low',
            confidenceInterval: { lower: 30, upper: 70 },
            keyFactors: [],
            recommendations: [],
            projectedScore: 0,
            riskLevel: 'medium'
        };

        // Validar datos mínimos
        if (!studentData || !allResults || allResults.length < 3) {
            prediction.keyFactors.push('Datos insuficientes para predicción precisa');
            return prediction;
        }

        // 1. Análisis de tendencia temporal con pesos exponenciales
        const scores = allResults.map(r => r.score);
        const timeWeights = scores.map((_, i) => Math.exp(-i * 0.1));
        const weightedAvg = scores.reduce((sum, score, i) => 
            sum + score * timeWeights[i], 0) / timeWeights.reduce((a, b) => a + b);

        // 2. Análisis de volatilidad y patrones
        const volatility = StatisticsUtils.calculateCoefficientOfVariation(scores);
        const trend = StatisticsUtils.calculateTrend(scores);
        const consistency = StatisticsUtils.calculateConsistency(allResults);

        // 3. Análisis de patrones de respuesta
        const responsePatterns = this.analyzeResponsePatterns(allResults);
        
        // 4. Factor de tiempo y precipitación
        const timeAnalysis = this.analyzeTimePatterns(allResults);
        
        // 5. Análisis por bloques temáticos
        const topicAnalysis = this.analyzeTopicPerformance(allResults);

        // 6. Calcular probabilidad base
        const additionalFactors = {
            recentScores: scores.slice(0, 5),
            avgTimeRatio: timeAnalysis.avgRatio,
            responsePatterns: responsePatterns,
            topicStrengths: topicAnalysis
        };

        prediction.probability = this.calculatePassProbability(
            weightedAvg,
            consistency,
            trend,
            allResults.length,
            additionalFactors
        );

        // 7. Calcular intervalo de confianza
        const confidenceMargin = Math.max(5, 30 - (allResults.length * 2));
        prediction.confidenceInterval = {
            lower: Math.max(0, prediction.probability - confidenceMargin),
            upper: Math.min(100, prediction.probability + confidenceMargin)
        };

        // 8. Determinar nivel de confianza
        if (allResults.length >= 10 && volatility < 15) {
            prediction.confidence = 'high';
        } else if (allResults.length >= 5 && volatility < 25) {
            prediction.confidence = 'medium';
        } else {
            prediction.confidence = 'low';
        }

        // 9. Proyectar puntuación esperada
        prediction.projectedScore = this.projectExamScore(
            weightedAvg, 
            trend, 
            consistency,
            responsePatterns
        );

        // 10. Identificar factores clave
        if (trend > 0.1) {
            prediction.keyFactors.push('Tendencia de mejora sostenida');
        } else if (trend < -0.1) {
            prediction.keyFactors.push('Tendencia negativa preocupante');
        }

        if (consistency < 1.5) {
            prediction.keyFactors.push('Alto nivel de consistencia');
        } else if (consistency > 2.5) {
            prediction.keyFactors.push('Resultados muy variables');
        }

        if (responsePatterns.blankRate > 0.15) {
            prediction.keyFactors.push('Alto porcentaje de preguntas sin responder');
        }

        if (timeAnalysis.rushingTendency) {
            prediction.keyFactors.push('Tendencia a precipitarse en los exámenes');
        }

        // 11. Generar recomendaciones específicas
        prediction.recommendations = this.generatePredictiveRecommendations(
            prediction,
            responsePatterns,
            topicAnalysis,
            timeAnalysis
        );

        // 12. Calcular nivel de riesgo
        if (prediction.probability < 30) {
            prediction.riskLevel = 'critical';
        } else if (prediction.probability < 50) {
            prediction.riskLevel = 'high';
        } else if (prediction.probability < 70) {
            prediction.riskLevel = 'medium';
        } else {
            prediction.riskLevel = 'low';
        }

        return prediction;
    }

    /**
     * Analizar patrones de respuesta
     */
    static analyzeResponsePatterns(results) {
        const patterns = {
            blankRate: 0,
            errorRate: 0,
            correctRate: 0,
            avgQuestionsAttempted: 0,
            rushingIndicator: false
        };

        if (results.length === 0) return patterns;

        const validResults = results.filter(r => 
            r.correct_answers !== undefined && 
            r.wrong_answers !== undefined
        );

        if (validResults.length > 0) {
            const totals = validResults.reduce((acc, r) => {
                const total = (r.correct_answers || 0) + (r.wrong_answers || 0) + (r.blank_answers || 0);
                acc.correct += r.correct_answers || 0;
                acc.wrong += r.wrong_answers || 0;
                acc.blank += r.blank_answers || 0;
                acc.total += total;
                return acc;
            }, { correct: 0, wrong: 0, blank: 0, total: 0 });

            if (totals.total > 0) {
                patterns.blankRate = totals.blank / totals.total;
                patterns.errorRate = totals.wrong / totals.total;
                patterns.correctRate = totals.correct / totals.total;
                patterns.avgQuestionsAttempted = (totals.correct + totals.wrong) / validResults.length;
            }
        }

        // Detectar precipitación
        const timeData = results.filter(r => r.time_taken);
        if (timeData.length >= 3) {
            const avgTime = timeData.reduce((sum, r) => sum + r.time_taken, 0) / timeData.length;
            const rushCount = timeData.filter(r => r.time_taken < avgTime * 0.8).length;
            patterns.rushingIndicator = rushCount > timeData.length * 0.3;
        }

        return patterns;
    }

    /**
     * Analizar patrones de tiempo
     */
    static analyzeTimePatterns(results) {
        const analysis = {
            avgTime: 0,
            avgRatio: 1,
            rushingTendency: false,
            optimalTime: 90 // minutos
        };

        const timeData = results.filter(r => r.time_taken);
        if (timeData.length === 0) return analysis;

        analysis.avgTime = timeData.reduce((sum, r) => sum + r.time_taken, 0) / timeData.length;
        analysis.avgRatio = analysis.avgTime / analysis.optimalTime;

        // Detectar tendencia a precipitarse
        const rushResults = timeData.filter(r => r.time_taken < analysis.optimalTime * 0.8);
        analysis.rushingTendency = rushResults.length > timeData.length * 0.4;

        return analysis;
    }

    /**
     * Analizar rendimiento por temas
     */
    static analyzeTopicPerformance(results) {
        const topicMap = new Map();

        // Agrupar por bloques temáticos CNP
        results.forEach(r => {
            if (r.topic_code) {
                const topicNum = parseInt(r.topic_code.replace(/\D/g, ''));
                let block = 'general';
                
                if (topicNum >= 1 && topicNum <= 26) {
                    block = 'juridico';
                } else if (topicNum >= 27 && topicNum <= 37) {
                    block = 'sociales';
                } else if (topicNum >= 38 && topicNum <= 45) {
                    block = 'tecnico';
                }

                if (!topicMap.has(block)) {
                    topicMap.set(block, { scores: [], count: 0 });
                }
                
                topicMap.get(block).scores.push(r.score);
                topicMap.get(block).count++;
            }
        });

        const analysis = {};
        topicMap.forEach((data, block) => {
            if (data.scores.length > 0) {
                analysis[block] = {
                    avg: data.scores.reduce((a, b) => a + b) / data.scores.length,
                    count: data.count,
                    weight: this.config.topicWeights[block] || 0.1
                };
            }
        });

        return analysis;
    }

    /**
     * Proyectar puntuación esperada en el examen
     */
    static projectExamScore(weightedAvg, trend, consistency, patterns) {
        let projectedScore = weightedAvg;

        // Ajustar por tendencia
        projectedScore += trend * 2; // Proyectar 2 simulacros más

        // Ajustar por consistencia
        if (consistency > 2) {
            // Alta variabilidad, usar percentil 40
            projectedScore *= 0.9;
        }

        // Ajustar por patrones de respuesta
        if (patterns.blankRate > 0.15) {
            // Muchas sin responder, potencial de mejora
            projectedScore *= 0.95;
        }

        // Ajustar por factor de estrés del examen real
        projectedScore *= 0.97; // 3% de penalización por estrés

        return Math.max(0, Math.min(10, parseFloat(projectedScore.toFixed(2))));
    }

    /**
     * Generar recomendaciones predictivas específicas
     */
    static generatePredictiveRecommendations(prediction, patterns, topicAnalysis, timeAnalysis) {
        const recommendations = [];

        // Recomendaciones basadas en probabilidad
        if (prediction.probability < 30) {
            recommendations.push({
                priority: 'critical',
                area: 'general',
                text: 'Necesita intervención inmediata y plan de estudio intensivo'
            });
        }

        // Recomendaciones basadas en patrones
        if (patterns.blankRate > 0.15) {
            recommendations.push({
                priority: 'high',
                area: 'estrategia',
                text: 'Practicar gestión del tiempo para responder todas las preguntas'
            });
        }

        if (patterns.errorRate > 0.35) {
            recommendations.push({
                priority: 'high',
                area: 'conocimiento',
                text: 'Reforzar conceptos fundamentales para reducir errores'
            });
        }

        // Recomendaciones basadas en tiempo
        if (timeAnalysis.rushingTendency) {
            recommendations.push({
                priority: 'medium',
                area: 'tiempo',
                text: 'Practicar ritmo constante, evitar precipitación'
            });
        }

        // Recomendaciones por bloques temáticos
        Object.entries(topicAnalysis).forEach(([block, data]) => {
            if (data.avg < 6 && data.weight > 0.1) {
                recommendations.push({
                    priority: 'high',
                    area: block,
                    text: `Reforzar bloque ${block} (promedio: ${data.avg.toFixed(1)})`
                });
            }
        });

        return recommendations.slice(0, 5); // Máximo 5 recomendaciones
    }
}

// Exportar todo
export default {
    StatisticsUtils,
    CNPStatistics
};