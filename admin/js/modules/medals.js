// admin/js/modules/medals.js
export default class MedalsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.medalDefinitions = {
            'first_place': {
                name: 'Primer Lugar',
                icon: '🥇',
                description: 'Terminar en primer lugar en un simulacro',
                points: 100
            },
            'top_3': {
                name: 'Podio',
                icon: '🏆',
                description: 'Terminar en el top 3',
                points: 50
            },
            'perfect_score': {
                name: 'Puntuación Perfecta',
                icon: '💯',
                description: 'Obtener 10/10 en un simulacro',
                points: 75
            },
            'streak_5': {
                name: 'Racha de 5',
                icon: '🔥',
                description: 'Participar 5 semanas consecutivas',
                points: 50
            },
            'streak_10': {
                name: 'Racha de 10',
                icon: '💎',
                description: 'Participar 10 semanas consecutivas',
                points: 100
            },
            'early_bird': {
                name: 'Madrugador',
                icon: '🌅',
                description: 'Enviar resultados en las primeras 2 horas',
                points: 25
            },
            'comeback': {
                name: 'Gran Remontada',
                icon: '🚀',
                description: 'Mejorar más de 2 puntos entre simulacros',
                points: 50
            },
            'consistency': {
                name: 'Constancia',
                icon: '⭐',
                description: 'Mantener promedio >7 por 5 simulacros',
                points: 75
            }
        };
    }

    async render(container) {
        // Cargar todas las medallas
        const { data: medals } = await this.supabase
            .from('user_medals')
            .select(`
                *,
                users!inner(username, email, slug, cohort)
            `)
            .order('earned_at', { ascending: false });
        
        // Estadísticas de medallas
        const stats = this.calculateMedalStats(medals);
        
        container.innerHTML = `
            <div class="medals-page">
                <h2>🏅 Sistema de Medallas y Logros</h2>
                
                <!-- Estadísticas generales -->
                <div class="medals-stats">
                    <div class="stat-box">
                        <div class="stat-number">${medals?.length || 0}</div>
                        <div class="stat-label">Medallas Otorgadas</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.uniqueWinners}</div>
                        <div class="stat-label">Estudiantes con Medallas</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.mostCommonMedal}</div>
                        <div class="stat-label">Medalla Más Común</div>
                    </div>
                </div>
                
                <!-- Definiciones de medallas -->
                <div class="medals-definitions">
                    <h3>📋 Tipos de Medallas</h3>
                    <div class="medals-grid">
                        ${Object.entries(this.medalDefinitions).map(([key, medal]) => `
                            <div class="medal-definition">
                                <div class="medal-icon">${medal.icon}</div>
                                <div class="medal-info">
                                    <strong>${medal.name}</strong>
                                    <p>${medal.description}</p>
                                    <span class="medal-points">${medal.points} puntos</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Acciones -->
                <div class="medal-actions">
                    <button class="btn btn-primary" onclick="window.medalsModule.checkAndAwardMedals()">
                        🔄 Verificar y Otorgar Medallas Pendientes
                    </button>
                    <button class="btn btn-secondary" onclick="window.medalsModule.exportMedalsReport()">
                        📊 Exportar Reporte de Medallas
                    </button>
                </div>
                
                <!-- Hall of Fame -->
                <div class="hall-of-fame">
                    <h3>🌟 Hall of Fame - Top 10 Medallistas</h3>
                    <div class="fame-list">
                        ${this.renderHallOfFame(medals)}
                    </div>
                </div>
                
                <!-- Medallas recientes -->
                <div class="recent-medals">
                    <h3>🆕 Medallas Recientes</h3>
                    <div class="medals-list">
                        ${medals?.slice(0, 20).map(medal => this.renderMedalItem(medal)).join('') || 
                          '<p>No hay medallas otorgadas aún</p>'}
                    </div>
                </div>
            </div>
        `;
        
        window.medalsModule = this;
    }

    calculateMedalStats(medals) {
        if (!medals || medals.length === 0) {
            return {
                uniqueWinners: 0,
                mostCommonMedal: 'N/A',
                totalPoints: 0
            };
        }
        
        const uniqueUsers = new Set(medals.map(m => m.user_id));
        
        const medalCounts = medals.reduce((acc, medal) => {
            acc[medal.medal_type] = (acc[medal.medal_type] || 0) + 1;
            return acc;
        }, {});
        
        const mostCommon = Object.entries(medalCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        return {
            uniqueWinners: uniqueUsers.size,
            mostCommonMedal: mostCommon ? this.medalDefinitions[mostCommon[0]]?.name || mostCommon[0] : 'N/A',
            totalPoints: medals.reduce((sum, m) => 
                sum + (this.medalDefinitions[m.medal_type]?.points || 0), 0)
        };
    }

    renderHallOfFame(medals) {
        if (!medals || medals.length === 0) return '<p>No hay medallistas aún</p>';
        
        // Agrupar por usuario y contar
        const userMedals = {};
        medals.forEach(medal => {
            const userId = medal.user_id;
            if (!userMedals[userId]) {
                userMedals[userId] = {
                    user: medal.users,
                    medals: [],
                    totalPoints: 0
                };
            }
            userMedals[userId].medals.push(medal);
            userMedals[userId].totalPoints += this.medalDefinitions[medal.medal_type]?.points || 0;
        });
        
        // Ordenar por puntos totales
        const topUsers = Object.values(userMedals)
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, 10);
        
        return topUsers.map((data, index) => `
            <div class="fame-item">
                <div class="fame-rank">${index + 1}</div>
                <div class="fame-user">
                    <strong>${data.user.username}</strong>
                    <span class="badge badge-info">${data.user.cohort}</span>
                </div>
                <div class="fame-medals">
                    ${this.groupMedalsByType(data.medals).map(group => 
                        `<span class="medal-group">
                            ${this.medalDefinitions[group.type]?.icon || '🏅'} 
                            ${group.count > 1 ? `×${group.count}` : ''}
                        </span>`
                    ).join('')}
                </div>
                <div class="fame-points">
                    <strong>${data.totalPoints}</strong> pts
                </div>
            </div>
        `).join('');
    }

    groupMedalsByType(medals) {
        const grouped = medals.reduce((acc, medal) => {
            acc[medal.medal_type] = (acc[medal.medal_type] || 0) + 1;
            return acc;
        }, {});
        
        return Object.entries(grouped).map(([type, count]) => ({ type, count }));
    }

    renderMedalItem(medal) {
        const definition = this.medalDefinitions[medal.medal_type] || {
            name: medal.medal_type,
            icon: '🏅'
        };
        
        return `
            <div class="medal-item">
                <div class="medal-icon">${definition.icon}</div>
                <div class="medal-details">
                    <strong>${medal.users.username}</strong> ganó 
                    <em>${definition.name}</em>
                    <div class="medal-meta">
                        Semana ${medal.week_earned} • 
                        ${this.formatDate(medal.earned_at)}
                    </div>
                </div>
            </div>
        `;
    }

    async checkAndAwardMedals() {
        try {
            this.dashboard.showNotification('info', 'Verificando medallas pendientes...');
            
            const results = this.dashboard.data.results;
            const students = this.dashboard.data.students;
            const simulations = this.dashboard.data.simulations;
            
            const newMedals = [];
            
            // Verificar cada estudiante
            for (const student of students) {
                const studentResults = results.filter(r => r.user_id === student.id);
                const existingMedals = await this.getUserMedals(student.id);
                
                // Verificar cada tipo de medalla
                // 1. Primera posición
                for (const result of studentResults) {
                    if (result.position === 1 && !this.hasMedal(existingMedals, 'first_place', result.simulation_id)) {
                        const sim = simulations.find(s => s.id === result.simulation_id);
                        newMedals.push({
                            user_id: student.id,
                            medal_type: 'first_place',
                            week_earned: sim?.week_number || 0,
                            metadata: { simulation_id: result.simulation_id, score: result.score }
                        });
                    }
                    
                    // Top 3
                    if (result.position <= 3 && !this.hasMedal(existingMedals, 'top_3', result.simulation_id)) {
                        const sim = simulations.find(s => s.id === result.simulation_id);
                        newMedals.push({
                            user_id: student.id,
                            medal_type: 'top_3',
                            week_earned: sim?.week_number || 0,
                            metadata: { simulation_id: result.simulation_id, position: result.position }
                        });
                    }
                    
                    // Puntuación perfecta
                    if (result.score === 10 && !this.hasMedal(existingMedals, 'perfect_score', result.simulation_id)) {
                        const sim = simulations.find(s => s.id === result.simulation_id);
                        newMedals.push({
                            user_id: student.id,
                            medal_type: 'perfect_score',
                            week_earned: sim?.week_number || 0,
                            metadata: { simulation_id: result.simulation_id }
                        });
                    }
                }
                
                // 2. Rachas
                if (student.current_streak >= 5 && !this.hasMedal(existingMedals, 'streak_5')) {
                    newMedals.push({
                        user_id: student.id,
                        medal_type: 'streak_5',
                        week_earned: this.getCurrentWeek(),
                        metadata: { streak: student.current_streak }
                    });
                }
                
                if (student.current_streak >= 10 && !this.hasMedal(existingMedals, 'streak_10')) {
                    newMedals.push({
                        user_id: student.id,
                        medal_type: 'streak_10',
                        week_earned: this.getCurrentWeek(),
                        metadata: { streak: student.current_streak }
                    });
                }
                
                // 3. Mejora significativa
                if (studentResults.length >= 2) {
                    const sorted = studentResults.sort((a, b) => 
                        new Date(b.submitted_at) - new Date(a.submitted_at));
                    
                    for (let i = 0; i < sorted.length - 1; i++) {
                        const improvement = sorted[i].score - sorted[i + 1].score;
                        if (improvement >= 2 && !this.hasMedal(existingMedals, 'comeback', sorted[i].simulation_id)) {
                            const sim = simulations.find(s => s.id === sorted[i].simulation_id);
                            newMedals.push({
                                user_id: student.id,
                                medal_type: 'comeback',
                                week_earned: sim?.week_number || 0,
                                metadata: { 
                                    improvement: improvement,
                                    from: sorted[i + 1].score,
                                    to: sorted[i].score
                                }
                            });
                        }
                    }
                }
            }
            
            // Insertar nuevas medallas
            if (newMedals.length > 0) {
                const { error } = await this.supabase
                    .from('user_medals')
                    .insert(newMedals);
                
                if (error) throw error;
                
                this.dashboard.showNotification('success', 
                    `${newMedals.length} nuevas medallas otorgadas`);
                
                // Crear alertas para las medallas
                await this.createMedalAlerts(newMedals);
                
                // Recargar página
                await this.dashboard.refreshCurrentPage();
            } else {
                this.dashboard.showNotification('info', 'No hay medallas pendientes por otorgar');
            }
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al verificar medallas: ' + error.message);
        }
    }

    async getUserMedals(userId) {
        const { data } = await this.supabase
            .from('user_medals')
            .select('*')
            .eq('user_id', userId);
        
        return data || [];
    }

    hasMedal(existingMedals, medalType, simulationId = null) {
        return existingMedals.some(m => {
            if (m.medal_type !== medalType) return false;
            if (simulationId && m.metadata?.simulation_id) {
                return m.metadata.simulation_id === simulationId;
            }
            return true;
        });
    }

    async createMedalAlerts(newMedals) {
        const alerts = newMedals.map(medal => ({
            user_id: medal.user_id,
            alert_type: 'medal_earned',
            message: `¡Felicidades! Has ganado la medalla "${this.medalDefinitions[medal.medal_type]?.name}"`,
            simulation_id: medal.metadata?.simulation_id || null
        }));
        
        if (alerts.length > 0) {
            await this.supabase.from('user_alerts').insert(alerts);
        }
    }

    async exportMedalsReport() {
        const exportsModule = await this.dashboard.loadModule('exports');
        
        // Obtener todas las medallas con información de usuarios
        const { data: medals } = await this.supabase
            .from('user_medals')
            .select(`
                *,
                users!inner(username, email, slug, cohort)
            `)
            .order('earned_at', { ascending: false });
        
        const reportData = medals.map(medal => ({
            Fecha: this.formatDate(medal.earned_at),
            Estudiante: medal.users.username,
            Email: medal.users.email,
            Cohorte: medal.users.cohort,
            Medalla: this.medalDefinitions[medal.medal_type]?.name || medal.medal_type,
            Semana: medal.week_earned,
            Puntos: this.medalDefinitions[medal.medal_type]?.points || 0,
            Detalles: JSON.stringify(medal.metadata || {})
        }));
        
        const csv = exportsModule.objectsToCSV(reportData);
        exportsModule.downloadCSV(csv, `reporte_medallas_${exportsModule.getTimestamp()}.csv`);
    }

    getCurrentWeek() {
        // Obtener la semana actual basada en los simulacros
        const active = this.dashboard.data.simulations.find(s => s.status === 'active');
        return active?.week_number || 1;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}