// /admin/js/modules/student-detail.js
export default class StudentDetailModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.currentStudent = null;
        this.studentHistory = null;
        this.currentEvolcampusData = null;
        this.currentStudentId = null;
        // Helper genérico: ejecuta la query Supabase y lanza error salvo 'no rows'
        this.safeQuery = async (promise, logCtx) => {
            const { data, error } = await promise;
            if (error && error.code !== 'PGRST116') {           // 116 = no rows found
                console.error(`${logCtx}:`, error);
                throw new Error(`${logCtx}: ${error.message}`);
            }
            return data;
        };
    }

    async render(container, studentId) {
        this.currentStudentId = studentId;
        
        try {
            // Mostrar loading
            container.innerHTML = this.getLoadingTemplate();
            
            // Cargar datos del estudiante
            const { student, results, analytics, eloHistory, medals, alerts, evolcampusData } = await this.loadStudentData(studentId);
            this.currentStudent = student;
            
            // Renderizar dashboard
            container.innerHTML = this.renderStudentDashboard(student, results, analytics, eloHistory, medals, alerts, evolcampusData);
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Renderizar gráficos con delay para asegurar que el DOM esté listo
            setTimeout(() => {
                this.renderCharts(results, eloHistory, analytics);
                this.updateEvolcampusTab(evolcampusData);
            }, 100);
            
        } catch (error) {
            console.error('Error cargando detalles del estudiante:', error);
            container.innerHTML = this.getErrorTemplate(error);
        }
    }

    renderStudentDashboard(student, results, analytics, eloHistory, medals, alerts, evolcampusData) {
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
                        <button class="tab-header" data-tab="evolcampus">
                            📚 Evolcampus
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
                        
                        <!-- Tab de Evolcampus -->
                        <div class="tab-pane" id="evolcampus-tab">
                            ${this.renderEvolcampusProgress(student)}
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
                trend: analytics.scoreTrend,
                class: this.getScoreClass(student.average_score)
            },
            {
                title: 'ELO Actual',
                value: student.current_elo,
                subtitle: `Cambio mensual: ${analytics.monthlyEloChange > 0 ? '+' : ''}${analytics.monthlyEloChange}`,
                icon: '⚡',
                trend: analytics.eloTrend,
                trendClass: analytics.monthlyEloChange >= 0 ? 'trend-positive' : 'trend-negative'
            },
            {
                title: 'Probabilidad de Aprobar',
                value: student.probability_pass + '%',
                subtitle: this.getRiskText(student.probability_pass),
                icon: '🎯',
                trend: null,
                class: this.getProbabilityClass(student.probability_pass)
            },
            {
                title: 'Participación',
                value: analytics.participationRate + '%',
                subtitle: `${student.total_simulations} de ${analytics.totalSimulations} simulacros`,
                icon: '📈',
                trend: null
            },
            {
                title: 'Racha Actual',
                value: student.current_streak || 0,
                subtitle: `Mejor: ${student.longest_streak || 0} semanas`,
                icon: '🔥',
                trend: null
            },
            {
                title: 'Mejor Día',
                value: analytics.bestDay || 'N/A',
                subtitle: 'Para rendir mejor',
                icon: '🏆',
                trend: null
            }
        ];
        
        return cards.map(card => `
            <div class="metric-card ${card.class || ''}">
                <div class="metric-header">
                    <div class="metric-icon">${card.icon}</div>
                    ${card.trend ? `
                        <div class="metric-trend ${card.trendClass || ''}">
                            ${this.getTrendIndicator(card.trend)}
                        </div>
                    ` : ''}
                </div>
                <div class="metric-value">${card.value}</div>
                <div class="metric-label">${card.title}</div>
                <div class="metric-trend">
                    <span>${card.subtitle}</span>
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
        
        // Botón de sincronización Evolcampus
        const syncBtn = document.getElementById('syncEvolcampusBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async (e) => {
                const email = e.target.dataset.email;
                await this.syncEvolcampusForStudent(email);
            });
        }
    }

    // Métodos faltantes que necesitas implementar:
    
    async loadStudentData(studentId) {
        // Validación básica del parámetro
        if (!studentId || (typeof studentId !== 'string' && typeof studentId !== 'number')) {
            throw new Error('ID de estudiante inválido');
        }
        const [student, results, eloHistory, medals, alerts] = await Promise.all([
            this.loadStudentInfo(studentId),
            this.loadStudentResults(studentId),
            this.loadEloHistory(studentId),
            this.loadStudentMedals(studentId),
            this.loadStudentAlerts(studentId)
        ]);
        
        // Cargar datos de Evolcampus
        const evolcampusData = await this.loadEvolcampusData(studentId);
        
        const analytics = this.calculateDetailedAnalytics(results, eloHistory);
        
        return { student, results, analytics, eloHistory, medals, alerts, evolcampusData };
    }
    
    async loadStudentInfo(studentId) {
        return await this.safeQuery(
            this.supabase
                .from('users')
                .select(`
                    *,
                    user_results(count)
                `)
                .eq('id', studentId)
                .single(),
            'loadStudentInfo'
        );
    }
    
    async loadEvolcampusData(studentId) {
        /*  Nueva estrategia:
            ─ Obtiene el email del alumno.
            ─ Invoca la función edge `sync-evolvcampus-student`
              para recibir:
              { activities: [ {topic_code, activity, done, score, avg_score}, … ] }
            ─ Recupera el último enrollment almacenado para stats rápidos.
        */
        // 1. Email del usuario
        const { data: userRow } = await this.supabase
            .from('users')
            .select('email')
            .eq('id', studentId)
            .single();

        const studentEmail = userRow?.email;
        if (!studentEmail) {
            console.warn('Estudiante sin email, se omite llamada a Evolcampus:', studentId);
            return { activities: [], enrollment: null };
        }

        // 2. Edge Function individual
        const { data: edgeData, error: edgeErr } = await this.supabase
            .functions
            .invoke('sync-evolvcampus-student', { body: { studentEmail } });

        if (edgeErr) {
            console.error('Edge sync error:', edgeErr);
        }

        // 3. Último enrollment (para % completado, nota, etc.)
        const { data: enrollmentRow } = await this.supabase
            .from('evolcampus_enrollments')
            .select('*')
            .eq('student_id', studentId)
            .order('synced_at', { ascending: false })
            .limit(1)
            .single();

        return {
            activities: edgeData?.activities || [],
            enrollment: enrollmentRow || null
        };
    }
    
    async loadStudentResults(studentId) {
        const res = await this.safeQuery(
            this.supabase
                .from('user_results')
                .select(`
                    *,
                    weekly_simulations!inner(
                        week_number,
                        start_date,
                        end_date,
                        status
                    )
                `)
                .eq('user_id', studentId)
                .order('submitted_at', { ascending: false }),
            'loadStudentResults'
        );
        return res ?? [];
    }
    
    async loadEloHistory(studentId) {
        const rows = await this.safeQuery(
            this.supabase
                .from('elo_history')
                .select('*')
                .eq('user_id', studentId)
                .order('created_at', { ascending: false })
                .limit(100),
            'loadEloHistory'
        );
        return rows ?? [];
    }
    
    async loadStudentMedals(studentId) {
        const { data, error } = await this.supabase
            .from('user_medals')
            .select('*')
            .eq('user_id', studentId)
            .order('earned_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    }
    
    async loadStudentAlerts(studentId) {
        const { data, error } = await this.supabase
            .from('user_alerts')
            .select('*')
            .eq('user_id', studentId)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        return data || [];
    }
    
    getLoadingTemplate() {
        return `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p style="margin-top: 1rem;">Cargando información del estudiante...</p>
            </div>
        `;
    }
    
    getErrorTemplate(error) {
        return `
            <div class="error-container">
                <h3>❌ Error al cargar los datos del estudiante</h3>
                <p>${error.message}</p>
                <button class="btn btn-secondary" onclick="window.dashboardAdmin.showPage('students')">
                    ← Volver a estudiantes
                </button>
            </div>
        `;
    }
    getRiskText(probability) {
        if (probability >= 80) return 'Excelente';
        if (probability >= 60) return 'Buena';
        if (probability >= 40) return 'Preocupante';
        return 'Crítica';
    }
    
    getTrendIndicator(trend) {
        if (trend === 'up') return '↗️';
        if (trend === 'down') return '↘️';
        return '→';
    }
    
    getScoreClass(score) {
        if (!score) return '';
        if (score >= 8) return 'success';
        if (score >= 6) return 'warning';
        return 'danger';
    }
    
    getProbabilityClass(probability) {
        if (!probability) probability = 50;
        if (probability >= 70) return 'success';
        if (probability >= 50) return 'warning';
        if (probability >= 30) return 'danger';
        return 'critical';
    }
    
    renderRiskAlert(student, analytics) {
        const probability = student.probability_pass || 50;
        
        if (probability >= 50) {
            return ''; // No mostrar alerta si no hay riesgo
        }
        
        const riskLevel = probability < 30 ? 'critical' : 'high';
        const riskClass = riskLevel === 'critical' ? 'danger' : 'warning';
        
        return `
            <div class="risk-alert ${riskClass}">
                <div class="risk-alert-icon">
                    ${riskLevel === 'critical' ? '🚨' : '⚠️'}
                </div>
                <div class="risk-alert-content">
                    <h3>Estudiante en Riesgo ${riskLevel === 'critical' ? 'Crítico' : 'Alto'}</h3>
                    <p>
                        Con una probabilidad de aprobar del ${probability}%, este estudiante requiere 
                        ${riskLevel === 'critical' ? 'intervención inmediata' : 'seguimiento cercano'}.
                    </p>
                    <div class="risk-factors">
                        ${this.getRiskFactors(student, analytics)}
                    </div>
                    <div class="risk-recommendations">
                        <h4>Acciones Recomendadas:</h4>
                        <ul>
                            ${this.getRiskRecommendations(student, analytics).map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    getRiskFactors(student, analytics) {
        const factors = [];
        
        if (student.average_score < 6) {
            factors.push(`📉 Score promedio bajo: ${student.average_score?.toFixed(2) || 'N/A'}/10`);
        }
        
        if (analytics.participationRate < 50) {
            factors.push(`📅 Baja participación: ${analytics.participationRate}%`);
        }
        
        if (analytics.scoreTrend === 'down') {
            factors.push(`📊 Tendencia negativa en puntuaciones`);
        }
        
        if (student.current_streak === 0) {
            factors.push(`🔥 Sin racha activa de participación`);
        }
        
        return factors.length > 0 ? 
            `<ul class="risk-factor-list">${factors.map(f => `<li>${f}</li>`).join('')}</ul>` :
            '<p>No se identificaron factores de riesgo específicos.</p>';
    }
    

    renderInsights(analytics) {
        const insights = [];
        
        if (analytics.scoreTrend === 'up') {
            insights.push(`📈 Tendencia positiva: mejorando constantemente`);
        } else if (analytics.scoreTrend === 'down') {
            insights.push(`📉 Tendencia negativa: necesita apoyo adicional`);
        }
        
        if (analytics.consistency < 1) {
            insights.push(`✅ Rendimiento muy consistente`);
        } else if (analytics.consistency > 2) {
            insights.push(`⚠️ Rendimiento variable: trabajar en estabilidad`);
        }
        
        if (analytics.participationRate < 50) {
            insights.push(`❌ Baja participación: solo ${analytics.participationRate}% de simulacros`);
        }
        
        return insights.length > 0 ? 
            `<ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>` :
            '<p>No hay insights significativos en este momento.</p>';
    }
    
    renderResultsTable(results) {
        if (results.length === 0) {
            return '<p style="text-align: center; padding: 2rem;">No hay resultados registrados aún.</p>';
        }
        
        return `
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Simulacro</th>
                        <th>Score</th>
                        <th>Posición</th>
                        <th>Detalles</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td>${new Date(result.submitted_at).toLocaleDateString('es-ES')}</td>
                            <td>RF${result.weekly_simulations?.week_number || '?'}</td>
                            <td><strong>${result.score.toFixed(2)}/10</strong></td>
                            <td>${result.position || 'N/A'}</td>
                            <td>
                                <span style="color: #10B981">✓ ${result.correct_answers || 0}</span> / 
                                <span style="color: #DC2626">✗ ${result.wrong_answers || 0}</span> / 
                                <span style="color: #6B7280">○ ${result.blank_answers || 0}</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    renderDetailedAnalysis(student, analytics, results) {
        return `
            <div class="analysis-sections">
                <h3>📊 Análisis Estadístico</h3>
                <div class="stats-grid">
                    <div class="stat-box">
                        <label>Score Promedio</label>
                        <value>${student.average_score?.toFixed(2) || 'N/A'}</value>
                    </div>
                    <div class="stat-box">
                        <label>Mejor Score</label>
                        <value>${analytics.bestScore?.toFixed(2) || 'N/A'}</value>
                    </div>
                    <div class="stat-box">
                        <label>Consistencia</label>
                        <value>${analytics.consistency?.toFixed(2) || 'N/A'}</value>
                    </div>
                    <div class="stat-box">
                        <label>Mejora Proyectada</label>
                        <value>${analytics.projectedScore?.toFixed(2) || 'N/A'}</value>
                    </div>
                </div>
                
                <h3>🎯 Áreas de Mejora</h3>
                <ul>
                    ${analytics.worstTopics?.map(topic => `<li>${topic}</li>`).join('') || '<li>No hay datos suficientes</li>'}
                </ul>
            </div>
        `;
    }
    
    renderCommunicationHistory(student) {
        return `
            <div class="communication-section">
                <h3>📧 Historial de Comunicaciones</h3>
                <p style="text-align: center; color: #6B7280;">
                    Esta función estará disponible próximamente
                </p>
            </div>
        `;
    }
    
    async renderCharts(results, eloHistory, analytics) {
        // Por ahora solo un placeholder
        console.log('Renderizando gráficos para el estudiante');
    }
    
    switchTab(tabName) {
        // Ocultar todas las tabs
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.querySelectorAll('.tab-header').forEach(header => {
            header.classList.remove('active');
        });
        
        // Mostrar la tab seleccionada
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    }
    
    openEmailModal() {
        document.getElementById('emailModal').style.display = 'flex';
    }
    
    closeEmailModal() {
        document.getElementById('emailModal').style.display = 'none';
    }
    
    updateEmailPreview() {
        const body = document.getElementById('emailBody').value;
        const preview = document.getElementById('emailPreview');
        
        if (preview) {
            // Reemplazar variables con datos reales
            let previewText = body
                .replace(/\${this\.currentStudent\.username}/g, this.currentStudent?.username || '[Nombre]')
                .replace(/\${this\.currentStudent\.average_score[^}]*}/g, this.currentStudent?.average_score?.toFixed(2) || '[Score]')
                .replace(/\${this\.currentStudent\.current_elo}/g, this.currentStudent?.current_elo || '[ELO]')
                .replace(/\${this\.currentStudent\.probability_pass}/g, this.currentStudent?.probability_pass || '[Prob]')
                .replace(/\${this\.currentStudent\.current_streak}/g, this.currentStudent?.current_streak || '[Racha]');
            
            preview.innerHTML = `<div style="white-space: pre-wrap; padding: 1rem; background: #f9fafb; border-radius: 6px;">${previewText}</div>`;
        }
    }
    
    async exportStudentReport() {
        try {
            const exportsModule = await this.dashboard.loadModule('exports');
            
            // Preparar datos del estudiante para exportar
            const reportData = {
                student: this.currentStudent,
                results: await this.loadStudentResults(this.currentStudent.id),
                eloHistory: await this.loadEloHistory(this.currentStudent.id),
                medals: await this.loadStudentMedals(this.currentStudent.id)
            };
            
            // Generar CSV o PDF según preferencia
            this.dashboard.showNotification('info', 'Generando reporte...');
            
            // Por ahora, solo un alert
            alert('Función de exportación en desarrollo. Los datos del estudiante están listos para exportar.');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar: ' + error.message);
        }
    }
    
    async saveEmailToHistory(emailData) {
        // Guardar en tabla de logs de email
        const { error } = await this.supabase
            .from('email_logs')
            .insert({
                user_id: emailData.metadata.student_id,
                email_type: emailData.metadata.type || 'direct',
                subject: emailData.subject,
                content: emailData.body,
                sent_at: new Date().toISOString(),
                metadata: emailData.metadata
            });
        
        if (error) {
            console.error('Error guardando historial de email:', error);
        }
    }
    
    async refreshCommunicationHistory() {
        // Recargar la sección de comunicación si está visible
        if (document.getElementById('communication-tab')?.classList.contains('active')) {
            await this.switchTab('communication');
        }
    }
    
    // Métodos de cálculo de analíticas
    calculateRecentAverage(results, count = 5) {
        const recent = results.slice(0, count);
        if (recent.length === 0) return 0;
        return recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
    }
    
    calculateMonthlyEloChange(eloHistory) {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        const recentHistory = eloHistory.filter(h => new Date(h.created_at) > monthAgo);
        if (recentHistory.length === 0) return 0;
        
        const first = recentHistory[recentHistory.length - 1];
        const last = recentHistory[0];
        
        return last.elo_after - first.elo_before;
    }
    
    calculateParticipationRate(results) {
        const totalSimulations = this.dashboard.data.simulations.filter(s => s.status !== 'future').length;
        if (totalSimulations === 0) return 0;
        
        const uniqueSimulations = new Set(results.map(r => r.simulation_id)).size;
        return Math.round((uniqueSimulations / totalSimulations) * 100);
    }
    
    calculateTrend(values) {
        if (values.length < 2) return 'neutral';
        
        const recent = values.slice(0, 3);
        const older = values.slice(3, 6);
        
        if (recent.length === 0 || older.length === 0) return 'neutral';
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        if (recentAvg > olderAvg + 0.5) return 'up';
        if (recentAvg < olderAvg - 0.5) return 'down';
        return 'stable';
    }
    
    findBestPerformanceDay(results) {
        // Análisis del mejor día de rendimiento
        const dayPerformance = {};
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        results.forEach(r => {
            const day = new Date(r.submitted_at).getDay();
            if (!dayPerformance[day]) {
                dayPerformance[day] = { scores: [], count: 0 };
            }
            dayPerformance[day].scores.push(r.score);
            dayPerformance[day].count++;
        });
        
        let bestDay = 0;
        let bestAvg = 0;
        
        Object.entries(dayPerformance).forEach(([day, data]) => {
            const avg = data.scores.reduce((a, b) => a + b, 0) / data.count;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestDay = parseInt(day);
            }
        });
        
        return days[bestDay];
    }
    
    analyzeWeakTopics(results) {
        const topics = {};
        
        results.forEach(r => {
            if (r.weakest_topics && Array.isArray(r.weakest_topics)) {
                r.weakest_topics.forEach(topic => {
                    topics[topic] = (topics[topic] || 0) + 1;
                });
            }
        });
        
        return Object.entries(topics)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([topic]) => topic);
    }
    
    calculateConsistency(results) {
        if (results.length < 3) return 0;
        
        const scores = results.slice(0, 10).map(r => r.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
        
        return Math.sqrt(variance);
    }
    
    projectNextScore(results) {
        if (results.length < 3) return this.currentStudent?.average_score || 5;
        
        // Proyección simple basada en tendencia
        const recent = results.slice(0, 5).map(r => r.score);
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
        
        let projection = 0;
        recent.forEach((score, i) => {
            if (i < weights.length) {
                projection += score * weights[i];
            }
        });
        
        return Math.max(0, Math.min(10, projection));
    }
    
    calculateImprovementRate(results) {
        if (results.length < 5) return 0;
        
        const first5 = results.slice(-5);
        const last5 = results.slice(0, 5);
        
        const firstAvg = first5.reduce((sum, r) => sum + r.score, 0) / first5.length;
        const lastAvg = last5.reduce((sum, r) => sum + r.score, 0) / last5.length;
        
        return ((lastAvg - firstAvg) / firstAvg * 100).toFixed(1);
    }
    
    getRiskText(probability) {
        if (probability >= 80) return 'Excelente';
        if (probability >= 60) return 'Buena';
        if (probability >= 40) return 'Preocupante';
        return 'Crítica';
    }
    
    getTrendIndicator(trend) {
        if (trend === 'up') return '↗️';
        if (trend === 'down') return '↘️';
        return '→';
    }
        getRiskRecommendations(student, analytics) {
        const recommendations = [];
        const probability = student.probability_pass || 50;
        
        if (probability < 30) {
            recommendations.push('Programar sesión individual urgente');
            recommendations.push('Evaluar necesidad de plan de refuerzo personalizado');
            recommendations.push('Contactar inmediatamente para evaluar situación');
        } else if (probability < 50) {
            recommendations.push('Aumentar frecuencia de seguimiento');
            recommendations.push('Identificar temas específicos de dificultad');
            recommendations.push('Ofrecer recursos adicionales de estudio');
        }
        
        if (student.average_score < 6) {
            recommendations.push('Revisar conceptos fundamentales');
        }
        
        if (analytics.participationRate < 50) {
            recommendations.push('Incentivar participación regular en simulacros');
        }
        
        return recommendations;
    }
    
    renderEvolcampusProgress(student) {
        return `
            <div class="evolcampus-progress-section">
                <div class="evolcampus-header">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">📚 Progreso en Evolcampus</h3>
                        <button class="btn btn-primary btn-sm" id="syncEvolcampusBtn" data-email="${student.email}" style="padding: 0.5rem 1rem;">
                            🔄 Sincronizar ahora
                        </button>
                    </div>
                    <div class="evolcampus-stats" id="evolcampusStats">
                        <div class="loading">Cargando datos...</div>
                    </div>
                </div>
                
                <div class="evolcampus-content" id="evolcampusContent">
                    <div class="loading">Cargando progreso detallado...</div>
                </div>
            </div>
        `;
    }

    updateEvolcampusTab(evolcampusData) {
        const statsContainer   = document.getElementById('evolcampusStats');
        const contentContainer = document.getElementById('evolcampusContent');
        if (!statsContainer || !contentContainer) return;

        // Guardar datos para uso posterior
        this.currentEvolcampusData = evolcampusData;
        
        const activities = evolcampusData.activities || [];
        const enrollment = evolcampusData.enrollment;

        /* ─────────  A. Cabecera de estadísticas  ───────── */
        if (enrollment) {
            statsContainer.innerHTML = `
              <div class="evolcampus-stats-grid">
                <div class="stat-card"><div class="stat-value">${enrollment.completed_percent || 0}%</div><div class="stat-label">Completado</div></div>
                <div class="stat-card"><div class="stat-value">${enrollment.grade ?? 'N/A'}</div><div class="stat-label">Nota Media</div></div>
                <div class="stat-card"><div class="stat-value">${activities.length}</div><div class="stat-label">Tests Totales</div></div>
                <div class="stat-card"><div class="stat-value">${enrollment.last_connect ? new Date(enrollment.last_connect).toLocaleDateString() : 'N/A'}</div><div class="stat-label">Última conexión</div></div>
              </div>`;
        } else {
            statsContainer.innerHTML = '<div class="no-data">Sin enrollment registrado</div>';
        }

        /* ─────────  B. Vista mejorada para muchos tests  ───────── */
        if (activities.length === 0) {
            contentContainer.innerHTML = '<p class="no-data-message">No hay datos de actividades todavía.</p>';
            return;
        }

        // Agrupar actividades por tema
        const groupedActivities = this.groupActivitiesByTopic(activities);
        
        // Crear controles de vista
        const controls = `
            <div class="evolcampus-controls">
                <div class="view-toggle">
                    <button class="active" onclick="window.studentDetailModule.changeEvolView('grouped')">Por Temas</button>
                    <button onclick="window.studentDetailModule.changeEvolView('heatmap')">Mapa de Calor</button>
                    <button onclick="window.studentDetailModule.changeEvolView('list')">Lista Completa</button>
                </div>
                <select class="filter-select" onchange="window.studentDetailModule.filterByScore(this.value)">
                    <option value="all">Todas las notas</option>
                    <option value="excellent">Excelentes (9-10)</option>
                    <option value="good">Buenas (7-8.9)</option>
                    <option value="regular">Regulares (5-6.9)</option>
                    <option value="poor">Bajas (<5)</option>
                </select>
            </div>
        `;

        // Vista por defecto: agrupada por temas
        const topicsHtml = Object.entries(groupedActivities).map(([topic, tests]) => {
            const avgScore = tests.reduce((sum, t) => sum + (t.score || 0), 0) / tests.filter(t => t.score !== null).length;
            const completedCount = tests.filter(t => t.done).length;
            
            return `
                <div class="topic-section" data-topic="${topic}">
                    <div class="topic-header" onclick="window.studentDetailModule.toggleTopic('${topic}')">
                        <div class="topic-title">
                            ${topic === 'general' ? '📚 Tests Generales' : `📖 Tema ${topic}`}
                        </div>
                        <div class="topic-stats">
                            <span class="topic-stat average">Promedio: ${avgScore.toFixed(1)}</span>
                            <span class="topic-stat count">${completedCount}/${tests.length} completados</span>
                        </div>
                    </div>
                    <div class="topic-tests">
                        <div class="tests-grid">
                            ${tests.map(test => this.renderTestCard(test)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        contentContainer.innerHTML = controls + `
            <div id="evolcampusViewContainer">
                ${topicsHtml}
            </div>
            <link rel="stylesheet" href="../admin/css/evolcampus-dashboard.css">
        `;

        // Mostrar un resumen visual al final
        this.addVisualSummary(activities, groupedActivities);
        
        // Guardar referencia global para acceso desde eventos onclick
        window.studentDetailModule = this;
    }
    
    groupByTopic(evolcampusData) {
        return evolcampusData.reduce((groups, item) => {
            const topic = item.topic_code || 'Sin categoría';
            if (!groups[topic]) groups[topic] = [];
            groups[topic].push(item);
            return groups;
        }, {});
    }
    
    renderTopicGroup(topic, activities) {
        const avgScore = activities.reduce((sum, a) => sum + (a.score || 0), 0) / activities.length;
        const maxScore = Math.max(...activities.map(a => a.max_score || 100));
        const completionRate = (avgScore / maxScore) * 100;
        
        return `
            <div class="topic-group">
                <div class="topic-header">
                    <h5>${topic}</h5>
                    <div class="topic-stats">
                        <span class="completion-rate">${completionRate.toFixed(1)}%</span>
                        <span class="activity-count">${activities.length} actividades</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${completionRate}%"></div>
                </div>
                <div class="activities-list">
                    ${activities.slice(0, 3).map(activity => `
                        <div class="activity-item">
                            <span class="activity-name">${activity.activity || 'Test'}</span>
                            <span class="activity-score">${activity.score}/${activity.max_score}</span>
                            <span class="activity-attempts">${activity.attempts || 1} intentos</span>
                        </div>
                    `).join('')}
                    ${activities.length > 3 ? `<div class="more-activities">+${activities.length - 3} más...</div>` : ''}
                </div>
            </div>
        `;
    }
    
    async syncEvolcampusForStudent(email) {
        try {
            const syncBtn = document.getElementById('syncEvolcampusBtn');
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '⏳ Sincronizando...';
            }
            
            // Llamar a la función edge específica para un estudiante
            const { data, error } = await this.supabase.functions.invoke('sync-evolvcampus-student', {
                body: { studentEmail: email }
            });
            
            if (error) throw error;
            
            // Mostrar notificación de éxito
            const message = data.message || `Sincronización completada: ${data.records_synced} registros`;
            this.dashboard.showNotification('success', message);
            
            // Recargar los datos de Evolcampus
            const evolcampusData = await this.loadEvolcampusData(this.currentStudentId);
            this.updateEvolcampusTab(evolcampusData);
            
        } catch (error) {
            console.error('Error sincronizando Evolcampus:', error);
            this.dashboard.showNotification('error', 'Error al sincronizar: ' + error.message);
        } finally {
            const syncBtn = document.getElementById('syncEvolcampusBtn');
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '🔄 Sincronizar ahora';
            }
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
    
    // Nuevas funciones para mejorar la visualización de Evolcampus
    groupActivitiesByTopic(activities) {
        // Agrupar por temas
        const topics = {};
        
        activities.forEach(activity => {
            const topicMatch = activity.activity.match(/\b(T\d+)\b/i);
            const topic = topicMatch ? topicMatch[1].toUpperCase() : 'general';
            
            if (!topics[topic]) topics[topic] = [];
            topics[topic].push(activity);
        });
        
        // Ordenar los temas
        const sortedTopics = {};
        Object.keys(topics).sort((a, b) => {
            if (a === 'general') return 1;
            if (b === 'general') return -1;
            return a.localeCompare(b);
        }).forEach(key => {
            sortedTopics[key] = topics[key];
        });
        
        return sortedTopics;
    }
    
    renderTestCard(test) {
        const scoreClass = this.getScoreClassForTest(test.score);
        const dateStr = test.last_attempt ? new Date(test.last_attempt).toLocaleDateString('es-ES') : 'N/A';
        
        return `
            <div class="test-card ${scoreClass}" data-score="${test.score || 0}">
                <div class="test-name" title="${test.activity}">${test.activity}</div>
                <div class="test-score">
                    <span class="score-value">${test.score !== null ? test.score.toFixed(1) : '—'}/10</span>
                    <span class="score-date">${dateStr}</span>
                </div>
            </div>
        `;
    }
    
    getScoreClassForTest(score) {
        if (score === null || score === undefined) return '';
        if (score >= 9) return 'excellent';
        if (score >= 7) return 'good';
        if (score >= 5) return 'regular';
        return 'poor';
    }
    
    toggleTopic(topic) {
        const section = document.querySelector(`.topic-section[data-topic="${topic}"]`);
        if (section) {
            section.classList.toggle('expanded');
        }
    }
    
    changeEvolView(viewType) {
        const container = document.getElementById('evolcampusViewContainer');
        const buttons = document.querySelectorAll('.view-toggle button');
        
        // Actualizar botón activo
        buttons.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Cambiar vista
        switch(viewType) {
            case 'heatmap':
                this.showHeatmapView(container);
                break;
            case 'list':
                this.showListView(container);
                break;
            default:
                this.showGroupedView(container);
        }
    }
    
    filterByScore(scoreRange) {
        const cards = document.querySelectorAll('.test-card');
        cards.forEach(card => {
            const score = parseFloat(card.dataset.score);
            let show = true;
            
            switch(scoreRange) {
                case 'excellent':
                    show = score >= 9;
                    break;
                case 'good':
                    show = score >= 7 && score < 9;
                    break;
                case 'regular':
                    show = score >= 5 && score < 7;
                    break;
                case 'poor':
                    show = score < 5;
                    break;
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }
    
    addVisualSummary(activities, groupedActivities) {
        const container = document.getElementById('evolcampusViewContainer');
        const summaryHtml = `
            <div class="visual-summary">
                <h3 class="summary-title">📊 Resumen Visual del Progreso</h3>
                <div class="heatmap-container">
                    <div class="topic-heatmap">
                        ${this.generateHeatmap(groupedActivities)}
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', summaryHtml);
    }
    
    generateHeatmap(groupedActivities) {
        const allTopics = Array.from({length: 45}, (_, i) => `T${i + 1}`);
        let html = '<div class="heatmap-label">Temas</div>';
        
        // Cabecera con números de tema
        allTopics.forEach(topic => {
            html += `<div class="heatmap-cell heatmap-label">${topic.replace('T', '')}</div>`;
        });
        
        // Fila de datos
        html += '<div class="heatmap-label">Progreso</div>';
        allTopics.forEach(topic => {
            const tests = groupedActivities[topic] || [];
            const completed = tests.filter(t => t.done).length;
            const avg = tests.length > 0 ? 
                tests.reduce((sum, t) => sum + (t.score || 0), 0) / tests.filter(t => t.score !== null).length : 0;
            
            let heatLevel = 0;
            if (completed > 0) {
                if (avg >= 9) heatLevel = 5;
                else if (avg >= 7) heatLevel = 4;
                else if (avg >= 5) heatLevel = 3;
                else if (avg >= 3) heatLevel = 2;
                else heatLevel = 1;
            }
            
            html += `<div class="heatmap-cell heat-${heatLevel}" title="${topic}: ${completed} tests, promedio ${avg.toFixed(1)}">${completed || ''}</div>`;
        });
        
        return html;
    }
    
    showHeatmapView(container) {
        // Implementación de vista de mapa de calor
        // Por ahora reutilizamos el heatmap del resumen
        const activities = this.currentEvolcampusData?.activities || [];
        const grouped = this.groupActivitiesByTopic(activities);
        
        container.innerHTML = `
            <div class="visual-summary">
                <h3 class="summary-title">📊 Mapa de Calor - Progreso por Tema</h3>
                <div class="heatmap-container">
                    <div class="topic-heatmap">
                        ${this.generateHeatmap(grouped)}
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <p style="text-align: center; color: #6b7280;">
                        Cada celda representa un tema. El color indica el rendimiento promedio.
                    </p>
                </div>
            </div>
        `;
    }
    
    showListView(container) {
        // Vista de lista completa
        const activities = this.currentEvolcampusData?.activities || [];
        
        const rows = activities.map(a => `
            <tr class="${a.done ? 'done' : 'pending'}">
                <td>${a.activity}</td>
                <td style="text-align:center;">${a.done ? '✔️' : '—'}</td>
                <td style="text-align:center;">${a.score ?? '—'}</td>
                <td style="text-align:center;">${a.first_attempt ? new Date(a.first_attempt).toLocaleDateString() : '—'}</td>
            </tr>
        `).join('');
        
        container.innerHTML = `
            <table class="activity-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th>Actividad</th>
                        <th>Completado</th>
                        <th>Nota</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <style>
                .activity-table th, .activity-table td { 
                    padding: 0.75rem; 
                    border-bottom: 1px solid #e5e7eb; 
                }
                .activity-table .done { background: #ecfdf5; }
                .activity-table .pending { background: #fef2f2; }
            </style>
        `;
    }
    
    showGroupedView(container) {
        // Volver a la vista agrupada por defecto
        const activities = this.currentEvolcampusData?.activities || [];
        const groupedActivities = this.groupActivitiesByTopic(activities);
        
        const topicsHtml = Object.entries(groupedActivities).map(([topic, tests]) => {
            const avgScore = tests.reduce((sum, t) => sum + (t.score || 0), 0) / tests.filter(t => t.score !== null).length;
            const completedCount = tests.filter(t => t.done).length;
            
            return `
                <div class="topic-section" data-topic="${topic}">
                    <div class="topic-header" onclick="window.studentDetailModule.toggleTopic('${topic}')">
                        <div class="topic-title">
                            ${topic === 'general' ? '📚 Tests Generales' : `📖 Tema ${topic}`}
                        </div>
                        <div class="topic-stats">
                            <span class="topic-stat average">Promedio: ${avgScore.toFixed(1)}</span>
                            <span class="topic-stat count">${completedCount}/${tests.length} completados</span>
                        </div>
                    </div>
                    <div class="topic-tests">
                        <div class="tests-grid">
                            ${tests.map(test => this.renderTestCard(test)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = topicsHtml;
        this.addVisualSummary(activities, groupedActivities);
    }
}
