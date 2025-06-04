// admin/js/modules/analytics/insights.js
// Módulo especializado en análisis de insights de temas problemáticos

import { StatisticsUtils } from '../utils/statistics.js';

export class TopicInsights {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.topicStudentMapping = {};
        this.currentTopicAnalysis = null;
        this.currentDrillDownData = null;
    }

    /**
     * Analizar temas problemáticos por simulacro con correlaciones
     * @returns {Object} Análisis detallado de temas débiles por simulacro
     */
    async analyzeProblematicTopicsBySimulation(results, simulations) {
        // Almacenar datos detallados para drill-down
        this.topicStudentMapping = {};
        
        const topicAnalysis = {};
        
        // Agrupar resultados por simulacro
        const resultsBySimulation = {};
        results.forEach(result => {
            if (!resultsBySimulation[result.simulation_id]) {
                resultsBySimulation[result.simulation_id] = [];
            }
            resultsBySimulation[result.simulation_id].push(result);
        });
        
        // Analizar cada simulacro
        for (const [simulationId, simulationResults] of Object.entries(resultsBySimulation)) {
            const simulation = simulations.find(s => s.id === simulationId);
            if (!simulation) continue;
            
            const topicFrequency = {};
            let totalResponses = 0;
            
            // Contar frecuencia de temas problemáticos y mapear estudiantes
            simulationResults.forEach(result => {
                if (result.weakest_topics && Array.isArray(result.weakest_topics)) {
                    totalResponses++;
                    result.weakest_topics.forEach(topic => {
                        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
                        
                        // Mapear estudiantes por tema para drill-down
                        const key = `${simulationId}_${topic}`;
                        if (!this.topicStudentMapping[key]) {
                            this.topicStudentMapping[key] = [];
                        }
                        
                        const student = this.dashboard.data.students.find(s => s.id === result.user_id);
                        if (student) {
                            this.topicStudentMapping[key].push({
                                id: student.id,
                                name: student.username,
                                email: student.email,
                                cohort: student.cohort,
                                score: result.score,
                                avgScore: student.average_score || 0
                            });
                        }
                    });
                }
            });
            
            // Calcular estadísticas y ordenar
            const topicStats = Object.entries(topicFrequency)
                .map(([topic, count]) => ({
                    topic,
                    count,
                    percentage: totalResponses > 0 ? (count / totalResponses * 100) : 0,
                    avgScoreImpact: this.calculateTopicScoreImpact(topic, simulationResults)
                }))
                .sort((a, b) => b.count - a.count);
            
            topicAnalysis[simulationId] = {
                simulation,
                weekNumber: simulation.week_number,
                totalParticipants: simulationResults.length,
                totalResponses,
                responseRate: simulationResults.length > 0 ? 
                    (totalResponses / simulationResults.length * 100) : 0,
                topicStats,
                topProblematicTopics: topicStats.slice(0, 5), // Top 5
                criticalTopics: topicStats.filter(t => t.percentage >= 30) // 30% umbral crítico
            };
        }
        
        // Análisis agregado cross-simulacro
        const globalTopicTrends = this.analyzeTopicTrends(topicAnalysis);
        
        // Análisis de correlación tema-nota
        const correlationAnalysis = this.analyzeTopicScoreCorrelations(results, simulations);
        
        return {
            bySimulation: topicAnalysis,
            globalTrends: globalTopicTrends,
            correlations: correlationAnalysis,
            insights: this.generateTopicInsights(topicAnalysis, globalTopicTrends, correlationAnalysis)
        };
    }

    /**
     * Calcular impacto de un tema en el score
     */
    calculateTopicScoreImpact(topic, results) {
        const withTopic = results.filter(r => 
            r.weakest_topics && r.weakest_topics.includes(topic)
        );
        const withoutTopic = results.filter(r => 
            r.weakest_topics && !r.weakest_topics.includes(topic)
        );
        
        if (withTopic.length === 0 || withoutTopic.length === 0) return 0;
        
        const avgWithTopic = withTopic.reduce((sum, r) => sum + r.score, 0) / withTopic.length;
        const avgWithoutTopic = withoutTopic.reduce((sum, r) => sum + r.score, 0) / withoutTopic.length;
        
        return avgWithoutTopic - avgWithTopic; // Diferencia positiva = tema problemático
    }

    /**
     * Analizar tendencias de temas a través del tiempo
     */
    analyzeTopicTrends(topicAnalysis) {
        const topicTimeline = {};
        
        // Ordenar simulacros por semana
        const sortedSimulations = Object.values(topicAnalysis)
            .sort((a, b) => a.weekNumber - b.weekNumber);
        
        // Construir timeline por tema
        sortedSimulations.forEach(simData => {
            simData.topicStats.forEach(topic => {
                if (!topicTimeline[topic.topic]) {
                    topicTimeline[topic.topic] = {
                        topic: topic.topic,
                        occurrences: [],
                        totalMentions: 0,
                        avgPercentage: 0,
                        trend: 'stable'
                    };
                }
                
                topicTimeline[topic.topic].occurrences.push({
                    week: simData.weekNumber,
                    percentage: topic.percentage,
                    count: topic.count
                });
                topicTimeline[topic.topic].totalMentions += topic.count;
            });
        });
        
        // Calcular tendencias y promedios
        Object.values(topicTimeline).forEach(topic => {
            topic.avgPercentage = topic.occurrences.reduce((sum, o) => sum + o.percentage, 0) / 
                                  topic.occurrences.length;
            
            // Calcular tendencia simple
            if (topic.occurrences.length >= 3) {
                const firstHalf = topic.occurrences.slice(0, Math.floor(topic.occurrences.length / 2));
                const secondHalf = topic.occurrences.slice(Math.floor(topic.occurrences.length / 2));
                
                const firstAvg = firstHalf.reduce((sum, o) => sum + o.percentage, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((sum, o) => sum + o.percentage, 0) / secondHalf.length;
                
                if (secondAvg > firstAvg * 1.2) topic.trend = 'increasing';
                else if (secondAvg < firstAvg * 0.8) topic.trend = 'decreasing';
            }
        });
        
        return topicTimeline;
    }

    /**
     * Analizar correlación entre temas problemáticos y notas medias
     */
    analyzeTopicScoreCorrelations(results, simulations) {
        const topicCorrelations = {};
        const allTopics = new Set();
        
        // Recopilar todos los temas únicos
        results.forEach(result => {
            if (result.weakest_topics) {
                result.weakest_topics.forEach(topic => allTopics.add(topic));
            }
        });
        
        // Para cada tema, analizar correlación con scores
        allTopics.forEach(topic => {
            const studentsWithTopic = new Set();
            const studentsWithoutTopic = new Set();
            
            results.forEach(result => {
                if (result.weakest_topics && result.weakest_topics.includes(topic)) {
                    studentsWithTopic.add(result.user_id);
                } else {
                    studentsWithoutTopic.add(result.user_id);
                }
            });
            
            // Calcular scores promedio para cada grupo
            const scoresWithTopic = [];
            const scoresWithoutTopic = [];
            
            this.dashboard.data.students.forEach(student => {
                if (studentsWithTopic.has(student.id)) {
                    scoresWithTopic.push(student.average_score || 0);
                } else if (studentsWithoutTopic.has(student.id)) {
                    scoresWithoutTopic.push(student.average_score || 0);
                }
            });
            
            if (scoresWithTopic.length > 5 && scoresWithoutTopic.length > 5) {
                const avgWithTopic = scoresWithTopic.reduce((a, b) => a + b, 0) / scoresWithTopic.length;
                const avgWithoutTopic = scoresWithoutTopic.reduce((a, b) => a + b, 0) / scoresWithoutTopic.length;
                const impact = avgWithoutTopic - avgWithTopic;
                
                topicCorrelations[topic] = {
                    topic,
                    studentsAffected: studentsWithTopic.size,
                    avgScoreWithTopic: avgWithTopic,
                    avgScoreWithoutTopic: avgWithoutTopic,
                    scoreImpact: impact,
                    impactPercentage: ((impact / avgWithoutTopic) * 100),
                    correlation: this.calculateCorrelationCoefficient(topic, results)
                };
            }
        });
        
        // Ordenar por impacto
        const sortedCorrelations = Object.values(topicCorrelations)
            .sort((a, b) => b.scoreImpact - a.scoreImpact);
        
        return {
            correlations: topicCorrelations,
            topImpactTopics: sortedCorrelations.slice(0, 5),
            averageImpact: sortedCorrelations.reduce((sum, t) => sum + t.scoreImpact, 0) / sortedCorrelations.length
        };
    }

    /**
     * Calcular coeficiente de correlación para un tema
     */
    calculateCorrelationCoefficient(topic, results) {
        // Preparar arrays para correlación
        const hasTopicArray = [];
        const scoreArray = [];
        
        const studentScores = {};
        results.forEach(r => {
            if (!studentScores[r.user_id]) {
                studentScores[r.user_id] = { scores: [], hasTopic: false };
            }
            studentScores[r.user_id].scores.push(r.score);
            if (r.weakest_topics && r.weakest_topics.includes(topic)) {
                studentScores[r.user_id].hasTopic = true;
            }
        });
        
        Object.values(studentScores).forEach(data => {
            if (data.scores.length > 0) {
                hasTopicArray.push(data.hasTopic ? 1 : 0);
                scoreArray.push(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
            }
        });
        
        // Calcular correlación de Pearson
        return StatisticsUtils.calculateCorrelation(hasTopicArray, scoreArray);
    }

    /**
     * Generar insights sobre temas problemáticos
     */
    generateTopicInsights(topicAnalysis, globalTrends, correlationAnalysis) {
        const insights = [];
        
        // 1. Temas persistentemente problemáticos
        const persistentTopics = Object.values(globalTrends)
            .filter(t => t.avgPercentage >= 25 && t.occurrences.length >= 3)
            .sort((a, b) => b.avgPercentage - a.avgPercentage);
        
        if (persistentTopics.length > 0) {
            insights.push({
                type: 'critical',
                title: 'Temas Persistentemente Problemáticos',
                message: `Los siguientes temas aparecen consistentemente como problemáticos: ${
                    persistentTopics.slice(0, 3).map(t => t.topic).join(', ')
                }. Afectan al ${persistentTopics[0].avgPercentage.toFixed(0)}% de estudiantes en promedio.`,
                action: 'Considerar sesiones de refuerzo específicas para estos temas.',
                data: persistentTopics
            });
        }
        
        // 2. Temas con tendencia creciente
        const increasingTopics = Object.values(globalTrends)
            .filter(t => t.trend === 'increasing' && t.avgPercentage >= 15)
            .sort((a, b) => b.totalMentions - a.totalMentions);
        
        if (increasingTopics.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Temas con Dificultad Creciente',
                message: `${increasingTopics[0].topic} muestra una tendencia creciente de dificultad, 
                         pasando de afectar a pocos estudiantes a ser problemático para muchos.`,
                action: 'Revisar la metodología de enseñanza de estos temas.',
                data: increasingTopics
            });
        }
        
        // 3. Análisis del último simulacro
        const lastSimulation = Object.values(topicAnalysis)
            .sort((a, b) => b.weekNumber - a.weekNumber)[0];
        
        if (lastSimulation && lastSimulation.criticalTopics.length > 0) {
            insights.push({
                type: 'info',
                title: 'Alerta del Último Simulacro',
                message: `En RF${lastSimulation.weekNumber}, ${lastSimulation.criticalTopics.length} temas 
                         fueron problemáticos para más del 30% de los estudiantes.`,
                action: 'Revisar estos temas antes del próximo simulacro.',
                data: lastSimulation.criticalTopics
            });
        }
        
        // 4. Análisis de correlación tema-nota
        if (correlationAnalysis && correlationAnalysis.topImpactTopics.length > 0) {
            const topImpact = correlationAnalysis.topImpactTopics[0];
            insights.push({
                type: 'critical',
                title: 'Temas con Mayor Impacto en Notas',
                message: `El tema "${topImpact.topic}" tiene el mayor impacto negativo, reduciendo la nota media en 
                         ${topImpact.scoreImpact.toFixed(2)} puntos (${topImpact.impactPercentage.toFixed(0)}% de impacto).
                         Los estudiantes que lo marcan como problemático tienen una media de ${topImpact.avgScoreWithTopic.toFixed(2)} 
                         vs ${topImpact.avgScoreWithoutTopic.toFixed(2)} de quienes no lo marcan.`,
                action: 'Priorizar este tema en sesiones de refuerzo para maximizar mejora de notas.',
                data: correlationAnalysis.topImpactTopics
            });
        }
        
        // 5. Comparación entre cohortes
        const cohortDifferences = this.analyzeTopicDifferencesByCohort(topicAnalysis);
        if (cohortDifferences.significant) {
            insights.push({
                type: 'info',
                title: 'Diferencias por Cohorte Detectadas',
                message: cohortDifferences.message,
                action: 'Adaptar el contenido según las necesidades de cada cohorte.',
                data: cohortDifferences.data
            });
        }
        
        return insights;
    }

    /**
     * Analizar diferencias de temas por cohorte
     */
    analyzeTopicDifferencesByCohort(topicAnalysis) {
        const cohortTopics = {};
        
        // Recopilar temas por cohorte desde el mapping de estudiantes
        Object.entries(this.topicStudentMapping).forEach(([key, students]) => {
            const [, topic] = key.split('_');
            
            students.forEach(student => {
                const cohort = student.cohort;
                if (!cohortTopics[cohort]) {
                    cohortTopics[cohort] = {};
                }
                cohortTopics[cohort][topic] = (cohortTopics[cohort][topic] || 0) + 1;
            });
        });
        
        // Identificar diferencias significativas
        const topics = new Set();
        Object.values(cohortTopics).forEach(topicMap => {
            Object.keys(topicMap).forEach(topic => topics.add(topic));
        });
        
        const differences = [];
        topics.forEach(topic => {
            const cohortPercentages = {};
            Object.entries(cohortTopics).forEach(([cohort, topicMap]) => {
                const count = topicMap[topic] || 0;
                const totalStudents = Object.values(this.topicStudentMapping)
                    .flat()
                    .filter(s => s.cohort === cohort).length;
                cohortPercentages[cohort] = totalStudents > 0 ? (count / totalStudents * 100) : 0;
            });
            
            const values = Object.values(cohortPercentages);
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            if (max - min > 20) { // Diferencia significativa > 20%
                differences.push({
                    topic,
                    cohortPercentages,
                    difference: max - min
                });
            }
        });
        
        if (differences.length > 0) {
            const topDiff = differences.sort((a, b) => b.difference - a.difference)[0];
            const message = `El tema "${topDiff.topic}" muestra diferencias significativas entre cohortes: ${
                Object.entries(topDiff.cohortPercentages)
                    .map(([c, p]) => `${c}: ${p.toFixed(0)}%`)
                    .join(', ')
            }`;
            
            return {
                significant: true,
                message,
                data: differences
            };
        }
        
        return { significant: false };
    }

    // Métodos de UI (drill-down, filtros, etc.)
    showTopicDrillDown(simulationId, topic) {
        const key = `${simulationId}_${topic}`;
        const students = this.topicStudentMapping[key] || [];
        
        const modal = document.getElementById('topicDrillDownModal');
        const title = document.getElementById('drillDownTitle');
        const content = document.getElementById('drillDownContent');
        
        // Encontrar el simulacro
        const simulation = this.dashboard.data.simulations.find(s => s.id === simulationId);
        const weekNumber = simulation ? simulation.week_number : '?';
        
        title.textContent = `Estudiantes que marcaron "${topic}" en RF${weekNumber}`;
        
        // Agrupar por cohorte
        const byCohort = {};
        students.forEach(student => {
            if (!byCohort[student.cohort]) {
                byCohort[student.cohort] = [];
            }
            byCohort[student.cohort].push(student);
        });
        
        content.innerHTML = `
            <div class="drill-down-stats">
                <div class="stat-box">
                    <div class="stat-label">Total estudiantes</div>
                    <div class="stat-value">${students.length}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Score promedio en simulacro</div>
                    <div class="stat-value">${
                        (students.reduce((sum, s) => sum + s.score, 0) / students.length).toFixed(2)
                    }/10</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Nota media general</div>
                    <div class="stat-value">${
                        (students.reduce((sum, s) => sum + s.avgScore, 0) / students.length).toFixed(2)
                    }/10</div>
                </div>
            </div>
            
            <div class="cohort-breakdown">
                ${Object.entries(byCohort).map(([cohort, cohortStudents]) => `
                    <div class="cohort-section">
                        <h4>${cohort} (${cohortStudents.length} estudiantes)</h4>
                        <table class="student-list-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Score Simulacro</th>
                                    <th>Media General</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cohortStudents.map(student => `
                                    <tr>
                                        <td>${student.name}</td>
                                        <td>${student.email}</td>
                                        <td>${student.score.toFixed(2)}</td>
                                        <td>${student.avgScore.toFixed(2)}</td>
                                        <td>
                                            <button class="btn-icon" 
                                                    onclick="window.dashboardAdmin.showStudentDetail('${student.id}')"
                                                    title="Ver detalles">
                                                👁️
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Guardar datos actuales para exportación
        this.currentDrillDownData = {
            topic,
            simulationId,
            weekNumber,
            students
        };
        
        modal.style.display = 'flex';
    }

    closeDrillDown() {
        document.getElementById('topicDrillDownModal').style.display = 'none';
    }

    filterTopicAnalysis() {
        const cohort = document.getElementById('topicCohortFilter').value;
        const period = document.getElementById('topicPeriodFilter').value;
        const threshold = parseInt(document.getElementById('topicThresholdFilter').value);
        
        console.log('Filtrando por:', { cohort, period, threshold });
        // Implementar filtrado real aquí
    }

    async exportTopicStudents() {
        if (!this.currentDrillDownData) return;
        
        const { topic, weekNumber, students } = this.currentDrillDownData;
        const exportsModule = await this.dashboard.loadModule('exports');
        
        const data = students.map(s => ({
            Nombre: s.name,
            Email: s.email,
            Cohorte: s.cohort,
            'Score Simulacro': s.score,
            'Media General': s.avgScore,
            Tema: topic,
            Simulacro: `RF${weekNumber}`
        }));
        
        const csv = exportsModule.objectsToCSV(data);
        exportsModule.downloadCSV(csv, `estudiantes_tema_${topic}_RF${weekNumber}.csv`);
    }

    async createTopicIntervention() {
        if (!this.currentDrillDownData) return;
        
        const { topic, students } = this.currentDrillDownData;
        
        if (confirm(`¿Crear plan de intervención para ${students.length} estudiantes con dificultades en "${topic}"?`)) {
            this.dashboard.showNotification('success', 
                `Plan de intervención creado para ${students.length} estudiantes`);
            
            this.closeDrillDown();
        }
    }
}

export default TopicInsights;