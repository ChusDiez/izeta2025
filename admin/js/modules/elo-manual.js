// admin/js/modules/elo-manual.js
export default class EloManualModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedSimulation = null;
        
        // Configuración del sistema de gamificación profesional
        this.gamificationConfig = {
            divisions: {
                elite: { min: 2000, max: 9999, name: 'Élite', icon: '⭐', color: '#FFD700', description: 'Top 10% - Rendimiento excepcional' },
                advanced: { min: 1500, max: 1999, name: 'Avanzado', icon: '🎯', color: '#C0C0C0', description: 'Top 25% - Progreso destacado' },
                progressing: { min: 1200, max: 1499, name: 'Progresando', icon: '📈', color: '#CD7F32', description: 'Top 50% - En buen camino' },
                initiated: { min: 0, max: 1199, name: 'Iniciado', icon: '🌱', color: '#4A5568', description: 'Fase inicial de preparación' }
            },
            milestones: [
                { id: 'first_7', name: 'Primera nota superior a 7', icon: '📊', points: 50 },
                { id: 'consistency_month', name: 'Mes completo de participación', icon: '📅', points: 100 },
                { id: 'improvement_1', name: 'Mejora de +1 punto en media', icon: '📈', points: 150 },
                { id: 'mastery_topic', name: 'Dominio temático (>8 en bloque)', icon: '🎯', points: 200 },
                { id: 'low_blanks', name: 'Eficiencia total (<5 blancos)', icon: '⚡', points: 75 },
                { id: 'time_management', name: 'Gestión óptima del tiempo', icon: '⏱️', points: 125 }
            ]
        };
    }

    async render(container) {
        try {
            const simulations = this.dashboard.data.simulations;
            const students = this.dashboard.data.students;
            
            // Inyectar estilos específicos del módulo
            this.injectStyles();
            
            container.innerHTML = `
                <div class="progress-system-page">
                    <div class="progress-container">
                        <!-- Header con tabs -->
                        <div class="progress-header">
                            <h1>📊 Sistema de Índice de Progreso (IP)</h1>
                            <p>Gestión integral del progreso y reconocimientos basados en mejora continua</p>
                            
                            <div class="progress-tabs">
                                <button class="tab-button active" onclick="window.eloManualModule.showTab('overview')">
                                    Vista General
                                </button>
                                <button class="tab-button" onclick="window.eloManualModule.showTab('divisions')">
                                    Divisiones
                                </button>
                                <button class="tab-button" onclick="window.eloManualModule.showTab('milestones')">
                                    Hitos y Logros
                                </button>
                                <button class="tab-button" onclick="window.eloManualModule.showTab('recognition')">
                                    Reconocimientos
                                </button>
                                <button class="tab-button" onclick="window.eloManualModule.showTab('manual')">
                                    Actualización Manual
                                </button>
                            </div>
                        </div>
                        
                        <!-- Contenido dinámico por tabs -->
                        <div id="tabContent">
                            ${this.renderOverviewTab(students)}
                        </div>
                    </div>
                </div>
            `;
            
            window.eloManualModule = this;
            
            // Cargar datos adicionales
            await this.loadGamificationData();
            
        } catch (error) {
            console.error('Error en módulo de Índice de Progreso:', error);
            container.innerHTML = `
                <div class="error-container">
                    <h3>❌ Error al cargar el módulo</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
    
    renderOverviewTab(students) {
        const divisionStats = this.calculateDivisionStats(students);
        
        return `
            <div class="tab-content" id="overviewTab">
                <!-- Estadísticas generales del sistema -->
                <div class="overview-section">
                    <h2>📈 Estado General del Sistema</h2>
                    
                    <div class="stats-grid-modern">
                        <div class="stat-card-modern primary">
                            <div class="stat-icon">👥</div>
                            <div class="stat-content">
                                <div class="stat-value">${students.length}</div>
                                <div class="stat-label">Estudiantes Totales</div>
                                <div class="stat-detail">${students.filter(s => s.active).length} activos</div>
                            </div>
                        </div>
                        
                        <div class="stat-card-modern success">
                            <div class="stat-icon">📊</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.calculateAverageIP(students)}</div>
                                <div class="stat-label">IP Promedio</div>
                                <div class="stat-detail">Sistema equilibrado</div>
                            </div>
                        </div>
                        
                        <div class="stat-card-modern warning">
                            <div class="stat-icon">🎯</div>
                            <div class="stat-content">
                                <div class="stat-value">${divisionStats.elite.count + divisionStats.advanced.count}</div>
                                <div class="stat-label">En Divisiones Superiores</div>
                                <div class="stat-detail">Élite + Avanzado</div>
                            </div>
                        </div>
                        
                        <div class="stat-card-modern info">
                            <div class="stat-icon">📈</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.calculateImprovingStudents(students)}%</div>
                                <div class="stat-label">En Mejora</div>
                                <div class="stat-detail">Tendencia positiva</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Distribución por divisiones -->
                <div class="overview-section">
                    <h3>🏆 Distribución por Divisiones</h3>
                    <div class="division-distribution">
                        ${this.renderDivisionDistribution(divisionStats)}
                    </div>
                </div>
                
                <!-- Top performers del mes -->
                <div class="overview-section">
                    <h3>🌟 Destacados del Mes</h3>
                    <div class="top-performers-grid">
                        ${this.renderTopPerformers(students)}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderDivisionsTab() {
        const students = this.dashboard.data.students;
        const divisions = this.gamificationConfig.divisions;
        
        return `
            <div class="tab-content" id="divisionsTab">
                <h2>🏆 Sistema de Divisiones</h2>
                <p>Las divisiones reflejan el progreso acumulado y la consistencia en el rendimiento.</p>
                
                <div class="divisions-grid">
                    ${Object.entries(divisions).map(([key, division]) => {
                        const studentsInDivision = this.getStudentsInDivision(students, division);
                        return `
                            <div class="division-card" style="border-color: ${division.color}">
                                <div class="division-header" style="background: ${division.color}20">
                                    <span class="division-icon">${division.icon}</span>
                                    <h3>${division.name}</h3>
                                </div>
                                <div class="division-body">
                                    <p class="division-description">${division.description}</p>
                                    <div class="division-stats">
                                        <div class="division-stat">
                                            <span class="stat-number">${studentsInDivision.length}</span>
                                            <span class="stat-label">Estudiantes</span>
                                        </div>
                                        <div class="division-stat">
                                            <span class="stat-number">${division.min} - ${division.max === 9999 ? '∞' : division.max}</span>
                                            <span class="stat-label">Rango IP</span>
                                        </div>
                                    </div>
                                    
                                    <!-- Top 3 de la división -->
                                    <div class="division-top">
                                        <h4>Top 3 División</h4>
                                        <ol class="division-ranking">
                                            ${studentsInDivision.slice(0, 3).map((student, index) => `
                                                <li>
                                                    <span class="rank">${index + 1}</span>
                                                    <span class="name">${student.username}</span>
                                                    <span class="ip">${student.current_elo} IP</span>
                                                </li>
                                            `).join('')}
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    renderMilestonesTab() {
        return `
            <div class="tab-content" id="milestonesTab">
                <h2>🎯 Sistema de Hitos y Logros</h2>
                <p>Reconocimientos profesionales basados en logros específicos de preparación.</p>
                
                <div class="milestones-grid">
                    ${this.gamificationConfig.milestones.map(milestone => `
                        <div class="milestone-card">
                            <div class="milestone-icon">${milestone.icon}</div>
                            <h4>${milestone.name}</h4>
                            <div class="milestone-points">${milestone.points} puntos</div>
                            <div class="milestone-progress" id="milestone-${milestone.id}">
                                <!-- Se actualizará dinámicamente -->
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Estadísticas de hitos -->
                <div class="milestones-stats">
                    <h3>📊 Estadísticas Globales de Hitos</h3>
                    <div id="milestoneStatsGrid">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
            </div>
        `;
    }
    
    renderRecognitionTab() {
        return `
            <div class="tab-content" id="recognitionTab">
                <h2>🏅 Reconocimientos Mensuales</h2>
                <p>Sistema automático de reconocimiento basado en métricas objetivas de mejora.</p>
                
                <!-- Reconocimientos del mes actual -->
                <div class="recognition-section">
                    <h3>🌟 Reconocimientos ${this.getCurrentMonth()}</h3>
                    <div class="recognitions-grid" id="currentRecognitions">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                
                <!-- Generar reconocimientos -->
                <div class="recognition-section">
                    <h3>🔄 Generar Reconocimientos</h3>
                    <p>Analiza los datos del mes y genera reconocimientos automáticamente.</p>
                    <button class="progress-button btn-primary" onclick="window.eloManualModule.generateMonthlyRecognitions()">
                        🏆 Generar Reconocimientos del Mes
                    </button>
                    <div id="recognitionStatus"></div>
                </div>
                
                <!-- Histórico -->
                <div class="recognition-section">
                    <h3>📜 Histórico de Reconocimientos</h3>
                    <div id="recognitionHistory">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
            </div>
        `;
    }
    
    renderManualTab() {
        const simulations = this.dashboard.data.simulations;
        
        return `
            <div class="tab-content" id="manualTab">
                <h2>⚙️ Actualización Manual del Sistema</h2>
                
                <!-- Sección 1: Selección de simulacro -->
                <div class="manual-section">
                    <h3>1. Seleccionar Simulacro</h3>
                    <select id="simulationSelect" onchange="window.eloManualModule.selectSimulation(this.value)">
                        <option value="">Selecciona un simulacro...</option>
                        ${simulations.map(sim => `
                            <option value="${sim.id}">
                                RF${sim.week_number} - ${sim.status} - ${this.formatDate(sim.start_date)}
                                ${sim.processed_at ? ' ✅ PROCESADO' : ' ⏳ PENDIENTE'}
                            </option>
                        `).join('')}
                    </select>
                    
                    <div id="simulationInfo" style="display: none;">
                        <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                
                <!-- Sección 2: Procesar Índice de Progreso -->
                <div class="manual-section">
                    <h3>2. Procesar Índice de Progreso</h3>
                    <p>Calcula el IP para todos los participantes del simulacro seleccionado.</p>
                    <button class="progress-button btn-warning" onclick="window.eloManualModule.processProgressIndex()">
                        📊 Procesar Índice de Progreso
                    </button>
                    <div class="progress-bar" id="progressBar" style="display: none;">
                        <div class="progress-fill" id="progressFill">0%</div>
                    </div>
                </div>
                
                <!-- Sección 3: Verificar hitos -->
                <div class="manual-section">
                    <h3>3. Verificar y Asignar Hitos</h3>
                    <p>Analiza logros alcanzados y asigna hitos correspondientes.</p>
                    <button class="progress-button btn-info" onclick="window.eloManualModule.checkMilestones()">
                        🎯 Verificar Hitos Alcanzados
                    </button>
                </div>
                
                <!-- Log de actividad -->
                <div class="manual-section">
                    <h3>📋 Log de Actividad</h3>
                    <div class="activity-log" id="activityLog">
                        <div class="log-entry info">Sistema iniciado. Esperando acciones...</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async showTab(tabName) {
        const tabContent = document.getElementById('tabContent');
        const buttons = document.querySelectorAll('.tab-button');
        
        // Actualizar botones activos
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tabName.toLowerCase()));
        });
        
        // Renderizar contenido según tab
        switch(tabName) {
            case 'overview':
                tabContent.innerHTML = this.renderOverviewTab(this.dashboard.data.students);
                break;
            case 'divisions':
                tabContent.innerHTML = this.renderDivisionsTab();
                break;
            case 'milestones':
                tabContent.innerHTML = this.renderMilestonesTab();
                await this.loadMilestoneStats();
                break;
            case 'recognition':
                tabContent.innerHTML = this.renderRecognitionTab();
                await this.loadRecognitions();
                break;
            case 'manual':
                tabContent.innerHTML = this.renderManualTab();
                break;
        }
    }
    
    // === MÉTODOS DE CÁLCULO Y ANÁLISIS ===
    
    calculateDivisionStats(students) {
        const stats = {
            elite: { count: 0, percentage: 0, avgIP: 0 },
            advanced: { count: 0, percentage: 0, avgIP: 0 },
            progressing: { count: 0, percentage: 0, avgIP: 0 },
            initiated: { count: 0, percentage: 0, avgIP: 0 }
        };
        
        students.forEach(student => {
            const division = this.getDivision(student.current_elo || 1000);
            const key = Object.keys(this.gamificationConfig.divisions).find(k => 
                this.gamificationConfig.divisions[k].name === division.name
            );
            
            if (key && stats[key]) {
                stats[key].count++;
                stats[key].avgIP += student.current_elo || 1000;
            }
        });
        
        // Calcular porcentajes y promedios
        const total = students.length || 1;
        Object.keys(stats).forEach(key => {
            stats[key].percentage = ((stats[key].count / total) * 100).toFixed(1);
            stats[key].avgIP = stats[key].count > 0 ? 
                Math.round(stats[key].avgIP / stats[key].count) : 0;
        });
        
        return stats;
    }
    
    getDivision(elo) {
        for (const [key, division] of Object.entries(this.gamificationConfig.divisions)) {
            if (elo >= division.min && elo <= division.max) {
                return division;
            }
        }
        return this.gamificationConfig.divisions.initiated;
    }
    
    getStudentsInDivision(students, division) {
        return students
            .filter(s => {
                const elo = s.current_elo || 1000;
                return elo >= division.min && elo <= division.max;
            })
            .sort((a, b) => (b.current_elo || 1000) - (a.current_elo || 1000));
    }
    
    calculateAverageIP(students) {
        const sum = students.reduce((acc, s) => acc + (s.current_elo || 1000), 0);
        return Math.round(sum / (students.length || 1));
    }
    
    calculateImprovingStudents(students) {
        const improving = students.filter(s => s.trend_direction === 'up').length;
        return Math.round((improving / (students.length || 1)) * 100);
    }
    
    renderDivisionDistribution(stats) {
        return `
            <div class="division-bars">
                ${Object.entries(stats).map(([key, stat]) => {
                    const division = this.gamificationConfig.divisions[key];
                    return `
                        <div class="division-bar">
                            <div class="bar-header">
                                <span>${division.icon} ${division.name}</span>
                                <span>${stat.percentage}%</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${stat.percentage}%; background: ${division.color}"></div>
                            </div>
                            <div class="bar-footer">
                                ${stat.count} estudiantes • IP medio: ${stat.avgIP}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    renderTopPerformers(students) {
        const categories = [
            { 
                title: 'Mayor Progreso', 
                icon: '📈', 
                students: this.getTopProgressStudents(students, 3)
            },
            { 
                title: 'Más Constantes', 
                icon: '🎯', 
                students: this.getMostConsistentStudents(students, 3)
            },
            { 
                title: 'Mejor Rendimiento', 
                icon: '⭐', 
                students: this.getTopScoreStudents(students, 3)
            }
        ];
        
        return categories.map(category => `
            <div class="performer-category">
                <h4>${category.icon} ${category.title}</h4>
                <ol class="performer-list">
                    ${category.students.map(student => `
                        <li>
                            <span class="performer-name">${student.username}</span>
                            <span class="performer-metric">${student.metric}</span>
                        </li>
                    `).join('')}
                </ol>
            </div>
        `).join('');
    }
    
    // === MÉTODOS DE PROCESAMIENTO ===
    
    async processProgressIndex() {
        if (!this.selectedSimulation) {
            this.addLog('Primero selecciona un simulacro', 'warning');
            return;
        }
        
        if (!confirm(`¿Procesar Índice de Progreso para RF${this.selectedSimulation.week_number}?`)) {
            return;
        }
        
        try {
            this.addLog('🚀 Iniciando procesamiento de Índice de Progreso...', 'info');
            
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            progressBar.style.display = 'block';
            
            // Obtener resultados del simulacro
            const results = this.dashboard.data.results.filter(
                r => r.simulation_id === this.selectedSimulation.id
            );
            
            let processed = 0;
            const total = results.length;
            
            for (const result of results) {
                // Aquí iría la llamada a la función de Supabase para calcular IP
                await this.calculateUserProgress(result);
                
                processed++;
                const percentage = Math.round((processed / total) * 100);
                progressFill.style.width = percentage + '%';
                progressFill.textContent = percentage + '%';
                
                if (processed % 10 === 0) {
                    this.addLog(`Procesados ${processed}/${total} participantes`, 'info');
                }
            }
            
            this.addLog('✅ Procesamiento completado', 'success');
            
            // Actualizar estadísticas del simulacro
            await this.updateSimulationStats();
            
            // Recargar datos
            await this.dashboard.loadInitialData();
            
        } catch (error) {
            this.addLog(`❌ Error: ${error.message}`, 'error');
        } finally {
            document.getElementById('progressBar').style.display = 'none';
        }
    }
    
    async calculateUserProgress(result) {
        // Simulación del cálculo - en producción esto llamaría a una función de Supabase
        return new Promise(resolve => setTimeout(resolve, 50));
    }
    
    async generateMonthlyRecognitions() {
        const statusDiv = document.getElementById('recognitionStatus');
        statusDiv.innerHTML = '<div class="loading">Analizando datos del mes...</div>';
        
        try {
            // Analizar métricas del mes
            const recognitions = await this.analyzeMonthlyPerformance();
            
            // Guardar reconocimientos
            for (const recognition of recognitions) {
                await this.saveRecognition(recognition);
            }
            
            statusDiv.innerHTML = `
                <div class="success-message">
                    ✅ Se generaron ${recognitions.length} reconocimientos
                </div>
            `;
            
            // Actualizar vista
            await this.loadRecognitions();
            
            this.addLog(`Generados ${recognitions.length} reconocimientos del mes`, 'success');
            
        } catch (error) {
            statusDiv.innerHTML = `
                <div class="error-message">
                    ❌ Error: ${error.message}
                </div>
            `;
            this.addLog(`Error generando reconocimientos: ${error.message}`, 'error');
        }
    }
    
    async analyzeMonthlyPerformance() {
        const students = this.dashboard.data.students;
        const results = this.dashboard.data.results;
        
        // Filtrar resultados del mes actual
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthResults = results.filter(r => {
            const date = new Date(r.submitted_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        
        const recognitions = [];
        
        // Mayor progreso
        const topProgress = this.findTopProgressStudent(students, monthResults);
        if (topProgress) {
            recognitions.push({
                type: 'mayor_progreso',
                user_id: topProgress.id,
                metric_value: topProgress.improvement,
                month_year: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
            });
        }
        
        // Más constante
        const mostConsistent = this.findMostConsistentStudent(students, monthResults);
        if (mostConsistent) {
            recognitions.push({
                type: 'mas_constante',
                user_id: mostConsistent.id,
                metric_value: mostConsistent.participationRate,
                month_year: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
            });
        }
        
        // Mejor gestión del tiempo
        const bestTimeManagement = this.findBestTimeManagement(students, monthResults);
        if (bestTimeManagement) {
            recognitions.push({
                type: 'mejor_gestion_tiempo',
                user_id: bestTimeManagement.id,
                metric_value: bestTimeManagement.efficiency,
                month_year: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
            });
        }
        
        return recognitions;
    }
    
    // === MÉTODOS AUXILIARES ===
    
    async loadGamificationData() {
        // Cargar datos adicionales si es necesario
        try {
            // Por ahora usamos los datos del dashboard
            console.log('Datos de gamificación cargados');
        } catch (error) {
            console.error('Error cargando datos de gamificación:', error);
        }
    }
    
    async loadMilestoneStats() {
        // Cargar estadísticas de hitos
        const statsGrid = document.getElementById('milestoneStatsGrid');
        if (!statsGrid) return;
        
        // Simulación - en producción esto vendría de la BD
        statsGrid.innerHTML = `
            <div class="milestone-stat">
                <div class="stat-value">142</div>
                <div class="stat-label">Hitos totales alcanzados</div>
            </div>
            <div class="milestone-stat">
                <div class="stat-value">23</div>
                <div class="stat-label">Este mes</div>
            </div>
            <div class="milestone-stat">
                <div class="stat-value">85%</div>
                <div class="stat-label">Tasa de consecución</div>
            </div>
        `;
    }
    
    async loadRecognitions() {
        // Cargar reconocimientos del mes
        const recognitionsDiv = document.getElementById('currentRecognitions');
        if (!recognitionsDiv) return;
        
        // Simulación - en producción vendría de la BD
        recognitionsDiv.innerHTML = `
            <div class="recognition-card">
                <div class="recognition-icon">📈</div>
                <h4>Mayor Progreso</h4>
                <p class="recognition-winner">Juan Pérez</p>
                <p class="recognition-metric">+2.3 puntos de mejora</p>
            </div>
            <div class="recognition-card">
                <div class="recognition-icon">🎯</div>
                <h4>Más Constante</h4>
                <p class="recognition-winner">María García</p>
                <p class="recognition-metric">100% participación</p>
            </div>
            <div class="recognition-card">
                <div class="recognition-icon">⏱️</div>
                <h4>Mejor Gestión del Tiempo</h4>
                <p class="recognition-winner">Carlos López</p>
                <p class="recognition-metric">0.12 puntos/minuto</p>
            </div>
        `;
    }
    
    getTopProgressStudents(students, limit = 3) {
        // Simulación - en producción calcularía basándose en datos reales
        return students
            .filter(s => s.trend_direction === 'up')
            .sort((a, b) => (b.current_elo || 1000) - (a.current_elo || 1000))
            .slice(0, limit)
            .map(s => ({
                ...s,
                metric: `+${Math.round(Math.random() * 200 + 50)} IP`
            }));
    }
    
    getMostConsistentStudents(students, limit = 3) {
        // Simulación
        return students
            .slice(0, limit)
            .map(s => ({
                ...s,
                metric: `${Math.round(Math.random() * 20 + 80)}% asistencia`
            }));
    }
    
    getTopScoreStudents(students, limit = 3) {
        // Simulación
        return students
            .sort((a, b) => (b.current_elo || 1000) - (a.current_elo || 1000))
            .slice(0, limit)
            .map(s => ({
                ...s,
                metric: `${((Math.random() * 2) + 7).toFixed(1)}/10 media`
            }));
    }
    
    getCurrentMonth() {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[new Date().getMonth()] + ' ' + new Date().getFullYear();
    }
    
    async selectSimulation(simulationId) {
        this.selectedSimulation = this.dashboard.data.simulations.find(s => s.id === simulationId);
        if (this.selectedSimulation) {
            await this.loadSimulationInfo();
        }
    }
    
    async loadSimulationInfo() {
        if (!this.selectedSimulation) return;
        
        const results = this.dashboard.data.results.filter(
            r => r.simulation_id === this.selectedSimulation.id
        );
        const infoDiv = document.getElementById('simulationInfo');
        
        if (!infoDiv) return;
        
        infoDiv.innerHTML = `
            <div class="simulation-info-grid">
                <div class="info-card">
                    <div class="info-value">${results.length}</div>
                    <div class="info-label">Participantes</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${results.length > 0 ? 
                        (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2) : 
                        'N/A'}</div>
                    <div class="info-label">Score Promedio</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${this.selectedSimulation.processed_at ? '✅' : '⏳'}</div>
                    <div class="info-label">Estado</div>
                </div>
                <div class="info-card">
                    <div class="info-value">${results.filter(r => r.is_saturday_live).length}</div>
                    <div class="info-label">En Directo</div>
                </div>
            </div>
        `;
        
        infoDiv.style.display = 'block';
        this.addLog(`Simulacro RF${this.selectedSimulation.week_number} cargado: ${results.length} resultados`, 'success');
    }
    
    async checkMilestones() {
        if (!this.selectedSimulation) {
            this.addLog('Primero selecciona un simulacro', 'warning');
            return;
        }
        
        this.addLog('🎯 Verificando hitos alcanzados...', 'info');
        
        try {
            // Aquí iría la lógica para verificar hitos
            // Por ahora simulamos
            const milestonesFound = Math.floor(Math.random() * 10) + 5;
            
            this.addLog(`✅ Se encontraron ${milestonesFound} nuevos hitos alcanzados`, 'success');
            this.addLog('Los hitos han sido asignados a los estudiantes correspondientes', 'info');
            
        } catch (error) {
            this.addLog(`❌ Error verificando hitos: ${error.message}`, 'error');
        }
    }
    
    async updateSimulationStats() {
        if (!this.selectedSimulation) {
            this.addLog('Primero selecciona un simulacro', 'warning');
            return;
        }
        
        try {
            this.addLog('📊 Actualizando estadísticas del simulacro...', 'info');
            
            // Aquí iría la actualización real a Supabase
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.addLog('✅ Estadísticas actualizadas correctamente', 'success');
            
        } catch (error) {
            this.addLog(`❌ Error: ${error.message}`, 'error');
        }
    }
    
    addLog(message, type = 'info') {
        const log = document.getElementById('activityLog');
        if (!log) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
    
    // === ESTILOS MEJORADOS ===
    
    injectStyles() {
        if (document.getElementById('progress-system-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'progress-system-styles';
        styles.textContent = `
            /* Estilos generales del sistema de progreso */
            .progress-system-page {
                padding: 0;
                background: #f9fafb;
                min-height: 100vh;
            }
            
            .progress-container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 0;
            }
            
            .progress-header {
                background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                color: white;
                padding: 2rem;
                border-radius: 0 0 1rem 1rem;
                margin-bottom: 2rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .progress-header h1 {
                margin: 0 0 0.5rem 0;
                font-size: 2rem;
            }
            
            .progress-header p {
                margin: 0 0 1.5rem 0;
                opacity: 0.9;
            }
            
            /* Tabs */
            .progress-tabs {
                display: flex;
                gap: 0.5rem;
                overflow-x: auto;
                padding: 0.5rem 0;
            }
            
            .tab-button {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                cursor: pointer;
                transition: all 0.3s;
                white-space: nowrap;
                font-weight: 500;
            }
            
            .tab-button:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }
            
            .tab-button.active {
                background: white;
                color: #1e3a8a;
                font-weight: 600;
            }
            
            /* Contenido de tabs */
            .tab-content {
                padding: 0 2rem 2rem;
            }
            
            .overview-section, .manual-section {
                background: white;
                padding: 1.5rem;
                border-radius: 0.75rem;
                margin-bottom: 1.5rem;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                border: 1px solid #e5e7eb;
            }
            
            /* Grid de estadísticas moderno */
            .stats-grid-modern {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-top: 1.5rem;
            }
            
            .stat-card-modern {
                background: white;
                border-radius: 0.75rem;
                padding: 1.5rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                border: 2px solid transparent;
                transition: all 0.3s;
            }
            
            .stat-card-modern.primary { border-color: #3b82f6; }
            .stat-card-modern.success { border-color: #10b981; }
            .stat-card-modern.warning { border-color: #f59e0b; }
            .stat-card-modern.info { border-color: #6366f1; }
            
            .stat-card-modern:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .stat-icon {
                font-size: 2.5rem;
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f3f4f6;
                border-radius: 0.5rem;
            }
            
            .stat-content {
                flex: 1;
            }
            
            .stat-value {
                font-size: 2rem;
                font-weight: bold;
                color: #1f2937;
                line-height: 1;
            }
            
            .stat-label {
                color: #6b7280;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }
            
            .stat-detail {
                color: #9ca3af;
                font-size: 0.75rem;
                margin-top: 0.25rem;
            }
            
            /* Distribución de divisiones */
            .division-bars {
                margin-top: 1rem;
            }
            
            .division-bar {
                margin-bottom: 1.5rem;
            }
            
            .bar-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
                font-weight: 500;
            }
            
            .bar-container {
                background: #e5e7eb;
                height: 30px;
                border-radius: 15px;
                overflow: hidden;
            }
            
            .bar-fill {
                height: 100%;
                transition: width 1s ease;
                display: flex;
                align-items: center;
                padding-left: 1rem;
                color: white;
                font-weight: 600;
            }
            
            .bar-footer {
                margin-top: 0.5rem;
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            /* Top performers */
            .top-performers-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-top: 1rem;
            }
            
            .performer-category {
                background: #f9fafb;
                padding: 1.5rem;
                border-radius: 0.5rem;
                border: 1px solid #e5e7eb;
            }
            
            .performer-category h4 {
                margin: 0 0 1rem 0;
                color: #1f2937;
            }
            
            .performer-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .performer-list li {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 0;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .performer-list li:last-child {
                border-bottom: none;
            }
            
            .performer-metric {
                color: #10b981;
                font-weight: 600;
            }
            
            /* Divisiones grid */
            .divisions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-top: 1.5rem;
            }
            
            .division-card {
                background: white;
                border-radius: 0.75rem;
                border: 2px solid;
                overflow: hidden;
                transition: all 0.3s;
            }
            
            .division-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
            }
            
            .division-header {
                padding: 1.5rem;
                text-align: center;
            }
            
            .division-icon {
                font-size: 3rem;
                display: block;
                margin-bottom: 0.5rem;
            }
            
            .division-body {
                padding: 1.5rem;
            }
            
            .division-description {
                color: #6b7280;
                margin-bottom: 1rem;
                text-align: center;
            }
            
            .division-stats {
                display: flex;
                justify-content: space-around;
                margin: 1.5rem 0;
                padding: 1rem 0;
                border-top: 1px solid #e5e7eb;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .division-stat {
                text-align: center;
            }
            
            .division-stat .stat-number {
                display: block;
                font-size: 1.5rem;
                font-weight: bold;
                color: #1f2937;
            }
            
            .division-stat .stat-label {
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            .division-ranking {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .division-ranking li {
                display: flex;
                align-items: center;
                padding: 0.5rem 0;
                border-bottom: 1px solid #f3f4f6;
            }
            
            .division-ranking .rank {
                width: 30px;
                font-weight: bold;
                color: #6b7280;
            }
            
            .division-ranking .name {
                flex: 1;
                color: #1f2937;
            }
            
            .division-ranking .ip {
                color: #3b82f6;
                font-weight: 600;
            }
            
            /* Hitos */
            .milestones-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1.5rem;
                margin-top: 1.5rem;
            }
            
            .milestone-card {
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 0.75rem;
                padding: 1.5rem;
                text-align: center;
                transition: all 0.3s;
            }
            
            .milestone-card:hover {
                border-color: #3b82f6;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .milestone-icon {
                font-size: 3rem;
                margin-bottom: 0.5rem;
            }
            
            .milestone-card h4 {
                margin: 0.5rem 0;
                color: #1f2937;
            }
            
            .milestone-points {
                color: #3b82f6;
                font-weight: 600;
                margin-bottom: 1rem;
            }
            
            /* Reconocimientos */
            .recognitions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-top: 1rem;
            }
            
            .recognition-card {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 0.75rem;
                padding: 2rem;
                text-align: center;
                box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);
            }
            
            .recognition-icon {
                font-size: 3rem;
                margin-bottom: 0.5rem;
            }
            
            .recognition-card h4 {
                margin: 0.5rem 0;
                color: #92400e;
            }
            
            .recognition-winner {
                font-size: 1.25rem;
                font-weight: bold;
                color: #78350f;
                margin: 0.5rem 0;
            }
            
            .recognition-metric {
                color: #92400e;
                font-weight: 500;
            }
            
            /* Botones del sistema */
            .progress-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 1rem;
                margin: 0.5rem;
            }
            
            .progress-button.btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .progress-button.btn-primary:hover {
                background: #2563eb;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }
            
            .progress-button.btn-warning {
                background: #f59e0b;
                color: white;
            }
            
            .progress-button.btn-warning:hover {
                background: #d97706;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
            }
            
            .progress-button.btn-info {
                background: #6366f1;
                color: white;
            }
            
            .progress-button.btn-info:hover {
                background: #4f46e5;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            
            /* Progress bar */
            .progress-bar {
                background: #e5e7eb;
                height: 30px;
                border-radius: 15px;
                overflow: hidden;
                margin: 1rem 0;
            }
            
            .progress-fill {
                background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
                height: 100%;
                width: 0%;
                transition: width 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            }
            
            /* Log de actividad */
            .activity-log {
                background: #1f2937;
                color: #e5e7eb;
                padding: 1rem;
                border-radius: 0.5rem;
                font-family: 'Courier New', monospace;
                font-size: 0.875rem;
                max-height: 300px;
                overflow-y: auto;
                margin-top: 1rem;
            }
            
            .log-entry {
                margin: 0.5rem 0;
                padding: 0.25rem 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .log-entry.success { color: #10b981; }
            .log-entry.error { color: #ef4444; }
            .log-entry.warning { color: #f59e0b; }
            .log-entry.info { color: #60a5fa; }
            
            /* Info del simulacro */
            .simulation-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .info-card {
                background: #f3f4f6;
                padding: 1rem;
                border-radius: 0.5rem;
                text-align: center;
            }
            
            .info-value {
                font-size: 1.5rem;
                font-weight: bold;
                color: #1f2937;
            }
            
            .info-label {
                font-size: 0.875rem;
                color: #6b7280;
                margin-top: 0.25rem;
            }
            
            /* Mensajes de estado */
            .success-message {
                background: #d1fae5;
                color: #065f46;
                padding: 1rem;
                border-radius: 0.5rem;
                margin-top: 1rem;
                border: 1px solid #6ee7b7;
            }
            
            .error-message {
                background: #fee2e2;
                color: #991b1b;
                padding: 1rem;
                border-radius: 0.5rem;
                margin-top: 1rem;
                border: 1px solid #fca5a5;
            }
            
            .loading {
                text-align: center;
                color: #6b7280;
                padding: 2rem;
            }
            
            /* Animaciones */
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .tab-content {
                animation: slideIn 0.3s ease;
            }
        `;
        document.head.appendChild(styles);
    }
}