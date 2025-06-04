// /admin/js/dashboard-core.js
// Núcleo principal del dashboard administrativo

import { getAuthInstance } from './modules/auth.js';

window.ensureChartJS = function() {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
            resolve();
        } else {
            console.warn('Chart.js no está cargado, intentando cargar...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => {
                console.log('Chart.js cargado exitosamente');
                resolve();
            };
            script.onerror = () => {
                console.error('Error al cargar Chart.js');
                resolve(); // Continuar de todos modos
            };
            document.head.appendChild(script);
        }
    });
}

export class DashboardCore {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.auth = getAuthInstance(supabaseClient);
        this.modules = new Map();
        this.currentPage = 'overview';
        this.data = {
            students: [],
            results: [],
            simulations: [],
            cohortStats: {},
            alerts: []
        };
        this.filters = {
            cohort: 'all',
            status: 'all',
            dateRange: 'all'
        };
    }

    /**
     * Inicializar el dashboard
     */
    async init() {
        try {
            console.log('Inicializando Dashboard Core...');
            
            // 1. Verificar acceso de admin
            const authResult = await this.auth.verifyAdminAccess();
            
            if (!authResult.success) {
                console.error('Acceso denegado:', authResult.message);
                return false;
            }
            
            // 2. Mostrar información del usuario
            this.updateUserInterface(authResult.user);
            
            // 3. Cargar módulos necesarios
            await this.loadModules();
            
            // 4. Cargar datos iniciales
            await this.loadInitialData();
            
            // 5. Configurar navegación
            this.setupNavigation();
            
            // 6. Configurar suscripciones en tiempo real
            this.setupRealtimeSubscriptions();
            
            // 7. Mostrar página inicial
            this.showPage('overview');
            
            console.log('Dashboard inicializado correctamente');
            return true;
            
        } catch (error) {
            console.error('Error inicializando dashboard:', error);
            this.showError('Error al inicializar el dashboard: ' + error.message);
            return false;
        }
    }

    /**
     * Cargar módulos dinámicamente según necesidad
     */
    async loadModules() {
        console.log('Cargando módulos del dashboard...');
        
        // Por ahora solo registramos los módulos disponibles
        // Se cargarán dinámicamente cuando se necesiten
        this.availableModules = {
            'charts': './modules/charts.js',
            'students': './modules/students.js',
            'results': './modules/results.js',
            'simulations': './modules/simulations.js',
            'analytics': './modules/analytics/index.js', 
            'exports': './modules/exports.js',
            'medals': './modules/medals.js',
            'alerts': './modules/alerts.js',
            'risk': './modules/risk-analysis.js',
            'bulk-users': './modules/bulk-users.js',
            'elo-manual': './modules/elo-manual.js',
            'student-detail': './modules/student-detail.js'
        };
    }

    /**
     * Cargar un módulo específico cuando se necesite
     */
    async loadModule(moduleName) {
        if (this.modules.has(moduleName)) {
            return this.modules.get(moduleName);
        }

        if (!this.availableModules[moduleName]) {
            throw new Error(`Módulo no encontrado: ${moduleName}`);
        }

        try {
            console.log(`Cargando módulo: ${moduleName}`);
            const module = await import(this.availableModules[moduleName]);
            const instance = new module.default(this.supabase, this);
            this.modules.set(moduleName, instance);
            return instance;
        } catch (error) {
            console.error(`Error cargando módulo ${moduleName}:`, error);
            throw error;
        }
    }

    /**
     * Actualizar interfaz con información del usuario
     */
    updateUserInterface(user) {
        const emailElement = document.getElementById('currentUserEmail');
        if (emailElement) {
            emailElement.textContent = user.email || 'Usuario';
        }

        // Registrar actividad de login
        this.auth.logAdminActivity('dashboard_access', {
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Cargar datos iniciales del dashboard
     */
    async loadInitialData() {
        try {
            console.log('Cargando datos iniciales...');
            
            const [
                studentsResponse,
                simulationsResponse,
                resultsResponse,
                alertsResponse,
                eloHistoryResponse
            ] = await Promise.all([
                // Estudiantes con verificación real de admin
                this.supabase
                    .from('users')
                    .select('*')
                    .order('created_at', { ascending: false }),
                
                // Simulacros
                this.supabase
                    .from('weekly_simulations')
                    .select('*')
                    .order('week_number', { ascending: false }),
                
                // Resultados recientes
                this.supabase
                    .from('user_results')
                    .select(`
                        *,
                        users!inner(slug, username, email, cohort)
                    `)
                    .order('submitted_at', { ascending: false })
                    .limit(1000),
                
                // Alertas no leídas
                this.supabase
                    .from('user_alerts')
                    .select('*')
                    .eq('is_read', false)
                    .order('created_at', { ascending: false }),

                this.supabase
                .from('elo_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500)
           
            ]);

            // Procesar respuestas
            if (!studentsResponse.error) {
                this.data.students = studentsResponse.data || [];
            }
            
            if (!simulationsResponse.error) {
                this.data.simulations = simulationsResponse.data || [];
            }
            
            if (!resultsResponse.error) {
                this.data.results = resultsResponse.data || [];
            }
            
            if (!alertsResponse.error) {
                this.data.alerts = alertsResponse.data || [];
            }

            if (!eloHistoryResponse.error) {
            this.data.eloHistory = eloHistoryResponse.data || [];
            } else {
            this.data.eloHistory = [];
            }

            // Calcular estadísticas
            this.calculateStats();
            
            // Actualizar badges
            this.updateBadges();
            
            console.log('Datos cargados:', this.data);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            throw error;
        }
    }

    /**
     * Calcular estadísticas
     */
    calculateStats() {
        // Estadísticas por cohorte
        const cohorts = ['20h', '36h', '48h', 'sin_asignar'];
        
        this.data.cohortStats = cohorts.reduce((acc, cohort) => {
            const cohortStudents = this.data.students.filter(s => s.cohort === cohort);
            
            acc[cohort] = {
                total: cohortStudents.length,
                active: cohortStudents.filter(s => s.active).length,
                avgElo: this.calculateAverage(cohortStudents, 'current_elo'),
                avgScore: this.calculateAverage(cohortStudents, 'average_score'),
                atRisk: cohortStudents.filter(s => (s.probability_pass || 50) < 50).length
            };
            
            return acc;
        }, {});

        // Estadísticas globales
        this.data.globalStats = {
            totalStudents: this.data.students.length,
            activeStudents: this.data.students.filter(s => s.active).length,
            totalResults: this.data.results.length,
            activeSimulations: this.data.simulations.filter(s => s.status === 'active').length,
            pendingAlerts: this.data.alerts.length
        };
    }

    /**
     * Calcular promedio de un campo
     */
    calculateAverage(array, field) {
        if (array.length === 0) return 0;
        const sum = array.reduce((acc, item) => acc + (item[field] || 0), 0);
        return Math.round(sum / array.length);
    }

    /**
     * Configurar navegación
     */
    setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                await this.showPage(page);
                
                // Actualizar estado activo
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Navegación por teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1': this.showPage('overview'); break;
                    case '2': this.showPage('students'); break;
                    case '3': this.showPage('results'); break;
                    case '4': this.showPage('simulations'); break;
                }
            }
        });
    }

    /**
     * Mostrar página específica
     */
    async showPage(page) {
        this.currentPage = page;
        const contentWrapper = document.getElementById('contentWrapper');
        
        // Actualizar UI
        this.updatePageHeader(page);
        
        // Mostrar loading
        contentWrapper.innerHTML = this.getLoadingHTML();
        
        try {
            // Renderizar según la página
            switch(page) {
                case 'overview':
                    await this.renderOverviewPage();
                    break;
                case 'students':
                    const studentsModule = await this.loadModule('students');
                    await studentsModule.render(contentWrapper, this.getFilteredData());
                    break;
                case 'results':
                    const resultsModule = await this.loadModule('results');
                    await resultsModule.render(contentWrapper, this.getFilteredData());
                    break;
                case 'simulations':
                    const simulationsModule = await this.loadModule('simulations');
                    await simulationsModule.render(contentWrapper, this.data.simulations);
                    break;
                case 'alerts':
                    const alertsModule = await this.loadModule('alerts');
                    await alertsModule.render(contentWrapper, this.data.alerts);
                    break;
                case 'analytics':
                    const analyticsModule = await this.loadModule('analytics');
                    await analyticsModule.render(contentWrapper);
                    break;
                case 'medals':
                    const medalsModule = await this.loadModule('medals');
                    await medalsModule.render(contentWrapper);
                    break;
                case 'risk':
                    const riskModule = await this.loadModule('risk');
                    await riskModule.render(contentWrapper);
                    break;
                case 'bulk-users':
                    const bulkUsersModule = await this.loadModule('bulk-users');
                    await bulkUsersModule.render(contentWrapper);
                    break;
                case 'elo-manual':
                    const eloManualModule = await this.loadModule('elo-manual');
                    await eloManualModule.render(contentWrapper);
                    break;
                default:
                    this.showError('Página no encontrada');
            }
            
            // Registrar navegación
            this.auth.logAdminActivity('page_view', { page });
            
        } catch (error) {
            console.error(`Error mostrando página ${page}:`, error);
            this.showError(`Error al cargar la página: ${error.message}`);
        }
    }

    async showStudentDetail(studentId) {
        const contentWrapper = document.getElementById('contentWrapper');
        
        // Cargar el módulo si no está cargado
        const detailModule = await this.loadModule('student-detail');
        
        // Renderizar la vista detallada
        await detailModule.render(contentWrapper, studentId);
        
        // Actualizar navegación
        document.getElementById('pageTitle').textContent = 'Perfil del Estudiante';
        document.getElementById('breadcrumbCurrent').textContent = 'Perfil del Estudiante';
    }

    /**
     * Actualizar header de la página
     */
    updatePageHeader(page) {
        const titles = {
            'overview': 'Vista General',
            'students': 'Gestión de Alumnos',
            'results': 'Resultados',
            'simulations': 'Gestión de Simulacros',
            'alerts': 'Alertas y Notificaciones',
            'analytics': 'Análisis y Tendencias',
            'medals': 'Medallas y Logros',
            'risk': 'Análisis de Riesgo',
            'bulk-users': 'Carga Masiva de Alumnos',
            'elo-manual': 'Actualización Manual ELO'
        };
        
        document.getElementById('pageTitle').textContent = titles[page] || page;
        document.getElementById('breadcrumbCurrent').textContent = titles[page] || page;
        
        // Mostrar/ocultar filtros según la página
        const filtersBar = document.getElementById('filtersBar');
        if (filtersBar) {
            filtersBar.style.display = ['overview', 'students', 'results'].includes(page) ? 'flex' : 'none';
        }
    }

    /**
     * Configurar suscripciones en tiempo real
     */
    setupRealtimeSubscriptions() {
        // Suscripción a cambios en usuarios
        this.supabase
            .channel('admin-users-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'users' },
                (payload) => this.handleUserChange(payload)
            )
            .subscribe();

        // Suscripción a nuevos resultados
        this.supabase
            .channel('admin-results-changes')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'user_results' },
                (payload) => this.handleNewResult(payload)
            )
            .subscribe();

        // Suscripción a nuevas alertas
        this.supabase
            .channel('admin-alerts')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'user_alerts' },
                (payload) => this.handleNewAlert(payload)
            )
            .subscribe();
    }

    /**
     * Manejadores de eventos en tiempo real
     */
    handleUserChange(payload) {
        console.log('Cambio en usuarios:', payload);
        this.showNotification('info', 'Actualización en usuarios detectada');
        // Actualizar datos locales sin recargar toda la página
        this.updateLocalUserData(payload);
    }

    handleNewResult(payload) {
        console.log('Nuevo resultado:', payload);
        this.showNotification('success', 'Nuevo resultado registrado');
        // Actualizar vista si estamos en la página correspondiente
        if (this.currentPage === 'results' || this.currentPage === 'overview') {
            this.refreshCurrentPage();
        }
    }

    handleNewAlert(payload) {
        console.log('Nueva alerta:', payload);
        this.data.alerts.unshift(payload.new);
        this.updateBadges();
        this.showNotification('warning', 'Nueva alerta del sistema');
    }

    /**
     * Actualizar datos locales sin recargar
     */
    updateLocalUserData(payload) {
        const { eventType, new: newData, old: oldData } = payload;
        
        switch(eventType) {
            case 'INSERT':
                this.data.students.unshift(newData);
                break;
            case 'UPDATE':
                const index = this.data.students.findIndex(s => s.id === newData.id);
                if (index !== -1) {
                    this.data.students[index] = newData;
                }
                break;
            case 'DELETE':
                this.data.students = this.data.students.filter(s => s.id !== oldData.id);
                break;
        }
        
        this.calculateStats();
        this.updateBadges();
        
        if (this.currentPage === 'students' || this.currentPage === 'overview') {
            this.refreshCurrentPage();
        }
    }

    /**
     * Actualizar badges de navegación
     */
    updateBadges() {
        // Badge de estudiantes
        const studentsBadge = document.getElementById('totalStudentsBadge');
        if (studentsBadge) {
            studentsBadge.textContent = this.data.students.length;
        }

        // Badge de alertas (nuevo)
        const alertsBadge = document.getElementById('alertsBadge');
        if (alertsBadge) {
            alertsBadge.textContent = this.data.alerts.length;
            alertsBadge.style.display = this.data.alerts.length > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Refrescar página actual
     */
    async refreshCurrentPage() {
        await this.showPage(this.currentPage);
    }

    /**
     * Obtener datos filtrados
     */
    getFilteredData() {
        let filtered = { ...this.data };
        
        // Filtro por cohorte
        if (this.filters.cohort !== 'all') {
            filtered.students = filtered.students.filter(s => s.cohort === this.filters.cohort);
            filtered.results = filtered.results.filter(r => r.users?.cohort === this.filters.cohort);
        }
        
        // Filtro por estado
        if (this.filters.status === 'active') {
            filtered.students = filtered.students.filter(s => s.active);
        } else if (this.filters.status === 'inactive') {
            filtered.students = filtered.students.filter(s => !s.active);
        }
        
        return filtered;
    }

    /**
     * Aplicar filtros
     */
    applyFilters(filterType, value) {
        this.filters[filterType] = value;
        this.refreshCurrentPage();
    }

    /**
     * Renderizar página de vista general
     */
    async renderOverviewPage() {
        const contentWrapper = document.getElementById('contentWrapper');
        const data = this.getFilteredData();
        
        await window.ensureChartJS();

        contentWrapper.innerHTML = `
            <div class="stats-grid">
                ${this.renderStatsCards(data)}
            </div>
            <div class="charts-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">📊 Evolución Semanal</h3>
                    </div>
                    <div class="chart-body" id="weeklyChart">
                        <!-- Chart.js canvas aquí -->
                    </div>
                </div>
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">📈 Distribución por Cohortes</h3>
                    </div>
                    <div class="chart-body" id="cohortChart">
                        <!-- Chart.js canvas aquí -->
                    </div>
                </div>
            </div>
            
            <!-- Acciones rápidas -->
            <div class="quick-actions-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 2rem;">
                <button class="action-card" onclick="window.dashboardAdmin.showPage('bulk-users')" style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; cursor: pointer; transition: all 0.3s;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">👥</div>
                    <h3 style="margin-bottom: 0.5rem;">Carga Masiva</h3>
                    <p style="color: #6b7280; font-size: 0.875rem;">Añadir múltiples alumnos</p>
                </button>
                
                <button class="action-card" onclick="window.dashboardAdmin.showPage('elo-manual')" style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; cursor: pointer; transition: all 0.3s;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚡</div>
                    <h3 style="margin-bottom: 0.5rem;">Actualizar ELO</h3>
                    <p style="color: #6b7280; font-size: 0.875rem;">Procesar resultados manualmente</p>
                </button>
                
                <button class="action-card" onclick="window.dashboardAdmin.showPage('risk')" style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; cursor: pointer; transition: all 0.3s;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                    <h3 style="margin-bottom: 0.5rem;">Análisis de Riesgo</h3>
                    <p style="color: #6b7280; font-size: 0.875rem;">Ver estudiantes en riesgo</p>
                </button>
            </div>
            
            <style>
                .action-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-color: #1e3a8a !important;
                }
                .chart-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    min-height: 400px;
                }
                .chart-body {
                    position: relative;
                    height: 300px;
                }
            </style>
        `;
        setTimeout(async () => {
            try {
                // Verificar que tengamos datos antes de renderizar
                if (data.results && data.results.length > 0) {
                    const chartsModule = await this.loadModule('charts');
                    
                    // Renderizar cada gráfico con manejo de errores
                    try {
                        await chartsModule.renderWeeklyChart('weeklyChart', data);
                    } catch (e) {
                        console.error('Error en gráfico semanal:', e);
                    }
                    
                    try {
                        await chartsModule.renderCohortDistribution('cohortChart', this.data.cohortStats);
                    } catch (e) {
                        console.error('Error en gráfico de cohortes:', e);
                    }
                    
                    try {
                        // Pasar los estudiantes para el análisis de riesgo
                        await chartsModule.renderRiskAnalysis('riskChart', data.students);
                    } catch (e) {
                        console.error('Error en gráfico de riesgo:', e);
                    }
                    
                    try {
                        // Renderizar tendencia ELO si hay datos
                        if (this.data.eloHistory && this.data.eloHistory.length > 0) {
                            await chartsModule.renderEloTrends('eloChart', this.data.eloHistory);
                        } else {
                            document.getElementById('eloChart').parentElement.innerHTML = 
                                '<p style="text-align: center; color: #6b7280; margin-top: 50px;">No hay datos de ELO disponibles</p>';
                        }
                    } catch (e) {
                        console.error('Error en gráfico ELO:', e);
                    }
                } else {
                    contentWrapper.querySelector('.charts-section').innerHTML = 
                        '<div style="text-align: center; padding: 3rem; color: #6b7280;">No hay datos suficientes para mostrar gráficos</div>';
                }
            } catch (error) {
                console.error('Error general renderizando gráficos:', error);
            }
        }, 100);
    }


    /**
     * Renderizar cards de estadísticas
     */
    renderStatsCards(data) {
        const stats = [
            {
                title: 'Total Estudiantes',
                value: data.students.length,
                icon: '👥',
                color: 'primary',
                change: `${data.students.filter(s => s.active).length} activos`
            },
            {
                title: 'Probabilidad Media',
                value: this.calculateAverage(data.students, 'probability_pass') + '%',
                icon: '📈',
                color: 'success',
                change: 'De aprobar'
            },
            {
                title: 'En Riesgo',
                value: data.students.filter(s => (s.probability_pass || 50) < 50).length,
                icon: '⚠️',
                color: 'warning',
                change: 'P(Aprobar) < 50%'
            },
            {
                title: 'Alertas Pendientes',
                value: data.alerts.length,
                icon: '🔔',
                color: 'danger',
                change: 'Sin leer'
            }
        ];
        
        return stats.map(stat => `
            <div class="stat-card ${stat.color}">
                <div class="stat-header">
                    <div class="stat-icon ${stat.color}">${stat.icon}</div>
                    <div class="stat-content">
                        <div class="stat-label">${stat.title}</div>
                        <div class="stat-value">${stat.value}</div>
                        <div class="stat-change">${stat.change}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Utilidades
     */
    getLoadingHTML() {
        return `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p style="margin-top: 1rem;">Cargando...</p>
            </div>
        `;
    }

    showError(message) {
        const contentWrapper = document.getElementById('contentWrapper');
        contentWrapper.innerHTML = `
            <div class="error-container">
                <div class="error-title">❌ Error</div>
                <div>${message}</div>
            </div>
        `;
    }

    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Cleanup al salir
     */
    destroy() {
        // Limpiar suscripciones
        this.supabase.removeAllChannels();
        
        // Limpiar event listeners
        document.removeEventListener('keydown', this.keyboardHandler);
        
        // Limpiar módulos
        this.modules.forEach(module => {
            if (module.destroy) module.destroy();
        });
    }
}

// Exportar para uso global
window.DashboardCore = DashboardCore;