/**
 * Módulo de Índice de Compromiso Académico (ICA)
 * Calcula una métrica compuesta de engagement basada en múltiples factores
 */

export class EngagementIndexCalculator {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        
        // Pesos configurables para cada componente
        this.weights = {
            platformActivity: 0.25,    // Actividad en Evolcampus
            simulationParticipation: 0.30, // Participación en simulacros
            studyConsistency: 0.25,    // Regularidad de estudio
            progressionRate: 0.20      // Velocidad de avance
        };
        
        // Umbrales para categorización
        this.thresholds = {
            excellent: 85,
            good: 70,
            regular: 50,
            poor: 30
        };
    }

    /**
     * Calcular ICA completo para un estudiante
     */
    async calculateForStudent(studentId) {
        try {
            // Recopilar todos los datos necesarios
            const data = await this.gatherStudentData(studentId);
            
            if (!data.student) {
                throw new Error('Estudiante no encontrado');
            }
            
            // Calcular cada componente
            const components = {
                platform: this.calculatePlatformActivity(data),
                simulations: this.calculateSimulationParticipation(data),
                consistency: this.calculateStudyConsistency(data),
                progression: this.calculateProgressionRate(data)
            };
            
            // Calcular índice total
            const total = 
                components.platform * this.weights.platformActivity +
                components.simulations * this.weights.simulationParticipation +
                components.consistency * this.weights.studyConsistency +
                components.progression * this.weights.progressionRate;
            
            // Determinar nivel de riesgo
            const riskLevel = this.assessRiskLevel(total, components);
            
            // Generar recomendaciones
            const recommendations = this.generateRecommendations(components, data);
            
            return {
                total: Math.round(total),
                level: this.getLevel(total),
                components: {
                    platform: Math.round(components.platform),
                    simulations: Math.round(components.simulations),
                    consistency: Math.round(components.consistency),
                    progression: Math.round(components.progression)
                },
                riskLevel,
                recommendations,
                metadata: {
                    calculatedAt: new Date().toISOString(),
                    dataPoints: this.countDataPoints(data),
                    reliability: this.assessDataReliability(data)
                }
            };
            
        } catch (error) {
            console.error('Error calculando ICA:', error);
            throw error;
        }
    }

    /**
     * Recopilar todos los datos del estudiante
     */
    async gatherStudentData(studentId) {
        // Datos básicos del estudiante
        const { data: student } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', studentId)
            .single();
        
        // Datos de Evolcampus
        const { data: evolcampusData } = await this.supabase
            .from('evolcampus_student_summary')
            .select('*')
            .eq('student_id', studentId)
            .single();
        
        // Resultados de simulacros
        const { data: simulationResults } = await this.supabase
            .from('user_results')
            .select('*')
            .eq('user_id', studentId)
            .order('submitted_at', { ascending: false });
        
        // Resultados de temas (Evolcampus)
        const { data: topicResults } = await this.supabase
            .from('topic_results')
            .select('*')
            .eq('student_id', studentId);
        
        // Calcular semanas desde inicio
        const startDate = new Date('2025-01-01'); // Ajustar según fecha real
        const weeksStudying = Math.floor((Date.now() - startDate) / (7 * 24 * 60 * 60 * 1000));
        
        return {
            student,
            evolcampus: evolcampusData,
            simulations: simulationResults || [],
            topics: topicResults || [],
            weeksStudying: Math.max(1, weeksStudying)
        };
    }

    /**
     * Calcular componente de actividad en plataforma
     */
    calculatePlatformActivity(data) {
        if (!data.evolcampus) return 0;
        
        const evolcampus = data.evolcampus;
        
        // 1. Días desde última conexión (40% del peso)
        const daysSinceLastConnect = evolcampus.last_connect ? 
            Math.floor((Date.now() - new Date(evolcampus.last_connect)) / (24 * 60 * 60 * 1000)) : 999;
        
        let activityScore = 100;
        if (daysSinceLastConnect > 7) activityScore = 20;
        else if (daysSinceLastConnect > 3) activityScore = 60;
        else if (daysSinceLastConnect > 1) activityScore = 80;
        
        // 2. Horas semanales promedio (30% del peso)
        const totalHours = (evolcampus.time_connected || 0) / 3600;
        const weeklyHours = totalHours / data.weeksStudying;
        const hoursScore = Math.min(100, (weeklyHours / 25) * 100); // Óptimo: 25h/semana
        
        // 3. Porcentaje de completitud (30% del peso)
        const completionScore = evolcampus.completed_percent || 0;
        
        return activityScore * 0.4 + hoursScore * 0.3 + completionScore * 0.3;
    }

    /**
     * Calcular componente de participación en simulacros
     */
    calculateSimulationParticipation(data) {
        const simulations = data.simulations;
        
        if (!simulations || simulations.length === 0) return 0;
        
        // 1. Tasa de participación (50% del peso)
        const expectedSimulations = data.weeksStudying; // 1 por semana
        const participationRate = Math.min(100, (simulations.length / expectedSimulations) * 100);
        
        // 2. Regularidad (30% del peso)
        let regularityScore = 100;
        if (simulations.length >= 2) {
            // Calcular días entre simulacros
            const intervals = [];
            for (let i = 1; i < simulations.length; i++) {
                const days = Math.floor(
                    (new Date(simulations[i-1].submitted_at) - new Date(simulations[i].submitted_at)) / 
                    (24 * 60 * 60 * 1000)
                );
                intervals.push(days);
            }
            
            // Penalizar si hay intervalos muy largos
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            if (avgInterval > 14) regularityScore = 40;
            else if (avgInterval > 10) regularityScore = 70;
            else if (avgInterval > 7) regularityScore = 90;
        }
        
        // 3. Completitud de respuestas (20% del peso)
        const avgBlankRate = simulations.reduce((sum, s) => {
            const total = (s.correct_answers || 0) + (s.wrong_answers || 0) + (s.blank_answers || 0);
            return sum + ((s.blank_answers || 0) / total);
        }, 0) / simulations.length;
        
        const completenessScore = (1 - avgBlankRate) * 100;
        
        return participationRate * 0.5 + regularityScore * 0.3 + completenessScore * 0.2;
    }

    /**
     * Calcular consistencia de estudio
     */
    calculateStudyConsistency(data) {
        // Combinar datos de simulacros y actividad en plataforma
        const activities = [];
        
        // Añadir actividades de simulacros
        data.simulations.forEach(s => {
            activities.push({
                date: new Date(s.submitted_at),
                type: 'simulation',
                score: s.score
            });
        });
        
        // Añadir actividades de temas
        data.topics.forEach(t => {
            if (t.last_attempt) {
                activities.push({
                    date: new Date(t.last_attempt),
                    type: 'topic',
                    score: t.score
                });
            }
        });
        
        if (activities.length < 3) return 30; // Poca data para evaluar
        
        // Ordenar por fecha
        activities.sort((a, b) => b.date - a.date);
        
        // 1. Frecuencia de actividad (50%)
        const daysActive = new Set(activities.map(a => 
            `${a.date.getFullYear()}-${a.date.getMonth()}-${a.date.getDate()}`
        )).size;
        const frequencyScore = Math.min(100, (daysActive / (data.weeksStudying * 3)) * 100); // Objetivo: 3 días/semana
        
        // 2. Variabilidad en rendimiento (30%)
        const scores = activities.filter(a => a.score !== null).map(a => a.score);
        if (scores.length > 0) {
            const avgScore = scores.reduce((a, b) => a + b) / scores.length;
            const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
            const stdDev = Math.sqrt(variance);
            const consistencyScore = Math.max(0, 100 - (stdDev * 20)); // Penalizar alta variabilidad
            
            // 3. Tendencia temporal (20%)
            const recentActivities = activities.slice(0, 10);
            const olderActivities = activities.slice(10, 20);
            
            let trendScore = 70;
            if (recentActivities.length > 5 && olderActivities.length > 5) {
                const recentAvg = recentActivities.filter(a => a.score).reduce((sum, a) => sum + a.score, 0) / recentActivities.length;
                const olderAvg = olderActivities.filter(a => a.score).reduce((sum, a) => sum + a.score, 0) / olderActivities.length;
                
                if (recentAvg > olderAvg + 0.5) trendScore = 100;
                else if (recentAvg < olderAvg - 0.5) trendScore = 40;
            }
            
            return frequencyScore * 0.5 + consistencyScore * 0.3 + trendScore * 0.2;
        }
        
        return frequencyScore * 0.7 + 30 * 0.3; // Sin scores, solo frecuencia
    }

    /**
     * Calcular tasa de progresión
     */
    calculateProgressionRate(data) {
        // 1. Progresión en completitud (40%)
        const completionProgress = data.evolcampus?.completed_percent || 0;
        const expectedProgress = Math.min(100, (data.weeksStudying / 20) * 100); // 20 semanas totales estimadas
        const progressScore = Math.min(100, (completionProgress / expectedProgress) * 100);
        
        // 2. Cobertura de temas (30%)
        const uniqueTopics = new Set(data.topics.map(t => t.topic_code)).size;
        const topicCoverageScore = Math.min(100, (uniqueTopics / 45) * 100); // 45 temas totales
        
        // 3. Mejora en rendimiento (30%)
        let improvementScore = 50;
        if (data.simulations.length >= 3) {
            const recent = data.simulations.slice(0, 3).map(s => s.score);
            const older = data.simulations.slice(-3).map(s => s.score);
            
            const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
            const olderAvg = older.reduce((a, b) => a + b) / older.length;
            
            const improvement = recentAvg - olderAvg;
            if (improvement > 1) improvementScore = 100;
            else if (improvement > 0.5) improvementScore = 80;
            else if (improvement > 0) improvementScore = 60;
            else if (improvement > -0.5) improvementScore = 40;
            else improvementScore = 20;
        }
        
        return progressScore * 0.4 + topicCoverageScore * 0.3 + improvementScore * 0.3;
    }

    /**
     * Evaluar nivel de riesgo
     */
    assessRiskLevel(total, components) {
        // Riesgo crítico si ICA < 30 o algún componente < 20
        if (total < 30 || Object.values(components).some(c => c < 20)) {
            return 'critical';
        }
        
        // Riesgo alto si ICA < 50 o más de 2 componentes < 40
        if (total < 50 || Object.values(components).filter(c => c < 40).length >= 2) {
            return 'high';
        }
        
        // Riesgo medio si ICA < 70
        if (total < 70) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Generar recomendaciones basadas en componentes
     */
    generateRecommendations(components, data) {
        const recommendations = [];
        
        // Recomendaciones por componente bajo
        if (components.platform < 50) {
            recommendations.push({
                area: 'platform',
                priority: 'high',
                message: 'Aumenta tu actividad en la plataforma Evolcampus',
                action: 'Dedica al menos 30 minutos diarios a estudiar en la plataforma'
            });
        }
        
        if (components.simulations < 50) {
            recommendations.push({
                area: 'simulations',
                priority: 'critical',
                message: 'Participa más regularmente en los simulacros',
                action: 'No te pierdas ningún simulacro semanal, son esenciales para tu preparación'
            });
        }
        
        if (components.consistency < 50) {
            recommendations.push({
                area: 'consistency',
                priority: 'high',
                message: 'Mejora la regularidad de tu estudio',
                action: 'Establece un horario fijo de estudio y cúmplelo al menos 4 días por semana'
            });
        }
        
        if (components.progression < 50) {
            recommendations.push({
                area: 'progression',
                priority: 'medium',
                message: 'Acelera tu ritmo de avance en el temario',
                action: 'Intenta completar al menos 2-3 temas nuevos por semana'
            });
        }
        
        // Recomendación especial si todo va bien
        if (Object.values(components).every(c => c >= 70)) {
            recommendations.push({
                area: 'general',
                priority: 'low',
                message: '¡Excelente trabajo! Mantén este ritmo',
                action: 'Sigue con tu rutina actual y considera ayudar a compañeros'
            });
        }
        
        return recommendations.sort((a, b) => {
            const priority = { critical: 3, high: 2, medium: 1, low: 0 };
            return priority[b.priority] - priority[a.priority];
        });
    }

    /**
     * Obtener nivel descriptivo
     */
    getLevel(score) {
        if (score >= this.thresholds.excellent) return 'excellent';
        if (score >= this.thresholds.good) return 'good';
        if (score >= this.thresholds.regular) return 'regular';
        if (score >= this.thresholds.poor) return 'poor';
        return 'critical';
    }

    /**
     * Contar puntos de datos disponibles
     */
    countDataPoints(data) {
        return {
            simulations: data.simulations.length,
            topics: data.topics.length,
            evolcampus: data.evolcampus ? 1 : 0,
            total: data.simulations.length + data.topics.length + (data.evolcampus ? 1 : 0)
        };
    }

    /**
     * Evaluar confiabilidad de los datos
     */
    assessDataReliability(data) {
        const points = this.countDataPoints(data);
        
        if (points.total < 10) return 'low';
        if (points.total < 30) return 'medium';
        return 'high';
    }

    /**
     * Calcular ICA para múltiples estudiantes
     */
    async calculateForCohort(cohort) {
        const { data: students } = await this.supabase
            .from('users')
            .select('id')
            .eq('cohort', cohort);
        
        const results = [];
        
        for (const student of students) {
            try {
                const ica = await this.calculateForStudent(student.id);
                results.push({
                    studentId: student.id,
                    ...ica
                });
            } catch (error) {
                console.error(`Error calculando ICA para ${student.id}:`, error);
            }
        }
        
        return results;
    }
}

