// admin/js/modules/alerts.js
export default class AlertsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.alertTypes = {
            'low_score': { icon: '📉', color: 'danger' },
            'missing_simulation': { icon: '❌', color: 'warning' },
            'streak_lost': { icon: '🔥', color: 'warning' },
            'high_risk': { icon: '⚠️', color: 'danger' },
            'improvement': { icon: '📈', color: 'success' },
            'medal_earned': { icon: '🏅', color: 'success' }
        };
    }

    async render(container, alerts) {
        // Agrupar alertas por tipo y estado
        const unreadAlerts = alerts.filter(a => !a.is_read);
        const readAlerts = alerts.filter(a => a.is_read);
        
        container.innerHTML = `
            <div class="alerts-page">
                <!-- Resumen -->
                <div class="alerts-summary">
                    <div class="stat-card danger">
                        <div class="stat-header">
                            <div class="stat-icon danger">🔔</div>
                            <div class="stat-content">
                                <div class="stat-label">Alertas Sin Leer</div>
                                <div class="stat-value">${unreadAlerts.length}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card warning">
                        <div class="stat-header">
                            <div class="stat-icon warning">⚠️</div>
                            <div class="stat-content">
                                <div class="stat-label">Requieren Acción</div>
                                <div class="stat-value">${unreadAlerts.filter(a => a.alert_type.includes('risk')).length}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Acciones -->
                <div class="alert-actions">
                    <button class="btn btn-primary" onclick="window.alertsModule.generateNewAlerts()">
                        🔄 Generar Alertas Automáticas
                    </button>
                    <button class="btn btn-secondary" onclick="window.alertsModule.markAllAsRead()">
                        ✅ Marcar todas como leídas
                    </button>
                    <button class="btn btn-secondary" onclick="window.alertsModule.exportAlerts()">
                        📊 Exportar Alertas
                    </button>
                </div>
                
                <!-- Lista de alertas -->
                <div class="alerts-container">
                    <h3>📨 Alertas Sin Leer (${unreadAlerts.length})</h3>
                    <div class="alerts-list">
                        ${unreadAlerts.map(alert => this.renderAlert(alert)).join('')}
                    </div>
                    
                    ${readAlerts.length > 0 ? `
                        <h3 style="margin-top: 2rem;">✅ Alertas Leídas (${readAlerts.length})</h3>
                        <div class="alerts-list read">
                            ${readAlerts.slice(0, 20).map(alert => this.renderAlert(alert, true)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        window.alertsModule = this;
    }

    renderAlert(alert, isRead = false) {
        const typeConfig = this.alertTypes[alert.alert_type] || { icon: '📢', color: 'info' };
        const user = this.dashboard.data.students.find(s => s.id === alert.user_id);
        
        return `
            <div class="alert-item ${isRead ? 'read' : 'unread'} ${typeConfig.color}"
                 data-alert-id="${alert.id}">
                <div class="alert-icon">${typeConfig.icon}</div>
                <div class="alert-content">
                    <div class="alert-header">
                        <strong>${user ? user.username : 'Usuario'}</strong>
                        <span class="alert-time">${this.formatRelativeTime(alert.created_at)}</span>
                    </div>
                    <div class="alert-message">${alert.message}</div>
                    ${alert.simulation_id ? `
                        <div class="alert-meta">
                            Simulacro RF${this.getSimulationWeek(alert.simulation_id)}
                        </div>
                    ` : ''}
                </div>
                <div class="alert-actions">
                    ${!isRead ? `
                        <button class="btn-icon" onclick="window.alertsModule.markAsRead('${alert.id}')"
                                title="Marcar como leída">
                            ✓
                        </button>
                    ` : ''}
                    <button class="btn-icon" onclick="window.alertsModule.viewStudent('${alert.user_id}')"
                            title="Ver estudiante">
                        👁️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Generar alertas automáticas basadas en análisis
     */
    async generateNewAlerts() {
        try {
            this.dashboard.showNotification('info', 'Analizando datos para generar alertas...');
            
            const alerts = [];
            const students = this.dashboard.data.students;
            const results = this.dashboard.data.results;
            
            // 1. Alertas por bajo rendimiento
            for (const student of students) {
                // Alerta por probabilidad muy baja
                if (student.probability_pass < 30 && student.active) {
                    alerts.push({
                        user_id: student.id,
                        alert_type: 'high_risk',
                        message: `Riesgo crítico: Probabilidad de aprobar ${student.probability_pass.toFixed(0)}%. Requiere intervención urgente.`
                    });
                }
                
                // Alerta por pérdida de racha
                const lastResult = results
                    .filter(r => r.user_id === student.id)
                    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
                
                if (lastResult) {
                    const daysSinceLastResult = Math.floor(
                        (new Date() - new Date(lastResult.submitted_at)) / (1000 * 60 * 60 * 24)
                    );
                    
                    if (daysSinceLastResult > 14 && student.current_streak > 0) {
                        alerts.push({
                            user_id: student.id,
                            alert_type: 'missing_simulation',
                            message: `No ha participado en ${daysSinceLastResult} días. En riesgo de perder racha de ${student.current_streak} semanas.`
                        });
                    }
                    
                    // Alerta por score muy bajo
                    if (lastResult.score < 5) {
                        alerts.push({
                            user_id: student.id,
                            alert_type: 'low_score',
                            message: `Score muy bajo en último simulacro: ${lastResult.score}/10. Necesita apoyo adicional.`,
                            simulation_id: lastResult.simulation_id
                        });
                    }
                }
            }
            
            // 2. Alertas positivas (mejoras significativas)
            for (const student of students) {
                const studentResults = results
                    .filter(r => r.user_id === student.id)
                    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                    .slice(0, 3);
                
                if (studentResults.length >= 2) {
                    const improvement = studentResults[0].score - studentResults[1].score;
                    if (improvement >= 1.5) {
                        alerts.push({
                            user_id: student.id,
                            alert_type: 'improvement',
                            message: `¡Mejora significativa! +${improvement.toFixed(2)} puntos en el último simulacro.`,
                            simulation_id: studentResults[0].simulation_id
                        });
                    }
                }
            }
            
            // Insertar alertas en la BD
            if (alerts.length > 0) {
                const { error } = await this.supabase
                    .from('user_alerts')
                    .insert(alerts);
                
                if (error) throw error;
                
                this.dashboard.showNotification('success', 
                    `${alerts.length} nuevas alertas generadas`);
                
                // Recargar datos
                await this.dashboard.loadInitialData();
                await this.dashboard.refreshCurrentPage();
            } else {
                this.dashboard.showNotification('info', 'No se encontraron situaciones que requieran alertas');
            }
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error generando alertas: ' + error.message);
        }
    }

    /**
     * Marcar alerta como leída
     */
    async markAsRead(alertId) {
        try {
            const { error } = await this.supabase
                .from('user_alerts')
                .update({ is_read: true })
                .eq('id', alertId);
            
            if (error) throw error;
            
            // Actualizar localmente
            const alert = this.dashboard.data.alerts.find(a => a.id === alertId);
            if (alert) alert.is_read = true;
            
            // Actualizar UI
            const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
            if (alertElement) {
                alertElement.classList.remove('unread');
                alertElement.classList.add('read');
            }
            
            this.dashboard.updateBadges();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al marcar como leída');
        }
    }

    /**
     * Marcar todas como leídas
     */
    async markAllAsRead() {
        if (!confirm('¿Marcar todas las alertas como leídas?')) return;
        
        try {
            const unreadIds = this.dashboard.data.alerts
                .filter(a => !a.is_read)
                .map(a => a.id);
            
            if (unreadIds.length === 0) return;
            
            const { error } = await this.supabase
                .from('user_alerts')
                .update({ is_read: true })
                .in('id', unreadIds);
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Todas las alertas marcadas como leídas');
            
            await this.dashboard.loadInitialData();
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al marcar alertas');
        }
    }

    /**
     * Ver detalles del estudiante
     */
    async viewStudent(userId) {
        // Cambiar a la página de estudiantes con el usuario seleccionado
        await this.dashboard.showPage('students');
        
        // Buscar y resaltar al estudiante
        setTimeout(() => {
            const row = document.querySelector(`tr[data-student-id="${userId}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.backgroundColor = '#fef3c7';
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 3000);
            }
        }, 500);
    }

    /**
     * Exportar alertas
     */
    async exportAlerts() {
        const exportsModule = await this.dashboard.loadModule('exports');
        
        const alertsData = this.dashboard.data.alerts.map(alert => {
            const user = this.dashboard.data.students.find(s => s.id === alert.user_id);
            return {
                Fecha: new Date(alert.created_at).toLocaleString('es-ES'),
                Estudiante: user?.username || 'N/A',
                Email: user?.email || 'N/A',
                Tipo: alert.alert_type,
                Mensaje: alert.message,
                Estado: alert.is_read ? 'Leída' : 'Sin leer',
                Simulacro: alert.simulation_id ? `RF${this.getSimulationWeek(alert.simulation_id)}` : 'N/A'
            };
        });
        
        const csv = exportsModule.objectsToCSV(alertsData);
        exportsModule.downloadCSV(csv, `alertas_${exportsModule.getTimestamp()}.csv`);
    }

    // Utilidades
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // diferencia en segundos
        
        if (diff < 60) return 'hace unos segundos';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
        if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
        
        return date.toLocaleDateString('es-ES');
    }

    getSimulationWeek(simulationId) {
        const sim = this.dashboard.data.simulations.find(s => s.id === simulationId);
        return sim ? sim.week_number : '?';
    }
}