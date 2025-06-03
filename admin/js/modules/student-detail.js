// /admin/js/modules/student-detail.js
export default class StudentDetailModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.currentStudent = null;
        this.studentHistory = null;
    }

    async render(container, studentId) {
        try {
            // Mostrar indicador de carga mientras obtenemos todos los datos
            container.innerHTML = this.getLoadingTemplate();
            
            // Cargar todos los datos del estudiante en paralelo para optimizar
            const [studentData, resultsData, eloHistory, medals, alerts] = await Promise.all([
                this.loadStudentData(studentId),
                this.loadStudentResults(studentId),
                this.loadEloHistory(studentId),
                this.loadStudentMedals(studentId),
                this.loadStudentAlerts(studentId)
            ]);
            
            this.currentStudent = studentData;
            
            // Calcular métricas avanzadas
            const analytics = this.calculateDetailedAnalytics(resultsData, eloHistory);
            
            // Renderizar la vista completa
            container.innerHTML = this.renderStudentDashboard(
                studentData, 
                resultsData, 
                analytics, 
                eloHistory,
                medals,
                alerts
            );
            
            // Configurar los gráficos después de renderizar el HTML
            await this.renderCharts(resultsData, eloHistory, analytics);
            
            // Establecer event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Error cargando detalles del estudiante:', error);
            container.innerHTML = this.getErrorTemplate(error);
        }
    }

    renderStudentDashboard(student, results, analytics, eloHistory, medals, alerts) {
        return `
            <div class="student-detail-page">
                <!-- Header con información principal -->
                <div class="student-header">
                    <button class="btn btn-secondary" onclick="window.dashboardAdmin.showPage('students')">
                        ← Volver a estudiantes
                    </button>
                    
                    <div class="student-info-header">
                        <h1>${student.username}</h1>
                        <div class="student-meta">
                            <span class="badge badge-info">${student.cohort}</span>
                            <span class="student-email">${student.email}</span>
                            <span class="student-slug">Código: ${student.slug}</span>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <button class="btn btn-primary" onclick="window.studentDetail.openEmailModal()">
                            ✉️ Enviar Email
                        </button>
                        <button class="btn btn-secondary" onclick="window.studentDetail.exportStudentReport()">
                            📄 Exportar Informe
                        </button>
                    </div>
                </div>
                
                <!-- Panel de métricas principales -->
                <div class="metrics-panel">
                    ${this.renderMetricsCards(student, analytics)}
                </div>
                
                <!-- Alerta de riesgo si es necesario -->
                ${this.renderRiskAlert(student, analytics)}
                
                <!-- Tabs de contenido -->
                <div class="student-tabs">
                    <div class="tab-headers">
                        <button class="tab-header active" data-tab="evolution">
                            📈 Evolución
                        </button>
                        <button class="tab-header" data-tab="results">
                            📊 Resultados Detallados
                        </button>
                        <button class="tab-header" data-tab="analysis">
                            🔍 Análisis Profundo
                        </button>
                        <button class="tab-header" data-tab="communication">
                            💬 Comunicación
                        </button>
                    </div>
                    
                    <div class="tab-content">
                        <!-- Tab de Evolución -->
                        <div class="tab-pane active" id="evolution-tab">
                            <div class="charts-grid">
                                <div class="chart-container">
                                    <h3>Evolución de Puntuaciones</h3>
                                    <canvas id="scoreEvolutionChart"></canvas>
                                </div>
                                <div class="chart-container">
                                    <h3>Progresión ELO</h3>
                                    <canvas id="eloProgressionChart"></canvas>
                                </div>
                            </div>
                            
                            <div class="insights-section">
                                <h3>💡 Insights Detectados</h3>
                                ${this.renderInsights(analytics)}
                            </div>
                        </div>
                        
                        <!-- Tab de Resultados -->
                        <div class="tab-pane" id="results-tab">
                            ${this.renderResultsTable(results)}
                        </div>
                        
                        <!-- Tab de Análisis -->
                        <div class="tab-pane" id="analysis-tab">
                            ${this.renderDetailedAnalysis(student, analytics, results)}
                        </div>
                        
                        <!-- Tab de Comunicación -->
                        <div class="tab-pane" id="communication-tab">
                            ${this.renderCommunicationHistory(student)}
                        </div>
                    </div>
                </div>
                
                <!-- Modal de Email -->
                ${this.renderEmailModal()}
            </div>
        `;
    }

    renderMetricsCards(student, analytics) {
        const cards = [
            {
                title: 'Puntuación Promedio',
                value: student.average_score?.toFixed(2) || 'N/A',
                subtitle: 'Últimos 5: ' + analytics.recentAverage.toFixed(2),
                icon: '📊',
                trend: analytics.scoreTrend
            },
            {
                title: 'ELO Actual',
                value: student.current_elo,
                subtitle: `Cambio mensual: ${analytics.monthlyEloChange > 0 ? '+' : ''}${analytics.monthlyEloChange}`,
                icon: '⚡',
                trend: analytics.eloTrend
            },
            {
                title: 'Probabilidad de Aprobar',
                value: student.probability_pass + '%',
                subtitle: this.getRiskText(student.probability_pass),
                icon: '🎯',
                trend: null
            },
            {
                title: 'Participación',
                value: analytics.participationRate + '%',
                subtitle: `${student.total_simulations} de ${analytics.totalSimulations} simulacros`,
                icon: '📈',
                trend: null
            }
        ];
        
        return cards.map(card => `
            <div class="metric-card">
                <div class="metric-icon">${card.icon}</div>
                <div class="metric-content">
                    <div class="metric-title">${card.title}</div>
                    <div class="metric-value">
                        ${card.value}
                        ${card.trend ? this.getTrendIndicator(card.trend) : ''}
                    </div>
                    <div class="metric-subtitle">${card.subtitle}</div>
                </div>
            </div>
        `).join('');
    }

    renderEmailModal() {
        return `
            <div id="emailModal" class="modal" style="display: none;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>✉️ Enviar Email a ${this.currentStudent?.username || 'Estudiante'}</h3>
                        <button class="btn-icon" onclick="window.studentDetail.closeEmailModal()">✖️</button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Plantillas predefinidas -->
                        <div class="email-templates">
                            <label>Plantilla rápida:</label>
                            <select id="emailTemplate" onchange="window.studentDetail.loadEmailTemplate()">
                                <option value="">-- Seleccionar plantilla --</option>
                                <option value="encouragement">🌟 Mensaje de ánimo</option>
                                <option value="concern">⚠️ Preocupación por rendimiento</option>
                                <option value="congratulations">🎉 Felicitación por mejora</option>
                                <option value="reminder">🔔 Recordatorio de participación</option>
                                <option value="custom">✏️ Personalizado</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Asunto:</label>
                            <input type="text" id="emailSubject" class="form-control" 
                                   placeholder="Asunto del mensaje">
                        </div>
                        
                        <div class="form-group">
                            <label>Mensaje:</label>
                            <textarea id="emailBody" rows="10" class="form-control" 
                                      placeholder="Escribe tu mensaje aquí..."></textarea>
                        </div>
                        
                        <!-- Vista previa con datos -->
                        <div class="email-preview">
                            <h4>Vista previa con datos del estudiante:</h4>
                            <div id="emailPreview" class="preview-content">
                                <!-- Se actualiza dinámicamente -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.studentDetail.closeEmailModal()">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" onclick="window.studentDetail.sendEmail()">
                            📤 Enviar Email
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    calculateDetailedAnalytics(results, eloHistory) {
        // Aquí calculamos métricas avanzadas del estudiante
        const analytics = {
            // Tendencias
            scoreTrend: this.calculateTrend(results.map(r => r.score)),
            eloTrend: this.calculateTrend(eloHistory.map(h => h.elo_after)),
            
            // Promedios recientes
            recentAverage: this.calculateRecentAverage(results, 5),
            monthlyEloChange: this.calculateMonthlyEloChange(eloHistory),
            
            // Participación
            participationRate: this.calculateParticipationRate(results),
            totalSimulations: this.dashboard.data.simulations.length,
            
            // Patrones
            bestDay: this.findBestPerformanceDay(results),
            worstTopics: this.analyzeWeakTopics(results),
            consistency: this.calculateConsistency(results),
            
            // Predicciones
            projectedScore: this.projectNextScore(results),
            improvementRate: this.calculateImprovementRate(results)
        };
        
        return analytics;
    }

    // Métodos para el sistema de email
    async sendEmail() {
        const subject = document.getElementById('emailSubject').value;
        const body = document.getElementById('emailBody').value;
        
        if (!subject || !body) {
            this.dashboard.showNotification('error', 'Por favor completa todos los campos');
            return;
        }
        
        try {
            // Preparar los datos del email con información contextual
            const emailData = {
                to: this.currentStudent.email,
                subject: subject,
                body: body,
                // Metadatos para tracking y automatización futura
                metadata: {
                    student_id: this.currentStudent.id,
                    sent_by: this.dashboard.auth.currentUser.email,
                    sent_at: new Date().toISOString(),
                    type: document.getElementById('emailTemplate').value,
                    context: {
                        current_elo: this.currentStudent.current_elo,
                        average_score: this.currentStudent.average_score,
                        probability_pass: this.currentStudent.probability_pass
                    }
                }
            };
            
            // Enviar a través de tu Edge Function
            const { data, error } = await this.supabase.functions.invoke('send-direct-email', {
                body: emailData
            });
            
            if (error) throw error;
            
            // Guardar en historial de comunicaciones
            await this.saveEmailToHistory(emailData);
            
            this.dashboard.showNotification('success', 'Email enviado correctamente');
            this.closeEmailModal();
            
            // Recargar historial de comunicación
            await this.refreshCommunicationHistory();
            
        } catch (error) {
            console.error('Error enviando email:', error);
            this.dashboard.showNotification('error', 'Error al enviar el email');
        }
    }

    loadEmailTemplate() {
        const template = document.getElementById('emailTemplate').value;
        const subject = document.getElementById('emailSubject');
        const body = document.getElementById('emailBody');
        
        const templates = {
            encouragement: {
                subject: `¡Ánimo ${this.currentStudent.username}! Sigue así 💪`,
                body: `Hola ${this.currentStudent.username},

He estado revisando tu progreso y quiero que sepas que valoro mucho tu esfuerzo. 
Tu puntuación promedio actual es de ${this.currentStudent.average_score?.toFixed(2)}/10 y tu ELO es ${this.currentStudent.current_elo}.

Sé que a veces puede ser difícil, pero cada simulacro es una oportunidad para mejorar. 
${this.currentStudent.current_streak > 0 ? `¡Tu racha de ${this.currentStudent.current_streak} semanas demuestra tu compromiso!` : 'Te animo a mantener la constancia en los simulacros.'}

Recuerda que estoy aquí para apoyarte. Si necesitas ayuda con algún tema específico, no dudes en preguntarme.

¡Sigue adelante!

Un saludo,
[Tu nombre]`
            },
            concern: {
                subject: `${this.currentStudent.username}, ¿cómo puedo ayudarte? 🤝`,
                body: `Hola ${this.currentStudent.username},

He notado que últimamente has tenido algunos desafíos en los simulacros. 
Tu probabilidad actual de aprobar es del ${this.currentStudent.probability_pass}% y me gustaría ayudarte a mejorar.

Me gustaría entender mejor qué dificultades estás encontrando:
- ¿Hay algún tema específico que te cueste más?
- ¿Necesitas más tiempo para estudiar?
- ¿Te gustaría sesiones de repaso adicionales?

Por favor, cuéntame cómo te sientes y qué podemos hacer juntos para mejorar tu situación.

Estoy aquí para apoyarte.

Un saludo,
[Tu nombre]`
            },
            congratulations: {
                subject: `¡Felicidades ${this.currentStudent.username}! 🎉`,
                body: `Hola ${this.currentStudent.username},

¡Quiero felicitarte por tu excelente progreso! 

He visto que tu rendimiento ha mejorado notablemente y eso demuestra tu dedicación y esfuerzo.
${this.currentStudent.current_elo > 1200 ? `Tu ELO de ${this.currentStudent.current_elo} te coloca entre los mejores estudiantes.` : ''}

Sigue así, estás en el camino correcto para alcanzar tus objetivos.

¡Enhorabuena!

Un saludo,
[Tu nombre]`
            },
            reminder: {
                subject: `${this.currentStudent.username}, ¡te echamos de menos! 👋`,
                body: `Hola ${this.currentStudent.username},

He notado que hace tiempo que no participas en los simulacros. 
${this.currentStudent.current_streak > 0 ? `No pierdas tu racha de ${this.currentStudent.current_streak} semanas.` : 'Es importante mantener la práctica constante.'}

El próximo simulacro está disponible y me gustaría verte participar. 
Recuerda que la práctica regular es clave para el éxito.

Si hay algo que te está impidiendo participar, por favor házmelo saber para poder ayudarte.

¡Espero verte pronto!

Un saludo,
[Tu nombre]`
            }
        };
        
        if (templates[template]) {
            subject.value = templates[template].subject;
            body.value = templates[template].body;
            this.updateEmailPreview();
        }
    }
    
    // Guardar referencia global
    setupEventListeners() {
        window.studentDetail = this;
        
        // Event listeners para tabs
        document.querySelectorAll('.tab-header').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Preview de email en tiempo real
        document.getElementById('emailBody')?.addEventListener('input', () => this.updateEmailPreview());
    }
}