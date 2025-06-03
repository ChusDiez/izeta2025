// /admin/js/modules/students.js
// Módulo de gestión de estudiantes con análisis de riesgo y tendencias

export default class StudentsModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedStudents = new Set();
        this.sortColumn = 'created_at';
        this.sortDirection = 'desc';
    }

    /**
     * Renderizar la página de estudiantes
     */
    async render(container, data) {
        const students = data.students || [];
        
        // Calcular z-scores y niveles de riesgo
        await this.calculateRiskMetrics(students);
        
        container.innerHTML = `
            <div class="students-page">
                <!-- Resumen de riesgo -->
                ${this.renderRiskSummary(students)}
                
                <!-- Acciones masivas -->
                ${this.renderBulkActions()}
                
                <!-- Tabla principal -->
                ${this.renderStudentsTable(students)}
                
                <!-- Modal de notas (oculto por defecto) -->
                ${this.renderNotesModal()}
            </div>
        `;
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Cargar gráfico de análisis si hay datos
        if (students.length > 0) {
            this.renderRiskChart();
        }
    }

    /**
     * Calcular métricas de riesgo (z-score, probabilidad, tendencia)
     */
    async calculateRiskMetrics(students) {
        // Calcular media y desviación estándar
        const scores = students.map(s => s.average_score || 0).filter(s => s > 0);
        if (scores.length === 0) return;
        
        const mean = scores.reduce((a, b) => a + b) / scores.length;
        const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        // Calcular z-score y actualizar probabilidad para cada estudiante
        for (const student of students) {
            if (student.average_score && student.average_score > 0) {
                // Z-score
                student.z_score = ((student.average_score - mean) / stdDev).toFixed(2);
                
                // Probabilidad de aprobar basada en z-score y otros factores
                const baseProbability = this.calculateProbabilityFromZScore(student.z_score);
                const streakBonus = student.current_streak * 0.5; // 0.5% por semana de racha
                const participationPenalty = student.total_simulations < 4 ? -10 : 0;
                
                student.probability_pass = Math.min(100, Math.max(0, 
                    baseProbability + streakBonus + participationPenalty
                ));
                
                // Determinar tendencia (requiere historial)
                student.trend_direction = await this.calculateTrend(student.id);
                
                // Nivel de riesgo calculado
                student.calculated_risk_level = this.determineRiskLevel(student);
            }
        }
    }

    /**
     * Calcular probabilidad desde z-score usando distribución normal
     */
    calculateProbabilityFromZScore(zScore) {
        // Aproximación de la función de distribución acumulativa normal
        const z = parseFloat(zScore);
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        
        if (z > 0) {
            return (1 - probability) * 100;
        } else {
            return probability * 100;
        }
    }

    /**
     * Calcular tendencia basada en últimos resultados
     */
    async calculateTrend(userId) {
        try {
            const { data: results } = await this.supabase
                .from('user_results')
                .select('score, submitted_at')
                .eq('user_id', userId)
                .order('submitted_at', { ascending: false })
                .limit(5);
            
            if (!results || results.length < 3) return 'neutral';
            
            // Calcular pendiente de la línea de tendencia
            const scores = results.map(r => r.score).reverse();
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            
            for (let i = 0; i < scores.length; i++) {
                sumX += i;
                sumY += scores[i];
                sumXY += i * scores[i];
                sumX2 += i * i;
            }
            
            const n = scores.length;
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            
            if (slope > 0.1) return 'up';
            if (slope < -0.1) return 'down';
            return 'stable';
            
        } catch (error) {
            console.error('Error calculando tendencia:', error);
            return 'neutral';
        }
    }

    /**
     * Determinar nivel de riesgo
     */
    determineRiskLevel(student) {
        const prob = student.probability_pass || 50;
        const trend = student.trend_direction || 'neutral';
        const participation = student.total_simulations || 0;
        
        // Factores de riesgo
        let riskScore = 0;
        
        // Probabilidad base
        if (prob < 30) riskScore += 40;
        else if (prob < 50) riskScore += 25;
        else if (prob < 70) riskScore += 10;
        
        // Tendencia
        if (trend === 'down') riskScore += 20;
        else if (trend === 'up') riskScore -= 10;
        
        // Participación
        if (participation < 2) riskScore += 20;
        else if (participation < 4) riskScore += 10;
        
        // Determinar nivel
        if (riskScore >= 50) return 'critical';
        if (riskScore >= 30) return 'high';
        if (riskScore >= 15) return 'medium';
        return 'low';
    }

    /**
     * Renderizar resumen de riesgo
     */
    renderRiskSummary(students) {
        const riskCounts = {
            critical: students.filter(s => s.calculated_risk_level === 'critical').length,
            high: students.filter(s => s.calculated_risk_level === 'high').length,
            medium: students.filter(s => s.calculated_risk_level === 'medium').length,
            low: students.filter(s => s.calculated_risk_level === 'low').length
        };
        
        const atRiskTotal = riskCounts.critical + riskCounts.high;
        const percentage = students.length > 0 ? 
            ((atRiskTotal / students.length) * 100).toFixed(1) : 0;
        
        return `
            <div class="risk-summary-card">
                <h3>⚠️ Análisis de Riesgo</h3>
                <div class="risk-stats">
                    <div class="risk-stat">
                        <div class="risk-number ${atRiskTotal > 0 ? 'text-danger' : 'text-success'}">
                            ${atRiskTotal}
                        </div>
                        <div class="risk-label">Estudiantes en riesgo</div>
                        <div class="risk-percentage">${percentage}% del total</div>
                    </div>
                    <div class="risk-breakdown">
                        <div class="risk-item critical">
                            <span class="risk-dot"></span>
                            Crítico: ${riskCounts.critical}
                        </div>
                        <div class="risk-item high">
                            <span class="risk-dot"></span>
                            Alto: ${riskCounts.high}
                        </div>
                        <div class="risk-item medium">
                            <span class="risk-dot"></span>
                            Medio: ${riskCounts.medium}
                        </div>
                        <div class="risk-item low">
                            <span class="risk-dot"></span>
                            Bajo: ${riskCounts.low}
                        </div>
                    </div>
                </div>
                <div id="riskChart" style="height: 200px; margin-top: 1rem;"></div>
            </div>
        `;
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
                    <button class="btn btn-secondary" onclick="window.studentsModule.bulkAddNote()">
                        📝 Añadir nota
                    </button>
                    <button class="btn btn-secondary" onclick="window.studentsModule.exportSelected()">
                        📊 Exportar seleccionados
                    </button>
                    <button class="btn btn-danger" onclick="window.studentsModule.bulkDeactivate()">
                        ❌ Desactivar
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar tabla de estudiantes
     */
    renderStudentsTable(students) {
        return `
            <div class="table-card">
                <div class="table-header">
                    <h2 class="table-title">📊 Todos los Estudiantes (${students.length})</h2>
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
                                <th onclick="window.studentsModule.sortBy('email')">
                                    Email ${this.getSortIcon('email')}
                                </th>
                                <th>Slug</th>
                                <th onclick="window.studentsModule.sortBy('cohort')">
                                    Cohorte ${this.getSortIcon('cohort')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('current_elo')">
                                    ELO ${this.getSortIcon('current_elo')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('average_score')">
                                    Promedio ${this.getSortIcon('average_score')}
                                </th>
                                <th onclick="window.studentsModule.sortBy('probability_pass')">
                                    P(Aprobar) ${this.getSortIcon('probability_pass')}
                                </th>
                                <th>Z-Score</th>
                                <th>Tendencia</th>
                                <th>Riesgo</th>
                                <th>Notas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => this.renderStudentRow(student)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar fila de estudiante
     */
    renderStudentRow(student) {
        const riskClass = this.getRiskClass(student.calculated_risk_level);
        const trendIcon = this.getTrendIcon(student.trend_direction);
        const hasNotes = student.notes && student.notes.length > 0;
        
        return `
            <tr data-student-id="${student.id}" class="student-row">
                <td>
                    <input type="checkbox" class="student-select" value="${student.id}">
                </td>
                <td class="font-semibold">${student.username}</td>
                <td class="text-small">${student.email}</td>
                <td><code>${student.slug}</code></td>
                <td>
                    <span class="badge badge-info">${student.cohort}</span>
                </td>
                <td class="font-semibold" style="color: var(--primary);">
                    ${student.current_elo}
                </td>
                <td>${student.average_score?.toFixed(1) || 'N/A'}/10</td>
                <td>
                    <div class="risk-indicator ${this.getProbabilityClass(student.probability_pass)}">
                        ${student.probability_pass?.toFixed(0) || 50}%
                    </div>
                </td>
                <td>
                    <span class="badge ${student.z_score > 0 ? 'badge-success' : 'badge-danger'}">
                        ${student.z_score || '0.00'}
                    </span>
                </td>
                <td>${trendIcon}</td>
                <td>
                    <span class="risk-indicator ${riskClass}">
                        ${this.formatRiskLevel(student.calculated_risk_level)}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="window.studentsModule.viewNotes('${student.id}')"
                            title="${hasNotes ? 'Ver notas' : 'Añadir nota'}">
                        ${hasNotes ? '📋' : '➕'}
                    </button>
                </td>
                <td>
                    <button class="btn-icon" onclick="window.dashboardAdmin.showStudentDetail('${student.id}')"
                            title="Ver perfil completo">
                        👁️
                    </button>
                    <button class="btn-icon" onclick="window.studentsModule.toggleStudentStatus('${student.id}', ${student.active})"
                            title="${student.active ? 'Desactivar' : 'Activar'}">
                        ${student.active ? '✅' : '❌'}
                    </button>
                </td>
            </tr>
        `;
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
     * Configurar event listeners
     */
    setupEventListeners() {
        // Guardar referencia al módulo globalmente para los callbacks
        window.studentsModule = this;
        
        // Checkbox de selección múltiple
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedCount());
        });
        
        // Click fuera del modal para cerrar
        document.getElementById('notesModal').addEventListener('click', (e) => {
            if (e.target.id === 'notesModal') {
                this.closeNotesModal();
            }
        });
    }

    /**
     * Métodos de interacción
     */
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllStudents').checked;
        document.querySelectorAll('.student-select').forEach(checkbox => {
            checkbox.checked = selectAll;
            if (selectAll) {
                this.selectedStudents.add(checkbox.value);
            } else {
                this.selectedStudents.clear();
            }
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

    async viewNotes(studentId) {
        this.currentStudentId = studentId;
        
        // Obtener estudiante y sus notas
        const { data: student } = await this.supabase
            .from('users')
            .select('username, notes')
            .eq('id', studentId)
            .single();
        
        if (!student) return;
        
        // Actualizar modal
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
        
        // Mostrar modal
        document.getElementById('notesModal').style.display = 'flex';
    }

    async addNote() {
        const text = document.getElementById('newNoteText').value.trim();
        const type = document.getElementById('noteType').value;
        
        if (!text) return;
        
        try {
            // Obtener notas actuales
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
            
            // Actualizar en BD
            const { error } = await this.supabase
                .from('users')
                .update({ notes })
                .eq('id', this.currentStudentId);
            
            if (error) throw error;
            
            // Recargar notas
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
            
            // Recargar datos
            await this.dashboard.refreshCurrentPage();
            
        } catch (error) {
            this.dashboard.showNotification('error', 'Error al actualizar cohortes');
        }
    }

    async exportSelected() {
        const studentsToExport = this.selectedStudents.size > 0 ? 
            this.selectedStudents : 
            new Set(this.dashboard.data.students.map(s => s.id));
        
        // Cargar módulo de exportación
        const exportsModule = await this.dashboard.loadModule('exports');
        await exportsModule.exportStudents(Array.from(studentsToExport));
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Reordenar y re-renderizar
        this.dashboard.refreshCurrentPage();
    }

    filterStudents(searchTerm) {
        const rows = document.querySelectorAll('#studentsTable tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    async renderRiskChart() {
        const chartsModule = await this.dashboard.loadModule('charts');
        await chartsModule.renderRiskAnalysis('riskChart', this.dashboard.data.students);
    }

    // Utilidades
    getRiskClass(level) {
        const classes = {
            'critical': 'risk-critical',
            'high': 'risk-high',
            'medium': 'risk-medium',
            'low': 'risk-low'
        };
        return classes[level] || '';
    }

    getProbabilityClass(probability) {
        if (!probability) probability = 50;
        if (probability >= 70) return 'risk-low';
        if (probability >= 50) return 'risk-medium';
        if (probability >= 30) return 'risk-high';
        return 'risk-critical';
    }

    getTrendIcon(trend) {
        const icons = {
            'up': '📈',
            'down': '📉',
            'stable': '➡️',
            'neutral': '⚪'
        };
        return icons[trend] || '⚪';
    }

    getSortIcon(column) {
        if (this.sortColumn !== column) return '';
        return this.sortDirection === 'asc' ? '↑' : '↓';
    }

    formatRiskLevel(level) {
        const labels = {
            'critical': 'Crítico',
            'high': 'Alto',
            'medium': 'Medio',
            'low': 'Bajo'
        };
        return labels[level] || level;
    }

    getNoteIcon(type) {
        const icons = {
            'general': '📝',
            'academic': '📚',
            'risk': '⚠️',
            'positive': '✅'
        };
        return icons[type] || '📝';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES');
    }
}