// Componente visual para mostrar el ICA
export class EngagementIndexWidget {
    constructor(container, calculator) {
        this.container = container;
        this.calculator = calculator;
    }

    async render(studentId) {
        try {
            // Mostrar loading
            this.container.innerHTML = '<div class="loading">Calculando ICA...</div>';
            
            // Calcular ICA
            const ica = await this.calculator.calculateForStudent(studentId);
            
            // Renderizar widget
            this.container.innerHTML = this.getTemplate(ica);
            
            // Añadir interactividad
            this.attachEventListeners();
            
        } catch (error) {
            this.container.innerHTML = `
                <div class="error">
                    Error calculando ICA: ${error.message}
                </div>
            `;
        }
    }

    getTemplate(ica) {
        const levelColors = {
            excellent: '#10b981',
            good: '#3b82f6',
            regular: '#f59e0b',
            poor: '#ef4444',
            critical: '#dc2626'
        };

        const riskColors = {
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            critical: '#dc2626'
        };

        return `
            <div class="ica-widget">
                <div class="ica-header">
                    <h3>📊 Índice de Compromiso Académico</h3>
                    <span class="ica-help" title="El ICA mide tu nivel de engagement con el programa">ℹ️</span>
                </div>
                
                <div class="ica-main">
                    <div class="ica-gauge">
                        <svg viewBox="0 0 200 100" class="gauge-svg">
                            <!-- Arco de fondo -->
                            <path d="M 10 90 A 80 80 0 0 1 190 90" 
                                  fill="none" 
                                  stroke="#e5e7eb" 
                                  stroke-width="20"/>
                            
                            <!-- Arco de progreso -->
                            <path d="M 10 90 A 80 80 0 0 1 190 90" 
                                  fill="none" 
                                  stroke="${levelColors[ica.level]}" 
                                  stroke-width="20"
                                  stroke-dasharray="${ica.total * 1.8} 180"
                                  stroke-linecap="round"/>
                        </svg>
                        
                        <div class="gauge-value">
                            <span class="gauge-number">${ica.total}</span>
                            <span class="gauge-label">${this.getLevelLabel(ica.level)}</span>
                        </div>
                    </div>
                    
                    <div class="ica-risk">
                        <span class="risk-label">Nivel de riesgo:</span>
                        <span class="risk-value" style="color: ${riskColors[ica.riskLevel]}">
                            ${this.getRiskLabel(ica.riskLevel)}
                        </span>
                    </div>
                </div>
                
                <div class="ica-components">
                    <h4>Componentes del índice</h4>
                    <div class="components-grid">
                        ${this.renderComponent('Plataforma', ica.components.platform, 'platform')}
                        ${this.renderComponent('Simulacros', ica.components.simulations, 'simulations')}
                        ${this.renderComponent('Consistencia', ica.components.consistency, 'consistency')}
                        ${this.renderComponent('Progresión', ica.components.progression, 'progression')}
                    </div>
                </div>
                
                ${ica.recommendations.length > 0 ? `
                    <div class="ica-recommendations">
                        <h4>Recomendaciones</h4>
                        <div class="recommendations-list">
                            ${ica.recommendations.map(r => this.renderRecommendation(r)).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="ica-footer">
                    <small>
                        Calculado: ${new Date(ica.metadata.calculatedAt).toLocaleString('es-ES')}
                        | Confiabilidad: ${this.getReliabilityLabel(ica.metadata.reliability)}
                    </small>
                </div>
            </div>
        `;
    }

    renderComponent(name, value, type) {
        const icons = {
            platform: '💻',
            simulations: '📝',
            consistency: '📅',
            progression: '📈'
        };

        const color = value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';

        return `
            <div class="component-item">
                <div class="component-header">
                    <span class="component-icon">${icons[type]}</span>
                    <span class="component-name">${name}</span>
                </div>
                <div class="component-bar">
                    <div class="component-fill" style="width: ${value}%; background: ${color}"></div>
                </div>
                <div class="component-value">${value}%</div>
            </div>
        `;
    }

    renderRecommendation(rec) {
        const priorityColors = {
            critical: '#dc2626',
            high: '#ef4444',
            medium: '#f59e0b',
            low: '#3b82f6'
        };

        return `
            <div class="recommendation-item">
                <div class="rec-priority" style="background: ${priorityColors[rec.priority]}"></div>
                <div class="rec-content">
                    <div class="rec-message">${rec.message}</div>
                    <div class="rec-action">→ ${rec.action}</div>
                </div>
            </div>
        `;
    }

    getLevelLabel(level) {
        const labels = {
            excellent: 'Excelente',
            good: 'Bueno',
            regular: 'Regular',
            poor: 'Bajo',
            critical: 'Crítico'
        };
        return labels[level] || level;
    }

    getRiskLabel(risk) {
        const labels = {
            low: 'Bajo',
            medium: 'Medio',
            high: 'Alto',
            critical: 'Crítico'
        };
        return labels[risk] || risk;
    }

    getReliabilityLabel(reliability) {
        const labels = {
            high: 'Alta',
            medium: 'Media',
            low: 'Baja'
        };
        return labels[reliability] || reliability;
    }

    attachEventListeners() {
        // Añadir tooltips, clicks, etc.
        const helpIcon = this.container.querySelector('.ica-help');
        if (helpIcon) {
            helpIcon.addEventListener('click', () => {
                this.showHelp();
            });
        }
    }

    showHelp() {
        alert('El ICA combina 4 factores clave:\n\n' +
              '1. Actividad en plataforma (25%)\n' +
              '2. Participación en simulacros (30%)\n' +
              '3. Consistencia de estudio (25%)\n' +
              '4. Tasa de progresión (20%)\n\n' +
              'Un índice superior a 70 indica buen compromiso.');
    }
}

export default EngagementIndexCalculator; 