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
     */
    static calculatePassProbability(avgScore, consistency, trend, simulations) {
        // Modelo simplificado basado en datos históricos
        let baseProbability = 50;
        
        // Factor de puntuación media (peso 40%)
        const scoreFactor = (avgScore / this.config.historicalCutoff) * 40;
        
        // Factor de consistencia (peso 20%)
        const consistencyFactor = consistency < 1.5 ? 20 : 
                                consistency < 2.5 ? 10 : 0;
        
        // Factor de tendencia (peso 20%)
        const trendFactor = trend > 0 ? 20 : 
                           trend < -0.1 ? -10 : 10;
        
        // Factor de experiencia (peso 20%)
        const experienceFactor = Math.min(20, (simulations / 10) * 20);
        
        baseProbability = scoreFactor + consistencyFactor + trendFactor + experienceFactor;
        
        // Ajustar a rango 0-100
        return Math.max(0, Math.min(100, Math.round(baseProbability)));
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
}

// Exportar todo
export default {
    StatisticsUtils,
    CNPStatistics
};