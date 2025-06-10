export default class ExcelImportModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedFiles = [];
        this.pendingFiles = new Map(); // Almacenar archivos pendientes de mapeo
    }
    
    getBaseFileSlug(fileName) {
        return fileName
            .replace(/\.(xlsx?|csv)$/i, '')
            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '')
            .replace(/-\d{8}-\d{6}$/, '')
            .toLowerCase();
    }

    async render(container) {
        container.innerHTML = `
            <div class="excel-import-page">
                <h2>📥 Importar Excel/CSV de Evolcampus</h2>
                <div class="info-box">
                    <h3>📋 Instrucciones</h3>
                    <ol>
                        <li><strong>Opción A - Excel individual:</strong> Sube archivos Excel (.xlsx) de estudiantes individuales</li>
                        <li><strong>Opción B - CSV masivo:</strong> Sube el CSV generado por el script bulk con todos los estudiantes</li>
                        <li>El sistema detectará automáticamente el tipo de archivo</li>
                        <li>Para CSV masivo: asegúrate de que tenga las columnas correctas</li>
                    </ol>
                    <p><strong>Formato CSV esperado:</strong></p>
                    <code style="display: block; background: #f3f4f6; padding: 10px; border-radius: 4px; font-size: 0.875rem;">
file_name,student_email,student_key,topic_code,activity,score,max_score,attempts,first_attempt,last_attempt,source
                    </code>
                </div>

                <div class="upload-zone" id="uploadZone">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto;">
                        <path d="M7 10L12 5L17 10" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 5V15" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M20 16V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V16" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>Arrastra archivos aquí</h3>
                    <p>Excel (.xlsx) o CSV (.csv)</p>
                    <input type="file" id="fileInput" multiple accept=".xlsx,.xls,.csv" style="display: none;">
                </div>

                <button class="btn btn-primary" id="uploadBtn" disabled>
                    📤 Procesar archivos seleccionados
                </button>

                <div class="file-list" id="fileList"></div>

                <div class="processing-summary" id="processingSummary" style="display: none;">
                    <h3>📊 Resumen del procesamiento</h3>
                    <div class="summary-stats">
                        <div class="stat-box">
                            <div class="stat-value" id="totalRecords">0</div>
                            <div class="stat-label">Registros totales</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="uniqueStudents">0</div>
                            <div class="stat-label">Estudiantes únicos</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="zeroScores">0</div>
                            <div class="stat-label">Tests con nota 0</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="errors">0</div>
                            <div class="stat-label">Errores</div>
                        </div>
                    </div>
                </div>

                <div class="import-log" id="importLog" style="display: none;">
                    <h3>📝 Log de importación</h3>
                    <div class="log-content" id="logContent"></div>
                </div>

                <h3 style="margin-top: 40px;">📊 Historial de Importaciones</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Archivo</th>
                                <th>Estudiante</th>
                                <th>Registros</th>
                                <th>Estado</th>
                                <th>Mensaje</th>
                            </tr>
                        </thead>
                        <tbody id="historyBody">
                            <tr>
                                <td colspan="6" style="text-align: center;">Cargando historial...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <style>
                .excel-import-page {
                    padding: 2rem;
                }
                
                .upload-zone {
                    border: 3px dashed #0066cc;
                    border-radius: 12px;
                    padding: 40px;
                    text-align: center;
                    background: #f0f7ff;
                    margin: 20px 0;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    position: relative;
                    user-select: none;
                }
                
                .upload-zone.dragover {
                    background: #e1f0ff;
                    border-color: #0052cc;
                    transform: scale(1.02);
                }
                
                .upload-zone svg {
                    opacity: 0.7;
                }
                
                .file-list {
                    margin-top: 30px;
                }
                
                .file-item {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                }
                
                .file-item.uploading {
                    background: #e3f2fd;
                    border-color: #2196f3;
                }
                
                .file-item.processing {
                    background: #fff3cd;
                    border-color: #ffc107;
                }
                
                .file-item.completed {
                    background: #d4edda;
                    border-color: #28a745;
                }
                
                .file-item.error {
                    background: #f8d7da;
                    border-color: #dc3545;
                }
                
                .file-item.skipped {
                    background: #e2e3e5;
                    border-color: #6c757d;
                    opacity: 0.7;
                }
                
                .file-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .file-name {
                    flex: 1;
                }
                
                .file-size {
                    color: #666;
                    font-size: 0.9em;
                    margin-left: 10px;
                }
                
                .file-details {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid rgba(0,0,0,0.1);
                }
                
                .student-info {
                    background: rgba(255,255,255,0.8);
                    padding: 10px;
                    border-radius: 5px;
                    margin-bottom: 10px;
                }
                
                .process-stats {
                    background: rgba(255,255,255,0.8);
                    padding: 10px;
                    border-radius: 5px;
                }
                
                .process-stats ul {
                    margin: 5px 0;
                    padding-left: 20px;
                }
                
                .manual-mapping-form {
                    background: white;
                    padding: 15px;
                    border-radius: 5px;
                }
                
                .error-message {
                    color: #dc3545;
                    font-size: 0.9em;
                    margin-bottom: 10px;
                }
                
                .mapping-input {
                    margin: 15px 0;
                }
                
                .mapping-input label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                
                .mapping-input select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                .mapping-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                }
                
                .success-message {
                    color: #28a745;
                    padding: 10px;
                    background: rgba(40, 167, 69, 0.1);
                    border-radius: 5px;
                }
                
                .status-badge {
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .status-pending { background: #e0e0e0; color: #666; }
                .status-processing { background: #ffc107; color: #000; }
                .status-completed { background: #28a745; color: white; }
                .status-error { background: #dc3545; color: white; }
                
                .info-box {
                    background: #e8f4fd;
                    border: 1px solid #bee5eb;
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin: 1rem 0;
                }
                
                .info-box h3 {
                    margin-top: 0;
                    color: #0066cc;
                }
                
                input.form-control {
                    width: 100%;
                    padding: 8px 12px;
                    margin-bottom: 10px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                input.form-control:focus {
                    border-color: #80bdff;
                    outline: 0;
                    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
                }
                
                select.form-control[size] {
                    height: 200px;
                    overflow-y: auto;
                }
                
                select.form-control option {
                    padding: 8px;
                }
                
                select.form-control option:hover {
                    background-color: #f8f9fa;
                }
                
                .mapping-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                
                .mapping-actions .btn {
                    flex: 1;
                    min-width: 150px;
                }
                
                .processing-summary {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 30px 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .summary-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                
                .stat-box {
                    text-align: center;
                    padding: 15px;
                    background: #f9fafb;
                    border-radius: 8px;
                }
                
                .stat-value {
                    font-size: 2rem;
                    font-weight: bold;
                    color: #1e3a8a;
                }
                
                .stat-label {
                    font-size: 0.875rem;
                    color: #6b7280;
                    margin-top: 5px;
                }
                
                .import-log {
                    background: #f9fafb;
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .log-content {
                    font-family: monospace;
                    font-size: 0.875rem;
                    white-space: pre-wrap;
                }
                
                .log-success { color: #10b981; }
                .log-warning { color: #f59e0b; }
                .log-error { color: #ef4444; }
                .log-info { color: #3b82f6; }
            </style>
        `;

        // Guardar referencia global
        window.excelImportModule = this;
        
        // Setup event listeners después de un pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            this.setupEventListeners();
            // Cargar historial
           // this.loadHistory();
        }, 100);
    }

    setupEventListeners() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        
        if (!uploadZone || !fileInput || !uploadBtn) {
            console.error('Elementos del DOM no encontrados');
            return;
        }
        
        // Click en la zona de carga
        uploadZone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Click en zona de carga');
            fileInput.click();
        });
        
        // Debug del file input
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Prevenir comportamiento por defecto del navegador para toda la ventana
        ['dragenter', 'dragover', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Eventos específicos para la zona de carga
        uploadZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.add('dragover');
            console.log('Drag enter');
        });
        
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Solo quitar la clase si realmente salimos de la zona
            if (e.target === uploadZone) {
                uploadZone.classList.remove('dragover');
                console.log('Drag leave');
            }
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            console.log('Archivos soltados:', files.length);
            
            if (files.length > 0) {
                this.handleFiles(files);
            }
        });
        
        // Handle file input change
        fileInput.addEventListener('change', (e) => {
            console.log('Archivos seleccionados:', e.target.files.length);
            if (e.target.files.length > 0) {
                this.handleFiles(e.target.files);
            }
        });
        
        // Upload button
        uploadBtn.addEventListener('click', () => {
            console.log('Click en botón upload');
            this.uploadFiles();
        });
        
        // Verificar que todo está funcionando
        console.log('Event listeners configurados correctamente');
    }

    handleFiles(files) {
        console.log('Procesando archivos:', files);
        
        // Convertir FileList a Array
        const allFiles = Array.from(files);
        console.log('Total archivos recibidos:', allFiles.length);
        
        // Filtrar solo archivos Excel o CSV
        this.selectedFiles = allFiles.filter(file => {
            const isValid = file.name.toLowerCase().endsWith('.xlsx')
                || file.name.toLowerCase().endsWith('.xls')
                || file.name.toLowerCase().endsWith('.csv');
            console.log(`Archivo ${file.name}: ${isValid ? 'ES' : 'NO ES'} válido`);
            return isValid;
        });
        
        console.log('Archivos válidos:', this.selectedFiles.length);
        
        if (allFiles.length > 0 && this.selectedFiles.length === 0) {
            this.dashboard.showNotification('warning', 'Por favor selecciona archivos Excel (.xlsx, .xls) o CSV (.csv)');
            return;
        }
        
        if (this.selectedFiles.length > 0) {
            this.dashboard.showNotification('info', `${this.selectedFiles.length} archivo(s) seleccionado(s)`);
            this.displaySelectedFiles();
        }
        
        // Habilitar/deshabilitar botón de upload
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.disabled = this.selectedFiles.length === 0;
        }
    }

    displaySelectedFiles() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '<h3>📁 Archivos seleccionados:</h3>';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div>
                    <strong>${file.name}</strong>
                    <span style="color: #666; margin-left: 10px;">${(file.size / 1024).toFixed(2)} KB</span>
                    <span style="color: #0066cc; margin-left: 10px;">${file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel'}</span>
                </div>
                <button class="btn btn-sm btn-danger" onclick="window.excelImportModule.removeFile(${index})">
                    Eliminar
                </button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displaySelectedFiles();
        document.getElementById('uploadBtn').disabled = this.selectedFiles.length === 0;
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;
        
        const uploadBtn = document.getElementById('uploadBtn');
        const fileList = document.getElementById('fileList');
        
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Procesando archivos...';
        
        // Mostrar resumen y log
        document.getElementById('processingSummary').style.display = 'block';
        document.getElementById('importLog').style.display = 'block';
        
        // Reiniciar contadores
        this.resetSummary();
        this.clearLog();
        
        // Limpiar lista anterior
        fileList.innerHTML = '<h3>📊 Procesamiento de archivos:</h3>';
        
        for (const file of this.selectedFiles) {
            const isCSV = file.name.toLowerCase().endsWith('.csv');
            
            // Crear elemento para este archivo con ID único
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const fileItem = document.createElement('div');
            fileItem.id = fileId;
            fileItem.className = 'file-item processing';
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-name">
                        <strong>${file.name}</strong>
                        <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div class="processing-status">
                        <span class="status-badge status-processing">⏳ Procesando...</span>
                    </div>
                </div>
                <div class="file-details" style="display: none;">
                    <div class="detail-content"></div>
                </div>
            `;
            fileList.appendChild(fileItem);
            
            try {
                if (isCSV) {
                    // Procesar CSV masivo
                    await this.processCsvFile(file, fileId);
                } else {
                    // Procesar Excel individual (mantener compatibilidad)
                    await this.processExcelFile(file, fileId);
                }
            } catch (error) {
                console.error('Error con archivo:', error);
                this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
                this.addLog('error', `Error procesando ${file.name}: ${error.message}`);
                this.updateSummary('errors', 1);
            }
        }
        
        // Limpiar solo si no hay archivos pendientes de mapeo
        // Los archivos con mapeo pendiente se mantienen para reprocesamiento
        const pendingMappingFiles = document.querySelectorAll('.file-item.error .manual-mapping-form');
        if (pendingMappingFiles.length === 0) {
            this.selectedFiles = [];
            document.getElementById('fileInput').value = '';
        }
        
        uploadBtn.textContent = '📤 Procesar archivos seleccionados';
        uploadBtn.disabled = true;
        
        // Actualizar historial después de 2 segundos
        setTimeout(() => this.loadImportSummary(), 2000);
    }

    // NUEVA FUNCIONALIDAD: Procesar archivo CSV masivo
    async processCsvFile(file, fileId) {
        this.addLog('info', `📄 Procesando CSV: ${file.name}`);
        this.updateFileStatus(fileId, 'processing', '🔄 Procesando CSV...');
        
        try {
            // Cargar Papa Parse para procesar CSV
            await this.loadPapaParse();
            
            const text = await file.text();
            const parsed = window.Papa.parse(text, { 
                header: true, 
                skipEmptyLines: true,
                dynamicTyping: true 
            });
            
            if (parsed.errors.length > 0) {
                throw new Error(`Error parseando CSV: ${parsed.errors[0].message}`);
            }
            
            // Procesar datos del CSV
            const processedData = await this.processBulkCsvData(parsed.data, file.name);
            
            // Actualizar estado final
            this.updateFileStatus(fileId, 'completed', '✅ CSV procesado exitosamente', {
                totalRecords: processedData.totalRecords,
                uniqueStudents: processedData.uniqueStudents.size,
                zeroScores: processedData.zeroScores
            });
            
            this.addLog('success', `✅ CSV procesado: ${processedData.totalRecords} registros de ${processedData.uniqueStudents.size} estudiantes`);
            
        } catch (error) {
            // Si es error de mapeo, activar mapeo manual
            if (error.needsMapping) {
                this.updateFileStatus(fileId, 'error', `❌ ${error.message}`);
                this.offerManualMapping(fileId, file.name, error.message, error.searchName);
                return; // No relanzar el error
            }
            throw error;
        }
    }

    async processBulkCsvData(rows, fileName) {
        const summary = {
            totalRecords: 0,
            uniqueStudents: new Set(),
            zeroScores: 0,
            errors: 0,
            processedRecords: []
        };
        
        // Detectar si es un CSV de un solo estudiante o masivo
        const uniqueStudentKeys = new Set(rows.map(r => r.student_key || r.student_email).filter(Boolean));
        const isSingleStudent = uniqueStudentKeys.size === 1;
        
        this.addLog('info', `📊 Detectado: ${isSingleStudent ? 'CSV individual' : 'CSV masivo'} (${uniqueStudentKeys.size} estudiante(s))`);
        
        // Cache de usuarios para evitar consultas repetidas
        const userCache = new Map();
        
        // Agrupar por lotes para optimizar inserciones
        const batchSize = 100;
        const batches = [];
        
        for (let i = 0; i < rows.length; i += batchSize) {
            batches.push(rows.slice(i, i + batchSize));
        }
        
        // En processCsvFile, después de la línea 234 aproximadamente:
        if (isSingleStudent && rows.length > 0) {
            const firstRow = rows[0];
            let studentKey = firstRow.student_email || firstRow.student_key;
            
            // NUEVO: Limpiar el student_key si no es un email
            if (studentKey && !studentKey.includes('@')) {
                studentKey = this.getBaseFileSlug(studentKey);
            }
            
            if (studentKey && !userCache.has(studentKey)) {
                const studentId = await this.findStudentId(firstRow.student_email, studentKey);
                
                if (!studentId) {
                    // Lanzar error inmediatamente para activar mapeo manual
                    throw {
                        needsMapping: true,
                        searchName: studentKey, // Ahora usa el nombre limpio
                        message: `No se pudo identificar al estudiante: ${studentKey}`
                    };
                }
                
                // Cachear para todos los registros
                userCache.set(studentKey, studentId);
                summary.uniqueStudents.add(studentKey);
            }
        }
        
        // Procesar cada lote
        for (const [batchIndex, batch] of batches.entries()) {
            this.addLog('info', `Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} registros)`);
            
            const batchRecords = [];
            
            for (const row of batch) {
                try {
                    // Validar fila
                    if (!row.activity || row.activity.trim() === '') {
                        continue; // Saltar filas vacías
                    }
                    
                    // Buscar o cachear usuario
                    let studentId = null;
                    const cacheKey = row.student_email || row.student_key;
                    
                    if (userCache.has(cacheKey)) {
                        studentId = userCache.get(cacheKey);
                    } else {
                        // Buscar usuario
                        studentId = await this.findStudentId(row.student_email, row.student_key);
                        if (studentId) {
                            userCache.set(cacheKey, studentId);
                            summary.uniqueStudents.add(cacheKey);
                        }
                    }
                    
                    if (!studentId) {
                        this.addLog('warning', `⚠️ Usuario no encontrado: ${cacheKey} (${row.file_name})`);
                        summary.errors++;
                        continue;
                    }
                    
                    // Contar tests con nota 0
                    if (parseFloat(row.score) === 0) {
                        summary.zeroScores++;
                    }
                    
                    // Crear registro para topic_results
                    const record = {
                        student_id: studentId,
                        topic_code: row.topic_code || 'GENERAL',
                        activity: row.activity.trim(),
                        score: parseFloat(row.score) || 0,
                        max_score: parseFloat(row.max_score) || 10,
                        attempts: parseInt(row.attempts) || 1,
                        first_attempt: this.parseDate(row.first_attempt),
                        last_attempt: this.parseDate(row.last_attempt),
                        source: row.source || fileName,
                        created_at: new Date().toISOString()
                    };
                    
                    batchRecords.push(record);
                    summary.totalRecords++;
                    
                } catch (error) {
                    this.addLog('error', `Error procesando fila: ${error.message}`);
                    summary.errors++;
                }
            }
            
            // Insertar lote en base de datos
            if (batchRecords.length > 0) {
                const { error } = await this.supabase
                    .from('topic_results')
                    .upsert(batchRecords, {
                        onConflict: 'student_id,topic_code,activity',
                        ignoreDuplicates: false
                    });
                
                if (error) {
                    this.addLog('error', `Error insertando lote: ${error.message}`);
                    summary.errors += batchRecords.length;
                } else {
                    this.addLog('success', `✅ Lote insertado: ${batchRecords.length} registros`);
                }
            }
        }
        
        // Actualizar resumen en la UI
        this.updateSummary('totalRecords', summary.totalRecords);
        this.updateSummary('uniqueStudents', summary.uniqueStudents.size);
        this.updateSummary('zeroScores', summary.zeroScores);
        this.updateSummary('errors', summary.errors);
        
        // Log final con estadísticas
        if (summary.zeroScores > 0) {
            this.addLog('warning', `⚠️ Se encontraron ${summary.zeroScores} tests con nota 0 (${((summary.zeroScores / summary.totalRecords) * 100).toFixed(1)}%)`);
        }
        
        return summary;
    }

    async findStudentId(email, studentKey) {
        // Primero intentar por email
        if (email && email.trim() !== '') {
            const { data: user } = await this.supabase
                .from('users')
                .select('id')
                .eq('email', email.trim())
                .single();
            
            if (user) return user.id;
        }
        
        // Si no se encontró por email, buscar por student_key
        if (studentKey) {
            // NUEVO: Limpiar el studentKey antes de buscar
            const cleanedKey = this.getBaseFileSlug(studentKey);
            
            // Si student_key es un UUID, buscar por ID
            if (studentKey.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                const { data: user } = await this.supabase
                    .from('users')
                    .select('id')
                    .eq('id', studentKey)
                    .single();
                
                if (user) return user.id;
            } else {
                // MODIFICADO: Buscar en mapeos usando el nombre limpio
                const { data: mapping } = await this.supabase
                    .from('excel_name_mappings')
                    .select('user_email')
                    .eq('excel_name', cleanedKey.toLowerCase())
                    .single();
                
                if (mapping) {
                    const { data: user } = await this.supabase
                        .from('users')
                        .select('id')
                        .eq('email', mapping.user_email)
                        .single();
                    
                    if (user) return user.id;
                }
            }
        }
        
        return null;
    }

    // MANTENER COMPATIBILIDAD: Procesar Excel individual
    async processExcelFile(file, fileId) {
        const fileName = file.name;
        
        try {
            // Usar el nombre original sin modificación
            console.log(`Procesando archivo Excel: ${fileName}`);
            
            // Verificar permisos
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) {
                throw new Error('No estás autenticado. Por favor, inicia sesión de nuevo.');
            }
            
            // Actualizar estado
            this.updateFileStatus(fileId, 'uploading', '📤 Subiendo archivo...');
            this.addLog('info', `📤 Subiendo ${fileName}...`);
            
            // Subir archivo al bucket
            const { data, error } = await this.supabase.storage
                .from('excel-public')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) throw error;
            
            // Actualizar estado
            this.updateFileStatus(fileId, 'processing', '🔄 Procesando Excel...');
            this.addLog('info', `🔄 Procesando ${fileName}...`);
            
            // Procesar localmente
            const processResult = await this.processExcelLocally(file, fileName);
            
            if (processResult.success) {
                // Actualizar UI con éxito
                this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente', {
                    student: processResult.student,
                    recordsProcessed: processResult.recordsProcessed,
                    details: processResult.details
                });
                
                this.addLog('success', `✅ ${fileName}: ${processResult.recordsProcessed} registros para ${processResult.student.email || 'usuario'}`);
                
                this.dashboard.showNotification('success', 
                    `✅ ${file.name} procesado: ${processResult.recordsProcessed} registros`
                );
            } else {
                // Si hay error con información adicional
                const errorObj = {
                    message: processResult.error,
                    needsMapping: processResult.needsMapping,
                    searchName: processResult.searchName
                };
                throw errorObj;
            }
            
        } catch (error) {
            console.error('Error con archivo:', error);
            
            // Actualizar UI con error
            this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
            
            // Si es error de usuario no encontrado, ofrecer mapeo manual
            if (error.needsMapping) {
                this.offerManualMapping(fileId, file.name, error.message, error.searchName);
            }
            
            throw error;
        }
    }

    // Métodos auxiliares de UI
    updateFileStatus(fileId, status, message, details = null) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;
        
        const statusBadge = fileItem.querySelector('.status-badge');
        const fileDetails = fileItem.querySelector('.file-details');
        const detailContent = fileItem.querySelector('.detail-content');
        
        // Actualizar clases
        fileItem.className = `file-item ${status}`;
        statusBadge.className = `status-badge status-${status}`;
        statusBadge.textContent = message;
        
        // Si hay detalles, mostrarlos
        if (details && (details.student || details.totalRecords)) {
            fileDetails.style.display = 'block';
            
            if (details.student) {
                // Detalles de Excel individual
                detailContent.innerHTML = `
                    <div class="student-info">
                        <strong>👤 Estudiante identificado:</strong> ${details.student.name || details.student.email}
                        <br><small>📧 Email: ${details.student.email}</small>
                        ${details.student.cohort ? `<br><small>🎓 Cohorte: ${details.student.cohort}</small>` : ''}
                    </div>
                    <div class="process-stats">
                        <strong>📊 Estadísticas:</strong>
                        <ul>
                            <li>Registros procesados: ${details.recordsProcessed || 0}</li>
                            <li>Fuente: Excel importado</li>
                            <li>Fecha: ${new Date().toLocaleString('es-ES')}</li>
                        </ul>
                    </div>
                `;
            } else {
                // Detalles de CSV masivo
                detailContent.innerHTML = `
                    <div class="process-stats">
                        <strong>📊 Estadísticas del CSV:</strong>
                        <ul>
                            <li>Total registros: ${details.totalRecords || 0}</li>
                            <li>Estudiantes únicos: ${details.uniqueStudents || 0}</li>
                            <li>Tests con nota 0: ${details.zeroScores || 0}</li>
                            <li>Fecha: ${new Date().toLocaleString('es-ES')}</li>
                        </ul>
                    </div>
                `;
            }
        }
    }

    resetSummary() {
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('uniqueStudents').textContent = '0';
        document.getElementById('zeroScores').textContent = '0';
        document.getElementById('errors').textContent = '0';
    }

    updateSummary(field, increment) {
        const element = document.getElementById(field);
        if (element) {
            const current = parseInt(element.textContent) || 0;
            element.textContent = current + increment;
        }
    }

    clearLog() {
        document.getElementById('logContent').innerHTML = '';
    }

    addLog(type, message) {
        const logContent = document.getElementById('logContent');
        const timestamp = new Date().toLocaleTimeString('es-ES');
        const logEntry = document.createElement('div');
        logEntry.className = `log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        logContent.appendChild(logEntry);
        
        // Auto-scroll
        logContent.scrollTop = logContent.scrollHeight;
    }

    parseDate(dateStr) {
        try {
            if (!dateStr || dateStr === null || dateStr === undefined) {
                return new Date().toISOString();
            }
            
            // IMPORTANTE: Forzar conversión a string
            let dateString = '';
            if (typeof dateStr === 'object' && dateStr instanceof Date) {
                return dateStr.toISOString();
            } else if (typeof dateStr === 'number') {
                // Si es un número, podría ser timestamp de Excel
                const date = new Date((dateStr - 25569) * 86400 * 1000);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
                dateString = String(dateStr);
            } else {
                dateString = String(dateStr);
            }
            
            // Validar que ahora sí es string
            if (typeof dateString !== 'string') {
                console.warn('parseDate: No se pudo convertir a string:', dateStr);
                return new Date().toISOString();
            }
            
            // Si ya es ISO, devolverlo tal cual
            if (dateString.indexOf('T') !== -1) {
                return dateString;
            }
            
            // Parsear formato DD/MM/YYYY o DD-MM-YYYY
            const parts = dateString.split(/[\/\-]/);
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString();
                    }
                }
            }
            
            // Intentar parsear como fecha estándar
            const parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString();
            }
            
            return new Date().toISOString();
            
        } catch (error) {
            console.error('Error en parseDate:', error, 'valor original:', dateStr);
            return new Date().toISOString();
        }
    }

    parseSpanishDate(dateStr) {
        try {
            if (!dateStr || dateStr === null || dateStr === undefined) {
                return new Date().toISOString();
            }
            
            // Forzar conversión a string de forma segura
            let dateString = '';
            if (typeof dateStr === 'object' && dateStr instanceof Date) {
                return dateStr.toISOString();
            } else if (typeof dateStr === 'number') {
                const date = new Date((dateStr - 25569) * 86400 * 1000);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
                dateString = String(dateStr);
            } else {
                dateString = String(dateStr);
            }
            
            // Buscar formato DD/MM/YYYY
            const match = dateString.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10);
                const year = parseInt(match[3], 10);
                
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
            }
            
            return new Date().toISOString();
            
        } catch (error) {
            console.error('Error en parseSpanishDate:', error, 'valor original:', dateStr);
            return new Date().toISOString();
        }
    }

    // Cargar librerías externas
    async loadPapaParse() {
        return new Promise((resolve, reject) => {
            if (window.Papa) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadSheetJS() {
        return new Promise((resolve, reject) => {
            if (window.XLSX) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Procesamiento local de Excel (compatible con versión anterior)
    async processExcelLocally(file, fileName) {
        try {
            console.log('📊 Procesando Excel localmente...');
            
            // Cargar SheetJS
            await this.loadSheetJS();
            
            // Leer archivo
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            
            // Extraer información del estudiante
            const studentInfo = await this.extractStudentInfoLocal(rawData, fileName);
            
            if (!studentInfo.email) {
                // Devolver error con información para mapeo
                return {
                    success: false,
                    error: `No se pudo identificar al estudiante. ${studentInfo.searchName ? `Nombre buscado: ${studentInfo.searchName}` : ''}`,
                    needsMapping: true,
                    searchName: studentInfo.searchName
                };
            }
            
            // Buscar usuario
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('id, username, email, cohort')
                .eq('email', studentInfo.email)
                .single();
            
            if (userError || !user) {
                // Usuario no existe
                return {
                    success: false,
                    error: `Usuario no encontrado: ${studentInfo.email}`,
                    needsUserCreation: true,
                    studentEmail: studentInfo.email
                };
            }
            
            // Extraer tests
            const testRecords = this.extractTestRecordsLocal(rawData, user.id);
            
            console.log(`📝 Encontrados ${testRecords.length} registros de tests`);
            
            // Contar tests con nota 0
            const zeroCount = testRecords.filter(r => r.score === 0).length;
            if (zeroCount > 0) {
                this.addLog('warning', `⚠️ ${fileName}: ${zeroCount} tests con nota 0`);
                this.updateSummary('zeroScores', zeroCount);
            }
            
            // Guardar en base de datos
            if (testRecords.length > 0) {
                const { error: insertError } = await this.supabase
                    .from('topic_results')
                    .upsert(testRecords, {
                        onConflict: 'student_id,topic_code,activity'
                    });
                
                if (insertError) {
                    throw new Error(`Error guardando datos: ${insertError.message}`);
                }
            }
            
            // Actualizar resumen
            this.updateSummary('totalRecords', testRecords.length);
            this.updateSummary('uniqueStudents', 1);
            
            // Registrar en log
            await this.supabase.from('api_sync_log').insert({
                endpoint: 'process_excel',
                status_code: 200,
                records_synced: testRecords.length,
                details: {
                    fileName,
                    studentEmail: studentInfo.email,
                    recordsProcessed: testRecords.length,
                    processedAt: new Date().toISOString(),
                    processingMode: 'local'
                }
            });
            
            return {
                success: true,
                student: {
                    ...user,
                    email: studentInfo.email,
                    name: user.username
                },
                recordsProcessed: testRecords.length
            };
            
        } catch (error) {
            console.error('Error en procesamiento local:', error);
            throw error;
        }
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async extractStudentInfoLocal(rawData, fileName) {
        const info = { email: null, searchName: null, baseFileName: null };
        
        // Buscar email en las primeras filas
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
            const row = rawData[i];
            if (!row) continue;
            
            const rowText = row.join(' ').toLowerCase();
            const emailMatch = rowText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (emailMatch) {
                info.email = emailMatch[1];
                return info;
            }
        }
        
        // Usar utilidad común para obtener slug base
        const baseFileName = this.getBaseFileSlug(fileName);
        info.baseFileName = baseFileName;
        
        // Extraer partes del nombre
        const parts = baseFileName.split('-');
        
        if (parts.length >= 3 && parts[0] === 'expediente') {
            // Formato: expediente-nombre-apellidos
            info.searchName = parts.slice(1).join(' ');
        } else if (parts.length >= 2) {
            // Otros formatos
            info.searchName = parts.join(' ');
        }
        
        console.log('Nombre base extraído:', info.baseFileName);
        console.log('Nombre para buscar:', info.searchName);
        
        if (info.searchName) {
            // Buscar en mapeos usando el nombre base
            const { data: mapping } = await this.supabase
                .from('excel_name_mappings')
                .select('user_email')
                .eq('excel_name', info.baseFileName.toLowerCase())
                .single();
            
            if (mapping) {
                info.email = mapping.user_email;
                console.log('✅ Encontrado en mapeo por nombre base:', info.email);
                return info;
            }
            
            // Buscar por nombre similar
            const { data: users } = await this.supabase
                .from('users')
                .select('email')
                .ilike('username', `%${info.searchName}%`);
            
            if (users && users.length === 1) {
                info.email = users[0].email;
            }
        }
        
        return info;
    }

    extractTestRecordsLocal(rawData, studentId) {
        const records = [];
        
        console.log('🔍 Analizando Excel de Evolcampus...');
        console.log('📊 Total de filas:', rawData.length);
        
        // Mostrar las primeras filas para debugging
        console.log('📋 Primeras 5 filas del Excel:');
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
            console.log(`Fila ${i}:`, rawData[i]?.slice(0, 5));
        }
        
        // Buscar donde empiezan los datos de tests
        let dataStartRow = -1;
        let dateColumns = [];
        
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            if (!rawData[i]) continue;
            
            const firstCell = (rawData[i][0] || '').toString().toLowerCase();
            
            // Detectar si es una fila con nombre de test/tema
            if (firstCell.includes('test') || firstCell.includes('tema') || 
                firstCell.includes('t1') || firstCell.includes('t2') ||
                firstCell.includes('ejercicio') || firstCell.includes('evaluación')) {
                dataStartRow = i;
                console.log('✅ Datos encontrados a partir de la fila:', dataStartRow);
                
                // Buscar columnas con fechas en la fila anterior
                if (i > 0 && rawData[i-1]) {
                    rawData[i-1].forEach((cell, index) => {
                        if (index > 0 && cell) {
                            const cellStr = cell.toString();
                            // Detectar si parece una fecha
                            if (cellStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || 
                                cellStr.match(/\d{4}-\d{2}-\d{2}/)) {
                                dateColumns.push({
                                    index: index,
                                    date: cellStr
                                });
                            }
                        }
                    });
                }
                break;
            }
        }
        
        if (dataStartRow === -1) {
            console.log('❌ No se encontraron datos de tests en el formato esperado');
            return records;
        }
        
        console.log('📅 Columnas de fechas encontradas:', dateColumns.length);
        
        // Procesar cada fila de test
        let processedTests = 0;
        const testsSummary = {};
        
        for (let i = dataStartRow; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || !row[0]) continue;
            
            const testName = row[0].toString().trim();
            if (!testName) continue;
            
            // Extraer información del test
            let topicCode = 'general';
            let cleanTestName = testName;
            
            // Intentar extraer el código del tema
            const topicMatch = testName.match(/\b(T\d+)\b/i);
            if (topicMatch) {
                topicCode = topicMatch[1].toUpperCase();
            } else if (testName.match(/tema\s*(\d+)/i)) {
                topicCode = 'Tema ' + testName.match(/tema\s*(\d+)/i)[1];
            }
            
            // Para cada columna de fecha, crear un registro si hay puntuación
            dateColumns.forEach(dateCol => {
                const score = row[dateCol.index];
                if (score !== undefined && score !== null && score !== '') {
                    const scoreValue = parseFloat(score);
                    
                    if (!isNaN(scoreValue)) {
                        const record = {
                            student_id: studentId,
                            topic_code: topicCode,
                            activity: cleanTestName,
                            score: scoreValue,
                            max_score: 10, // Asumimos que las notas son sobre 10
                            attempts: 1,
                            source: 'evol_excel',
                            first_attempt: this.parseSpanishDate(dateCol.date),
                            last_attempt: this.parseSpanishDate(dateCol.date),
                            created_at: new Date().toISOString()
                        };
                        
                        records.push(record);
                        
                        // Actualizar resumen
                        if (!testsSummary[topicCode]) {
                            testsSummary[topicCode] = {
                                count: 0,
                                totalScore: 0,
                                maxScore: 0,
                                zeroScores: 0
                            };
                        }
                        testsSummary[topicCode].count++;
                        testsSummary[topicCode].totalScore += scoreValue;
                        testsSummary[topicCode].maxScore = Math.max(testsSummary[topicCode].maxScore, scoreValue);
                        if (scoreValue === 0) {
                            testsSummary[topicCode].zeroScores++;
                        }
                    }
                }
            });
            
            processedTests++;
        }
        
        console.log(`✅ Procesados ${processedTests} tests únicos`);
        console.log(`📊 Total de registros creados: ${records.length}`);
        console.log('📈 Resumen por tema:', testsSummary);
        
        // Mostrar algunos ejemplos
        if (records.length > 0) {
            console.log('📝 Primeros 3 registros:');
            records.slice(0, 3).forEach((r, i) => {
                console.log(`  ${i+1}. ${r.activity} - Tema ${r.topic_code}: ${r.score}/${r.max_score}`);
            });
        }
        
        return records;
    }

    // Métodos para mapeo manual (mantener compatibilidad)
    offerManualMapping(fileId, fileName, errorMessage, searchName) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;
        
        // Buscar y almacenar el archivo original
        const originalFile = this.selectedFiles.find(f => f.name === fileName);
        if (originalFile) {
            this.pendingFiles.set(fileId, originalFile);
        }
        
        const detailContent = fileItem.querySelector('.detail-content');
        const fileDetails = fileItem.querySelector('.file-details');
        
        fileDetails.style.display = 'block';
        
        // Usar slug base y nombre probable
        const baseFileName = this.getBaseFileSlug(fileName);
        const possibleName = searchName || baseFileName
            .replace(/^expediente-/, '')
            .split('-')
            .join(' ');
        
        detailContent.innerHTML = `
            <div class="manual-mapping-form">
                <p class="error-message">${errorMessage}</p>
                <p><strong>🔍 Necesitamos identificar al estudiante</strong></p>
                <p>Archivo: <code>${baseFileName}</code></p>
                <p>Nombre detectado: <code>${possibleName}</code></p>
                
                <div class="mapping-input">
                    <label>Buscar estudiante por nombre:</label>
                    <input type="text" 
                           id="student-search-${fileId}" 
                           class="form-control" 
                           placeholder="Escribe para buscar..."
                           value="${possibleName}">
                    
                    <label style="margin-top: 10px;">O selecciona de la lista:</label>
                    <select id="mapping-select-${fileId}" class="form-control" size="8">
                        <option value="">Cargando estudiantes...</option>
                    </select>
                </div>
                
                <div class="mapping-actions">
                    <button class="btn btn-sm btn-primary" 
                            onclick="window.excelImportModule.saveMappingWithBase('${fileId}', '${fileName}')"
                            id="save-mapping-btn-${fileId}"
                            disabled>
                        💾 Guardar mapeo (se recordará para futuros archivos)
                    </button>
                    <button class="btn btn-sm btn-secondary" 
                            onclick="window.excelImportModule.skipFile('${fileId}')">
                        ⏭️ Omitir este archivo
                    </button>
                </div>
                
                <div class="info-box" style="margin-top: 1rem;">
                    <p><small>💡 Una vez que mapees este archivo, todos los futuros archivos de <strong>${possibleName}</strong> se procesarán automáticamente.</small></p>
                </div>
            </div>
        `;
        
        // Cargar lista de estudiantes con búsqueda inteligente
        this.loadStudentsListWithSearch(`mapping-select-${fileId}`, `student-search-${fileId}`, possibleName, fileId);
    }

    async loadStudentsListWithSearch(selectId, searchId, initialSearch, fileId) {
        try {
            console.log('🔍 Cargando lista de estudiantes...');
            
            // Cargar todos los usuarios
            let { data: allUsers, error } = await this.supabase
                .from('users')
                .select('id, email, username, cohort, is_admin')
                .order('username');
            
            // Filtrar solo estudiantes (no administradores)
            const allStudents = allUsers ? allUsers.filter(user => !user.is_admin) : [];
            
            console.log('📊 Estudiantes cargados:', allStudents?.length || 0);
            
            if (error) {
                console.error('❌ Error cargando estudiantes:', error);
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Error cargando estudiantes</option>';
                }
                return;
            }
            
            const select = document.getElementById(selectId);
            const searchInput = document.getElementById(searchId);
            const saveBtn = document.getElementById(`save-mapping-btn-${fileId}`);
            
            if (!select || !searchInput) {
                console.error('❌ No se encontraron elementos del DOM');
                return;
            }
            
            // Función para actualizar la lista filtrada
            const updateList = (searchTerm) => {
                console.log('🔍 Filtrando con término:', searchTerm);
                
                const filtered = searchTerm 
                    ? allStudents.filter(s => 
                        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.email.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                    : allStudents;
                
                console.log('📋 Estudiantes filtrados:', filtered.length);
                
                select.innerHTML = '';
                
                if (filtered.length === 0) {
                    select.innerHTML = '<option value="">No se encontraron coincidencias</option>';
                    if (saveBtn) saveBtn.disabled = true;
                } else {
                    filtered.forEach(student => {
                        const option = document.createElement('option');
                        option.value = student.email;
                        option.textContent = `${student.username} (${student.email})${student.cohort ? ` - ${student.cohort}` : ''}`;
                        select.appendChild(option);
                    });
                    
                    console.log('✅ Lista actualizada con', filtered.length, 'estudiantes');
                    
                    // Si hay exactamente una coincidencia, seleccionarla automáticamente
                    if (filtered.length === 1) {
                        select.value = filtered[0].email;
                        console.log('🎯 Auto-seleccionado:', filtered[0].email);
                    }
                    
                    if (saveBtn) saveBtn.disabled = false;
                }
            };
            
            // Evento de búsqueda en tiempo real
            searchInput.addEventListener('input', (e) => {
                updateList(e.target.value);
            });
            
            // Habilitar/deshabilitar botón según selección
            select.addEventListener('change', (e) => {
                if (saveBtn) saveBtn.disabled = !e.target.value;
            });
            
            // Búsqueda inicial
            console.log('🚀 Iniciando búsqueda con:', initialSearch);
            updateList(initialSearch);
            
        } catch (error) {
            console.error('❌ Error cargando estudiantes:', error);
            
            // Mostrar error en el select
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Error cargando estudiantes</option>';
            }
        }
    }

    async saveMappingWithBase(fileId, originalFileName) {
        const select = document.getElementById(`mapping-select-${fileId}`);
        if (!select || !select.value) {
            this.dashboard.showNotification('warning', 'Por favor selecciona un estudiante');
            return;
        }
        
        try {
            // Obtener slug base del archivo
            const baseFileName = this.getBaseFileSlug(originalFileName);
            
            // Guardar el mapeo usando el nombre base
            const { error } = await this.supabase
                .from('excel_name_mappings')
                .insert({
                    excel_name: baseFileName.toLowerCase(),
                    user_email: select.value,
                    notes: `Mapeo creado desde archivo: ${originalFileName}`
                });
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 
                `✅ Mapeo guardado. Los próximos archivos de este estudiante se procesarán automáticamente.`
            );
            
            this.addLog('success', `✅ Mapeo guardado: ${baseFileName} → ${select.value}`);
            
            // Actualizar UI para mostrar éxito
            const fileItem = document.getElementById(fileId);
            if (fileItem) {
                const detailContent = fileItem.querySelector('.detail-content');
                detailContent.innerHTML = `
                    <div class="success-message">
                        ✅ Mapeo guardado exitosamente<br>
                        <small>Los archivos de <strong>${baseFileName}</strong> se asociarán automáticamente a ${select.value}</small>
                        <br><br>
                        <button class="btn btn-sm btn-primary" 
                                onclick="window.excelImportModule.retryFileWithMapping('${fileId}', '${originalFileName}', '${select.value}')">
                            🔄 Procesar este archivo ahora
                        </button>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error guardando mapeo:', error);
            this.dashboard.showNotification('error', 'Error al guardar el mapeo: ' + error.message);
        }
    }

    async retryFileWithMapping(fileId, fileName, userEmail) {
        try {
            // Buscar el archivo original en pendingFiles primero, luego en selectedFiles
            let originalFile = this.pendingFiles.get(fileId);
            
            if (!originalFile) {
                originalFile = this.selectedFiles.find(f => f.name === fileName);
            }
            
            if (!originalFile) {
                this.dashboard.showNotification('error', 'No se pudo encontrar el archivo original para reprocesar');
                return;
            }
            
            // Actualizar estado
            this.updateFileStatus(fileId, 'processing', '🔄 Reprocesando con mapeo...');
            
            const isCSV = fileName.toLowerCase().endsWith('.csv');
            let processResult;
            
            if (isCSV) {
                // Procesar CSV con email conocido
                processResult = await this.processCsvLocallyWithEmail(originalFile, fileName, userEmail);
            } else {
                // Procesar Excel con email conocido
                processResult = await this.processExcelLocallyWithEmail(originalFile, fileName, userEmail);
            }
            
            if (processResult.success) {
                this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente con mapeo manual', {
                    student: processResult.student,
                    recordsProcessed: processResult.recordsProcessed,
                    details: processResult.details
                });
                
                this.dashboard.showNotification('success', 
                    `✅ Archivo procesado: ${processResult.recordsProcessed} registros para ${processResult.student.email}`
                );
                
                // Limpiar archivo pendiente
                this.pendingFiles.delete(fileId);
            } else {
                throw new Error(processResult.error || 'Error en el reprocesamiento');
            }
            
        } catch (error) {
            console.error('Error reprocesando archivo:', error);
            this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
            this.dashboard.showNotification('error', 'Error al reprocesar: ' + error.message);
        }
    }

    // Método auxiliar para procesar CSV con email conocido
    async processCsvLocallyWithEmail(file, fileName, userEmail) {
        try {
            console.log('📊 Reprocesando CSV con email mapeado:', userEmail);
            
            // Buscar usuario directamente por email
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('id, username, email, cohort')
                .eq('email', userEmail)
                .single();
            
            if (userError || !user) {
                throw new Error(`Usuario no encontrado: ${userEmail}`);
            }
            
            // Cargar Papa Parse si no está cargado
            if (!window.Papa) {
                await this.loadPapaParse();
            }
            
            // Leer y parsear CSV
            const text = await file.text();
            const parsed = window.Papa.parse(text, { 
                header: true, 
                skipEmptyLines: true,
                dynamicTyping: true 
            });
            
            if (parsed.errors.length > 0) {
                throw new Error(`Error parseando CSV: ${parsed.errors[0].message}`);
            }
            
            // Procesar registros
            const testRecords = [];
            let zeroScores = 0;
            
            for (const row of parsed.data) {
                if (!row.activity || row.activity.trim() === '') continue;
                
                const score = parseFloat(row.score) || 0;
                if (score === 0) zeroScores++;
                
                const record = {
                    student_id: user.id,
                    topic_code: row.topic_code || 'GENERAL',
                    activity: row.activity.trim(),
                    score: score,
                    max_score: parseFloat(row.max_score) || 10,
                    attempts: parseInt(row.attempts) || 1,
                    first_attempt: this.parseDate(row.first_attempt),
                    last_attempt: this.parseDate(row.last_attempt),
                    source: row.source || fileName,
                    created_at: new Date().toISOString()
                };
                
                testRecords.push(record);
            }
            
            console.log(`📝 Encontrados ${testRecords.length} registros de tests`);
            
            // Guardar en base de datos
            if (testRecords.length > 0) {
                const { error: insertError } = await this.supabase
                    .from('topic_results')
                    .upsert(testRecords, {
                        onConflict: 'student_id,topic_code,activity'
                    });
                
                if (insertError) {
                    throw new Error(`Error guardando datos: ${insertError.message}`);
                }
            }
            
            // Actualizar resumen
            this.updateSummary('totalRecords', testRecords.length);
            this.updateSummary('uniqueStudents', 1);
            this.updateSummary('zeroScores', zeroScores);
            
            // Registrar en log
            await this.supabase.from('api_sync_log').insert({
                endpoint: 'process_csv',
                status_code: 200,
                records_synced: testRecords.length,
                details: {
                    fileName,
                    studentEmail: userEmail,
                    recordsProcessed: testRecords.length,
                    processedAt: new Date().toISOString(),
                    processingMode: 'csv_with_mapping'
                }
            });
            
            return {
                success: true,
                student: {
                    ...user,
                    email: userEmail,
                    name: user.username
                },
                recordsProcessed: testRecords.length
            };
            
        } catch (error) {
            console.error('Error en procesamiento CSV con email:', error);
            throw error;
        }
    }

    // Método auxiliar para procesar con email conocido
    async processExcelLocallyWithEmail(file, fileName, userEmail) {
        try {
            console.log('📊 Reprocesando Excel con email mapeado:', userEmail);
            
            // Cargar SheetJS si no está cargado
            if (!window.XLSX) {
                await this.loadSheetJS();
            }
            
            // Leer archivo
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            
            // Buscar usuario directamente por email
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('id, username, email, cohort')
                .eq('email', userEmail)
                .single();
            
            if (userError || !user) {
                throw new Error(`Usuario no encontrado: ${userEmail}`);
            }
            
            // Procesar tests
            const testRecords = this.extractTestRecordsLocal(rawData, user.id);
            
            console.log(`📝 Encontrados ${testRecords.length} registros de tests`);
            
            // Guardar en base de datos
            if (testRecords.length > 0) {
                const { error: insertError } = await this.supabase
                    .from('topic_results')
                    .upsert(testRecords, {
                        onConflict: 'student_id,topic_code,activity'
                    });
                
                if (insertError) {
                    throw new Error(`Error guardando datos: ${insertError.message}`);
                }
            }
            
            // Registrar en log
            await this.supabase.from('api_sync_log').insert({
                endpoint: 'process_excel',
                status_code: 200,
                records_synced: testRecords.length,
                details: {
                    fileName,
                    studentEmail: userEmail,
                    recordsProcessed: testRecords.length,
                    processedAt: new Date().toISOString(),
                    processingMode: 'local_with_mapping'
                }
            });
            
            return {
                success: true,
                student: {
                    ...user,
                    email: userEmail,
                    name: user.username
                },
                recordsProcessed: testRecords.length
            };
            
        } catch (error) {
            console.error('Error en procesamiento con email:', error);
            throw error;
        }
    }

    skipFile(fileId) {
        const fileItem = document.getElementById(fileId);
        if (fileItem) {
            this.updateFileStatus(fileId, 'skipped', '⏭️ Archivo omitido');
            fileItem.style.opacity = '0.5';
            
            // Ocultar detalles
            const fileDetails = fileItem.querySelector('.file-details');
            if (fileDetails) {
                fileDetails.style.display = 'none';
            }
            
            // Limpiar archivo pendiente
            this.pendingFiles.delete(fileId);
        }
    }

    async loadImportSummary() {
        // Cargar resumen de importaciones recientes
        try {
            const { data: recentImports } = await this.supabase
                .from('api_sync_log')
                .select('*')
                .eq('endpoint', 'process_excel')
                .order('executed_at', { ascending: false })
                .limit(10);
            
            if (recentImports && recentImports.length > 0) {
                // Mostrar resumen
                console.log('Importaciones recientes:', recentImports);
            }
        } catch (error) {
            console.error('Error cargando resumen:', error);
        }
    }

    async loadHistory() {
        const historyBody = document.getElementById('historyBody');
        historyBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Historial desactivado temporalmente</td></tr>';
        return;
    }
}