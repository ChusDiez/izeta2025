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

// /admin/js/modules/medals.js
async render(container) {
    try {
        // Mostrar un indicador de carga mientras obtenemos los datos
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p style="margin-top: 1rem;">Cargando sistema de medallas...</p>
            </div>
        `;
        
        // Intentar cargar las medallas con manejo de errores
        let medals = [];
        let medalsError = null;
        
        try {
            const { data, error } = await this.supabase
                .from('user_medals')
                .select(`
                    *,
                    users!inner(username, email, slug, cohort)
                `)
                .order('earned_at', { ascending: false });
            
            if (error) {
                medalsError = error;
                console.error('Error cargando medallas:', error);
            } else {
                medals = data || [];
            }
        } catch (err) {
            medalsError = err;
            console.error('Error crítico al cargar medallas:', err);
        }
        
        // Calcular estadísticas incluso si hay pocos datos
        const stats = this.calculateMedalStats(medals);
        
        // Renderizar la página con los datos disponibles
        container.innerHTML = `
            <div class="medals-page">
                <h2>🏅 Sistema de Medallas y Logros</h2>
                
                ${medalsError ? `
                    <div class="alert alert-warning" style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                        <strong>⚠️ Aviso:</strong> Hubo un problema al cargar algunas medallas. 
                        Mostrando información disponible.
                    </div>
                ` : ''}
                
                <!-- Estadísticas generales -->
                <div class="medals-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0;">
                    <div class="stat-box">
                        <div class="stat-icon" style="font-size: 2rem;">🏅</div>
                        <div class="stat-number">${medals.length}</div>
                        <div class="stat-label">Medallas Otorgadas</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-icon" style="font-size: 2rem;">👥</div>
                        <div class="stat-number">${stats.uniqueWinners}</div>
                        <div class="stat-label">Estudiantes con Medallas</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-icon" style="font-size: 2rem;">⭐</div>
                        <div class="stat-number">${stats.mostCommonMedal}</div>
                        <div class="stat-label">Medalla Más Común</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-icon" style="font-size: 2rem;">💯</div>
                        <div class="stat-number">${stats.totalPoints}</div>
                        <div class="stat-label">Puntos Totales</div>
                    </div>
                </div>
                
                <!-- Definiciones de medallas -->
                <div class="medals-definitions">
                    <h3>📋 Tipos de Medallas</h3>
                    <div class="medals-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 1rem 0;">
                        ${Object.entries(this.medalDefinitions).map(([key, medal]) => `
                            <div class="medal-definition" style="background: #f9fafb; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem;">
                                <div class="medal-icon" style="font-size: 2.5rem;">${medal.icon}</div>
                                <div class="medal-info" style="flex: 1;">
                                    <strong style="display: block; margin-bottom: 0.25rem;">${medal.name}</strong>
                                    <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">${medal.description}</p>
                                    <span class="medal-points" style="color: #10b981; font-weight: 600;">${medal.points} puntos</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Acciones -->
                <div class="medal-actions" style="margin: 2rem 0; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="window.medalsModule.checkAndAwardMedalsWithFeedback()">
                        🔄 Verificar y Otorgar Medallas Pendientes
                    </button>
                    <button class="btn btn-secondary" onclick="window.medalsModule.exportMedalsReport()">
                        📊 Exportar Reporte de Medallas
                    </button>
                </div>
                
                <!-- Hall of Fame -->
                <div class="hall-of-fame table-card">
                    <div class="table-header">
                        <h3>🌟 Hall of Fame - Top 10 Medallistas</h3>
                    </div>
                    <div class="fame-list" style="padding: 1rem;">
                        ${medals.length > 0 ? 
                            this.renderHallOfFame(medals) : 
                            '<p style="text-align: center; color: #6b7280;">No hay medallistas aún. ¡Sé el primero en ganar una medalla!</p>'
                        }
                    </div>
                </div>
                
                <!-- Medallas recientes -->
                <div class="recent-medals table-card" style="margin-top: 2rem;">
                    <div class="table-header">
                        <h3>🆕 Medallas Recientes</h3>
                    </div>
                    <div class="medals-list" style="padding: 1rem;">
                        ${medals.length > 0 ? 
                            medals.slice(0, 20).map(medal => this.renderMedalItem(medal)).join('') : 
                            '<p style="text-align: center; color: #6b7280;">No hay medallas otorgadas aún. Completa los desafíos para ganar medallas.</p>'
                        }
                    </div>
                </div>
            </div>
        `;
        
        // Guardar referencia global para eventos
        window.medalsModule = this;
        
        // Log de éxito
        console.log(`Módulo de medallas cargado: ${medals.length} medallas encontradas`);
        
    } catch (error) {
        console.error('Error crítico en módulo de medallas:', error);
        
        // Mostrar un mensaje de error amigable con opciones
        container.innerHTML = `
            <div class="error-container" style="background: #fee2e2; border: 1px solid #dc2626; padding: 2rem; border-radius: 8px; margin: 2rem auto; max-width: 600px;">
                <h3 style="color: #991b1b; margin-bottom: 1rem;">❌ Error al cargar el módulo de medallas</h3>
                <p style="margin-bottom: 1rem;">No se pudo cargar el sistema de medallas. Esto puede deberse a:</p>
                <ul style="margin-left: 1.5rem; margin-bottom: 1.5rem;">
                    <li>Problemas de conexión con la base de datos</li>
                    <li>Permisos insuficientes</li>
                    <li>Error temporal del servidor</li>
                </ul>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="window.dashboardAdmin.refreshData()">
                        🔄 Reintentar
                    </button>
                    <button class="btn btn-secondary" onclick="window.dashboardAdmin.showPage('overview')">
                        🏠 Volver al inicio
                    </button>
                </div>
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: #6b7280;">Detalles técnicos</summary>
                    <pre style="margin-top: 0.5rem; padding: 0.5rem; background: #f3f4f6; border-radius: 4px; font-size: 0.75rem; overflow-x: auto;">
${error.message}
${error.stack || 'No hay información adicional de stack trace'}
                    </pre>
                </details>
            </div>
        `;
    }
}

// Agregar este método mejorado también
async checkAndAwardMedalsWithFeedback() {
    try {
        // Deshabilitar el botón temporalmente para evitar múltiples clics
        const button = event.target;
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '⏳ Procesando...';
        
        // Llamar al método original
        await this.checkAndAwardMedals();
        
        // Restaurar el botón
        button.disabled = false;
        button.innerHTML = originalText;
        
    } catch (error) {
        console.error('Error al verificar medallas:', error);
        this.dashboard.showNotification('error', 'Error al procesar medallas. Por favor, intenta de nuevo.');
        
        // Restaurar el botón en caso de error
        if (event && event.target) {
            event.target.disabled = false;
            event.target.innerHTML = '🔄 Verificar y Otorgar Medallas Pendientes';
        }
    }
}

// Mejorar también el método calculateMedalStats para manejar casos edge
calculateMedalStats(medals) {
    // Validar entrada
    if (!medals || !Array.isArray(medals) || medals.length === 0) {
        return {
            uniqueWinners: 0,
            mostCommonMedal: 'Ninguna aún',
            totalPoints: 0
        };
    }
    
    try {
        // Calcular usuarios únicos
        const uniqueUsers = new Set(medals.map(m => m.user_id));
        
        // Contar medallas por tipo
        const medalCounts = medals.reduce((acc, medal) => {
            if (medal.medal_type) {
                acc[medal.medal_type] = (acc[medal.medal_type] || 0) + 1;
            }
            return acc;
        }, {});
        
        // Encontrar la más común
        const mostCommon = Object.entries(medalCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        // Calcular puntos totales
        const totalPoints = medals.reduce((sum, medal) => {
            const points = this.medalDefinitions[medal.medal_type]?.points || 0;
            return sum + points;
        }, 0);
        
        return {
            uniqueWinners: uniqueUsers.size,
            mostCommonMedal: mostCommon ? 
                (this.medalDefinitions[mostCommon[0]]?.name || mostCommon[0]) : 
                'Ninguna aún',
            totalPoints: totalPoints
        };
        
    } catch (error) {
        console.error('Error calculando estadísticas de medallas:', error);
        return {
            uniqueWinners: 0,
            mostCommonMedal: 'Error al calcular',
            totalPoints: 0
        };
    }
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
            
            // Primero, obtener los tipos de medallas válidos desde la base de datos
            const validMedalTypes = await this.getValidMedalTypes();
            console.log('Tipos de medallas válidos:', validMedalTypes);
            
            const results = this.dashboard.data.results;
            const students = this.dashboard.data.students;
            const simulations = this.dashboard.data.simulations;
            
            const newMedals = [];
            
            // Verificar cada estudiante
            for (const student of students) {
                const studentResults = results.filter(r => r.user_id === student.id);
                const existingMedals = await this.getUserMedals(student.id);
                
                // Verificar cada tipo de medalla (solo los válidos)
                // 1. Primera posición
                for (const result of studentResults) {
                    if (validMedalTypes.includes('first_place') && result.position === 1 && !this.hasMedal(existingMedals, 'first_place', result.simulation_id)) {
                        const sim = simulations.find(s => s.id === result.simulation_id);
                        newMedals.push({
                            user_id: student.id,
                            medal_type: 'first_place',
                            week_earned: sim?.week_number || 0,
                            metadata: { simulation_id: result.simulation_id, score: result.score }
                        });
                    }
                    
                    // Top 3
                    if (validMedalTypes.includes('top_3') && result.position <= 3 && !this.hasMedal(existingMedals, 'top_3', result.simulation_id)) {
                        const sim = simulations.find(s => s.id === result.simulation_id);
                        newMedals.push({
                            user_id: student.id,
                            medal_type: 'top_3',
                            week_earned: sim?.week_number || 0,
                            metadata: { simulation_id: result.simulation_id, position: result.position }
                        });
                    }
                    
                    // Puntuación perfecta
                    if (validMedalTypes.includes('perfect_score') && result.score === 10 && !this.hasMedal(existingMedals, 'perfect_score', result.simulation_id)) {
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
                if (validMedalTypes.includes('streak_5') && student.current_streak >= 5 && !this.hasMedal(existingMedals, 'streak_5')) {
                    newMedals.push({
                        user_id: student.id,
                        medal_type: 'streak_5',
                        week_earned: this.getCurrentWeek(),
                        metadata: { streak: student.current_streak }
                    });
                }
                
                if (validMedalTypes.includes('streak_10') && student.current_streak >= 10 && !this.hasMedal(existingMedals, 'streak_10')) {
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
                        if (validMedalTypes.includes('comeback') && improvement >= 2 && !this.hasMedal(existingMedals, 'comeback', sorted[i].simulation_id)) {
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
            
            // Filtrar solo las medallas con tipos válidos
            const validMedals = newMedals.filter(medal => 
                validMedalTypes.includes(medal.medal_type)
            );
            
            const invalidCount = newMedals.length - validMedals.length;
            if (invalidCount > 0) {
                console.warn(`Se ignoraron ${invalidCount} medallas con tipos no válidos`);
            }
            
            // Insertar nuevas medallas válidas
            if (validMedals.length > 0) {
                const { error } = await this.supabase
                    .from('user_medals')
                    .insert(validMedals);
                
                if (error) throw error;
                
                this.dashboard.showNotification('success', 
                    `${validMedals.length} nuevas medallas otorgadas`);
                
                // Crear alertas para las medallas
                await this.createMedalAlerts(validMedals);
                
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

    async getValidMedalTypes() {
        try {
            // Intentar obtener una medalla de cada tipo para ver cuáles son válidos
            const testTypes = ['first_place', 'top_3', 'perfect_score', 'streak_5', 'streak_10', 'early_bird', 'comeback', 'consistency'];
            const validTypes = [];
            
            // Obtener cualquier medalla existente para ver qué tipos son válidos
            const { data: existingMedals } = await this.supabase
                .from('user_medals')
                .select('medal_type')
                .limit(100);
            
            if (existingMedals && existingMedals.length > 0) {
                // Si hay medallas existentes, usar esos tipos como referencia
                const uniqueTypes = [...new Set(existingMedals.map(m => m.medal_type))];
                console.log('Tipos encontrados en la base de datos:', uniqueTypes);
                return uniqueTypes;
            }
            
            // Si no hay medallas, intentar con los tipos básicos más comunes
            // Estos son los tipos más probables de estar en el constraint
            return ['first_place', 'top_3', 'perfect_score'];
            
        } catch (error) {
            console.error('Error obteniendo tipos de medallas válidos:', error);
            // Por defecto, usar solo los tipos más básicos
            return ['first_place', 'top_3', 'perfect_score'];
        }
    }
}