// admin/js/modules/exports.js
export default class ExportsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
    }

    /**
     * Exportar estudiantes a CSV
     */
    async exportStudents(studentIds = null) {
        try {
            // Si no se especifican IDs, exportar todos
            const students = studentIds ? 
                this.dashboard.data.students.filter(s => studentIds.includes(s.id)) :
                this.dashboard.data.students;
            
            // Preparar datos para CSV
            const csvData = this.studentsToCSV(students);
            
            // Descargar
            this.downloadCSV(csvData, `estudiantes_${this.getTimestamp()}.csv`);
            
            this.dashboard.showNotification('success', `${students.length} estudiantes exportados`);
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar: ' + error.message);
        }
    }

    /**
     * Exportar resultados a CSV
     */
    async exportResults(filters = {}) {
        try {
            // Aplicar filtros si existen
            let results = this.dashboard.data.results;
            
            if (filters.simulationId) {
                results = results.filter(r => r.simulation_id === filters.simulationId);
            }
            
            if (filters.cohort && filters.cohort !== 'all') {
                results = results.filter(r => r.users?.cohort === filters.cohort);
            }
            
            // Preparar datos
            const csvData = this.resultsToCSV(results);
            
            // Descargar
            this.downloadCSV(csvData, `resultados_${this.getTimestamp()}.csv`);
            
            this.dashboard.showNotification('success', `${results.length} resultados exportados`);
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar: ' + error.message);
        }
    }

    /**
     * Exportar análisis de riesgo
     */
    async exportRiskAnalysis() {
        try {
            // Obtener estudiantes con métricas de riesgo calculadas
            const studentsModule = await this.dashboard.loadModule('students');
            const students = [...this.dashboard.data.students];
            
            // Calcular métricas si no están
            await studentsModule.calculateRiskMetrics(students);
            
            // Preparar datos específicos de riesgo
            const riskData = students.map(s => ({
                Email: s.email,
                Nombre: s.username,
                Slug: s.slug,
                Cohorte: s.cohort,
                'ELO Actual': s.current_elo,
                'Score Promedio': s.average_score || 0,
                'Z-Score': s.z_score || 0,
                'P(Aprobar)': s.probability_pass || 50,
                'Tendencia': s.trend_direction || 'neutral',
                'Nivel de Riesgo': s.calculated_risk_level || 'medium',
                'Simulacros': s.total_simulations,
                'Racha Actual': s.current_streak,
                'Estado': s.active ? 'Activo' : 'Inactivo'
            }));
            
            // Convertir a CSV
            const csv = this.objectsToCSV(riskData);
            
            // Descargar
            this.downloadCSV(csv, `analisis_riesgo_${this.getTimestamp()}.csv`);
            
            this.dashboard.showNotification('success', 'Análisis de riesgo exportado');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar análisis: ' + error.message);
        }
    }

    /**
     * Exportar a Excel usando SheetJS
     */
    async exportToExcel(type = 'complete') {
        try {
            // Verificar que SheetJS esté disponible
            if (typeof XLSX === 'undefined') {
                // Cargar SheetJS dinámicamente
                await this.loadSheetJS();
            }
            
            const wb = XLSX.utils.book_new();
            
            // Hoja 1: Estudiantes
            const studentsData = this.dashboard.data.students.map(s => ({
                Email: s.email,
                Nombre: s.username,
                Slug: s.slug,
                Cohorte: s.cohort,
                ELO: s.current_elo,
                'Score Promedio': s.average_score || 0,
                'P(Aprobar)': s.probability_pass || 50,
                Simulacros: s.total_simulations,
                Racha: s.current_streak,
                Estado: s.active ? 'Activo' : 'Inactivo'
            }));
            
            const ws1 = XLSX.utils.json_to_sheet(studentsData);
            XLSX.utils.book_append_sheet(wb, ws1, "Estudiantes");
            
            // Hoja 2: Resultados recientes
            if (type === 'complete') {
                const resultsData = this.dashboard.data.results.slice(0, 1000).map(r => ({
                    Fecha: new Date(r.submitted_at).toLocaleDateString('es-ES'),
                    Estudiante: r.users?.username || 'N/A',
                    Email: r.users?.email || 'N/A',
                    Cohorte: r.users?.cohort || 'N/A',
                    Score: r.score,
                    Aciertos: r.correct_answers || 0,
                    Fallos: r.wrong_answers || 0,
                    Blancos: r.blank_answers || 0,
                    'En Directo': r.is_saturday_live ? 'Sí' : 'No',
                    'Tiempo (min)': r.time_taken ? Math.round(r.time_taken / 60) : 0
                }));
                
                const ws2 = XLSX.utils.json_to_sheet(resultsData);
                XLSX.utils.book_append_sheet(wb, ws2, "Resultados");
                
                // Hoja 3: Estadísticas por cohorte
                const cohortStats = Object.entries(this.dashboard.data.cohortStats).map(([cohort, stats]) => ({
                    Cohorte: cohort,
                    Total: stats.total,
                    Activos: stats.active,
                    'ELO Promedio': stats.avgElo,
                    'Score Promedio': stats.avgScore,
                    'En Riesgo': stats.atRisk || 0
                }));
                
                const ws3 = XLSX.utils.json_to_sheet(cohortStats);
                XLSX.utils.book_append_sheet(wb, ws3, "Estadísticas");
            }
            
            // Guardar archivo
            XLSX.writeFile(wb, `izeta_dashboard_${this.getTimestamp()}.xlsx`);
            
            this.dashboard.showNotification('success', 'Datos exportados a Excel');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al exportar a Excel: ' + error.message);
        }
    }

    /**
     * Convertir estudiantes a CSV
     */
    studentsToCSV(students) {
        const headers = [
            'Email', 'Nombre', 'Slug', 'Cohorte', 'ELO', 'Score Promedio',
            'Probabilidad Aprobar', 'Z-Score', 'Tendencia', 'Nivel Riesgo',
            'Total Simulacros', 'Racha Actual', 'Racha Máxima', 'Estado'
        ];
        
        const rows = students.map(s => [
            s.email,
            s.username,
            s.slug,
            s.cohort,
            s.current_elo,
            s.average_score || 0,
            s.probability_pass || 50,
            s.z_score || 0,
            s.trend_direction || 'neutral',
            s.risk_level || 'medium',
            s.total_simulations,
            s.current_streak,
            s.longest_streak,
            s.active ? 'Activo' : 'Inactivo'
        ]);
        
        return this.arrayToCSV([headers, ...rows]);
    }

    /**
     * Convertir resultados a CSV
     */
    resultsToCSV(results) {
        const headers = [
            'Fecha', 'Hora', 'Estudiante', 'Email', 'Slug', 'Cohorte',
            'Score', 'Aciertos', 'Fallos', 'Blancos', 'Error %',
            'Tiempo (min)', 'En Directo', 'Dispositivo', 'Nivel Estrés',
            'Tiempo Revisión', 'Temas Débiles'
        ];
        
        const rows = results.map(r => {
            const date = new Date(r.submitted_at);
            return [
                date.toLocaleDateString('es-ES'),
                date.toLocaleTimeString('es-ES'),
                r.users?.username || 'N/A',
                r.users?.email || 'N/A',
                r.users?.slug || 'N/A',
                r.users?.cohort || 'N/A',
                r.score,
                r.correct_answers || 0,
                r.wrong_answers || 0,
                r.blank_answers || 0,
                r.error_percentage || 0,
                r.time_taken ? Math.round(r.time_taken / 60) : 0,
                r.is_saturday_live ? 'Sí' : 'No',
                r.device_type || 'N/A',
                r.stress_level || 50,
                r.review_time || 0,
                r.weakest_topics ? r.weakest_topics.join('; ') : ''
            ];
        });
        
        return this.arrayToCSV([headers, ...rows]);
    }

    /**
     * Convertir objetos a CSV
     */
    objectsToCSV(objects) {
        if (objects.length === 0) return '';
        
        const headers = Object.keys(objects[0]);
        const rows = objects.map(obj => headers.map(h => obj[h]));
        
        return this.arrayToCSV([headers, ...rows]);
    }

    /**
     * Convertir array a string CSV
     */
    arrayToCSV(data) {
        return data.map(row => 
            row.map(cell => {
                // Escapar comillas y envolver en comillas si contiene comas
                const str = String(cell).replace(/"/g, '""');
                return str.includes(',') || str.includes('"') || str.includes('\n') 
                    ? `"${str}"` 
                    : str;
            }).join(',')
        ).join('\n');
    }

    /**
     * Descargar CSV
     */
    downloadCSV(csvContent, filename) {
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (navigator.msSaveBlob) {
            // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        }
    }

    /**
     * Cargar SheetJS dinámicamente
     */
    async loadSheetJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Obtener timestamp para nombres de archivo
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    /**
     * Crear botón de exportación reutilizable
     */
    createExportButton(options = {}) {
        const {
            text = 'Exportar',
            type = 'csv',
            className = 'btn btn-secondary',
            data = 'students'
        } = options;
        
        const button = document.createElement('button');
        button.className = className;
        button.innerHTML = `📊 ${text}`;
        
        button.addEventListener('click', async () => {
            switch(data) {
                case 'students':
                    type === 'excel' ? await this.exportToExcel() : await this.exportStudents();
                    break;
                case 'results':
                    await this.exportResults(this.dashboard.filters);
                    break;
                case 'risk':
                    await this.exportRiskAnalysis();
                    break;
                default:
                    this.dashboard.showNotification('error', 'Tipo de exportación no válido');
            }
        });
        
        return button;
    }
}