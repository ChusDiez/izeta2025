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
            
            // Cargar todos los resultados de exámenes para calcular percentiles y P80
            const { data: allResults } = await this.supabase
                .from('user_results')
                .select('simulation_id, user_id, score')
                .order('score', { ascending: true });
            
            this.allExamResults = allResults || [];
            
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
                <!-- Header compacto con acciones -->
                <div class="student-header-compact">
                    <div class="header-nav">
                        <button class="btn btn-ghost" onclick="window.dashboardAdmin.showPage('students')">
                            ← Volver
                        </button>
                    </div>
                    
                    <div class="header-main">
                        <div class="student-identity">
                            <h1>${student.username}</h1>
                            <div class="student-tags">
                                <span class="tag tag-cohort">${student.cohort}</span>
                                <span class="tag tag-email">${student.email}</span>
                                <span class="tag tag-code">ID: ${student.slug}</span>
                            </div>
                        </div>
                        
                        <div class="header-actions">
                            <button class="btn btn-primary" onclick="window.studentDetail.openEmailModal()">
                                <span class="btn-icon">✉️</span>
                                Contactar
                            </button>
                            <button class="btn btn-secondary" onclick="window.studentDetail.exportStudentReport()">
                                <span class="btn-icon">📊</span>
                                Exportar
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Vista principal continua - Patient Chart Style -->
                <div class="student-journey">
                    <!-- 1. Resumen ejecutivo visual -->
                    <section class="journey-section executive-summary">
                        <h2 class="section-title">
                            <span class="section-icon">📊</span>
                            Resumen del Estudiante
                        </h2>
                        <div class="summary-grid">
                            ${this.renderVisualSummary(student, analytics)}
                        </div>
                    </section>
                    
                    <!-- 2. Timeline interactivo de exámenes -->
                    <section class="journey-section exam-timeline">
                        <h2 class="section-title">
                            <span class="section-icon">📈</span>
                            Historial de Simulacros
                        </h2>
                        ${this.renderInteractiveTimeline(results)}
                    </section>
                    
                    <!-- 3. Análisis de patrones -->
                    <section class="journey-section patterns-analysis">
                        <h2 class="section-title">
                            <span class="section-icon">🔍</span>
                            Patrones Detectados
                        </h2>
                        ${this.renderPatternsGrid(analytics, results)}
                    </section>
                    
                    <!-- 4. Evolcampus Progress integrado -->
                    <section class="journey-section evolcampus-section">
                        <h2 class="section-title">
                            <span class="section-icon">📚</span>
                            Progreso por Temas (Evolcampus)
                        </h2>
                        ${this.renderEvolcampusIntegrated(evolcampusData)}
                    </section>
                    
                    <!-- 5. Recomendaciones personalizadas -->
                    <section class="journey-section recommendations">
                        <h2 class="section-title">
                            <span class="section-icon">💡</span>
                            Plan de Acción Personalizado
                        </h2>
                        ${this.renderActionPlan(student, analytics)}
                    </section>
                    
                    <!-- 6. Historial de comunicación -->
                    <section class="journey-section communication-history">
                        <h2 class="section-title">
                            <span class="section-icon">💬</span>
                            Historial de Comunicación
                        </h2>
                        ${this.renderCommunicationHistory(student)}
                    </section>
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
        
        // Expandir/colapsar tarjetas del timeline
        this.setupTimelineCardToggles();
    }
    
    setupTimelineCardToggles() {
        // Configurar event delegation para las tarjetas del timeline
        // Usamos delegation porque las tarjetas se pueden recargar dinámicamente
        document.addEventListener('click', (e) => {
            // Buscar si el click fue en una timeline-card o dentro de ella
            const card = e.target.closest('.timeline-card');
            if (!card) return;
            
            // Ignorar clicks en botones o enlaces internos
            if (e.target.closest('a, button')) return;
            
            // Toggle la clase expanded
            card.classList.toggle('expanded');
            
            // Opcional: cerrar otras tarjetas expandidas (comportamiento accordion)
            // Si prefieres que solo una esté expandida a la vez, descomenta esto:
            /*
            document.querySelectorAll('.timeline-card.expanded').forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('expanded');
                }
            });
            */
        });
        
        // Al cargar la página o renderizar nuevas tarjetas, 
        // asegurarse de que todas empiecen colapsadas
        this.collapseAllTimelineCards();
    }
    
    collapseAllTimelineCards() {
        document.querySelectorAll('.timeline-card').forEach(card => {
            card.classList.remove('expanded');
        });
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
        /*  Nueva estrategia mejorada:
            ─ Carga TODOS los tests desde topic_results (incluyendo los de nota 0)
            ─ Agrupa por tema y actividad
            ─ Calcula estadísticas de participación
        */
        
        try {
            // 1. Obtener email del usuario
            const { data: userRow } = await this.supabase
                .from('users')
                .select('email')
                .eq('id', studentId)
                .single();
    
            if (!userRow || !userRow.email) {
                console.warn('Estudiante sin email:', studentId);
                return { activities: [], enrollment: null, stats: null };
            }
    
            // 2. Cargar TODOS los tests desde topic_results
            const { data: topicResults, error } = await this.supabase
                .from('topic_results')
                .select('*')
                .eq('student_id', studentId)
                .order('last_attempt', { ascending: false });
    
            if (error) {
                console.error('Error cargando topic_results:', error);
                return { activities: [], enrollment: null, stats: null };
            }
    
            // 3. Transformar datos al formato esperado por updateEvolcampusTab
            const activities = (topicResults || []).map(result => ({
                topic_code: result.topic_code,
                activity: result.activity,
                done: true, // Si existe en topic_results, está hecho
                score: result.score,
                max_score: result.max_score || 10,
                avg_score: result.score, // Por simplicidad, usamos el score como avg
                attempts: result.attempts || 1,
                first_attempt: result.first_attempt,
                last_attempt: result.last_attempt,
                source: result.source
            }));
    
            // 4. Calcular estadísticas
            const stats = this.calculateEvolcampusStats(activities);
    
            // 5. Crear un enrollment simulado con las estadísticas
            const enrollment = {
                student_id: studentId,
                completed_percent: stats.completionPercentage,
                grade: stats.averageGrade,
                last_connect: stats.lastActivity,
                synced_at: new Date().toISOString(),
                total_activities: stats.totalActivities,
                completed_activities: stats.completedActivities,
                zero_score_activities: stats.zeroScoreActivities
            };
    
            return {
                activities,
                enrollment,
                stats
            };
            
        } catch (error) {
            console.error('Error en loadEvolcampusData:', error);
            return { activities: [], enrollment: null, stats: null };
        }
    }
    // Nuevo método para calcular estadísticas
    calculateEvolcampusStats(activities) {
        if (!activities || activities.length === 0) {
            return {
                totalActivities: 0,
                completedActivities: 0,
                zeroScoreActivities: 0,
                averageGrade: 0,
                completionPercentage: 0,
                lastActivity: null,
                topicsWithActivity: new Set(),
                topicsWithZeroScores: new Set()
            };
        }

        const stats = {
            totalActivities: activities.length,
            completedActivities: 0,
            zeroScoreActivities: 0,
            totalScore: 0,
            totalMaxScore: 0,
            lastActivity: null,
            topicsWithActivity: new Set(),
            topicsWithZeroScores: new Set()
        };

        activities.forEach(activity => {
            // Contar actividades completadas (con cualquier nota)
            if (activity.done) {
                stats.completedActivities++;
            }

            // Contar actividades con nota 0 (importante para detectar falta de participación)
            if (activity.score === 0) {
                stats.zeroScoreActivities++;
                stats.topicsWithZeroScores.add(activity.topic_code);
            }

            // Sumar scores
            stats.totalScore += activity.score || 0;
            stats.totalMaxScore += activity.max_score || 10;

            // Registrar tema
            stats.topicsWithActivity.add(activity.topic_code);

            // Actualizar última actividad
            if (activity.last_attempt) {
                const attemptDate = new Date(activity.last_attempt);
                if (!stats.lastActivity || attemptDate > new Date(stats.lastActivity)) {
                    stats.lastActivity = activity.last_attempt;
                }
            }
        });

        // Calcular promedios
        stats.averageGrade = stats.totalMaxScore > 0 
            ? (stats.totalScore / stats.totalMaxScore * 10).toFixed(2) 
            : 0;
        
        stats.completionPercentage = stats.totalActivities > 0
            ? Math.round((stats.completedActivities / stats.totalActivities) * 100)
            : 0;

        return stats;
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
    async editTest(testId, currentScore, activityName) {
        const newScore = prompt(`Editar nota para "${activityName}"\n\nNota actual: ${currentScore}\nIngresa la nueva nota (0-10):`, currentScore);
        
        if (newScore === null) return;
        
        const score = parseFloat(newScore);
        if (isNaN(score) || score < 0 || score > 10) {
            this.dashboard.showNotification('error', 'La nota debe ser un número entre 0 y 10');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('topic_results')
                .update({ 
                    score: score,
                    updated_at: new Date().toISOString()
                })
                .eq('id', testId);
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Nota actualizada correctamente');
            
            // Recargar datos
            const evolcampusData = await this.loadEvolcampusData(this.currentStudentId);
            this.updateEvolcampusTab(evolcampusData);
            
        } catch (error) {
            console.error('Error actualizando nota:', error);
            this.dashboard.showNotification('error', 'Error al actualizar la nota');
        }
    }
    
    async deleteTest(testId, activityName) {
        if (!confirm(`¿Estás seguro de eliminar "${activityName}"?\n\nEsta acción no se puede deshacer.`)) {
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('topic_results')
                .delete()
                .eq('id', testId);
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Actividad eliminada correctamente');
            
            // Recargar datos
            const evolcampusData = await this.loadEvolcampusData(this.currentStudentId);
            this.updateEvolcampusTab(evolcampusData);
            
        } catch (error) {
            console.error('Error eliminando actividad:', error);
            this.dashboard.showNotification('error', 'Error al eliminar la actividad');
        }
    }
    
    // Método para mostrar detalles de un tema específico
    showTopicDetails(topic) {
        const activities = this.currentEvolcampusData?.activities || [];
        const topicActivities = activities.filter(a => {
            const actTopic = this.normalizeTopicCode(a.topic_code);
            return actTopic === topic;
        });
        
        if (topicActivities.length === 0) {
            this.dashboard.showNotification('info', `No hay actividades para ${topic}`);
            return;
        }
        
        // Cambiar a vista de lista y filtrar por este tema
        this.changeEvolView('list');
        // Aquí podrías implementar un filtro específico por tema
    }
    
    // Normalizar código de tema
    normalizeTopicCode(topicCode) {
        if (!topicCode) return 'GENERAL';
        
        const code = topicCode.toString().toUpperCase();
        
        if (code.includes('TEMA')) {
            const match = code.match(/TEMA\s*(\d+)/);
            if (match) return `T${match[1]}`;
        }
        
        if (code.match(/^\d+$/)) {
            return `T${code}`;
        }
        
        if (code.match(/^T\d+$/)) {
            return code;
        }
        
        return code;
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
        console.log('evolcampusData:', evolcampusData);
        console.log('stats:', evolcampusData?.stats);
        console.log('topicsWithZeroScores:', evolcampusData?.stats?.topicsWithZeroScores);
        
        const statsContainer   = document.getElementById('evolcampusStats');
        const contentContainer = document.getElementById('evolcampusContent');
        if (!statsContainer || !contentContainer) return;

        // Guardar datos para uso posterior
        this.currentEvolcampusData = evolcampusData;
        
        const activities = evolcampusData.activities || [];
        const enrollment = evolcampusData.enrollment;
        const stats = evolcampusData.stats;

        // Antes del statsContainer.innerHTML = 
        let zeroScoreAlert = '';
        if (stats?.zeroScoreActivities > 0) {
            let alertMessage = `⚠️ Este estudiante tiene ${stats.zeroScoreActivities} tests con nota 0`;
            if (stats?.topicsWithZeroScores && stats.topicsWithZeroScores.size > 0) {
                alertMessage += `, lo que podría indicar falta de participación en los temas: ${Array.from(stats.topicsWithZeroScores).join(', ')}`;
            } else {
                alertMessage += '.';
            }
            zeroScoreAlert = `<div class="alert alert-warning" style="margin-top: 1rem;">${alertMessage}</div>`;
        }

        // En el template simplemente:

        /* ─────────  A. Cabecera de estadísticas mejorada  ───────── */
        if (enrollment) {
            statsContainer.innerHTML = `
            <div class="evolcampus-stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${enrollment.completed_percent || 0}%</div>
                    <div class="stat-label">Completado</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${enrollment.grade ?? 'N/A'}</div>
                    <div class="stat-label">Nota Media</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${activities.length}</div>
                    <div class="stat-label">Tests Totales</div>
                </div>
                <div class="stat-card ${stats?.zeroScoreActivities > 0 ? 'warning' : ''}">
                    <div class="stat-value">${stats?.zeroScoreActivities || 0}</div>
                    <div class="stat-label">Tests con Nota 0</div>
                </div>
            </div>
        
        ${zeroScoreAlert}`;
        } else {
            statsContainer.innerHTML = '<div class="no-data">Sin datos de enrollment</div>';
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
                    <button onclick="window.studentDetailModule.changeEvolView('zeros')">Solo Nota 0</button>
                </div>
                <select class="filter-select" onchange="window.studentDetailModule.filterByScore(this.value)">
                    <option value="all">Todas las notas</option>
                    <option value="excellent">Excelentes (9-10)</option>
                    <option value="good">Buenas (7-8.9)</option>
                    <option value="regular">Regulares (5-6.9)</option>
                    <option value="poor">Bajas (<5)</option>
                    <option value="zero">Solo ceros (0)</option>
                </select>
            </div>
        `;

        // Vista por defecto: agrupada por temas
        const topicsHtml = Object.entries(groupedActivities).map(([topic, tests]) => {
            const avgScore = tests.reduce((sum, t) => sum + (t.score || 0), 0) / tests.filter(t => t.score !== null).length;
            const completedCount = tests.filter(t => t.done).length;
            const zeroCount = tests.filter(t => t.score === 0).length;
            
            return `
                <div class="topic-section" data-topic="${topic}">
                    <div class="topic-header" onclick="window.studentDetailModule.toggleTopic('${topic}')">
                        <div class="topic-title">
                            ${topic === 'general' || topic === 'GENERAL' ? '📚 Tests Generales' : `📖 ${topic}`}
                        </div>
                        <div class="topic-stats">
                            <span class="topic-stat average">Promedio: ${avgScore.toFixed(1)}</span>
                            <span class="topic-stat count">${completedCount}/${tests.length} completados</span>
                            ${zeroCount > 0 ? `<span class="topic-stat warning">⚠️ ${zeroCount} con nota 0</span>` : ''}
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
        const topics = {};
        
        activities.forEach(activity => {
            // Usar el topic_code que viene de la base de datos
            let topic = activity.topic_code || 'GENERAL';
            
            // Normalizar el formato del tema
            if (topic.toLowerCase().includes('tema')) {
                // "Tema 5" -> "T5"
                const match = topic.match(/tema\s*(\d+)/i);
                if (match) {
                    topic = `T${match[1]}`;
                }
            } else if (!topic.match(/^T\d+$/)) {
                // Si no es formato T# y no es "Tema #", dejarlo como está
                topic = topic.toUpperCase();
            }
            
            if (!topics[topic]) topics[topic] = [];
            topics[topic].push(activity);
        });
        
        // Ordenar los temas de forma inteligente
        const sortedTopics = {};
        Object.keys(topics).sort((a, b) => {
            // Primero los temas numerados (T1, T2, etc)
            const aMatch = a.match(/^T(\d+)$/);
            const bMatch = b.match(/^T(\d+)$/);
            
            if (aMatch && bMatch) {
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
            }
            if (aMatch) return -1;
            if (bMatch) return 1;
            
            // Luego el resto alfabéticamente
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
            <div class="test-card ${scoreClass}" data-score="${test.score || 0}" data-test-id="${test.id || ''}">
                <div class="test-header">
                    <div class="test-name" title="${test.activity}">${test.activity}</div>
                    <div class="test-actions">
                        <button class="btn-mini" onclick="window.studentDetailModule.editTest('${test.id}', ${test.score}, '${test.activity}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-mini danger" onclick="window.studentDetailModule.deleteTest('${test.id}', '${test.activity}')" title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </div>
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
            case 'zeros':
                this.showZeroScoreView(container);
                break;
            default:
                this.showGroupedView(container);
        }
    }
    // Nuevo método para mostrar solo tests con nota 0
    showZeroScoreView(container) {
        const activities = this.currentEvolcampusData?.activities || [];
        const zeroScoreTests = activities.filter(a => a.score === 0);
        
        if (zeroScoreTests.length === 0) {
            container.innerHTML = `
                <div class="no-data-message">
                    ✅ No hay tests con nota 0
                </div>
            `;
            return;
        }
        
        // Agrupar por tema
        const grouped = {};
        zeroScoreTests.forEach(test => {
            const topic = test.topic_code || 'GENERAL';
            if (!grouped[topic]) grouped[topic] = [];
            grouped[topic].push(test);
        });
        
        container.innerHTML = `
            <div class="zero-score-summary">
                <h3>⚠️ Tests con Nota 0 (${zeroScoreTests.length} total)</h3>
                <p>Estos tests pueden indicar falta de participación del estudiante.</p>
            </div>
            ${Object.entries(grouped).map(([topic, tests]) => `
                <div class="topic-section warning">
                    <h4>${topic} (${tests.length} tests)</h4>
                    <ul>
                        ${tests.map(test => `
                            <li>
                                <strong>${test.activity}</strong>
                                <span class="test-date">- ${test.last_attempt ? new Date(test.last_attempt).toLocaleDateString('es-ES') : 'Sin fecha'}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
            
            <style>
                .zero-score-summary {
                    background: #fef3c7;
                    padding: 1.5rem;
                    border-radius: 8px;
                    margin-bottom: 1.5rem;
                    border: 1px solid #fbbf24;
                }
                .topic-section.warning {
                    background: #fee2e2;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    border-left: 4px solid #dc2626;
                }
                .test-date {
                    color: #6b7280;
                    font-size: 0.875rem;
                }
            </style>
        `;
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
                        show = score < 5 && score > 0;
                        break;
                    case 'zero':
                        show = score === 0;
                        break;
                }
                
                card.style.display = show ? 'block' : 'none';
            });
            
            // Si es filtro zero, resaltar
            if (scoreRange === 'zero') {
                document.querySelectorAll('.test-card[data-score="0"]').forEach(card => {
                    card.style.border = '2px solid #dc2626';
                });
            }
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
        // Obtener todos los temas únicos de los datos reales
        const allTopicsFromData = Object.keys(groupedActivities)
            .filter(t => t.match(/^T\d+$/))
            .map(t => ({ code: t, num: parseInt(t.substring(1)) }))
            .sort((a, b) => a.num - b.num);
        
        // Si no hay temas T#, usar los primeros 45
        const maxTopic = allTopicsFromData.length > 0 
            ? Math.max(...allTopicsFromData.map(t => t.num)) 
            : 45;
        
        const allTopics = Array.from({length: maxTopic}, (_, i) => `T${i + 1}`);
        
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
            
            html += `<div class="heatmap-cell heat-${heatLevel}" 
                          title="${topic}: ${completed} tests, promedio ${avg.toFixed(1)}"
                          onclick="window.studentDetailModule.showTopicDetails('${topic}')"
                          style="cursor: pointer;">
                        ${completed || ''}
                     </div>`;
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

    // ==================== NUEVOS MÉTODOS PARA EL DASHBOARD UNIFICADO ====================
    
    renderVisualSummary(student, analytics) {
        return `
            <div class="metric-visualization">
                <!-- Gauge de probabilidad de aprobar -->
                <div class="probability-gauge-container">
                    <div class="gauge-wrapper">
                        <svg viewBox="0 0 200 120" class="probability-gauge">
                            <defs>
                                <linearGradient id="gaugeGradient">
                                    <stop offset="0%" style="stop-color:#DC2626"/>
                                    <stop offset="30%" style="stop-color:#F59E0B"/>
                                    <stop offset="60%" style="stop-color:#FCD34D"/>
                                    <stop offset="100%" style="stop-color:#10B981"/>
                                </linearGradient>
                            </defs>
                            <!-- Arco de fondo -->
                            <path d="M 20 100 A 80 80 0 0 1 180 100" 
                                  stroke="#E5E7EB" 
                                  stroke-width="15" 
                                  fill="none"/>
                            <!-- Arco de progreso -->
                            <path d="M 20 100 A 80 80 0 0 1 180 100" 
                                  stroke="url(#gaugeGradient)" 
                                  stroke-width="15" 
                                  fill="none"
                                  stroke-dasharray="${student.probability_pass * 2.51} 251"
                                  stroke-linecap="round"/>
                            <!-- Indicador -->
                            <circle cx="${20 + (student.probability_pass * 1.6)}" 
                                    cy="${100 - Math.sin(student.probability_pass * 0.0157) * 80}" 
                                    r="8" 
                                    fill="#1E293B"/>
                        </svg>
                        <div class="gauge-value">
                            <span class="value">${student.probability_pass}%</span>
                            <span class="label">Probabilidad de Aprobar</span>
                        </div>
                    </div>
                    <div class="gauge-status ${this.getProbabilityClass(student.probability_pass)}">
                        ${this.getRiskText(student.probability_pass)}
                    </div>
                </div>
                
                <!-- Métricas clave con visualización -->
                <div class="key-metrics-grid">
                    ${this.renderKeyMetricCard('Puntuación Media', student.average_score?.toFixed(2) || 'N/A', 
                        '/10', this.getScoreClass(student.average_score), '📊')}
                    ${this.renderKeyMetricCard('ELO Actual', student.current_elo, 
                        `${analytics.monthlyEloChange >= 0 ? '+' : ''}${analytics.monthlyEloChange}`, 
                        analytics.monthlyEloChange >= 0 ? 'success' : 'danger', '⚡')}
                    ${this.renderKeyMetricCard('Participación', analytics.participationRate + '%', 
                        `${student.total_simulations} simulacros`, null, '📈')}
                    ${this.renderKeyMetricCard('Mejor Racha', student.longest_streak || 0, 
                        'semanas consecutivas', null, '🔥')}
                </div>
                
                <!-- Mini heatmap de rendimiento por tema -->
                <div class="topics-performance-overview">
                    <h4>Rendimiento por Temas</h4>
                    <div class="mini-heatmap">
                        ${this.renderMiniTopicsHeatmap(analytics)}
                    </div>
                </div>
                
                <!-- Comparación con cohorte -->
                <div class="cohort-comparison">
                    <h4>Comparación con Cohorte ${student.cohort}</h4>
                    ${this.renderCohortComparison(student, analytics)}
                </div>
            </div>
        `;
    }
    
    renderKeyMetricCard(title, value, subtitle, statusClass, icon) {
        return `
            <div class="key-metric-card ${statusClass || ''}">
                <div class="metric-icon-large">${icon}</div>
                <div class="metric-content">
                    <div class="metric-title">${title}</div>
                    <div class="metric-value-large">${value}</div>
                    <div class="metric-subtitle">${subtitle}</div>
                </div>
            </div>
        `;
    }
    
    renderInteractiveTimeline(results) {
        if (results.length === 0) {
            return `
                <div class="no-data-card">
                    <div class="no-data-icon">📊</div>
                    <h4>No hay simulacros registrados</h4>
                    <p>Este estudiante aún no ha participado en ningún Simulacro Recta Final.</p>
                </div>
            `;
        }
        
        // Organizar resultados por período
        const currentPeriod = this.getCurrentPeriod();
        const resultsWithMonths = this.groupResultsByMonth(results);
        
        // Después de renderizar, necesitamos colapsar todas las tarjetas y configurar el scroll
        setTimeout(() => {
            this.collapseAllTimelineCards();
            this.setupTimelineInteractions();
            this.renderTrendMiniChart(results);
        }, 0);
        
        return `
            <div class="timeline-container">
                <div class="timeline-controls">
                    <div class="timeline-period-indicator">${currentPeriod}</div>
                    <button onclick="window.studentDetail.zoomTimeline('week')" class="btn-timeline active">
                        <span>Última</span>
                        <span>Semana</span>
                    </button>
                    <button onclick="window.studentDetail.zoomTimeline('month')" class="btn-timeline">
                        <span>Último</span>
                        <span>Mes</span>
                    </button>
                    <button onclick="window.studentDetail.zoomTimeline('quarter')" class="btn-timeline">
                        <span>Último</span>
                        <span>Trimestre</span>
                    </button>
                    <button onclick="window.studentDetail.zoomTimeline('all')" class="btn-timeline">
                        <span>Todo el</span>
                        <span>Historial</span>
                    </button>
                    <button onclick="window.studentDetail.toggleCompactView()" class="btn-timeline">
                        <span>Vista</span>
                        <span id="viewToggleText">Compacta</span>
                    </button>
                </div>
                
                <div class="timeline-track" id="timelineTrack">
                    ${this.renderTimelineWithMarkers(results, resultsWithMonths)}
                </div>
                
                <!-- Mini gráfico de tendencia debajo -->
                <div class="trend-chart-container">
                    <canvas id="trendMiniChart" height="80"></canvas>
                </div>
                
                <!-- Comparador de exámenes mejorado -->
                <div class="exam-comparator-section">
                    <h4>📊 Comparar Exámenes</h4>
                    <div class="comparator-controls">
                        <select id="exam1" class="exam-select">
                            <option value="">Selecciona...</option>
                            ${results.map(r => 
                                `<option value="${r.id}">RF${r.weekly_simulations?.week_number} - ${r.score.toFixed(1)}/10 (${this.formatDateShort(r.submitted_at)})</option>`
                            ).join('')}
                        </select>
                        <span class="vs-label">vs</span>
                        <select id="exam2" class="exam-select">
                            <option value="">Selecciona...</option>
                            ${results.map(r => 
                                `<option value="${r.id}">RF${r.weekly_simulations?.week_number} - ${r.score.toFixed(1)}/10 (${this.formatDateShort(r.submitted_at)})</option>`
                            ).join('')}
                        </select>
                        <button onclick="window.studentDetail.compareExams()" class="btn btn-sm" disabled id="compareBtn">
                            Comparar
                        </button>
                    </div>
                    <div id="comparisonResult"></div>
                </div>
            </div>
        `;
    }
    
    renderTimelineCard(result, index, allResults) {
        const prevResult = index < allResults.length - 1 ? allResults[index + 1] : null;
        const improvement = prevResult ? result.score - prevResult.score : 0;
        
        // Calcular percentil real y nota de corte P80 para este simulacro
        const simulationStats = this.calculateSimulationStats(result.simulation_id);
        const percentile = simulationStats.percentiles[result.user_id] || this.calculatePercentile(result);
        const notaCorteP80 = simulationStats.p80 || 7.5;
        const vsCorte = result.score - notaCorteP80;
        
        // Determinar tendencia
        const trendClass = improvement > 0.5 ? 'up' : improvement < -0.5 ? 'down' : 'stable';
        const trendIcon = improvement > 0.5 ? '↗' : improvement < -0.5 ? '↘' : '→';
        
        return `
            <div class="timeline-card ${this.getCardClass(result)}" data-exam-id="${result.id}" data-date="${result.submitted_at}">
                ${improvement !== 0 ? `
                    <div class="timeline-trend-indicator ${trendClass}">${trendIcon}</div>
                ` : ''}
                
                <div class="timeline-header">
                    <h4>RF${result.weekly_simulations?.week_number || '?'}</h4>
                    <span class="timeline-date">${this.formatDateShort(result.submitted_at)}</span>
                    <span class="expand-indicator">▼</span>
                </div>
                
                <div class="timeline-content">
                    <div class="score-visual">
                        <div class="score-ring" style="--score: ${result.score * 10}">
                            <span class="score-value">${result.score.toFixed(1)}</span>
                        </div>
                        <div class="percentile-info">
                            <span class="percentile-badge">P${percentile}</span>
                            <span class="cutoff-info ${vsCorte >= 0 ? 'above' : 'below'}">
                                ${vsCorte >= 0 ? '✓' : '✗'} P80: ${notaCorteP80.toFixed(1)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="exam-stats-grid">
                        <div class="exam-stat">
                            <span class="stat-label">Respuestas</span>
                            <div class="stat-values">
                                <span class="correct">✓ ${result.correct_answers || 0}</span>
                                <span class="wrong">✗ ${result.wrong_answers || 0}</span>
                                <span class="blank">○ ${result.blank_answers || 0}</span>
                            </div>
                        </div>
                        
                        <div class="exam-stat">
                            <span class="stat-label">Mejora</span>
                            <span class="stat ${improvement >= 0 ? 'positive' : 'negative'}">
                                ${improvement >= 0 ? '↗' : '↘'} ${Math.abs(improvement).toFixed(1)}
                            </span>
                        </div>
                        
                        <div class="exam-stat">
                            <span class="stat-label">Vs. Corte</span>
                            <span class="stat ${vsCorte >= 0 ? 'positive' : 'negative'}">
                                ${vsCorte >= 0 ? '+' : ''}${vsCorte.toFixed(1)}
                            </span>
                        </div>
                        
                        ${result.time_taken ? `
                            <div class="exam-stat">
                                <span class="stat-label">Tiempo</span>
                                <span class="stat">${Math.round(result.time_taken/60)}min</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${result.is_saturday_live ? '<div class="saturday-badge">🔴 Sábado en directo</div>' : ''}
                </div>
            </div>
        `;
    }
    
    // Nuevas funciones para el timeline mejorado
    getCurrentPeriod() {
        const now = new Date();
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    
    groupResultsByMonth(results) {
        const grouped = {};
        
        results.forEach(result => {
            const date = new Date(result.submitted_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = {
                    results: [],
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    displayName: this.getMonthDisplayName(date)
                };
            }
            
            grouped[monthKey].results.push(result);
        });
        
        return grouped;
    }
    
    getMonthDisplayName(date) {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
    
    renderTimelineWithMarkers(results, resultsWithMonths) {
        let html = '';
        let currentMonth = null;
        let monthOffset = 0;
        
        results.slice(0, 50).forEach((result, index) => {
            const date = new Date(result.submitted_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Añadir marcador de mes si es necesario
            if (currentMonth !== monthKey) {
                currentMonth = monthKey;
                const monthData = resultsWithMonths[monthKey];
                if (monthData) {
                    html += `<div class="timeline-month-marker" style="left: ${monthOffset}px">${monthData.displayName}</div>`;
                }
            }
            
            html += this.renderTimelineCard(result, index, results);
            monthOffset += 160; // Ancho de la tarjeta + gap
        });
        
        return html;
    }
    
    setupTimelineInteractions() {
        const track = document.getElementById('timelineTrack');
        if (!track) return;
        
        // Habilitar navegación con teclado
        track.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                track.scrollLeft -= 160;
            } else if (e.key === 'ArrowRight') {
                track.scrollLeft += 160;
            }
        });
        
        // Habilitar selección de comparación
        const exam1Select = document.getElementById('exam1');
        const exam2Select = document.getElementById('exam2');
        const compareBtn = document.getElementById('compareBtn');
        
        if (exam1Select && exam2Select && compareBtn) {
            const updateCompareButton = () => {
                compareBtn.disabled = !exam1Select.value || !exam2Select.value || 
                                     exam1Select.value === exam2Select.value;
            };
            
            exam1Select.addEventListener('change', updateCompareButton);
            exam2Select.addEventListener('change', updateCompareButton);
        }
        
        // Scroll suave al exam más reciente
        setTimeout(() => {
            track.scrollLeft = 0;
        }, 100);
    }
    
    renderTrendMiniChart(results) {
        const canvas = document.getElementById('trendMiniChart');
        if (!canvas || !window.Chart) return;
        
        const ctx = canvas.getContext('2d');
        const scores = results.slice(0, 20).reverse().map(r => r.score);
        const labels = results.slice(0, 20).reverse().map(r => `RF${r.weekly_simulations?.week_number || '?'}`);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Puntuación',
                    data: scores,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        ticks: { stepSize: 2 }
                    }
                }
            }
        });
    }
    
    toggleCompactView() {
        const track = document.getElementById('timelineTrack');
        const viewToggleText = document.getElementById('viewToggleText');
        
        if (!track) return;
        
        const isCompact = track.classList.contains('compact-view');
        
        if (isCompact) {
            track.classList.remove('compact-view');
            viewToggleText.textContent = 'Compacta';
            // Expandir todas las tarjetas
            document.querySelectorAll('.timeline-card').forEach(card => {
                card.classList.add('expanded');
            });
        } else {
            track.classList.add('compact-view');
            viewToggleText.textContent = 'Expandida';
            // Colapsar todas las tarjetas
            this.collapseAllTimelineCards();
        }
    }
    
    renderPatternsGrid(analytics, results) {
        const patterns = [
            {
                icon: '📅',
                title: 'Mejor día',
                value: analytics.bestDay || 'Por determinar',
                insight: analytics.bestDay ? `Rinde mejor los ${analytics.bestDay}` : 'Datos insuficientes'
            },
            {
                icon: '⏰',
                title: 'Tiempo óptimo',
                value: this.calculateOptimalTime(results) + ' min',
                insight: 'Su mejor rendimiento es con este tiempo'
            },
            {
                icon: '📈',
                title: 'Tendencia',
                value: this.getTrendText(analytics.scoreTrend),
                insight: this.getTrendMessage(analytics.scoreTrend)
            },
            {
                icon: '🎯',
                title: 'Consistencia',
                value: this.getConsistencyPercentage(analytics.consistency) + '%',
                insight: analytics.consistency < 1.5 ? 'Muy estable' : 'Variable'
            },
            {
                icon: '💪',
                title: 'Temas fuertes',
                value: this.getStrongestTopics(results).length || 0,
                insight: this.getStrongestTopics(results).join(', ') || 'Por identificar'
            },
            {
                icon: '⚠️',
                title: 'Áreas de mejora',
                value: analytics.worstTopics?.length || 0,
                insight: analytics.worstTopics?.slice(0, 2).join(', ') || 'Sin debilidades claras'
            }
        ];
        
        return `
            <div class="patterns-grid">
                ${patterns.map(p => `
                    <div class="pattern-card">
                        <div class="pattern-icon">${p.icon}</div>
                        <div class="pattern-content">
                            <h4>${p.title}</h4>
                            <div class="pattern-value">${p.value}</div>
                            <p class="pattern-insight">${p.insight}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Análisis de patrones avanzado -->
            <div class="advanced-patterns">
                <h4>🔬 Análisis Avanzado</h4>
                ${this.renderAdvancedPatterns(analytics, results)}
            </div>
        `;
    }
    
    renderEvolcampusIntegrated(evolcampusData) {
        const activities = evolcampusData?.activities || [];
        
        if (activities.length === 0) {
            return `
                <div class="evolcampus-empty">
                    <p>No hay datos de Evolcampus disponibles.</p>
                    <button class="btn btn-primary" onclick="window.studentDetail.syncEvolcampusForStudent('${this.currentStudent?.email}')">
                        🔄 Sincronizar Evolcampus
                    </button>
                </div>
            `;
        }
        
        const groupedByTopic = this.groupActivitiesByTopic(activities);
        const cleanedTopics = this.cleanTopicNames(groupedByTopic);
        
        return `
            <div class="evolcampus-integrated">
                <!-- Controles de filtro por tema -->
                <div class="topic-filters">
                    <label>Filtrar por tema:</label>
                    <select id="topicFilter" onchange="window.studentDetail.filterByTopic(this.value)" class="topic-select">
                        <option value="all">Todos los temas</option>
                        ${Object.keys(cleanedTopics).map(topic => 
                            `<option value="${topic}">${this.getTopicDisplayName(topic)}</option>`
                        ).join('')}
                    </select>
                    
                    <div class="view-toggles">
                        <button onclick="window.studentDetail.setEvolView('cards')" class="view-btn active">
                            <span class="icon">📇</span> Tarjetas
                        </button>
                        <button onclick="window.studentDetail.setEvolView('table')" class="view-btn">
                            <span class="icon">📊</span> Tabla
                        </button>
                        <button onclick="window.studentDetail.setEvolView('heatmap')" class="view-btn">
                            <span class="icon">🗺️</span> Mapa
                        </button>
                    </div>
                </div>
                
                <!-- Vista principal de temas -->
                <div id="evolcampusContent" class="evolcampus-content">
                    ${this.renderTopicsView(cleanedTopics)}
                </div>
                
                <!-- Resumen estadístico -->
                <div class="evolcampus-stats-summary">
                    ${this.renderEvolcampusStatsSummary(evolcampusData)}
                </div>
            </div>
        `;
    }
    
    renderActionPlan(student, analytics) {
        const actions = this.generatePersonalizedActions(student, analytics);
        
        return `
            <div class="action-plan">
                <div class="plan-timeline">
                    ${actions.map((action, index) => `
                        <div class="action-item ${action.priority}" data-action-id="${action.id}">
                            <div class="action-number">${index + 1}</div>
                            <div class="action-content">
                                <h4>${action.title}</h4>
                                <p>${action.description}</p>
                                <div class="action-meta">
                                    <span class="deadline">
                                        <span class="icon">📅</span> ${action.deadline}
                                    </span>
                                    <span class="impact">
                                        <span class="icon">💪</span> Impacto: ${this.renderImpactStars(action.impact)}
                                    </span>
                                </div>
                            </div>
                            <button class="btn-action" onclick="window.studentDetail.markActionComplete('${action.id}')">
                                ✓ Completar
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Seguimiento del plan -->
                <div class="plan-progress">
                    <h4>📊 Progreso del Plan</h4>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.calculatePlanProgress(actions)}%"></div>
                    </div>
                    <p class="progress-text">${this.calculatePlanProgress(actions)}% completado</p>
                </div>
            </div>
        `;
    }
    
    // ==================== MÉTODOS AUXILIARES NUEVOS ====================
    
    calculatePercentile(result) {
        // Calcular percentil basado en la posición si está disponible
        if (result.position && result.total_participants) {
            return Math.round((1 - result.position / result.total_participants) * 100);
        }
        // Estimación basada en el score
        return Math.round(result.score * 10);
    }
    
    getCardClass(result) {
        if (result.score >= 8) return 'excellent';
        if (result.score >= 6.5) return 'good';
        if (result.score >= 5) return 'warning';
        return 'danger';
    }
    
    formatDateShort(dateStr) {
        const date = new Date(dateStr);
        const options = { day: 'numeric', month: 'short' };
        return date.toLocaleDateString('es-ES', options);
    }
    
    // Para uso interno - formato parseable
    formatDateForParsing(dateStr) {
        const date = new Date(dateStr);
        return date.toISOString();
    }
    
    getQuickInsights(result) {
        const insights = [];
        
        if (result.correct_answers > result.wrong_answers * 2) {
            insights.push('<span class="insight-pill positive">Buen dominio</span>');
        }
        if (result.blank_answers > 5) {
            insights.push('<span class="insight-pill warning">Muchas en blanco</span>');
        }
        if (result.time_taken && result.time_taken < 2400) {
            insights.push('<span class="insight-pill">Rápido</span>');
        }
        
        return insights.join('');
    }
    
    renderExamFullDetail(result) {
        return `
            <div class="exam-full-detail">
                <div class="detail-grid">
                    <div class="detail-section">
                        <h5>Respuestas</h5>
                        <div class="answers-breakdown">
                            <div class="answer-stat correct">✓ ${result.correct_answers}</div>
                            <div class="answer-stat wrong">✗ ${result.wrong_answers}</div>
                            <div class="answer-stat blank">○ ${result.blank_answers}</div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h5>Rendimiento</h5>
                        <p>Posición: ${result.position || 'N/A'}</p>
                        <p>Tiempo: ${result.time_taken ? Math.round(result.time_taken/60) + ' min' : 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateOptimalTime(results) {
        const validTimes = results
            .filter(r => r.time_taken && r.score >= 7)
            .map(r => r.time_taken);
        
        if (validTimes.length === 0) return 45;
        
        const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
        return Math.round(avgTime / 60);
    }
    
    getTrendText(trend) {
        const trendMap = {
            'up': 'Mejorando',
            'down': 'Bajando',
            'stable': 'Estable',
            'neutral': 'Sin tendencia'
        };
        return trendMap[trend] || 'Por determinar';
    }
    
    getTrendMessage(trend) {
        const messages = {
            'up': 'Excelente progreso, mantén el ritmo',
            'down': 'Necesita atención y apoyo',
            'stable': 'Rendimiento consistente',
            'neutral': 'Continúa practicando'
        };
        return messages[trend] || 'Continúa practicando';
    }
    
    getConsistencyPercentage(consistency) {
        // Convertir desviación estándar a porcentaje de consistencia
        if (!consistency || consistency === 0) return 100;
        return Math.max(0, Math.round(100 - (consistency * 20)));
    }
    
    getStrongestTopics(results) {
        // Análisis simplificado de temas fuertes
        const strongTopics = [];
        // Por ahora retornamos un array vacío, pero aquí iría la lógica real
        return strongTopics;
    }
    
    renderAdvancedPatterns(analytics, results) {
        return `
            <div class="advanced-patterns-content">
                <p>Análisis detallado basado en ${results.length} simulacros.</p>
                <!-- Aquí irían visualizaciones más complejas -->
            </div>
        `;
    }
    
    cleanTopicNames(groupedTopics) {
        const cleaned = {};
        
        Object.entries(groupedTopics).forEach(([topic, activities]) => {
            // Filtrar temas que son nombres de profesores
            const cleanTopic = this.extractRealTopicName(topic);
            if (cleanTopic && !this.isProfessorName(cleanTopic)) {
                if (!cleaned[cleanTopic]) {
                    cleaned[cleanTopic] = [];
                }
                cleaned[cleanTopic].push(...activities);
            }
        });
        
        return cleaned;
    }
    
    extractRealTopicName(topic) {
        // Extraer número de tema si existe
        const match = topic.match(/tema\s*(\d+)/i);
        if (match) {
            return `T${match[1]}`;
        }
        
        // Si ya es formato T#
        if (topic.match(/^T\d+$/)) {
            return topic;
        }
        
        // Si es "GENERAL" o similar
        if (topic.toUpperCase() === 'GENERAL' || topic.toUpperCase() === 'SIN CATEGORÍA') {
            return 'GENERAL';
        }
        
        return topic;
    }
    
    isProfessorName(topic) {
        // Lista de palabras que indican que es un nombre de profesor
        const professorIndicators = [
            'prof', 'profesor', 'dr', 'dra', 'lic', 'ing', 'mgtr', 
            'msc', 'phd', 'maestro', 'maestra'
        ];
        
        const lowerTopic = topic.toLowerCase();
        
        // Si contiene indicadores de profesor
        if (professorIndicators.some(indicator => lowerTopic.includes(indicator))) {
            return true;
        }
        
        // Si parece un nombre completo (tiene espacios y no números)
        if (lowerTopic.includes(' ') && !lowerTopic.match(/\d/) && !lowerTopic.includes('tema')) {
            return true;
        }
        
        return false;
    }
    
    getTopicDisplayName(topic) {
        if (topic === 'GENERAL') return '📚 Temas Generales';
        if (topic.match(/^T\d+$/)) return `📖 Tema ${topic.substring(1)}`;
        return `📁 ${topic}`;
    }
    
    renderTopicsView(topics) {
        return Object.entries(topics).map(([topic, activities]) => {
            const stats = this.calculateTopicStats(activities);
            
            return `
                <div class="topic-card" data-topic="${topic}">
                    <div class="topic-card-header">
                        <h4>${this.getTopicDisplayName(topic)}</h4>
                        <div class="topic-stats-inline">
                            <span class="stat-badge">${stats.completed}/${stats.total}</span>
                            <span class="stat-badge ${this.getScoreClass(stats.avgScore)}">
                                ${stats.avgScore.toFixed(1)}/10
                            </span>
                        </div>
                    </div>
                    <div class="topic-progress">
                        <div class="progress-bar-thin">
                            <div class="progress-fill" style="width: ${stats.completionRate}%"></div>
                        </div>
                    </div>
                    <div class="topic-activities-preview">
                        ${activities.slice(0, 3).map(a => `
                            <div class="activity-mini">
                                <span class="activity-name">${a.activity}</span>
                                <span class="activity-score ${this.getScoreClassForTest(a.score)}">
                                    ${a.score !== null ? a.score.toFixed(1) : '—'}
                                </span>
                            </div>
                        `).join('')}
                        ${activities.length > 3 ? `<div class="more-link">+${activities.length - 3} más...</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    calculateTopicStats(activities) {
        const completed = activities.filter(a => a.done).length;
        const withScores = activities.filter(a => a.score !== null);
        const avgScore = withScores.length > 0 
            ? withScores.reduce((sum, a) => sum + a.score, 0) / withScores.length 
            : 0;
        
        return {
            total: activities.length,
            completed,
            avgScore,
            completionRate: activities.length > 0 ? (completed / activities.length * 100) : 0
        };
    }
    
    renderEvolcampusStatsSummary(evolcampusData) {
        const stats = evolcampusData.stats || {};
        
        return `
            <div class="stats-summary-grid">
                <div class="summary-stat">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.averageGrade || 0}</div>
                        <div class="stat-label">Nota Media</div>
                    </div>
                </div>
                <div class="summary-stat">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.completionPercentage || 0}%</div>
                        <div class="stat-label">Completado</div>
                    </div>
                </div>
                <div class="summary-stat ${stats.zeroScoreActivities > 0 ? 'warning' : ''}">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.zeroScoreActivities || 0}</div>
                        <div class="stat-label">Con Nota 0</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    generatePersonalizedActions(student, analytics) {
        const actions = [];
        const probability = student.probability_pass || 50;
        
        // Acciones basadas en probabilidad de aprobar
        if (probability < 40) {
            actions.push({
                id: 'urgent-meeting',
                title: '🚨 Reunión urgente de evaluación',
                description: 'Programar una sesión individual para evaluar situación y crear plan de recuperación',
                deadline: 'Esta semana',
                impact: 5,
                priority: 'critical'
            });
        }
        
        // Acciones basadas en participación
        if (analytics.participationRate < 50) {
            actions.push({
                id: 'increase-participation',
                title: '📅 Aumentar participación en simulacros',
                description: 'Establecer recordatorios y seguimiento semanal para asegurar participación',
                deadline: 'Inmediato',
                impact: 4,
                priority: 'high'
            });
        }
        
        // Acciones basadas en tendencia
        if (analytics.scoreTrend === 'down') {
            actions.push({
                id: 'reverse-trend',
                title: '📉 Revertir tendencia negativa',
                description: 'Identificar causas de la bajada de rendimiento y aplicar medidas correctivas',
                deadline: 'Próximos 15 días',
                impact: 4,
                priority: 'high'
            });
        }
        
        // Acciones basadas en temas débiles
        if (analytics.worstTopics && analytics.worstTopics.length > 0) {
            actions.push({
                id: 'reinforce-topics',
                title: '📚 Reforzar temas débiles',
                description: `Sesiones específicas para: ${analytics.worstTopics.slice(0, 3).join(', ')}`,
                deadline: 'Próximo mes',
                impact: 3,
                priority: 'medium'
            });
        }
        
        // Acción general de seguimiento
        actions.push({
            id: 'regular-followup',
            title: '👥 Seguimiento regular',
            description: 'Mantener comunicación quincenal para monitorear progreso',
            deadline: 'Continuo',
            impact: 2,
            priority: 'normal'
        });
        
        return actions;
    }
    
    renderImpactStars(impact) {
        return '⭐'.repeat(impact);
    }
    
    calculatePlanProgress(actions) {
        // Por ahora retornamos 0, pero aquí iría la lógica real de progreso
        return 0;
    }
    
    renderMiniTopicsHeatmap(analytics) {
        // Versión simplificada del heatmap de temas
        return '<div class="mini-heatmap-placeholder">Heatmap de temas en desarrollo</div>';
    }
    
    renderCohortComparison(student, analytics) {
        return `
            <div class="cohort-comparison-chart">
                <div class="comparison-metric">
                    <span class="metric-name">Tu estudiante</span>
                    <div class="comparison-bar">
                        <div class="bar-fill student" style="width: ${student.average_score * 10}%"></div>
                    </div>
                    <span class="metric-value">${student.average_score?.toFixed(1) || 'N/A'}</span>
                </div>
                <div class="comparison-metric">
                    <span class="metric-name">Media cohorte</span>
                    <div class="comparison-bar">
                        <div class="bar-fill cohort" style="width: 65%"></div>
                    </div>
                    <span class="metric-value">6.5</span>
                </div>
            </div>
        `;
    }
    
    // ==================== MÉTODOS DE INTERACCIÓN ====================
    
    expandExamDetail(examId) {
        const detail = document.getElementById(`detail-${examId}`);
        if (detail) {
            detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    zoomTimeline(period) {
        // Cambiar el zoom del timeline
        document.querySelectorAll('.btn-timeline').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.btn-timeline').classList.add('active');
        
        const track = document.getElementById('timelineTrack');
        const allCards = track.querySelectorAll('.timeline-card');
        const now = new Date();
        
        allCards.forEach(card => {
            // Obtener la fecha del atributo data-date
            const examDateStr = card.getAttribute('data-date');
            const examDate = examDateStr ? new Date(examDateStr) : new Date();
            let show = false;
            
            switch(period) {
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    show = examDate >= weekAgo;
                    break;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    show = examDate >= monthAgo;
                    break;
                case 'quarter':
                    const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    show = examDate >= quarterAgo;
                    break;
                case 'all':
                    show = true;
                    break;
            }
            
            card.style.display = show ? 'flex' : 'none';
        });
        
        // Actualizar marcadores de mes
        this.updateMonthMarkers(period);
        
        // Scroll al inicio
        track.scrollLeft = 0;
    }
    
    updateMonthMarkers(period) {
        const markers = document.querySelectorAll('.timeline-month-marker');
        markers.forEach(marker => {
            marker.style.display = period === 'all' || period === 'quarter' ? 'block' : 'none';
        });
    }
    
    compareExams() {
        const exam1Id = document.getElementById('exam1').value;
        const exam2Id = document.getElementById('exam2').value;
        const resultDiv = document.getElementById('comparisonResult');
        
        if (!exam1Id || !exam2Id || exam1Id === exam2Id) {
            resultDiv.innerHTML = '<p class="warning-message">Selecciona dos exámenes diferentes para comparar</p>';
            return;
        }
        
        // Obtener los datos de los exámenes
        const results = this.currentStudent.results || [];
        const exam1 = results.find(r => r.id === exam1Id);
        const exam2 = results.find(r => r.id === exam2Id);
        
        if (!exam1 || !exam2) {
            resultDiv.innerHTML = '<p class="error-message">Error al cargar los datos de los exámenes</p>';
            return;
        }
        
        // Calcular métricas comparativas
        const scoreDiff = exam2.score - exam1.score;
        const timeDiff = (exam2.time_taken || 0) - (exam1.time_taken || 0);
        const blankDiff = (exam2.blank_answers || 0) - (exam1.blank_answers || 0);
        
        // Obtener estadísticas y P80 de cada simulacro
        const stats1 = this.calculateSimulationStats(exam1.simulation_id);
        const stats2 = this.calculateSimulationStats(exam2.simulation_id);
        
        const notaCorte1 = stats1.p80;
        const notaCorte2 = stats2.p80;
        const percentil1 = stats1.percentiles[exam1.user_id] || this.calculatePercentile(exam1);
        const percentil2 = stats2.percentiles[exam2.user_id] || this.calculatePercentile(exam2);
        
        resultDiv.innerHTML = `
            <div class="exam-comparison">
                <h5>📊 Comparación Detallada</h5>
                
                <div class="comparison-grid">
                    <div class="comparison-metric">
                        <div class="metric-header">Nota</div>
                        <div class="metric-values">
                            <div class="value-box ${exam1.score >= notaCorte ? 'success' : 'danger'}">
                                <strong>RF${exam1.weekly_simulations?.week_number}</strong>
                                <span>${exam1.score.toFixed(1)}/10</span>
                            </div>
                            <div class="trend-indicator ${scoreDiff >= 0 ? 'positive' : 'negative'}">
                                ${scoreDiff >= 0 ? '↗' : '↘'} ${Math.abs(scoreDiff).toFixed(1)}
                            </div>
                            <div class="value-box ${exam2.score >= notaCorte ? 'success' : 'danger'}">
                                <strong>RF${exam2.weekly_simulations?.week_number}</strong>
                                <span>${exam2.score.toFixed(1)}/10</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="comparison-metric">
                        <div class="metric-header">Vs. Nota de Corte (P80)</div>
                        <div class="metric-values">
                            <div class="value-box">
                                <span class="${exam1.score >= notaCorte1 ? 'above-cutoff' : 'below-cutoff'}">
                                    ${exam1.score >= notaCorte1 ? '+' : ''}${(exam1.score - notaCorte1).toFixed(1)}
                                </span>
                                <small>P${percentil1} | Corte: ${notaCorte1.toFixed(1)}</small>
                            </div>
                            <div class="trend-indicator">→</div>
                            <div class="value-box">
                                <span class="${exam2.score >= notaCorte2 ? 'above-cutoff' : 'below-cutoff'}">
                                    ${exam2.score >= notaCorte2 ? '+' : ''}${(exam2.score - notaCorte2).toFixed(1)}
                                </span>
                                <small>P${percentil2} | Corte: ${notaCorte2.toFixed(1)}</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="comparison-metric">
                        <div class="metric-header">Respuestas</div>
                        <div class="metric-values">
                            <div class="value-box small">
                                <div class="answers-mini">
                                    <span class="correct">✓${exam1.correct_answers}</span>
                                    <span class="wrong">✗${exam1.wrong_answers}</span>
                                    <span class="blank">○${exam1.blank_answers}</span>
                                </div>
                            </div>
                            <div class="trend-indicator ${blankDiff <= 0 ? 'positive' : 'negative'}">
                                ${blankDiff <= 0 ? '✓' : '⚠️'}
                            </div>
                            <div class="value-box small">
                                <div class="answers-mini">
                                    <span class="correct">✓${exam2.correct_answers}</span>
                                    <span class="wrong">✗${exam2.wrong_answers}</span>
                                    <span class="blank">○${exam2.blank_answers}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${exam1.time_taken && exam2.time_taken ? `
                        <div class="comparison-metric">
                            <div class="metric-header">Tiempo</div>
                            <div class="metric-values">
                                <div class="value-box">
                                    <span>${Math.round(exam1.time_taken/60)}min</span>
                                </div>
                                <div class="trend-indicator ${timeDiff < 0 ? 'positive' : 'negative'}">
                                    ${timeDiff < 0 ? '⚡' : '🐌'} ${Math.abs(Math.round(timeDiff/60))}min
                                </div>
                                <div class="value-box">
                                    <span>${Math.round(exam2.time_taken/60)}min</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="comparison-insights">
                    <h6>💡 Análisis</h6>
                    <ul>
                        ${scoreDiff > 0 ? 
                            `<li class="positive">✅ Mejora de ${scoreDiff.toFixed(1)} puntos</li>` :
                            scoreDiff < 0 ?
                            `<li class="negative">⚠️ Bajada de ${Math.abs(scoreDiff).toFixed(1)} puntos</li>` :
                            `<li>→ Rendimiento estable</li>`
                        }
                        ${exam2.score >= notaCorte && exam1.score < notaCorte ?
                            `<li class="positive">🎯 Ha superado la nota de corte</li>` :
                            exam2.score < notaCorte && exam1.score >= notaCorte ?
                            `<li class="negative">⚠️ Ha bajado por debajo de la nota de corte</li>` :
                            ''
                        }
                        ${blankDiff < -2 ?
                            `<li class="positive">✅ Menos preguntas en blanco (${Math.abs(blankDiff)} menos)</li>` :
                            blankDiff > 2 ?
                            `<li class="negative">⚠️ Más preguntas en blanco (+${blankDiff})</li>` :
                            ''
                        }
                        ${timeDiff < -300 ?
                            `<li class="positive">⚡ Más rápido (${Math.abs(Math.round(timeDiff/60))} min menos)</li>` :
                            ''
                        }
                    </ul>
                </div>
            </div>
        `;
    }
    
    calculatePercentileVsCorte(score, corte) {
        // Calcular percentil estimado basado en distribución normal
        // Asumiendo media=7.0, desviación=1.5
        const media = 7.0;
        const desviacion = 1.5;
        const z = (score - media) / desviacion;
        
        // Aproximación de la función de distribución normal
        const percentil = Math.round(50 + 50 * this.erf(z / Math.sqrt(2)));
        return Math.min(99, Math.max(1, percentil));
    }
    
    // Función de error para cálculo de percentil
    erf(x) {
        // Aproximación de la función de error
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return sign * y;
    }

    calculateSimulationStats(simulationId) {
        // Cache para evitar recalcular constantemente
        if (!this.simulationStatsCache) {
            this.simulationStatsCache = {};
        }
        
        if (this.simulationStatsCache[simulationId]) {
            return this.simulationStatsCache[simulationId];
        }
        
        // Obtener todos los resultados de este simulacro desde allExamResults
        const simulationResults = this.allExamResults?.filter(r => 
            r.simulation_id === simulationId
        ) || [];
        
        if (simulationResults.length === 0) {
            return { p80: 7.5, percentiles: {} };
        }
        
        // Ordenar por puntuación
        const sortedScores = simulationResults
            .map(r => ({ user_id: r.user_id, score: r.score }))
            .sort((a, b) => a.score - b.score);
        
        // Calcular P80 (percentil 80)
        const p80Index = Math.floor(sortedScores.length * 0.8);
        const p80 = sortedScores[p80Index]?.score || 7.5;
        
        // Calcular percentil de cada estudiante
        const percentiles = {};
        sortedScores.forEach((result, index) => {
            const percentile = Math.round((index + 1) / sortedScores.length * 100);
            percentiles[result.user_id] = percentile;
        });
        
        // Guardar en caché
        this.simulationStatsCache[simulationId] = {
            p80: p80,
            percentiles: percentiles,
            totalStudents: sortedScores.length,
            mean: sortedScores.reduce((sum, r) => sum + r.score, 0) / sortedScores.length,
            min: sortedScores[0]?.score,
            max: sortedScores[sortedScores.length - 1]?.score
        };
        
        return this.simulationStatsCache[simulationId];
    }
    
    filterByTopic(topic) {
        const cards = document.querySelectorAll('.topic-card');
        
        if (topic === 'all') {
            cards.forEach(card => card.style.display = 'block');
        } else {
            cards.forEach(card => {
                card.style.display = card.dataset.topic === topic ? 'block' : 'none';
            });
        }
    }
    
    setEvolView(viewType) {
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.view-btn').classList.add('active');
        
        // Aquí iría la lógica real de cambio de vista
        const content = document.getElementById('evolcampusContent');
        if (viewType === 'table') {
            content.classList.add('table-view');
        } else {
            content.classList.remove('table-view');
        }
    }
    
    markActionComplete(actionId) {
        const actionItem = document.querySelector(`[data-action-id="${actionId}"]`);
        if (actionItem) {
            actionItem.classList.add('completed');
            this.dashboard.showNotification('success', '✅ Acción marcada como completada');
        }
    }

    getMiniHeatmap(analytics) {
        if (!analytics.worstTopics || analytics.worstTopics.length === 0) {
            return '<div class="mini-heatmap">Sin datos de temas</div>';
        }
        
        const maxScore = 10;
        const topics = analytics.worstTopics.slice(0, 8); // Mostrar máximo 8 temas
        
        const cells = topics.map(topic => {
            const percentage = (topic.avgScore / maxScore) * 100;
            const color = percentage >= 70 ? '#10b981' : 
                         percentage >= 50 ? '#f59e0b' : 
                         percentage >= 30 ? '#ef4444' : '#991b1b';
            
            return `
                <div class="heatmap-cell" 
                     style="background-color: ${color}; opacity: ${0.3 + (percentage / 100) * 0.7}"
                     title="${topic.topic}: ${topic.avgScore.toFixed(1)}/10">
                    <span class="cell-label">${topic.topic.replace('T', '')}</span>
                    <span class="cell-value">${topic.avgScore.toFixed(1)}</span>
                </div>
            `;
        }).join('');
        
        return `
            <div class="mini-heatmap">
                <div class="heatmap-grid">
                    ${cells}
                </div>
                <style>
                    .mini-heatmap { margin: 10px 0; }
                    .heatmap-grid { 
                        display: grid; 
                        grid-template-columns: repeat(4, 1fr); 
                        gap: 4px;
                        max-width: 200px;
                    }
                    .heatmap-cell {
                        aspect-ratio: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        font-size: 10px;
                        cursor: pointer;
                        transition: transform 0.2s;
                    }
                    .heatmap-cell:hover {
                        transform: scale(1.1);
                    }
                    .cell-label {
                        font-weight: bold;
                        color: white;
                    }
                    .cell-value {
                        color: white;
                        opacity: 0.8;
                        font-size: 9px;
                    }
                </style>
            </div>
        `;
    }
}
