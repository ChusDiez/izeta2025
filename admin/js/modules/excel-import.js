export default class ExcelImportModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedFiles = [];
    }

    async render(container) {
        container.innerHTML = `
            <div class="excel-import-page">
                <h2>📥 Importar Excel de Evolcampus</h2>
                
                <div class="info-box">
                    <h3>📋 Instrucciones</h3>
                    <ol>
                        <li>Descarga los informes individuales de cada alumno desde Evolcampus (Informes → Alumno)</li>
                        <li>Arrastra los archivos Excel (.xlsx) a la zona de carga o haz clic para seleccionarlos</li>
                        <li>Los archivos se procesarán automáticamente</li>
                        <li>Una vez procesados, los datos aparecerán en el dashboard principal</li>
                    </ol>
                    <p><strong>Formato esperado:</strong> expediente-nombre-apellidos-fecha.xlsx</p>
                    <p><small>El sistema buscará el email automáticamente por el nombre del alumno</small></p>
                </div>

                <div class="upload-zone" id="uploadZone">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto;">
                        <path d="M7 10L12 5L17 10" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 5V15" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M20 16V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V16" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>Arrastra archivos Excel aquí</h3>
                    <p>o haz clic para seleccionar</p>
                    <input type="file" id="fileInput" multiple accept=".xlsx,.xls" style="display: none;">
                </div>

                <button class="btn btn-primary" id="uploadBtn" disabled>
                    📤 Subir archivos seleccionados
                </button>

                <div class="file-list" id="fileList"></div>

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
        
        // Filtrar solo archivos Excel
        this.selectedFiles = allFiles.filter(file => {
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
            console.log(`Archivo ${file.name}: ${isExcel ? 'ES' : 'NO ES'} Excel`);
            return isExcel;
        });
        
        console.log('Archivos Excel válidos:', this.selectedFiles.length);
        
        if (allFiles.length > 0 && this.selectedFiles.length === 0) {
            this.dashboard.showNotification('warning', 'Por favor selecciona archivos Excel (.xlsx o .xls)');
            return;
        }
        
        if (this.selectedFiles.length > 0) {
            this.dashboard.showNotification('info', `${this.selectedFiles.length} archivo(s) Excel seleccionado(s)`);
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
        uploadBtn.textContent = '⏳ Subiendo archivos...';
        
        // Limpiar lista anterior
        fileList.innerHTML = '<h3>📊 Procesamiento de archivos:</h3>';
        
        for (const file of this.selectedFiles) {
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
                        <span class="status-badge status-processing">⏳ Subiendo...</span>
                    </div>
                </div>
                <div class="file-details" style="display: none;">
                    <div class="detail-content"></div>
                </div>
            `;
            fileList.appendChild(fileItem);
            
            try {
                // Generar nombre único para el archivo
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `${timestamp}_${file.name}`;
                
                console.log(`Subiendo archivo como: ${fileName}`);
                
                // Actualizar estado a "subiendo"
                this.updateFileStatus(fileId, 'uploading', '📤 Subiendo archivo...');
                
                // Subir archivo al bucket
                const { data, error } = await this.supabase.storage
                    .from('evol-excel-import')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Actualizar estado a "procesando"
                this.updateFileStatus(fileId, 'processing', '🔄 Procesando Excel...');
                
                // Esperar un poco para que el trigger se ejecute y procesar
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Verificar el resultado del procesamiento
                const processResult = await this.checkProcessingResult(fileName);
                
                if (processResult.success) {
                    // Actualizar UI con éxito y detalles del estudiante
                    this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente', {
                        student: processResult.student,
                        recordsProcessed: processResult.recordsProcessed,
                        details: processResult.details
                    });
                    
                    this.dashboard.showNotification('success', 
                        `✅ ${file.name} procesado: ${processResult.recordsProcessed} registros para ${processResult.student.email}`
                    );
                } else {
                    throw new Error(processResult.error || 'Error desconocido en el procesamiento');
                }
                
            } catch (error) {
                console.error('Error con archivo:', error);
                
                // Actualizar UI con error
                this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
                
                // Si es error de usuario no encontrado, ofrecer mapeo manual
                if (error.message.includes('No se pudo encontrar') || error.message.includes('Usuario no encontrado')) {
                    this.offerManualMapping(fileId, file.name, error.message);
                }
                
                this.dashboard.showNotification('error', `Error con ${file.name}: ${error.message}`);
            }
        }
        
        // Limpiar
        this.selectedFiles = [];
        document.getElementById('fileInput').value = '';
        uploadBtn.textContent = '📤 Subir archivos seleccionados';
        uploadBtn.disabled = true;
        
        // Actualizar historial después de 2 segundos
        setTimeout(() => this.loadImportSummary(), 2000);
    }
    
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
        if (details && details.student) {
            fileDetails.style.display = 'block';
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
        }
    }
    
    async checkProcessingResult(fileName) {
        try {
            // Buscar en el log de sincronización el resultado del procesamiento
            const { data, error } = await this.supabase
                .from('api_sync_log')
                .select('*')
                .eq('endpoint', 'process_excel')
                .like('details', `%${fileName}%`)
                .order('executed_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error || !data) {
                // Si no hay log todavía, esperar un poco más
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Intentar de nuevo
                const { data: retryData, error: retryError } = await this.supabase
                    .from('api_sync_log')
                    .select('*')
                    .eq('endpoint', 'process_excel')
                    .like('details', `%${fileName}%`)
                    .order('executed_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (retryError || !retryData) {
                    return { success: false, error: 'No se pudo verificar el resultado del procesamiento' };
                }
                
                data = retryData;
            }
            
            // Extraer información del log
            const details = data.details || {};
            
            if (data.status_code === 200) {
                // Buscar información del estudiante
                const studentEmail = details.studentEmail;
                let studentInfo = { email: studentEmail };
                
                if (studentEmail) {
                    // Obtener información completa del estudiante
                    const { data: userData } = await this.supabase
                        .from('users')
                        .select('id, username, email, cohort')
                        .eq('email', studentEmail)
                        .single();
                    
                    if (userData) {
                        studentInfo = userData;
                    }
                }
                
                return {
                    success: true,
                    student: studentInfo,
                    recordsProcessed: details.recordsProcessed || data.records_synced || 0,
                    details: details
                };
            } else {
                return {
                    success: false,
                    error: details.error || 'Error en el procesamiento'
                };
            }
            
        } catch (error) {
            console.error('Error verificando resultado:', error);
            return {
                success: false,
                error: 'Error al verificar el procesamiento'
            };
        }
    }
    
    offerManualMapping(fileId, fileName, errorMessage) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;
        
        const detailContent = fileItem.querySelector('.detail-content');
        const fileDetails = fileItem.querySelector('.file-details');
        
        fileDetails.style.display = 'block';
        
        // Extraer el nombre del archivo
        const nameParts = fileName.replace('.xlsx', '').replace('.xls', '').split('-');
        const possibleName = nameParts.slice(1, 3).join(' ');
        
        detailContent.innerHTML = `
            <div class="manual-mapping-form">
                <p class="error-message">${errorMessage}</p>
                <p><strong>¿Quieres crear un mapeo manual para este archivo?</strong></p>
                <p>Nombre detectado: <code>${possibleName}</code></p>
                
                <div class="mapping-input">
                    <label>Selecciona el estudiante correcto:</label>
                    <select id="mapping-select-${fileId}" class="form-control">
                        <option value="">-- Selecciona un estudiante --</option>
                    </select>
                </div>
                
                <div class="mapping-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.excelImportModule.saveMapping('${fileId}', '${possibleName}')">
                        💾 Guardar mapeo
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.excelImportModule.retryFile('${fileId}', '${fileName}')">
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        `;
        
        // Cargar lista de estudiantes
        this.loadStudentsList(`mapping-select-${fileId}`);
    }
    
    async loadStudentsList(selectId) {
        try {
            const { data: students } = await this.supabase
                .from('users')
                .select('id, email, username, cohort')
                .eq('role', 'user')
                .order('username');
            
            const select = document.getElementById(selectId);
            if (!select || !students) return;
            
            // Agrupar por cohorte
            const grouped = {};
            students.forEach(student => {
                const cohort = student.cohort || 'Sin cohorte';
                if (!grouped[cohort]) grouped[cohort] = [];
                grouped[cohort].push(student);
            });
            
            // Llenar el select
            Object.entries(grouped).forEach(([cohort, cohortStudents]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = cohort;
                
                cohortStudents.forEach(student => {
                    const option = document.createElement('option');
                    option.value = student.email;
                    option.textContent = `${student.username} (${student.email})`;
                    optgroup.appendChild(option);
                });
                
                select.appendChild(optgroup);
            });
            
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
        }
    }
    
    async saveMapping(fileId, excelName) {
        const select = document.getElementById(`mapping-select-${fileId}`);
        if (!select || !select.value) {
            this.dashboard.showNotification('warning', 'Por favor selecciona un estudiante');
            return;
        }
        
        try {
            // Guardar el mapeo
            const { error } = await this.supabase
                .from('excel_name_mappings')
                .insert({
                    excel_name: excelName.toLowerCase(),
                    user_email: select.value,
                    notes: 'Mapeo manual desde importación'
                });
            
            if (error) throw error;
            
            this.dashboard.showNotification('success', 'Mapeo guardado correctamente. Los próximos archivos con este nombre se procesarán automáticamente.');
            
            // Actualizar UI
            const fileItem = document.getElementById(fileId);
            if (fileItem) {
                const detailContent = fileItem.querySelector('.detail-content');
                detailContent.innerHTML = `
                    <div class="success-message">
                        ✅ Mapeo guardado exitosamente<br>
                        <small>Los próximos archivos de "${excelName}" se asociarán automáticamente a ${select.value}</small>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error guardando mapeo:', error);
            this.dashboard.showNotification('error', 'Error al guardar el mapeo: ' + error.message);
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
        return; // Salir sin hacer nada
        
        try {
            const { data, error } = await this.supabase
                .from('excel_import_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay importaciones previas</td></tr>';
                return;
            }
            
            historyBody.innerHTML = data.map(record => {
                const date = new Date(record.created_at).toLocaleString('es-ES');
                const statusClass = `status-${record.status}`;
                const statusText = {
                    pending: 'Pendiente',
                    processing: 'Procesando',
                    completed: 'Completado',
                    error: 'Error'
                }[record.status] || record.status;
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${record.file_name || '-'}</td>
                        <td>${record.student_email || '-'}</td>
                        <td>${record.records_imported || 0}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${record.error_message || '-'}</td>
                    </tr>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error cargando historial:', error);
            this.dashboard.showNotification('error', 'Error cargando historial: ' + error.message);
        }
    }
} 