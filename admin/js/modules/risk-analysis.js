// admin/js/modules/risk-analysis.js
export default class RiskAnalysisModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.riskFactors = {
            score: { weight: 0.3, threshold: 6 },
            participation: { weight: 0.2, threshold: 0.7 },
            consistency: { weight: 0.2, threshold: 1.5 },
            trend: { weight: 0.2, threshold: 0 },
            engagement: { weight: 0.1, threshold: 0.5 }
        };
        this.allAtRiskStudents = [];
    }

    async render(container) {
        try {
            // Mostrar indicador de carga
            container.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 1rem;">Analizando riesgos...</p>
                </div>
            `;

            // Realizar análisis completo de riesgo
            const studentsWithRisk = await this.calculateComprehensiveRisk();
            
            // Filtrar estudiantes por niveles de riesgo
            const atRisk = studentsWithRisk.filter(s => (s.probability_pass || 50) < 50);
            const criticalRisk = studentsWithRisk.filter(s => (s.probability_pass || 50) < 30);
            const highRisk = studentsWithRisk.filter(s => (s.probability_pass || 50) >= 30 && (s.probability_pass || 50) < 50);
            const mediumRisk = studentsWithRisk.filter(s => (s.probability_pass || 50) >= 50 && (s.probability_pass || 50) < 70);
            const lowRisk = studentsWithRisk.filter(s => (s.probability_pass || 50) >= 70);
            
            // Guardar para uso posterior
            this.allAtRiskStudents = atRisk;
            
            container.innerHTML = `
                <div class="risk-analysis-page">
                    <h2>⚠️ Análisis de Riesgo</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                        Análisis completo de estudiantes en riesgo académico basado en múltiples factores
                    </p>
                    
                    <!-- Resumen ejecutivo -->
                    ${this.renderExecutiveSummary(studentsWithRisk)}
                    
                    <!-- Resumen de riesgo -->
                    <div class="risk-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0;">
                        <div class="stat-card danger">
                            <div class="stat-header">
                                <div class="stat-icon danger">⚠️</div>
                                <div class="stat-content">
                                    <div class="stat-label">Estudiantes en Riesgo</div>
                                    <div class="stat-value">${atRisk.length}</div>
                                    <div class="stat-change">${((atRisk.length / studentsWithRisk.length) * 100).toFixed(1)}% del total</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card danger" style="border-top: 4px solid #dc2626;">
                            <div class="stat-header">
                                <div class="stat-icon danger">🚨</div>
                                <div class="stat-content">
                                    <div class="stat-label">Riesgo Crítico</div>
                                    <div class="stat-value">${criticalRisk.length}</div>
                                    <div class="stat-change">P(aprobar) < 30%</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card warning">
                            <div class="stat-header">
                                <div class="stat-icon warning">⚡</div>
                                <div class="stat-content">
                                    <div class="stat-label">Riesgo Alto</div>
                                    <div class="stat-value">${highRisk.length}</div>
                                    <div class="stat-change">P(aprobar) 30-50%</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card success">
                            <div class="stat-header">
                                <div class="stat-icon success">✅</div>
                                <div class="stat-content">
                                    <div class="stat-label">Sin Riesgo</div>
                                    <div class="stat-value">${lowRisk.length}</div>
                                    <div class="stat-change">P(aprobar) ≥ 70%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Distribución por niveles de riesgo -->
                    <div class="risk-distribution card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                        <h3>📊 Distribución por Niveles de Riesgo</h3>
                        ${this.renderRiskDistributionBars(studentsWithRisk)}
                    </div>
                    
                    <!-- Matriz de riesgo-impacto -->
                    <div class="risk-matrix-container card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                        <h3>📈 Matriz de Riesgo-Impacto</h3>
                        <div id="riskMatrix" style="height: 400px;"></div>
                    </div>
                    
                    <!-- Lista de estudiantes en riesgo -->
                    <div class="risk-list table-card">
                        <div class="table-header">
                            <h3>🚨 Estudiantes que requieren atención inmediata</h3>
                            <button class="btn btn-primary" onclick="window.riskAnalysisModule.exportRiskReport()">
                                📊 Exportar Informe de Riesgo
                            </button>
                        </div>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Estudiante</th>
                                        <th>Cohorte</th>
                                        <th>Probabilidad</th>
                                        <th>Score Promedio</th>
                                        <th>Tendencia</th>
                                        <th>Factores de Riesgo</th>
                                        <th>Nivel</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${atRisk.slice(0, 20).map(student => this.renderRiskTableRow(student)).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${atRisk.length > 20 ? `
                            <div style="padding: 1rem; text-align: center; background: #f9fafb;">
                                <p>Mostrando 20 de ${atRisk.length} estudiantes en riesgo</p>
                                <button class="btn btn-secondary" onclick="window.riskAnalysisModule.showAllAtRisk()">
                                    Ver todos
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Acciones recomendadas -->
                    <div class="recommended-actions card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-top: 2rem;">
                        <h3>💡 Acciones Recomendadas por Tipo</h3>
                        ${this.renderRecommendedActions(atRisk)}
                    </div>
                    
                    <!-- Recomendaciones generales -->
                    <div class="recommendations-section card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-top: 2rem;">
                        <h3>📌 Recomendaciones Generales</h3>
                        ${this.renderGeneralRecommendations(studentsWithRisk, atRisk, criticalRisk)}
                    </div>
                </div>
            `;
            
            // Guardar referencia global correcta
            window.riskAnalysisModule = this;
            
            // Renderizar gráficos después de que el DOM esté listo
            setTimeout(() => {
                this.renderRiskMatrix(studentsWithRisk);
            }, 100);
            
        } catch (error) {
            console.error('Error en módulo de riesgo:', error);
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo de análisis de riesgo</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="window.dashboardAdmin.refreshData()">
                        🔄 Reintentar
                    </button>
                </div>
            `;
        }
    }

    // Renderizar fila de la tabla de riesgo
    renderRiskTableRow(student) {
        const mainFactors = this.getMainRiskFactors(student);
        
        return `
            <tr>
                <td>
                    <strong>${student.username}</strong>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">${student.email}</div>
                </td>
                <td><span class="badge badge-info">${student.cohort}</span></td>
                <td>
                    <span class="risk-indicator ${this.getRiskClass(student.probability_pass)}">
                        ${(student.probability_pass || 50).toFixed(0)}%
                    </span>
                </td>
                <td>${(student.average_score || 0).toFixed(1)}/10</td>
                <td>${this.getTrendIcon(student.trend_direction)}</td>
                <td>
                    <div style="font-size: 0.875rem;">
                        ${mainFactors.map(f => `<span class="risk-factor-tag">${f}</span>`).join(' ')}
                    </div>
                </td>
                <td>
                    <span class="badge badge-${this.getRiskBadgeClass(student.probability_pass)}">
                        ${this.getRiskLevelText(student.probability_pass)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')" title="Ver detalles">
                            👁️
                        </button>
                        <button class="btn-icon" onclick="window.riskAnalysisModule.createIntervention('${student.id}')" title="Crear intervención">
                            💬
                        </button>
                        <button class="btn-icon" onclick="window.riskAnalysisModule.createAlert('${student.id}')" title="Crear alerta">
                            🔔
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Obtener los principales factores de riesgo
    getMainRiskFactors(student) {
        const factors = [];
        
        if (student.average_score < 6) factors.push('📉 Score bajo');
        if (student.total_simulations < 3) factors.push('📅 Poca participación');
        if (student.current_streak === 0) factors.push('🔥 Sin racha');
        if (student.trend_direction === 'down') factors.push('📊 Tendencia negativa');
        if (student.riskFactors?.consistencyRisk > 40) factors.push('📈 Inconsistente');
        
        return factors.slice(0, 3); // Máximo 3 factores
    }

    // Renderizar distribución de riesgo con barras
    renderRiskDistributionBars(students) {
        const distribution = {
            critical: students.filter(s => (s.probability_pass || 50) < 30).length,
            high: students.filter(s => (s.probability_pass || 50) >= 30 && (s.probability_pass || 50) < 50).length,
            medium: students.filter(s => (s.probability_pass || 50) >= 50 && (s.probability_pass || 50) < 70).length,
            low: students.filter(s => (s.probability_pass || 50) >= 70).length
        };
        
        const total = students.length;
        
        return `
            <div style="margin-top: 1.5rem;">
                ${Object.entries(distribution).map(([level, count]) => {
                    const percentage = (count / total * 100).toFixed(1);
                    const colors = {
                        critical: '#dc2626',
                        high: '#f59e0b',
                        medium: '#3b82f6',
                        low: '#10b981'
                    };
                    
                    return `
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="font-weight: 500;">
                                    ${this.getRiskLevelText(level === 'critical' ? 20 : level === 'high' ? 40 : level === 'medium' ? 60 : 80)}
                                </span>
                                <span>${count} estudiantes (${percentage}%)</span>
                            </div>
                            <div style="background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
                                <div style="background: ${colors[level]}; width: ${percentage}%; height: 100%; transition: width 0.5s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Renderizar recomendaciones generales
    renderGeneralRecommendations(allStudents, atRisk, criticalRisk) {
        const recommendations = [];
        
        const riskPercentage = (atRisk.length / allStudents.length * 100).toFixed(1);
        const criticalPercentage = (criticalRisk.length / allStudents.length * 100).toFixed(1);
        
        if (criticalPercentage > 10) {
            recommendations.push({
                icon: '🚨',
                title: 'Situación Crítica',
                text: `${criticalPercentage}% de estudiantes en riesgo crítico. Se recomienda implementar un plan de intervención inmediata.`
            });
        }
        
        if (riskPercentage > 30) {
            recommendations.push({
                icon: '⚠️',
                title: 'Alto Porcentaje en Riesgo',
                text: `${riskPercentage}% de estudiantes necesitan apoyo. Considerar sesiones de refuerzo grupales.`
            });
        }
        
        const lowParticipation = allStudents.filter(s => s.total_simulations < 3).length;
        if (lowParticipation > allStudents.length * 0.2) {
            recommendations.push({
                icon: '📅',
                title: 'Baja Participación General',
                text: `${lowParticipation} estudiantes han participado en menos de 3 simulacros. Implementar estrategias de motivación.`
            });
        }
        
        const noStreak = allStudents.filter(s => s.current_streak === 0).length;
        if (noStreak > allStudents.length * 0.4) {
            recommendations.push({
                icon: '🔥',
                title: 'Falta de Constancia',
                text: `${noStreak} estudiantes sin racha activa. Incentivar la participación continua.`
            });
        }
        
        return recommendations.length > 0 ? `
            <div style="display: grid; gap: 1rem; margin-top: 1rem;">
                ${recommendations.map(rec => `
                    <div style="display: flex; gap: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <div style="font-size: 2rem;">${rec.icon}</div>
                        <div>
                            <h4 style="margin-bottom: 0.5rem; color: #92400e;">${rec.title}</h4>
                            <p style="margin: 0; color: #78350f;">${rec.text}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '<p style="color: var(--text-secondary);">No hay recomendaciones generales en este momento.</p>';
    }

    // Métodos auxiliares
    getRiskClass(probability) {
        if (!probability) probability = 50;
        if (probability < 30) return 'risk-critical';
        if (probability < 50) return 'risk-high';
        if (probability < 70) return 'risk-medium';
        return 'risk-low';
    }

    getRiskBadgeClass(probability) {
        if (!probability) probability = 50;
        if (probability < 30) return 'danger';
        if (probability < 50) return 'warning';
        if (probability < 70) return 'info';
        return 'success';
    }

    getRiskLevelText(probability) {
        if (!probability) probability = 50;
        if (probability < 30) return 'Crítico';
        if (probability < 50) return 'Alto';
        if (probability < 70) return 'Medio';
        return 'Bajo';
    }

    getTrendIcon(trend) {
        const icons = {
            'up': '📈',
            'down': '📉',
            'stable': '➡️',
            'neutral': '⚪'
        };
        return icons[trend] || '⚪';
    }

    // Mostrar todos los estudiantes en riesgo
    async showAllAtRisk() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-large" style="max-width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>Todos los estudiantes en riesgo (${this.allAtRiskStudents.length})</h3>
                    <button class="btn-icon" onclick="this.closest('.modal').remove()">✖️</button>
                </div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Email</th>
                                    <th>Cohorte</th>
                                    <th>Probabilidad</th>
                                    <th>Score</th>
                                    <th>Nivel</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.allAtRiskStudents.map(student => this.renderRiskTableRow(student)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Crear intervención
    async createIntervention(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Crear Plan de Intervención - ${student.username}</h3>
                    <button class="btn-icon" onclick="this.closest('.modal').remove()">✖️</button>
                </div>
                <div class="modal-body">
                    <p>Probabilidad de aprobar: <strong>${student.probability_pass}%</strong></p>
                    
                    <h4>Plan de acción recomendado:</h4>
                    <ul>
                        ${student.recommendations ? student.recommendations.map(r => `<li>${r.action}: ${r.details}</li>`).join('') : '<li>Sin recomendaciones específicas</li>'}
                    </ul>
                    
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Notas adicionales:</label>
                        <textarea id="interventionNotes" rows="4" style="width: 100%;"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn btn-primary" onclick="window.riskAnalysisModule.saveIntervention('${studentId}')">
                        Guardar Plan
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Crear alerta
    async createAlert(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        try {
            const alertData = {
                user_id: studentId,
                alert_type: 'high_risk',
                message: `Estudiante en riesgo ${this.getRiskLevelText(student.probability_pass).toLowerCase()}: ${student.username}. Probabilidad de aprobar: ${student.probability_pass}%. Requiere seguimiento.`
            };
            
            const { error } = await this.supabase
                .from('user_alerts')
                .insert(alertData);
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Alerta creada correctamente');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al crear alerta: ' + error.message);
        }
    }

    // Guardar intervención
    async saveIntervention(studentId) {
        const notes = document.getElementById('interventionNotes')?.value;
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        
        if (!student) return;
        
        try {
            // Añadir nota al estudiante
            const currentNotes = student.notes || [];
            currentNotes.push({
                type: 'intervention',
                text: `Plan de intervención: ${notes || 'Ver recomendaciones automáticas'}`,
                date: new Date().toISOString(),
                author: this.dashboard.auth.currentUser?.email
            });
            
            const { error } = await this.supabase
                .from('users')
                .update({ notes: currentNotes })
                .eq('id', studentId);
            
            if (error) throw error;
            
            // Crear alerta también
            await this.createAlert(studentId);
            
            this.dashboard.showNotification('success', 'Plan de intervención guardado');
            document.querySelector('.modal')?.remove();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al guardar: ' + error.message);
        }
    }

    // Métodos del análisis completo (ya existentes en tu código)
    async calculateComprehensiveRisk() {
        const students = [...this.dashboard.data.students];
        const results = this.dashboard.data.results;
        
        for (const student of students) {
            const studentResults = results.filter(r => r.user_id === student.id);
            
            // Factores de riesgo
            const factors = {
                avgScore: student.average_score || 0,
                scoreRisk: student.average_score ? (10 - student.average_score) * 10 : 100,
                participationRate: studentResults.length / Math.max(1, this.dashboard.data.simulations.length),
                participationRisk: (1 - (studentResults.length / Math.max(1, this.dashboard.data.simulations.length))) * 100,
                consistency: this.calculateConsistency(studentResults),
                consistencyRisk: this.calculateConsistency(studentResults) * 20,
                trend: await this.calculateDetailedTrend(student.id, studentResults),
                trendRisk: 0,
                engagement: this.calculateEngagement(studentResults),
                engagementRisk: (1 - this.calculateEngagement(studentResults)) * 100
            };
            
            // Calcular riesgo de tendencia
            if (factors.trend.slope < -0.1) {
                factors.trendRisk = Math.abs(factors.trend.slope) * 100;
            }
            
            // Calcular score de riesgo ponderado
            student.riskScore = (
                factors.scoreRisk * this.riskFactors.score.weight +
                factors.participationRisk * this.riskFactors.participation.weight +
                factors.consistencyRisk * this.riskFactors.consistency.weight +
                factors.trendRisk * this.riskFactors.trend.weight +
                factors.engagementRisk * this.riskFactors.engagement.weight
            );
            
            // Guardar factores detallados
            student.riskFactors = factors;
            
            // Calcular impacto
            student.riskImpact = this.calculateImpact(student);
            
            // Generar recomendaciones específicas
            student.recommendations = this.generateRecommendations(student);
        }
        
        // Ordenar por score de riesgo
        students.sort((a, b) => b.riskScore - a.riskScore);
        
        return students;
    }

    calculateConsistency(results) {
        if (results.length < 3) return 0;
        
        const scores = results.slice(0, 10).map(r => r.score);
        const avg = scores.reduce((a, b) => a + b) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
        
        return Math.sqrt(variance);
    }

    async calculateDetailedTrend(userId, results) {
        if (results.length < 3) return { slope: 0, r2: 0 };
        
        const data = results.slice(0, 10).map((r, i) => ({ x: i, y: r.score }));
        
        const n = data.length;
        const sumX = data.reduce((sum, d) => sum + d.x, 0);
        const sumY = data.reduce((sum, d) => sum + d.y, 0);
        const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
        const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const yMean = sumY / n;
        const ssTotal = data.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
        const ssResidual = data.reduce((sum, d) => {
            const predicted = slope * d.x + intercept;
            return sum + Math.pow(d.y - predicted, 2);
        }, 0);
        
        const r2 = 1 - (ssResidual / ssTotal);
        
        return { slope, intercept, r2 };
    }

    calculateEngagement(results) {
        if (results.length === 0) return 0;
        
        const reviewTime = results.reduce((sum, r) => sum + (r.review_time || 0), 0) / results.length;
        const completionRate = results.filter(r => r.blank_answers === 0).length / results.length;
        const saturdayRate = results.filter(r => r.is_saturday_live).length / results.length;
        
        return (
            (reviewTime / 60) * 0.3 +
            completionRate * 0.4 +
            saturdayRate * 0.3
        );
    }

    calculateImpact(student) {
        const cohortMultiplier = {
            '48h': 1.5,
            '36h': 1.2,
            '20h': 1.0,
            'sin_asignar': 0.8
        };
        
        const baseImpact = 50;
        const cohortImpact = cohortMultiplier[student.cohort] || 1;
        const potentialImpact = student.current_elo > 1200 ? 1.2 : 1;
        
        return baseImpact * cohortImpact * potentialImpact;
    }

    generateRecommendations(student) {
        const recommendations = [];
        const factors = student.riskFactors;
        
        if (factors.scoreRisk > 60) {
            recommendations.push({
                priority: 'alta',
                type: 'academica',
                action: 'Refuerzo académico urgente',
                details: `Score promedio de ${factors.avgScore.toFixed(1)}/10. Necesita apoyo en conceptos fundamentales.`
            });
        }
        
        if (factors.participationRisk > 50) {
            recommendations.push({
                priority: 'alta',
                type: 'motivacion',
                action: 'Mejorar participación',
                details: `Solo ha participado en ${(factors.participationRate * 100).toFixed(0)}% de los simulacros.`
            });
        }
        
        if (factors.consistencyRisk > 40) {
            recommendations.push({
                priority: 'media',
                type: 'metodologia',
                action: 'Estabilizar rendimiento',
                details: 'Alta variabilidad en resultados. Trabajar en técnicas de estudio consistentes.'
            });
        }
        
        if (factors.trendRisk > 30) {
            recommendations.push({
                priority: 'alta',
                type: 'intervencion',
                action: 'Intervención inmediata',
                details: 'Tendencia negativa marcada. Requiere seguimiento personalizado.'
            });
        }
        
        return recommendations;
    }

    renderExecutiveSummary(students) {
        const critical = students.filter(s => s.riskScore > 80).length;
        const high = students.filter(s => s.riskScore > 60 && s.riskScore <= 80).length;
        const medium = students.filter(s => s.riskScore > 40 && s.riskScore <= 60).length;
        const low = students.filter(s => s.riskScore <= 40).length;
        
        return `
            <div class="executive-summary" style="background: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: var(--shadow);">
                <h3 style="margin-bottom: 1.5rem;">📊 Resumen Ejecutivo del Análisis</h3>
                <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div class="summary-card critical" style="background: #fee2e2; padding: 1.5rem; border-radius: 8px; text-align: center; border-left: 4px solid #dc2626;">
                        <div class="summary-number" style="font-size: 2.5rem; font-weight: 700; color: #dc2626;">${critical}</div>
                        <div class="summary-label" style="font-weight: 600; color: #991b1b;">Riesgo Crítico</div>
                        <div class="summary-detail" style="font-size: 0.875rem; color: #7f1d1d;">Requieren intervención inmediata</div>
                    </div>
                    <div class="summary-card high" style="background: #fef3c7; padding: 1.5rem; border-radius: 8px; text-align: center; border-left: 4px solid #f59e0b;">
                        <div class="summary-number" style="font-size: 2.5rem; font-weight: 700; color: #f59e0b;">${high}</div>
                        <div class="summary-label" style="font-weight: 600; color: #92400e;">Riesgo Alto</div>
                        <div class="summary-detail" style="font-size: 0.875rem; color: #78350f;">Necesitan seguimiento cercano</div>
                    </div>
                    <div class="summary-card medium" style="background: #dbeafe; padding: 1.5rem; border-radius: 8px; text-align: center; border-left: 4px solid #3b82f6;">
                        <div class="summary-number" style="font-size: 2.5rem; font-weight: 700; color: #3b82f6;">${medium}</div>
                        <div class="summary-label" style="font-weight: 600; color: #1e40af;">Riesgo Medio</div>
                        <div class="summary-detail" style="font-size: 0.875rem; color: #1e3a8a;">Monitorear evolución</div>
                    </div>
                    <div class="summary-card low" style="background: #d1fae5; padding: 1.5rem; border-radius: 8px; text-align: center; border-left: 4px solid #10b981;">
                        <div class="summary-number" style="font-size: 2.5rem; font-weight: 700; color: #10b981;">${low}</div>
                        <div class="summary-label" style="font-weight: 600; color: #047857;">Riesgo Bajo</div>
                        <div class="summary-detail" style="font-size: 0.875rem; color: #065f46;">En buen camino</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRecommendedActions(students) {
        const allRecommendations = [];
        students.forEach(s => {
            if (s.recommendations) {
                s.recommendations.forEach(r => {
                    allRecommendations.push({
                        ...r,
                        studentId: s.id,
                        studentName: s.username
                    });
                });
            }
        });
        
        const grouped = allRecommendations.reduce((acc, rec) => {
            if (!acc[rec.type]) acc[rec.type] = [];
            acc[rec.type].push(rec);
            return acc;
        }, {});
        
        return Object.entries(grouped).map(([type, recs]) => `
            <div class="action-group" style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                <h4 style="margin-bottom: 0.5rem;">${this.formatActionType(type)} (${recs.length} estudiantes)</h4>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${recs.slice(0, 5).map(rec => `
                        <li style="margin-bottom: 0.5rem;">
                            <strong>${rec.studentName}:</strong> ${rec.action}
                        </li>
                    `).join('')}
                </ul>
                ${recs.length > 5 ? `<p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">... y ${recs.length - 5} más</p>` : ''}
            </div>
        `).join('');
    }

    async renderRiskMatrix(students) {
        // Solo renderizar si Chart.js está disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está disponible para renderizar la matriz de riesgo');
            document.getElementById('riskMatrix').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Gráfico no disponible</p>';
            return;
        }
        
        const ctx = document.createElement('canvas');
        document.getElementById('riskMatrix').appendChild(ctx);
        
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Estudiantes',
                    data: students.map(s => ({
                        x: s.riskScore || 0,
                        y: s.riskImpact || 50,
                        label: s.username
                    })),
                    backgroundColor: students.map(s => {
                        const score = s.riskScore || 0;
                        if (score > 80) return 'rgba(220, 38, 38, 0.6)';
                        if (score > 60) return 'rgba(245, 158, 11, 0.6)';
                        if (score > 40) return 'rgba(59, 130, 246, 0.6)';
                        return 'rgba(16, 185, 129, 0.6)';
                    }),
                    borderColor: students.map(s => {
                        const score = s.riskScore || 0;
                        if (score > 80) return '#dc2626';
                        if (score > 60) return '#f59e0b';
                        if (score > 40) return '#3b82f6';
                        return '#10b981';
                    }),
                    borderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Probabilidad de Riesgo (%)' },
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        title: { display: true, text: 'Impacto' },
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.raw;
                                return `${point.label}: Riesgo ${point.x.toFixed(0)}%, Impacto ${point.y.toFixed(0)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    async exportRiskReport() {
        try {
            const exportsModule = await this.dashboard.loadModule('exports');
            await exportsModule.exportRiskAnalysis();
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar: ' + error.message);
        }
    }

    formatActionType(type) {
        const types = {
            'academica': '📚 Acciones Académicas',
            'motivacion': '💪 Acciones de Motivación',
            'metodologia': '📋 Mejora de Metodología',
            'intervencion': '🚨 Intervenciones Urgentes'
        };
        return types[type] || type;
    }
}