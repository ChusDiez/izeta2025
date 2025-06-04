// admin/js/modules/risk-analysis.js
// Módulo de análisis de riesgo actualizado para usar utilidades compartidas

import { StatisticsUtils, CNPStatistics } from './utils/statistics.js';
import PatternDetector from './analytics/patterns.js';

export default class RiskAnalysisModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.patternDetector = new PatternDetector();
        this.allAtRiskStudents = [];
    }

    async render(container) {
        try {
            // Mostrar indicador de carga
            container.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Analizando riesgos...</p>
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
                    <p class="text-muted">
                        Análisis completo de estudiantes en riesgo académico basado en múltiples factores
                    </p>
                    
                    <!-- Resumen ejecutivo -->
                    ${this.renderExecutiveSummary(studentsWithRisk)}
                    
                    <!-- Resumen de riesgo -->
                    <div class="stats-grid">
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
                        
                        <div class="stat-card danger">
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
                    <div class="card">
                        <h3>📊 Distribución por Niveles de Riesgo</h3>
                        ${this.renderRiskDistributionBars(studentsWithRisk)}
                    </div>
                    
                    <!-- Matriz de riesgo-impacto -->
                    <div class="card">
                        <h3>📈 Matriz de Riesgo-Impacto</h3>
                        <div id="riskMatrix" class="chart-body"></div>
                    </div>
                    
                    <!-- Lista de estudiantes en riesgo -->
                    <div class="table-card">
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
                            <div class="table-footer">
                                <p>Mostrando 20 de ${atRisk.length} estudiantes en riesgo</p>
                                <button class="btn btn-secondary" onclick="window.riskAnalysisModule.showAllAtRisk()">
                                    Ver todos
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Acciones recomendadas -->
                    <div class="card">
                        <h3>💡 Acciones Recomendadas por Tipo</h3>
                        ${this.renderRecommendedActions(atRisk)}
                    </div>
                    
                    <!-- Recomendaciones generales -->
                    <div class="card">
                        <h3>📌 Recomendaciones Generales</h3>
                        ${this.renderGeneralRecommendations(studentsWithRisk, atRisk, criticalRisk)}
                    </div>
                </div>
            `;
            
            // Guardar referencia global
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

    /**
     * Calcular riesgo comprehensivo usando las utilidades compartidas
     */
    async calculateComprehensiveRisk() {
        const students = [...this.dashboard.data.students];
        const results = this.dashboard.data.results;
        
        for (const student of students) {
            const studentResults = results.filter(r => r.user_id === student.id);
            
            // === AQUÍ ESTÁ EL CAMBIO PRINCIPAL ===
            // Usar StatisticsUtils en lugar de métodos locales
            const consistency = StatisticsUtils.calculateConsistency(studentResults);
            
            // Calcular tendencia usando las utilidades
            const scores = studentResults.map(r => r.score);
            const trendSlope = scores.length >= 2 ? StatisticsUtils.calculateTrend(scores) : 0;
            
            // Calcular regresión completa si necesitas más detalles
            const trend = scores.length >= 3 ? {
                slope: trendSlope,
                direction: trendSlope > 0.1 ? 'up' : trendSlope < -0.1 ? 'down' : 'stable',
                ...StatisticsUtils.calculateLinearRegression(
                    scores.map((_, i) => i),
                    scores
                )
            } : { slope: 0, direction: 'neutral', r2: 0 };
            
            // Usar el PatternDetector para análisis de patrones
            const responsePatterns = await this.patternDetector.analyzeStudentPatterns(student, studentResults);
            
            // Calcular factores de riesgo
            const factors = {
                avgScore: student.average_score || 0,
                scoreRisk: student.average_score ? (10 - student.average_score) * 10 : 100,
                participationRate: studentResults.length / Math.max(1, this.dashboard.data.simulations.length),
                participationRisk: (1 - (studentResults.length / Math.max(1, this.dashboard.data.simulations.length))) * 100,
                consistency: consistency,
                consistencyRisk: consistency * 20,
                trend: trend,
                trendRisk: trend.slope < -0.1 ? Math.abs(trend.slope) * 100 : 0,
                engagement: this.calculateEngagement(studentResults),
                engagementRisk: (1 - this.calculateEngagement(studentResults)) * 100
            };
            
            // Calcular score de riesgo ponderado
            const riskWeights = {
                score: 0.3,
                participation: 0.2,
                consistency: 0.2,
                trend: 0.2,
                engagement: 0.1
            };
            
            student.riskScore = (
                factors.scoreRisk * riskWeights.score +
                factors.participationRisk * riskWeights.participation +
                factors.consistencyRisk * riskWeights.consistency +
                factors.trendRisk * riskWeights.trend +
                factors.engagementRisk * riskWeights.engagement
            );
            
            // Guardar factores detallados
            student.riskFactors = factors;
            student.responsePatterns = responsePatterns;
            
            // Calcular impacto
            student.riskImpact = this.calculateImpact(student);
            
            // Generar recomendaciones específicas
            student.recommendations = this.generateRecommendations(student);
        }
        
        // Ordenar por score de riesgo
        students.sort((a, b) => b.riskScore - a.riskScore);
        
        return students;
    }

    /**
     * Calcular engagement del estudiante
     */
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

    /**
     * Calcular impacto del estudiante
     */
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

    /**
     * Generar recomendaciones basadas en el análisis
     */
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
        
        // Añadir recomendaciones basadas en patrones detectados
        if (student.responsePatterns?.hasEnoughData && student.responsePatterns.recommendations) {
            recommendations.push(...student.responsePatterns.recommendations);
        }
        
        return recommendations;
    }

    // ==== MÉTODOS DE RENDERIZADO (sin cambios significativos) ====

    renderExecutiveSummary(students) {
        const critical = students.filter(s => s.riskScore > 80).length;
        const high = students.filter(s => s.riskScore > 60 && s.riskScore <= 80).length;
        const medium = students.filter(s => s.riskScore > 40 && s.riskScore <= 60).length;
        const low = students.filter(s => s.riskScore <= 40).length;
        
        return `
            <div class="executive-summary card">
                <h3>📊 Resumen Ejecutivo del Análisis</h3>
                <div class="stats-grid">
                    <div class="stat-card danger">
                        <div class="stat-icon danger">${critical}</div>
                        <div class="stat-label">Riesgo Crítico</div>
                        <div class="stat-change">Requieren intervención inmediata</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-icon warning">${high}</div>
                        <div class="stat-label">Riesgo Alto</div>
                        <div class="stat-change">Necesitan seguimiento cercano</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-icon info">${medium}</div>
                        <div class="stat-label">Riesgo Medio</div>
                        <div class="stat-change">Monitorear evolución</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-icon success">${low}</div>
                        <div class="stat-label">Riesgo Bajo</div>
                        <div class="stat-change">En buen camino</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRiskTableRow(student) {
        const mainFactors = this.getMainRiskFactors(student);
        const patterns = student.responsePatterns;
        const hasPatternIssues = patterns?.hasEnoughData && 
            patterns.riskFactors && patterns.riskFactors.length > 0;
        
        return `
            <tr>
                <td>
                    <strong>${student.username}</strong>
                    <div class="text-small text-muted">${student.email}</div>
                </td>
                <td><span class="badge badge-info">${student.cohort}</span></td>
                <td>
                    <span class="risk-indicator ${this.getRiskClass(student.probability_pass)}">
                        ${(student.probability_pass || 50).toFixed(0)}%
                    </span>
                </td>
                <td>${(student.average_score || 0).toFixed(1)}/10</td>
                <td>${this.getTrendIcon(student.riskFactors?.trend?.direction || 'neutral')}</td>
                <td>
                    <div class="text-small">
                        ${mainFactors.map(f => `<span class="risk-factor-tag">${f}</span>`).join(' ')}
                        ${hasPatternIssues ? '<span class="risk-factor-tag pattern-alert">⚠️ Patrones</span>' : ''}
                    </div>
                </td>
                <td>
                    <span class="risk-badge ${this.getRiskBadgeClass(student.probability_pass)}">
                        ${this.getRiskLevelText(student.probability_pass)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')" title="Ver detalles">
                            👁️
                        </button>
                        ${hasPatternIssues ? `
                            <button class="btn-icon" onclick="window.riskAnalysisModule.showPatternDetails('${student.id}')" title="Ver patrones">
                                📊
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="window.riskAnalysisModule.createIntervention('${student.id}')" title="Crear intervención">
                            💬
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderRiskDistributionBars(students) {
        const distribution = {
            critical: students.filter(s => (s.probability_pass || 50) < 30).length,
            high: students.filter(s => (s.probability_pass || 50) >= 30 && (s.probability_pass || 50) < 50).length,
            medium: students.filter(s => (s.probability_pass || 50) >= 50 && (s.probability_pass || 50) < 70).length,
            low: students.filter(s => (s.probability_pass || 50) >= 70).length
        };
        
        const total = students.length;
        
        return `
            <div class="risk-distribution-bars">
                ${Object.entries(distribution).map(([level, count]) => {
                    const percentage = (count / total * 100).toFixed(1);
                    const colors = {
                        critical: '#dc2626',
                        high: '#f59e0b',
                        medium: '#3b82f6',
                        low: '#10b981'
                    };
                    
                    return `
                        <div class="distribution-bar">
                            <div class="bar-header">
                                <span>${this.getRiskLevelText(level === 'critical' ? 20 : level === 'high' ? 40 : level === 'medium' ? 60 : 80)}</span>
                                <span>${count} estudiantes (${percentage}%)</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${percentage}%; background-color: ${colors[level]};"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
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
            <div class="action-group">
                <h4>${this.formatActionType(type)} (${recs.length} estudiantes)</h4>
                <ul>
                    ${recs.slice(0, 5).map(rec => `
                        <li><strong>${rec.studentName}:</strong> ${rec.action}</li>
                    `).join('')}
                </ul>
                ${recs.length > 5 ? `<p class="text-muted">... y ${recs.length - 5} más</p>` : ''}
            </div>
        `).join('');
    }

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
        
        return recommendations.length > 0 ? `
            <div class="recommendations-list">
                ${recommendations.map(rec => `
                    <div class="recommendation-item">
                        <div class="recommendation-icon">${rec.icon}</div>
                        <div>
                            <h4>${rec.title}</h4>
                            <p>${rec.text}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '<p class="text-muted">No hay recomendaciones generales en este momento.</p>';
    }

    async renderRiskMatrix(students) {
        // Solo renderizar si Chart.js está disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está disponible para renderizar la matriz de riesgo');
            document.getElementById('riskMatrix').innerHTML = '<p class="text-muted">Gráfico no disponible</p>';
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

    // ==== MÉTODOS DE ACCIÓN ====

    showPatternDetails(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student || !student.responsePatterns) return;
        
        const patterns = student.responsePatterns;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📊 Análisis de Patrones - ${student.username}</h3>
                    <button class="btn-icon" onclick="this.closest('.modal').remove()">✖️</button>
                </div>
                <div class="modal-body">
                    <h4>Patrones Detectados:</h4>
                    ${patterns.summary}
                    
                    <h4>Detalles:</h4>
                    <ul>
                        ${Object.entries(patterns.patterns)
                            .filter(([_, pattern]) => pattern.detected)
                            .map(([type, pattern]) => `
                                <li><strong>${this.getPatternName(type)}:</strong> ${pattern.recommendation || 'Detectado'}</li>
                            `).join('')}
                    </ul>
                    
                    <h4>Recomendaciones:</h4>
                    ${patterns.recommendations.map(rec => `
                        <div class="recommendation-item ${rec.priority}">
                            <strong>${rec.action}</strong>
                            <p>${rec.details}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

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
                    
                    <div class="form-group">
                        <label>Notas adicionales:</label>
                        <textarea id="interventionNotes" rows="4"></textarea>
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

    async showAllAtRisk() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-large">
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

    async exportRiskReport() {
        const exportsModule = await this.dashboard.loadModule('exports');
        await exportsModule.exportRiskAnalysis();
    }

    // ==== MÉTODOS AUXILIARES ====

    getMainRiskFactors(student) {
        const factors = [];
        
        if (student.average_score < 6) factors.push('📉 Score bajo');
        if (student.total_simulations < 3) factors.push('📅 Poca participación');
        if (student.current_streak === 0) factors.push('🔥 Sin racha');
        if (student.riskFactors?.trend?.direction === 'down') factors.push('📊 Tendencia negativa');
        if (student.riskFactors?.consistencyRisk > 40) factors.push('📈 Inconsistente');
        
        return factors.slice(0, 3); // Máximo 3 factores
    }

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

    getPatternName(pattern) {
        const names = {
            'fatigue': 'Fatiga mental',
            'rushing': 'Precipitación',
            'abandonment': 'Abandono excesivo',
            'topicWeakness': 'Debilidad en temas',
            'confidenceAlignment': 'Alineación de confianza',
            'stressImpact': 'Impacto del estrés',
            'timeManagement': 'Gestión del tiempo',
            'consistencyPattern': 'Patrón de consistencia'
        };
        return names[pattern] || pattern;
    }

    formatActionType(type) {
        const types = {
            'academica': '📚 Acciones Académicas',
            'motivacion': '💪 Acciones de Motivación',
            'metodologia': '📋 Mejora de Metodología',
            'intervencion': '🚨 Intervenciones Urgentes',
            'performance': '🎯 Mejora de Rendimiento',
            'technique': '🛠️ Técnicas de Examen',
            'strategy': '📝 Estrategia',
            'mental': '🧠 Salud Mental'
        };
        return types[type] || type;
    }
}