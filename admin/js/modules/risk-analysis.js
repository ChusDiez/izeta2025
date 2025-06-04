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
    }

// /admin/js/modules/risk-analysis.js
async render(container) {
    try {
        // Asegurar que Chart.js esté disponible
        await (window.ensureChartJS ? window.ensureChartJS() : Promise.resolve());
        
        // Calcular estadísticas básicas de riesgo
        const students = this.dashboard.data.students;
        const atRisk = students.filter(s => (s.probability_pass || 50) < 50);
        const criticalRisk = students.filter(s => (s.probability_pass || 50) < 30);
        
        container.innerHTML = `
            <div class="risk-analysis-page">
                <h2>⚠️ Análisis de Riesgo</h2>
                
                <!-- Resumen de riesgo -->
                <div class="risk-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0;">
                    <div class="stat-card danger">
                        <div class="stat-header">
                            <div class="stat-icon danger">⚠️</div>
                            <div class="stat-content">
                                <div class="stat-label">Estudiantes en Riesgo</div>
                                <div class="stat-value">${atRisk.length}</div>
                                <div class="stat-change">${((atRisk.length / students.length) * 100).toFixed(1)}% del total</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card danger" style="border-color: #dc2626;">
                        <div class="stat-header">
                            <div class="stat-icon danger">🚨</div>
                            <div class="stat-content">
                                <div class="stat-label">Riesgo Crítico</div>
                                <div class="stat-value">${criticalRisk.length}</div>
                                <div class="stat-change">P(aprobar) < 30%</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Lista de estudiantes en riesgo -->
                <div class="risk-list table-card">
                    <div class="table-header">
                        <h3>Estudiantes que requieren atención inmediata</h3>
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
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${atRisk.slice(0, 20).map(student => `
                                    <tr>
                                        <td><strong>${student.username}</strong></td>
                                        <td><span class="badge badge-info">${student.cohort}</span></td>
                                        <td>
                                            <span class="risk-indicator ${this.getRiskClass(student.probability_pass)}">
                                                ${(student.probability_pass || 50).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td>${(student.average_score || 0).toFixed(1)}/10</td>
                                        <td>${this.getTrendIcon(student.trend_direction)}</td>
                                        <td>
                                            <button class="btn-icon" onclick="window.dashboardAdmin.showPage('students')" title="Ver detalles">
                                                👁️
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${atRisk.length > 20 ? `
                        <div style="padding: 1rem; text-align: center; background: #f9fafb;">
                            <p>Mostrando 20 de ${atRisk.length} estudiantes en riesgo</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        window.riskModule = this;
        
        // Si Chart.js está disponible, puedes renderizar la matriz de riesgo
        if (typeof Chart !== 'undefined') {
            // Aquí puedes llamar a renderRiskMatrix de forma segura
            console.log('Chart.js disponible para gráficos de riesgo');
        }
        
    } catch (error) {
        console.error('Error en módulo de riesgo:', error);
        container.innerHTML = `
            <div class="error-container">
                <h3>❌ Error al cargar el módulo</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Agregar estos métodos auxiliares si no existen
getRiskClass(probability) {
    if (!probability) probability = 50;
    if (probability < 30) return 'risk-critical';
    if (probability < 50) return 'risk-high';
    if (probability < 70) return 'risk-medium';
    return 'risk-low';
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

    async calculateComprehensiveRisk() {
        const students = [...this.dashboard.data.students];
        const results = this.dashboard.data.results;
        
        for (const student of students) {
            const studentResults = results.filter(r => r.user_id === student.id);
            
            // Factores de riesgo
            const factors = {
                // 1. Score promedio bajo
                avgScore: student.average_score || 0,
                scoreRisk: student.average_score ? (10 - student.average_score) * 10 : 100,
                
                // 2. Baja participación
                participationRate: studentResults.length / Math.max(1, this.dashboard.data.simulations.length),
                participationRisk: (1 - (studentResults.length / Math.max(1, this.dashboard.data.simulations.length))) * 100,
                
                // 3. Inconsistencia
                consistency: this.calculateConsistency(studentResults),
                consistencyRisk: this.calculateConsistency(studentResults) * 20,
                
                // 4. Tendencia negativa
                trend: await this.calculateDetailedTrend(student.id, studentResults),
                trendRisk: 0, // Se calcula después
                
                // 5. Bajo engagement
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
            
            // Calcular impacto (basado en cohorte y potencial)
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
        
        // Análisis de regresión lineal
        const data = results.slice(0, 10).map((r, i) => ({ x: i, y: r.score }));
        
        const n = data.length;
        const sumX = data.reduce((sum, d) => sum + d.x, 0);
        const sumY = data.reduce((sum, d) => sum + d.y, 0);
        const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
        const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calcular R²
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
        
        // Factores de engagement
        const reviewTime = results.reduce((sum, r) => sum + (r.review_time || 0), 0) / results.length;
        const completionRate = results.filter(r => r.blank_answers === 0).length / results.length;
        const saturdayRate = results.filter(r => r.is_saturday_live).length / results.length;
        
        return (
            (reviewTime / 60) * 0.3 +  // Normalizado a horas
            completionRate * 0.4 +
            saturdayRate * 0.3
        );
    }

    calculateImpact(student) {
        // El impacto es mayor para estudiantes de cohortes superiores
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
            <div class="executive-summary">
                <div class="summary-grid">
                    <div class="summary-card critical">
                        <div class="summary-number">${critical}</div>
                        <div class="summary-label">Riesgo Crítico</div>
                        <div class="summary-detail">Requieren intervención inmediata</div>
                    </div>
                    <div class="summary-card high">
                        <div class="summary-number">${high}</div>
                        <div class="summary-label">Riesgo Alto</div>
                        <div class="summary-detail">Necesitan seguimiento cercano</div>
                    </div>
                    <div class="summary-card medium">
                        <div class="summary-number">${medium}</div>
                        <div class="summary-label">Riesgo Medio</div>
                        <div class="summary-detail">Monitorear evolución</div>
                    </div>
                    <div class="summary-card low">
                        <div class="summary-number">${low}</div>
                        <div class="summary-label">Riesgo Bajo</div>
                        <div class="summary-detail">En buen camino</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRiskCard(student) {
        const priorityClass = student.riskScore > 80 ? 'critical' : 
                             student.riskScore > 60 ? 'high' : 'medium';
        
        return `
            <div class="risk-card ${priorityClass}">
                <div class="risk-card-header">
                    <h4>${student.username}</h4>
                    <span class="risk-score">${student.riskScore.toFixed(0)}%</span>
                </div>
                <div class="risk-card-body">
                    <div class="risk-factors">
                        ${Object.entries(student.riskFactors)
                            .filter(([key, value]) => key.includes('Risk') && value > 30)
                            .map(([key, value]) => `
                                <div class="risk-factor">
                                    <span class="factor-name">${this.formatFactorName(key)}:</span>
                                    <span class="factor-value">${value.toFixed(0)}%</span>
                                </div>
                            `).join('')}
                    </div>
                    <div class="recommendations">
                        ${student.recommendations
                            .filter(r => r.priority === 'alta')
                            .slice(0, 2)
                            .map(r => `
                                <div class="recommendation ${r.priority}">
                                    <strong>${r.action}</strong>
                                    <p>${r.details}</p>
                                </div>
                            `).join('')}
                    </div>
                </div>
                <div class="risk-card-actions">
                    <button class="btn-icon" onclick="window.riskModule.viewStudentDetail('${student.id}')">
                        Ver detalles
                    </button>
                    <button class="btn-icon" onclick="window.riskModule.createAlert('${student.id}')">
                        Crear alerta
                    </button>
                </div>
            </div>
        `;
    }

    renderRecommendedActions(students) {
        // Agrupar recomendaciones por tipo
        const allRecommendations = [];
        students.forEach(s => {
            s.recommendations.forEach(r => {
                allRecommendations.push({
                    ...r,
                    studentId: s.id,
                    studentName: s.username
                });
            });
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
                        <li>
                            <strong>${rec.studentName}:</strong> ${rec.action}
                        </li>
                    `).join('')}
                </ul>
                ${recs.length > 5 ? `<p>... y ${recs.length - 5} más</p>` : ''}
            </div>
        `).join('');
    }

    async renderRiskMatrix(students) {
        // Aquí podrías usar D3.js o Chart.js para crear una matriz de riesgo interactiva
        // Por simplicidad, usaré Chart.js con un scatter plot
        
        const ctx = document.createElement('canvas');
        document.getElementById('riskMatrix').appendChild(ctx);
        
        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Estudiantes',
                    data: students.map(s => ({
                        x: s.riskScore,
                        y: s.riskImpact,
                        label: s.username
                    })),
                    backgroundColor: students.map(s => 
                        s.riskScore > 80 ? '#DC2626' :
                        s.riskScore > 60 ? '#F59E0B' :
                        s.riskScore > 40 ? '#3B82F6' : '#10B981'
                    )
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Probabilidad de Riesgo (%)' },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: { display: true, text: 'Impacto' },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
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
        // Aquí podrías usar jsPDF para generar un PDF
        // Por ahora, exportamos a Excel
        const exportsModule = await this.dashboard.loadModule('exports');
        await exportsModule.exportRiskAnalysis();
    }

    formatFactorName(key) {
        const names = {
            'scoreRisk': 'Puntuación',
            'participationRisk': 'Participación',
            'consistencyRisk': 'Consistencia',
            'trendRisk': 'Tendencia',
            'engagementRisk': 'Compromiso'
        };
        return names[key] || key;
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