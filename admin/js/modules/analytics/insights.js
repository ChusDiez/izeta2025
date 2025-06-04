// admin/js/modules/analytics/insights.js
// Módulo especializado en análisis de insights de temas problemáticos

import { StatisticsUtils } from '../utils/statistics.js';

export class TopicInsights {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.topicStudentMapping = {};
        this.currentTopicAnalysis = null;
        this.currentDrillDownData = null;
        
        // Configuración de umbrales
        this.config = {
            criticalThreshold: 30, // % de estudiantes
            significantDifferenceThreshold: 20, // % diferencia entre cohortes
            minStudentsForAnalysis: 5,
            persistentTopicThreshold: 0.3 // 30% de apariciones
        };
        
        // Cache para optimización
        this.cache = new Map();
    }

    /**
     * Analizar temas problemáticos por simulacro con correlaciones
     * @returns {Object} Análisis detallado de temas débiles por simulacro
     */
    async analyzeProblematicTopicsBySimulation(results, simulations) {
        try {
            // Validar entradas
            if (!results || !Array.isArray(results) || results.length === 0) {
                console.warn('No hay resultados para analizar temas problemáticos');
                return this.getEmptyAnalysis();
            }
            
            if (!simulations || !Array.isArray(simulations)) {
                console.warn('No hay simulacros para el análisis');
                return this.getEmptyAnalysis();
            }
            
            // Verificar cache
            const cacheKey = `topic_analysis_${results.length}_${simulations.length}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            // Almacenar datos detallados para drill-down
            this.topicStudentMapping = {};
            
            const topicAnalysis = {};
            
            // Agrupar resultados por simulacro usando Map para mejor performance
            const resultsBySimulation = this.groupResultsBySimulation(results);
            
            // Analizar cada simulacro
            for (const [simulationId, simulationResults] of resultsBySimulation.entries()) {
                const simulation = simulations.find(s => s.id === simulationId);
                if (!simulation) continue;
                
                const analysis = this.analyzeSimulationTopics(simulation, simulationResults);
                topicAnalysis[simulationId] = analysis;
            }
            
            // Análisis agregado cross-simulacro
            const globalTopicTrends = this.analyzeTopicTrends(topicAnalysis);
            
            // Análisis de correlación tema-nota
            const correlationAnalysis = this.analyzeTopicScoreCorrelations(results, simulations);
            
            const result = {
                bySimulation: topicAnalysis,
                globalTrends: globalTopicTrends,
                correlations: correlationAnalysis,
                insights: this.generateTopicInsights(topicAnalysis, globalTopicTrends, correlationAnalysis),
                metadata: {
                    totalSimulations: simulations.length,
                    totalResults: results.length,
                    analysisDate: new Date().toISOString()
                }
            };
            
            // Guardar en cache
            this.cache.set(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error('Error en análisis de temas problemáticos:', error);
            return this.getEmptyAnalysis();
        }
    }

    /**
     * Agrupar resultados por simulacro usando Map para mejor performance
     */
    groupResultsBySimulation(results) {
        const grouped = new Map();
        
        for (const result of results) {
            if (!result.simulation_id) continue;
            
            if (!grouped.has(result.simulation_id)) {
                grouped.set(result.simulation_id, []);
            }
            grouped.get(result.simulation_id).push(result);
        }
        
        return grouped;
    }

    /**
     * Analizar temas de un simulacro específico
     */
    analyzeSimulationTopics(simulation, simulationResults) {
        const topicFrequency = new Map();
        let totalResponses = 0;
        
        // Contar frecuencia de temas problemáticos y mapear estudiantes
        for (const result of simulationResults) {
            if (!result.weakest_topics || !Array.isArray(result.weakest_topics)) continue;
            
            totalResponses++;
            
            for (const topic of result.weakest_topics) {
                // Actualizar frecuencia
                topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
                
                // Mapear estudiantes por tema para drill-down
                this.addStudentToTopicMapping(simulation.id, topic, result);
            }
        }
        
        // Calcular estadísticas y ordenar
        const topicStats = Array.from(topicFrequency.entries())
            .map(([topic, count]) => ({
                topic,
                count,
                percentage: totalResponses > 0 ? (count / totalResponses * 100) : 0,
                avgScoreImpact: this.calculateTopicScoreImpact(topic, simulationResults)
            }))
            .sort((a, b) => b.count - a.count);
        
        return {
            simulation,
            weekNumber: simulation.week_number,
            totalParticipants: simulationResults.length,
            totalResponses,
            responseRate: simulationResults.length > 0 ? 
                (totalResponses / simulationResults.length * 100) : 0,
            topicStats,
            topProblematicTopics: topicStats.slice(0, 5),
            criticalTopics: topicStats.filter(t => t.percentage >= this.config.criticalThreshold)
        };
    }

    /**
     * Añadir estudiante al mapping de temas
     */
    addStudentToTopicMapping(simulationId, topic, result) {
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
    }

    /**
     * Calcular impacto de un tema en el score
     */
    calculateTopicScoreImpact(topic, results) {
        try {
            const withTopic = results.filter(r => 
                r.weakest_topics && r.weakest_topics.includes(topic)
            );
            const withoutTopic = results.filter(r => 
                r.weakest_topics && !r.weakest_topics.includes(topic)
            );
            
            if (withTopic.length === 0 || withoutTopic.length === 0) return 0;
            
            const avgWithTopic = withTopic.reduce((sum, r) => sum + (r.score || 0), 0) / withTopic.length;
            const avgWithoutTopic = withoutTopic.reduce((sum, r) => sum + (r.score || 0), 0) / withoutTopic.length;
            
            return avgWithoutTopic - avgWithTopic;
        } catch (error) {
            console.error('Error calculando impacto del tema:', error);
            return 0;
        }
    }

    /**
     * Analizar tendencias de temas a través del tiempo
     */
    analyzeTopicTrends(topicAnalysis) {
        const topicTimeline = {};
        
        // Ordenar simulacros por semana
        const sortedSimulations = Object.values(topicAnalysis)
            .sort((a, b) => a.weekNumber - b.weekNumber);
        
        // Construir timeline por tema usando Map para mejor performance
        const topicDataMap = new Map();
        
        for (const simData of sortedSimulations) {
            for (const topic of simData.topicStats) {
                if (!topicDataMap.has(topic.topic)) {
                    topicDataMap.set(topic.topic, {
                        topic: topic.topic,
                        occurrences: [],
                        totalMentions: 0,
                        avgPercentage: 0,
                        trend: 'stable'
                    });
                }
                
                const topicData = topicDataMap.get(topic.topic);
                topicData.occurrences.push({
                    week: simData.weekNumber,
                    percentage: topic.percentage,
                    count: topic.count
                });
                topicData.totalMentions += topic.count;
            }
        }
        
        // Calcular tendencias y promedios
        for (const topicData of topicDataMap.values()) {
            topicData.avgPercentage = topicData.occurrences.reduce((sum, o) => sum + o.percentage, 0) / 
                                      topicData.occurrences.length;
            
            // Calcular tendencia simple
            if (topicData.occurrences.length >= 3) {
                const midPoint = Math.floor(topicData.occurrences.length / 2);
                const firstHalf = topicData.occurrences.slice(0, midPoint);
                const secondHalf = topicData.occurrences.slice(midPoint);
                
                const firstAvg = firstHalf.reduce((sum, o) => sum + o.percentage, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((sum, o) => sum + o.percentage, 0) / secondHalf.length;
                
                if (secondAvg > firstAvg * 1.2) topicData.trend = 'increasing';
                else if (secondAvg < firstAvg * 0.8) topicData.trend = 'decreasing';
            }
            
            topicTimeline[topicData.topic] = topicData;
        }
        
        return topicTimeline;
    }

    /**
     * Analizar correlación entre temas problemáticos y notas medias
     */
    analyzeTopicScoreCorrelations(results, simulations) {
        try {
            const topicCorrelations = {};
            const allTopics = new Set();
            
            // Recopilar todos los temas únicos
            for (const result of results) {
                if (result.weakest_topics && Array.isArray(result.weakest_topics)) {
                    result.weakest_topics.forEach(topic => allTopics.add(topic));
                }
            }
            
            // Para cada tema, analizar correlación con scores
            for (const topic of allTopics) {
                const correlation = this.calculateTopicCorrelation(topic, results);
                if (correlation) {
                    topicCorrelations[topic] = correlation;
                }
            }
            
            // Ordenar por impacto
            const sortedCorrelations = Object.values(topicCorrelations)
                .sort((a, b) => b.scoreImpact - a.scoreImpact);
            
            return {
                correlations: topicCorrelations,
                topImpactTopics: sortedCorrelations.slice(0, 5),
                averageImpact: sortedCorrelations.length > 0 ? 
                    sortedCorrelations.reduce((sum, t) => sum + t.scoreImpact, 0) / sortedCorrelations.length : 0
            };
        } catch (error) {
            console.error('Error en análisis de correlaciones:', error);
            return { correlations: {}, topImpactTopics: [], averageImpact: 0 };
        }
    }

    /**
     * Calcular correlación para un tema específico
     */
    calculateTopicCorrelation(topic, results) {
        const studentsWithTopic = new Set();
        const studentsWithoutTopic = new Set();
        
        for (const result of results) {
            if (result.weakest_topics && result.weakest_topics.includes(topic)) {
                studentsWithTopic.add(result.user_id);
            } else {
                studentsWithoutTopic.add(result.user_id);
            }
        }
        
        // Calcular scores promedio para cada grupo
        const scoresWithTopic = [];
        const scoresWithoutTopic = [];
        
        for (const student of this.dashboard.data.students) {
            if (studentsWithTopic.has(student.id) && student.average_score !== undefined) {
                scoresWithTopic.push(student.average_score);
            } else if (studentsWithoutTopic.has(student.id) && student.average_score !== undefined) {
                scoresWithoutTopic.push(student.average_score);
            }
        }
        
        if (scoresWithTopic.length >= this.config.minStudentsForAnalysis && 
            scoresWithoutTopic.length >= this.config.minStudentsForAnalysis) {
            
            const avgWithTopic = scoresWithTopic.reduce((a, b) => a + b, 0) / scoresWithTopic.length;
            const avgWithoutTopic = scoresWithoutTopic.reduce((a, b) => a + b, 0) / scoresWithoutTopic.length;
            const impact = avgWithoutTopic - avgWithTopic;
            
            return {
                topic,
                studentsAffected: studentsWithTopic.size,
                avgScoreWithTopic: avgWithTopic,
                avgScoreWithoutTopic: avgWithoutTopic,
                scoreImpact: impact,
                impactPercentage: ((impact / avgWithoutTopic) * 100),
                correlation: this.calculateCorrelationCoefficient(topic, results)
            };
        }
        
        return null;
    }

    /**
     * Calcular coeficiente de correlación para un tema
     */
    calculateCorrelationCoefficient(topic, results) {
        try {
            // Preparar arrays para correlación
            const hasTopicArray = [];
            const scoreArray = [];
            
            const studentScores = new Map();
            
            for (const result of results) {
                if (!studentScores.has(result.user_id)) {
                    studentScores.set(result.user_id, { scores: [], hasTopic: false });
                }
                const data = studentScores.get(result.user_id);
                data.scores.push(result.score);
                if (result.weakest_topics && result.weakest_topics.includes(topic)) {
                    data.hasTopic = true;
                }
            }
            
            for (const data of studentScores.values()) {
                if (data.scores.length > 0) {
                    hasTopicArray.push(data.hasTopic ? 1 : 0);
                    scoreArray.push(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
                }
            }
            
            // Calcular correlación de Pearson
            return StatisticsUtils.calculateCorrelation(hasTopicArray, scoreArray);
        } catch (error) {
            console.error('Error calculando correlación:', error);
            return 0;
        }
    }

    /**
     * Generar insights sobre temas problemáticos
     */
    generateTopicInsights(topicAnalysis, globalTrends, correlationAnalysis) {
        const insights = [];
        
        try {
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
                             fueron problemáticos para más del ${this.config.criticalThreshold}% de los estudiantes.`,
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
                             ${topImpact.scoreImpact.toFixed(2)} puntos (${topImpact.impactPercentage.toFixed(0)}% de impacto).`,
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
        } catch (error) {
            console.error('Error generando insights:', error);
        }
        
        return insights;
    }

    /**
     * Analizar diferencias de temas por cohorte
     */
    analyzeTopicDifferencesByCohort(topicAnalysis) {
        try {
            const cohortTopics = {};
            
            // Recopilar temas por cohorte desde el mapping de estudiantes
            for (const [key, students] of Object.entries(this.topicStudentMapping)) {
                const [, topic] = key.split('_');
                
                for (const student of students) {
                    const cohort = student.cohort;
                    if (!cohortTopics[cohort]) {
                        cohortTopics[cohort] = {};
                    }
                    cohortTopics[cohort][topic] = (cohortTopics[cohort][topic] || 0) + 1;
                }
            }
            
            // Identificar diferencias significativas
            const topics = new Set();
            Object.values(cohortTopics).forEach(topicMap => {
                Object.keys(topicMap).forEach(topic => topics.add(topic));
            });
            
            const differences = [];
            for (const topic of topics) {
                const cohortPercentages = {};
                
                for (const [cohort, topicMap] of Object.entries(cohortTopics)) {
                    const count = topicMap[topic] || 0;
                    const totalStudents = Object.values(this.topicStudentMapping)
                        .flat()
                        .filter(s => s.cohort === cohort).length;
                    cohortPercentages[cohort] = totalStudents > 0 ? (count / totalStudents * 100) : 0;
                }
                
                const values = Object.values(cohortPercentages);
                if (values.length > 0) {
                    const max = Math.max(...values);
                    const min = Math.min(...values);
                    
                    if (max - min > this.config.significantDifferenceThreshold) {
                        differences.push({
                            topic,
                            cohortPercentages,
                            difference: max - min
                        });
                    }
                }
            }
            
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
        } catch (error) {
            console.error('Error analizando diferencias por cohorte:', error);
        }
        
        return { significant: false };
    }

    /**
     * Mostrar drill-down de estudiantes por tema (mejorado)
     */
    showTopicDrillDown(simulationId, topic) {
        try {
            const key = `${simulationId}_${topic}`;
            const students = this.topicStudentMapping[key] || [];
            
            if (students.length === 0) {
                this.dashboard.showNotification('info', 'No hay estudiantes para mostrar');
                return;
            }
            
            // Crear modal dinámicamente
            const modal = this.createDrillDownModal();
            
            // Encontrar el simulacro
            const simulation = this.dashboard.data.simulations.find(s => s.id === simulationId);
            const weekNumber = simulation ? simulation.week_number : '?';
            
            // Actualizar contenido
            this.updateDrillDownContent(modal, {
                topic,
                weekNumber,
                students,
                simulationId
            });
            
            // Mostrar modal
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error mostrando drill-down:', error);
            this.dashboard.showNotification('error', 'Error al mostrar detalles');
        }
    }

    /**
     * Crear modal de drill-down dinámicamente
     */
    createDrillDownModal() {
        const existingModal = document.getElementById('topicDrillDownModal');
        if (existingModal) {
            return existingModal;
        }
        
        const modal = document.createElement('div');
        modal.id = 'topicDrillDownModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3 id="drillDownTitle">Cargando...</h3>
                    <button class="btn-icon" data-action="close">✖️</button>
                </div>
                <div class="modal-body" id="drillDownContent">
                    <!-- Contenido dinámico -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-action="export">
                        📊 Exportar lista
                    </button>
                    <button class="btn btn-primary" data-action="intervention">
                        📧 Crear intervención grupal
                    </button>
                </div>
            </div>
        `;
        
        // Añadir event listeners
        modal.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'close') {
                this.closeDrillDown();
            } else if (action === 'export') {
                this.exportTopicStudents();
            } else if (action === 'intervention') {
                this.createTopicIntervention();
            }
        });
        
        return modal;
    }

    /**
     * Actualizar contenido del drill-down
     */
    updateDrillDownContent(modal, data) {
        const { topic, weekNumber, students, simulationId } = data;
        
        const title = modal.querySelector('#drillDownTitle');
        const content = modal.querySelector('#drillDownContent');
        
        title.textContent = `Estudiantes que marcaron "${topic}" en RF${weekNumber}`;
        
        // Agrupar por cohorte
        const byCohort = {};
        students.forEach(student => {
            if (!byCohort[student.cohort]) {
                byCohort[student.cohort] = [];
            }
            byCohort[student.cohort].push(student);
        });
        
        // Calcular estadísticas
        const avgScoreSimulation = students.reduce((sum, s) => sum + s.score, 0) / students.length;
        const avgScoreGeneral = students.reduce((sum, s) => sum + s.avgScore, 0) / students.length;
        
        content.innerHTML = `
            <div class="drill-down-stats">
                <div class="stat-box">
                    <div class="stat-label">Total estudiantes</div>
                    <div class="stat-value">${students.length}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Score promedio en simulacro</div>
                    <div class="stat-value">${avgScoreSimulation.toFixed(2)}/10</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Nota media general</div>
                    <div class="stat-value">${avgScoreGeneral.toFixed(2)}/10</div>
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
                                                    data-action="view-student"
                                                    data-student-id="${student.id}"
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
        
        // Añadir event listener para ver estudiante
        content.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'view-student') {
                const studentId = e.target.dataset.studentId;
                if (window.dashboardAdmin && window.dashboardAdmin.showStudentDetail) {
                    window.dashboardAdmin.showStudentDetail(studentId);
                    this.closeDrillDown();
                }
            }
        });
        
        // Guardar datos actuales para exportación
        this.currentDrillDownData = {
            topic,
            simulationId,
            weekNumber,
            students
        };
    }

    /**
     * Cerrar modal de drill-down
     */
    closeDrillDown() {
        const modal = document.getElementById('topicDrillDownModal');
        if (modal) {
            modal.style.display = 'none';
            // Opcionalmente remover del DOM
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    /**
     * Filtrar análisis de temas
     */
    filterTopicAnalysis() {
        try {
            const cohortFilter = document.getElementById('topicCohortFilter');
            const periodFilter = document.getElementById('topicPeriodFilter');
            const thresholdFilter = document.getElementById('topicThresholdFilter');
            
            if (!cohortFilter || !periodFilter || !thresholdFilter) {
                console.warn('Filtros no encontrados');
                return;
            }
            
            const filters = {
                cohort: cohortFilter.value,
                period: periodFilter.value,
                threshold: parseInt(thresholdFilter.value)
            };
            
            console.log('Aplicando filtros:', filters);
            
            // Emitir evento personalizado con los filtros
            window.dispatchEvent(new CustomEvent('topicFiltersChanged', { detail: filters }));
            
        } catch (error) {
            console.error('Error aplicando filtros:', error);
        }
    }

    /**
     * Exportar estudiantes del drill-down actual
     */
    async exportTopicStudents() {
        try {
            if (!this.currentDrillDownData) {
                this.dashboard.showNotification('warning', 'No hay datos para exportar');
                return;
            }
            
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
            
            this.dashboard.showNotification('success', 'Datos exportados correctamente');
            
        } catch (error) {
            console.error('Error exportando datos:', error);
            this.dashboard.showNotification('error', 'Error al exportar datos');
        }
    }

    /**
     * Crear intervención para el tema actual
     */
    async createTopicIntervention() {
        try {
            if (!this.currentDrillDownData) {
                this.dashboard.showNotification('warning', 'No hay datos para la intervención');
                return;
            }
            
            const { topic, students } = this.currentDrillDownData;
            
            if (confirm(`¿Crear plan de intervención para ${students.length} estudiantes con dificultades en "${topic}"?`)) {
                // Aquí iría la lógica real de crear la intervención
                this.dashboard.showNotification('success', 
                    `Plan de intervención creado para ${students.length} estudiantes`);
                
                this.closeDrillDown();
            }
        } catch (error) {
            console.error('Error creando intervención:', error);
            this.dashboard.showNotification('error', 'Error al crear intervención');
        }
    }

    /**
     * Obtener análisis vacío por defecto
     */
    getEmptyAnalysis() {
        return {
            bySimulation: {},
            globalTrends: {},
            correlations: {
                correlations: {},
                topImpactTopics: [],
                averageImpact: 0
            },
            insights: [],
            metadata: {
                totalSimulations: 0,
                totalResults: 0,
                analysisDate: new Date().toISOString(),
                error: 'No hay datos suficientes para el análisis'
            }
        };
    }

    /**
     * Limpiar recursos
     */
    destroy() {
        // Limpiar cache
        this.cache.clear();
        
        // Limpiar datos
        this.topicStudentMapping = {};
        this.currentTopicAnalysis = null;
        this.currentDrillDownData = null;
        
        // Remover modal si existe
        const modal = document.getElementById('topicDrillDownModal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
}

export default TopicInsights;