// admin/js/modules/students.js
// Módulo enfocado en la gestión de UI y acciones sobre estudiantes
// Todo el análisis estadístico se ha movido a analytics.js

export default class StudentsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedStudents = new Set();
        this.sortColumn = 'created_at';
        this.sortDirection = 'desc';
        this.currentStudentId = null;
    }

    async render(container, data) {
        const students = data.students || [];
        
        // Solo calcular métricas básicas necesarias para la tabla
        await this.calculateBasicMetrics(students);
        
        container.innerHTML = `
            <div class="students-page">
                <!-- Acciones masivas -->
                ${this.renderBulkActions()}
                
                <!-- Tabla principal de estudiantes -->
                ${this.renderAdvancedStudentsTable(students)}
                
                <!-- Modales -->
                ${this.renderNotesModal()}
                ${this.renderDetailedAnalysisModal()}
            </div>
        `;
        
        // Configurar event listeners
        this.setupEventListeners();
    }

    /**
     * Calcular métricas comprehensivas delegando al módulo de analytics
     */
    async calculateComprehensiveMetrics(students) {
        try {
            // Obtener el módulo de analytics para el análisis pesado
            const analyticsModule = await this.dashboard.loadModule('analytics');
            
            // Obtener todos los resultados para el análisis
            const allResults = this.dashboard.data.results;
            
            // Procesar cada estudiante usando analytics
            for (const student of students) {
                const studentResults = allResults.filter(r => r.user_id === student.id);
                
                if (studentResults.length === 0) {
                    this.assignDefaultMetrics(student);
                    continue;
                }
                
                // Delegar el análisis complejo al módulo de analytics
                const analysis = await analyticsModule.analyzeIndividualStudent(student, studentResults);
                
                // Asignar todos los resultados del análisis al estudiante
                Object.assign(student, analysis);
            }
        } catch (error) {
            console.error('Error calculando métricas:', error);
            // Si falla el análisis, asignar métricas por defecto
            students.forEach(student => this.assignDefaultMetrics(student));
        }
    }
    /**
     * Renderizar acciones masivas
     */
    renderBulkActions() {
        return `
            <div class="bulk-actions-bar">
                <div class="bulk-select">
                    <input type="checkbox" id="selectAllStudents" onchange="window.studentsModule.toggleSelectAll()">
                    <label for="selectAllStudents">Seleccionar todos</label>
                    <span class="selected-count" id="selectedCount">0 seleccionados</span>
                </div>
                <div class="bulk-buttons">
                    <button class="btn btn-secondary" onclick="window.studentsModule.bulkUpdateCohort()">
                        📋 Cambiar cohorte
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.bulkSendRecommendations()">
                        📧 Enviar recomendaciones
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.exportSelected()">
                        📊 Exportar seleccionados
                    </button>
                    <button class="btn btn-primary" onclick="window.studentsModule.generateBulkReport()">
                        📄 Generar informe grupal
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar tabla avanzada de estudiantes
     */
    renderAdvancedStudentsTable(students) {
        return `
            <div class="table-card">
                <div class="table-header">
                    <h2 class="table-title">📊 Análisis Detallado de Estudiantes (${students.length})</h2>
                    <div class="table-controls">
                        <div class="search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" class="search-input" 
                                   placeholder="Buscar por nombre, email o slug..." 
                                   onkeyup="window.studentsModule.filterStudents(this.value)">
                        </div>
                        <button class="btn btn-primary" onclick="window.dashboardAdmin.showPage('bulk-users')">
                            ➕ Añadir alumnos
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table id="studentsTable">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" id="headerSelectAll">
                                </th>
                                <th onclick="window.studentsModule.sortBy('username')">
                                    Estudiante ${this.getSortIcon('username')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('cohort')">
                                    Cohorte ${this.getSortIcon('cohort')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('weighted_average')" title="Promedio ponderado">
                                    Nota ${this.getSortIcon('weighted_average')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('probability_pass')" title="Probabilidad de aprobar">
                                    P(Aprobar) ${this.getSortIcon('probability_pass')}
                                </th>
                                <th>Tendencia</th>
                                <th>Patrones</th>
                                <th onclick="window.studentsModule.sortBy('risk_level')">
                                    Riesgo ${this.getSortIcon('risk_level')}
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => this.renderAdvancedStudentRow(student)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar fila avanzada de estudiante
     */
    renderAdvancedStudentRow(student) {
        const hasPatterns = student.responsePatterns?.hasEnoughData && 
            Object.values(student.responsePatterns.patterns).some(p => p.detected);
        
        const trendIcon = this.getTrendIcon(student.trendAnalysis?.direction || 'neutral');
        const confidence = student.probability_details?.confidence;
        
        return `
            <tr data-student-id="${student.id}" class="student-row ${student.risk_level}">
                <td>
                    <input type="checkbox" class="student-select" value="${student.id}">
                </td>
                <td>
                    <div class="student-info">
                        <strong>${student.username}</strong>
                        <div class="student-meta">
                            ${student.email} | ${student.slug}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${this.getCohortClass(student.cohort)}">
                        ${student.cohort}
                    </span>
                </td>
                <td>
                    <div class="score-display">
                        <strong>${(student.weighted_average || 0).toFixed(2)}</strong>/10
                        <div class="score-detail">
                            σ: ${(student.consistency_coefficient || 0).toFixed(2)}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="probability-display ${this.getProbabilityClass(student.probability_pass)}">
                        <strong>${student.probability_pass || 50}%</strong>
                        ${confidence ? `
                            <div class="confidence-interval" title="Intervalo de confianza">
                                ±${confidence.margin.toFixed(0)}%
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div class="trend-display">
                        ${trendIcon}
                        ${student.trendAnalysis?.confidence ? `
                            <span class="trend-confidence">${student.trendAnalysis.confidence.toFixed(0)}%</span>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div class="patterns-indicators">
                        ${hasPatterns ? this.renderPatternIndicators(student.responsePatterns.patterns) : '—'}
                    </div>
                </td>
                <td>
                    <span class="risk-badge ${student.risk_level || 'unknown'}">
                        ${this.getRiskLabel(student.risk_level)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')"
                                title="Ver análisis completo">
                            📊
                        </button>
                        <button class="btn-icon" onclick="window.studentsModule.showQuickAnalysis('${student.id}')"
                                title="Análisis rápido">
                            ⚡
                        </button>
                        <button class="btn-icon" onclick="window.studentsModule.sendRecommendations('${student.id}')"
                                title="Enviar recomendaciones">
                            📧
                        </button>
                        <button class="btn-icon" onclick="window.studentsModule.viewNotes('${student.id}')"
                                title="Ver notas">
                            📝
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Renderizar indicadores de patrones
     */
    renderPatternIndicators(patterns) {
        const indicators = [];
        
        if (patterns.fatigue?.detected) {
            indicators.push('<span class="pattern-indicator fatigue" title="Fatiga detectada">😴</span>');
        }
        if (patterns.rushing?.detected) {
            indicators.push('<span class="pattern-indicator rushing" title="Precipitación detectada">⚡</span>');
        }
        if (patterns.abandonment) {
            indicators.push('<span class="pattern-indicator abandonment" title="Muchas preguntas en blanco">❌</span>');
        }
        
        return indicators.join(' ') || '✅';
    }

    /**
     * Modal de notas
     */
    renderNotesModal() {
        return `
            <div id="notesModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="notesModalTitle">Notas del estudiante</h3>
                        <button class="btn-icon" onclick="window.studentsModule.closeNotesModal()">✖️</button>
                    </div>
                    <div class="modal-body">
                        <div id="notesList" class="notes-list">
                            <!-- Notas se cargarán aquí -->
                        </div>
                        <div class="add-note-form">
                            <textarea id="newNoteText" placeholder="Añadir nueva nota..." rows="3"></textarea>
                            <div class="note-form-actions">
                                <select id="noteType">
                                    <option value="general">📝 General</option>
                                    <option value="academic">📚 Académica</option>
                                    <option value="risk">⚠️ Riesgo</option>
                                    <option value="positive">✅ Positiva</option>
                                    <option value="recommendation">💡 Recomendación</option>
                                </select>
                                <button class="btn btn-primary" onclick="window.studentsModule.addNote()">
                                    Añadir nota
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Modal de análisis detallado
     */
    renderDetailedAnalysisModal() {
        return `
            <div id="analysisModal" class="modal" style="display: none;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="analysisModalTitle">Análisis Detallado</h3>
                        <button class="btn-icon" onclick="window.studentsModule.closeAnalysisModal()">✖️</button>
                    </div>
                    <div class="modal-body" id="analysisContent">
                        <!-- Contenido dinámico -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        window.studentsModule = this;
        
        // Checkbox de selección múltiple
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedCount());
        });
        
        // Header checkbox
        document.getElementById('headerSelectAll')?.addEventListener('change', (e) => {
            document.querySelectorAll('.student-select').forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            this.updateSelectedCount();
        });
    }

    /**
     * Mostrar análisis rápido
     */
    async showQuickAnalysis(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        const modal = document.getElementById('analysisModal');
        const content = document.getElementById('analysisContent');
        
        content.innerHTML = `
            <div class="quick-analysis">
                <h4>${student.username} - Análisis Rápido</h4>
                
                <div class="analysis-section">
                    <h5>📊 Métricas Principales</h5>
                    <div class="metrics-grid">
                        <div class="metric">
                            <label>Nota media ponderada:</label>
                            <value>${(student.weighted_average || 0).toFixed(2)}/10</value>
                        </div>
                        <div class="metric">
                            <label>Probabilidad de aprobar:</label>
                            <value class="${this.getProbabilityClass(student.probability_pass)}">
                                ${student.probability_pass}%
                            </value>
                        </div>
                        <div class="metric">
                            <label>Tendencia:</label>
                            <value>${this.getTrendIcon(student.trendAnalysis?.direction)} 
                                ${student.trendAnalysis?.direction || 'neutral'}
                            </value>
                        </div>
                        <div class="metric">
                            <label>Simulacros realizados:</label>
                            <value>${student.total_simulations}</value>
                        </div>
                    </div>
                </div>
                
                ${student.responsePatterns?.hasEnoughData ? `
                    <div class="analysis-section">
                        <h5>🎯 Patrones Detectados</h5>
                        <ul>
                            ${Object.entries(student.responsePatterns.patterns)
                                .filter(([_, pattern]) => pattern.detected)
                                .map(([name, pattern]) => `
                                    <li><strong>${this.getPatternName(name)}:</strong> 
                                        ${pattern.recommendation || 'Detectado'}
                                    </li>
                                `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${student.recommendations?.length > 0 ? `
                    <div class="analysis-section">
                        <h5>💡 Recomendaciones Prioritarias</h5>
                        <div class="recommendations-list">
                            ${student.recommendations.slice(0, 3).map(rec => `
                                <div class="recommendation-item ${rec.priority}">
                                    <strong>${rec.action}</strong>
                                    <p>${rec.details}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="analysis-actions">
                    <button class="btn btn-primary" onclick="window.dashboardAdmin.showStudentDetail('${studentId}')">
                        Ver Análisis Completo
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.exportStudentReport('${studentId}')">
                        Exportar Informe
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    }

    /**
     * Cerrar modal de análisis
     */
    closeAnalysisModal() {
        document.getElementById('analysisModal').style.display = 'none';
    }

    /**
     * Enviar recomendaciones a un estudiante
     */
    async sendRecommendations(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student || !student.recommendations) return;
        
        if (confirm(`¿Enviar recomendaciones personalizadas a ${student.username}?`)) {
            try {
                // Aquí iría la lógica para enviar email con las recomendaciones
                this.dashboard.showNotification('success', 'Recomendaciones enviadas correctamente');
            } catch (error) {
                this.dashboard.showNotification('error', 'Error al enviar recomendaciones');
            }
        }
    }

    /**
     * Generar informe grupal
     */
    async generateBulkReport() {
        const selectedIds = Array.from(this.selectedStudents);
        const students = selectedIds.length > 0 ?
            this.dashboard.data.students.filter(s => selectedIds.includes(s.id)) :
            this.dashboard.data.students;
        
        if (students.length === 0) {
            this.dashboard.showNotification('warning', 'No hay estudiantes seleccionados');
            return;
        }
        
        // Aquí iría la lógica para generar un informe PDF o Excel completo
        this.dashboard.showNotification('info', `Generando informe para ${students.length} estudiantes...`);
        
        // Por ahora, exportar a CSV con todas las métricas
        await this.exportAdvancedReport(students);
    }

    /**
     * Exportar informe avanzado
     */
    async exportAdvancedReport(students) {
        const exportsModule = await this.dashboard.loadModule('exports');
        
        const reportData = students.map(s => ({
            // Datos básicos
            Nombre: s.username,
            Email: s.email,
            Cohorte: s.cohort,
            Código: s.slug,
            
            // Métricas principales
            'Nota Media': s.average_score || 0,
            'Nota Ponderada': s.weighted_average || 0,
            'Mejor Nota': s.best_score || 0,
            'Peor Nota': s.worst_score || 0,
            'Consistencia': s.consistency_coefficient || 0,
            
            // Probabilidad y riesgo
            'P(Aprobar)': s.probability_pass || 50,
            'Nivel Riesgo': s.risk_level || 'unknown',
            'Tendencia': s.trendAnalysis?.direction || 'neutral',
            'Proyección': s.trendAnalysis?.projection || 'N/A',
            
            // Participación
            'Simulacros': s.total_simulations || 0,
            'Racha Actual': s.current_streak || 0,
            
            // Patrones
            'Fatiga': s.responsePatterns?.patterns?.fatigue?.detected ? 'Sí' : 'No',
            'Precipitación': s.responsePatterns?.patterns?.rushing?.detected ? 'Sí' : 'No',
            'Abandono': s.responsePatterns?.patterns?.abandonment ? 'Sí' : 'No',
            
            // Recomendación principal
            'Recomendación Principal': s.recommendations?.[0]?.action || 'Sin recomendaciones'
        }));
        
        const csv = exportsModule.objectsToCSV(reportData);
        exportsModule.downloadCSV(csv, `informe_avanzado_cnp_${exportsModule.getTimestamp()}.csv`);
    }

    // ==================================================================
    // MÉTODOS DE UI Y UTILIDADES (no requieren cambios)
    // ==================================================================

    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllStudents').checked;
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        this.selectedStudents.clear();
        document.querySelectorAll('.student-select:checked').forEach(checkbox => {
            this.selectedStudents.add(checkbox.value);
        });
        document.getElementById('selectedCount').textContent = 
            `${this.selectedStudents.size} seleccionados`;
    }

    filterStudents(searchTerm) {
        const rows = document.querySelectorAll('#studentsTable tbody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.dashboard.refreshCurrentPage();
    }

    // Métodos de formato y visualización
    getProbabilityClass(probability) {
        if (!probability) probability = 50;
        if (probability >= 70) return 'success';
        if (probability >= 50) return 'warning';
        if (probability >= 30) return 'danger';
        return 'critical';
    }

    getCohortClass(cohort) {
        const classes = {
            '48h': 'danger',
            '36h': 'warning',
            '20h': 'info',
            'sin_asignar': 'secondary'
        };
        return classes[cohort] || 'secondary';
    }

    getTrendIcon(direction) {
        const icons = {
            'up': '📈',
            'down': '📉',
            'stable': '➡️',
            'neutral': '⚪'
        };
        return icons[direction] || '⚪';
    }

    getRiskLabel(level) {
        const labels = {
            'critical': 'Crítico',
            'high': 'Alto',
            'medium': 'Medio',
            'low': 'Bajo',
            'unknown': 'No evaluado'
        };
        return labels[level] || level;
    }

    getBlockName(block) {
        const names = {
            'juridico': 'Jurídico (T1-26)',
            'sociales': 'Ciencias Sociales (T27-37)',
            'tecnico': 'Técnico-Científico (T38-45)'
        };
        return names[block] || block;
    }

    getPatternName(pattern) {
        const names = {
            'fatigue': 'Fatiga mental',
            'rushing': 'Precipitación',
            'abandonment': 'Abandono excesivo'
        };
        return names[pattern] || pattern;
    }

    getSortIcon(column) {
        if (this.sortColumn !== column) return '';
        return this.sortDirection === 'asc' ? '↑' : '↓';
    }

    // Métodos de datos por defecto
    assignDefaultMetrics(student) {
        Object.assign(student, {
            average_score: 0,
            weighted_average: 0,
            consistency_coefficient: 0,
            z_score: 0,
            percentile: 50,
            probability_pass: 50,
            risk_level: 'unknown',
            trend_direction: 'neutral',
            calculated_risk_level: 'unknown',
            recommendations: [{
                priority: 'high',
                category: 'start',
                action: 'Comenzar con simulacros',
                details: 'Necesitas realizar al menos 3 simulacros para obtener un análisis completo.'
            }]
        });
    }

    // ==================================================================
    // MÉTODOS DE ACCIONES MASIVAS
    // ==================================================================

    async bulkUpdateCohort() {
        if (this.selectedStudents.size === 0) {
            alert('Selecciona al menos un estudiante');
            return;
        }
        
        const newCohort = prompt('Nueva cohorte (20h, 36h, 48h, sin_asignar):');
        if (!newCohort || !['20h', '36h', '48h', 'sin_asignar'].includes(newCohort)) {
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ cohort: newCohort })
                .in('id', Array.from(this.selectedStudents));
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 
                `Cohorte actualizada para ${this.selectedStudents.size} estudiantes`);
            
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al actualizar cohortes');
        }
    }

    async bulkSendRecommendations() {
        if (this.selectedStudents.size === 0) {
            alert('Selecciona al menos un estudiante');
            return;
        }
        
        if (confirm(`¿Enviar recomendaciones personalizadas a ${this.selectedStudents.size} estudiantes?`)) {
            // Implementar lógica de envío masivo
            this.dashboard.showNotification('info', 'Función en desarrollo');
        }
    }

    async exportSelected() {
        const studentsToExport = this.selectedStudents.size > 0 ? 
            Array.from(this.selectedStudents) : 
            this.dashboard.data.students.map(s => s.id);
        
        const students = this.dashboard.data.students.filter(s => studentsToExport.includes(s.id));
        await this.exportAdvancedReport(students);
    }

    async exportStudentReport(studentId) {
        const student = this.dashboard.data.students.find(s => s.id === studentId);
        if (!student) return;
        
        await this.exportAdvancedReport([student]);
    }

    async renderAnalyticsCharts(students) {
        // Implementar gráficos específicos si es necesario
        // Por ejemplo: distribución de probabilidades, tendencias grupales, etc.
    }

    // ==================================================================
    // GESTIÓN DE NOTAS Y ANOTACIONES
    // ==================================================================

    async viewNotes(studentId) {
        this.currentStudentId = studentId;
        
        const { data: student } = await this.supabase
            .from('users')
            .select('username, notes')
            .eq('id', studentId)
            .single();
        
        if (!student) return;
        
        document.getElementById('notesModalTitle').textContent = 
            `Notas de ${student.username}`;
        
        const notesList = document.getElementById('notesList');
        if (student.notes && student.notes.length > 0) {
            notesList.innerHTML = student.notes.map((note, index) => `
                <div class="note-item ${note.type || 'general'}">
                    <div class="note-header">
                        <span class="note-type">${this.getNoteIcon(note.type)} ${note.type || 'General'}</span>
                        <span class="note-date">${this.formatDate(note.date)}</span>
                    </div>
                    <div class="note-content">${note.text}</div>
                    <button class="btn-icon note-delete" onclick="window.studentsModule.deleteNote(${index})">
                        🗑️
                    </button>
                </div>
            `).join('');
        } else {
            notesList.innerHTML = '<p class="text-muted">No hay notas para este estudiante</p>';
        }
        
        document.getElementById('notesModal').style.display = 'flex';
    }

    async addNote() {
        const text = document.getElementById('newNoteText').value.trim();
        const type = document.getElementById('noteType').value;
        
        if (!text) return;
        
        try {
            const { data: student } = await this.supabase
                .from('users')
                .select('notes')
                .eq('id', this.currentStudentId)
                .single();
            
            const notes = student.notes || [];
            notes.push({
                text,
                type,
                date: new Date().toISOString(),
                author: this.dashboard.auth.currentUser.email
            });
            
            const { error } = await this.supabase
                .from('users')
                .update({ notes })
                .eq('id', this.currentStudentId);
            
            if (error) throw error;
            
            document.getElementById('newNoteText').value = '';
            this.viewNotes(this.currentStudentId);
            
            this.dashboard.showNotification('success', 'Nota añadida correctamente');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al añadir nota');
        }
    }

    async deleteNote(index) {
        if (!confirm('¿Eliminar esta nota?')) return;
        
        try {
            const { data: student } = await this.supabase
                .from('users')
                .select('notes')
                .eq('id', this.currentStudentId)
                .single();
            
            const notes = student.notes || [];
            notes.splice(index, 1);
            
            const { error } = await this.supabase
                .from('users')
                .update({ notes })
                .eq('id', this.currentStudentId);
            
            if (error) throw error;
            
            this.viewNotes(this.currentStudentId);
            this.dashboard.showNotification('success', 'Nota eliminada');
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al eliminar nota');
        }
    }

    closeNotesModal() {
        document.getElementById('notesModal').style.display = 'none';
    }

    getNoteIcon(type) {
        const icons = {
            'general': '📝',
            'academic': '📚',
            'risk': '⚠️',
            'positive': '✅',
            'recommendation': '💡'
        };
        return icons[type] || '📝';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}