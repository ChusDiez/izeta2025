export default class ExcelImportModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedFiles = [];
    }
    getBaseFileSlug(fileName) {
        return fileName
            .replace(/\.xlsx?$/i, '')
            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '')
            .replace(/-\d{8}-\d{6}$/, '')
            .toLowerCase();
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
                    <p><strong>Formato esperado:</strong> expediente-nombre-apellidos-timestamp.xlsx</p>
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
                    <input type="file" id="fileInput" multiple accept=".xlsx,.xls,.csv" style="display: none;">
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
            const isExcel = file.name.toLowerCase().endsWith('.xlsx')
                || file.name.toLowerCase().endsWith('.xls')
                || file.name.toLowerCase().endsWith('.csv');
            console.log(`Archivo ${file.name}: ${isExcel ? 'ES' : 'NO ES'} Excel/CSV`);
            return isExcel;
        });
        
        console.log('Archivos Excel/CSV válidos:', this.selectedFiles.length);
        
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
                        <span class="status-badge status-processing">⏳ Subiendo...</span>
                    </div>
                </div>
                <div class="file-details" style="display: none;">
                    <div class="detail-content"></div>
                </div>
            `;
            fileList.appendChild(fileItem);
            
            try {
                // Usar el nombre original sin modificación (sin timestamp)
                const fileName = file.name;
                const isCSV = fileName.toLowerCase().endsWith('.csv');
                
                console.log(`Subiendo archivo como: ${fileName}`);
                
                // Verificar permisos primero
                const { data: { user } } = await this.supabase.auth.getUser();
                if (!user) {
                    throw new Error('No estás autenticado. Por favor, inicia sesión de nuevo.');
                }
                console.log('Usuario autenticado:', user.email);
                
                // Actualizar estado a "subiendo"
                this.updateFileStatus(fileId, 'uploading', '📤 Subiendo archivo...');
                
                // Subir archivo al bucket
                const { data, error } = await this.supabase.storage
                    .from('excel-public')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Actualizar estado a "procesando"
                this.updateFileStatus(fileId, 'processing', '🔄 Procesando Excel...');
                
                // OPCIÓN: Forzar procesamiento manual siempre (descomenta si hay problemas con el trigger)
                const FORCE_MANUAL_PROCESSING = false; // Cambia a false para usar trigger automático
                
                // TEMPORAL: Mientras la función Edge tiene error 500, usar procesamiento local
                const USE_LOCAL_PROCESSING = true; // Cambiar a false cuando se arregle la Edge Function
                
                if (USE_LOCAL_PROCESSING) {
                    if (isCSV) {
                        const processResult = await this.processCsvLocally(file, fileName);
                        if (processResult.success) {
                            this.updateFileStatus(fileId, 'completed', '✅ CSV procesado', {
                                student: processResult.student,
                                recordsProcessed: processResult.recordsProcessed,
                                details: processResult.details
                            });
                            this.dashboard.showNotification('success',
                                `✅ ${file.name} procesado: ${processResult.recordsProcessed} registros`
                            );
                        } else {
                            throw {
                              message: processResult.error,
                              needsMapping: processResult.needsMapping,
                              searchName: processResult.searchName
                            };
                        }
                        continue; // pasa al siguiente archivo
                    }
                    // Procesar localmente en el navegador
                    console.log('Usando procesamiento local (Edge Function no disponible)');
                    const processResult = await this.processExcelLocally(file, fileName);
                    
                    if (processResult.success) {
                        // Actualizar UI con éxito y detalles del estudiante
                        this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente', {
                            student: processResult.student,
                            recordsProcessed: processResult.recordsProcessed,
                            details: processResult.details
                        });
                        
                        this.dashboard.showNotification('success', 
                            `✅ ${file.name} procesado: ${processResult.recordsProcessed} registros para ${processResult.student.email || 'usuario'}`
                        );
                    } else {
                        // Si hay error con información adicional
                        const errorObj = {
                            message: processResult.error,
                            needsMapping: processResult.needsMapping,
                            needsUserCreation: processResult.needsUserCreation,
                            searchName: processResult.searchName,
                            studentEmail: processResult.studentEmail
                        };
                        throw errorObj;
                    }
                } else if (FORCE_MANUAL_PROCESSING) {
                    // Procesar con Edge Function manualmente
                    const processResult = await this.processManually(fileName, file);
                    
                    if (processResult.success) {
                        // Actualizar UI con éxito y detalles del estudiante
                        this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente', {
                            student: processResult.student,
                            recordsProcessed: processResult.recordsProcessed,
                            details: processResult.details
                        });
                        
                        this.dashboard.showNotification('success', 
                            `✅ ${file.name} procesado: ${processResult.recordsProcessed} registros para ${processResult.student.email || 'usuario'}`
                        );
                    } else {
                        // Si hay error con información adicional
                        const errorObj = {
                            message: processResult.error,
                            needsMapping: processResult.needsMapping,
                            needsUserCreation: processResult.needsUserCreation,
                            searchName: processResult.searchName,
                            studentEmail: processResult.studentEmail
                        };
                        throw errorObj;
                    }
                } else {
                    // Usar el flujo normal con trigger automático
                    // Esperar un poco para que el trigger se ejecute y procesar
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Verificar el resultado del procesamiento
                    const processResult = await this.checkProcessingResult(fileName, file);
                    
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
                        // Si hay error con información adicional
                        const errorObj = {
                            message: processResult.error,
                            needsMapping: processResult.needsMapping,
                            needsUserCreation: processResult.needsUserCreation,
                            searchName: processResult.searchName,
                            studentEmail: processResult.studentEmail
                        };
                        throw errorObj;
                    }
                }
                
            } catch (error) {
                console.error('Error con archivo:', error);
                
                // Actualizar UI con error
                this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
                
                // Si es error de usuario no encontrado, ofrecer mapeo manual
                if (error.message.includes('No se pudo encontrar') || error.message.includes('Usuario no encontrado')) {
                    this.offerManualMapping(fileId, file.name, error.message);
                }
                
                // Si el procesamiento devolvió información adicional
                if (error.needsMapping) {
                    this.offerManualMapping(fileId, file.name, error.message);
                } else if (error.needsUserCreation) {
                    this.offerUserCreation(fileId, error.studentEmail, error.message);
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
    
    async checkProcessingResult(fileName, originalFile = null) {
        try {
            // Buscar en el log de sincronización el resultado del procesamiento
            let { data, error } = await this.supabase
                .from('api_sync_log')
                .select('*')
                .eq('endpoint', 'process_excel')
                .filter('details->fileName', 'eq', fileName)
                .order('executed_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error || !data) {
                console.log('No se encontró log inmediato, esperando...');
                // Si no hay log todavía, esperar un poco más
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Intentar de nuevo con búsqueda más flexible
                const { data: retryData, error: retryError } = await this.supabase
                    .from('api_sync_log')
                    .select('*')
                    .eq('endpoint', 'process_excel')
                    .filter('details::text', 'ilike', `%${fileName}%`)
                    .order('executed_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (retryError || !retryData) {
                    console.log('No se encontró resultado del procesamiento automático');
                    
                    // Si el trigger no funcionó, llamar manualmente a la función
                    if (originalFile) {
                        console.log('Intentando procesar manualmente...');
                        return await this.processManually(fileName, originalFile);
                    }
                    
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
                        studentInfo.name = userData.username;
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
            
            // Si hay error y tenemos el archivo original, intentar procesar manualmente
            if (originalFile) {
                console.log('Error en verificación, intentando procesar manualmente...');
                return await this.processManually(fileName, originalFile);
            }
            
            // Si es un error de CORS o de red, dar mensaje más claro
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return {
                    success: false,
                    error: 'Error de conexión. Verifica que la función Edge esté activa.'
                };
            }
            
            // Si es error de función no encontrada o no autorizada
            if (error.message.includes('not found') || error.message.includes('401') || error.message.includes('404')) {
                console.log('⚠️ Función Edge no disponible, intentando procesamiento local...');
                
                // Intentar procesamiento local como fallback
                try {
                    return await this.processExcelLocally(file, fileName);
                } catch (localError) {
                    console.error('Error en procesamiento local:', localError);
                    return {
                        success: false,
                        error: `La función Edge no está disponible y el procesamiento local falló: ${localError.message}`
                    };
                }
            }
            
            return {
                success: false,
                error: 'Error al verificar el procesamiento'
            };
        }
    }
    
    async processManually(fileName, file) {
        try {
            console.log('Procesando archivo manualmente:', fileName);
            
            // Llamar directamente a la función Edge
            const response = await this.supabase.functions.invoke('process-excel-evolcampus', {
                body: {
                    bucket: 'excel-public',
                    fileName: fileName
                }
            });
            
            console.log('Respuesta de la función:', response);
            
            // La función puede devolver error de dos formas
            if (response.error) {
                console.error('Error de la función:', response.error);
                throw new Error(response.error.message || 'Error en la función Edge');
            }
            
            const data = response.data;
            
            // Verificar si la función devolvió un error en el data
            if (data && !data.success && data.error) {
                console.error('Error procesando:', data.error);
                
                // Manejar errores específicos
                if (data.errorCode === 'STUDENT_NOT_FOUND') {
                    return {
                        success: false,
                        error: data.error,
                        needsMapping: true,
                        searchName: data.searchName
                    };
                } else if (data.errorCode === 'USER_NOT_FOUND') {
                    return {
                        success: false,
                        error: data.error,
                        needsUserCreation: true,
                        studentEmail: data.studentEmail
                    };
                } else if (data.errorCode === 'HEADER_NOT_FOUND') {
                    return {
                        success: false,
                        error: 'El archivo Excel no tiene el formato esperado. ' + data.error
                    };
                } else {
                    // Otros errores
                    throw new Error(data.error);
                }
            }
            
            if (data && data.success) {
                // Buscar información completa del estudiante si tenemos el email
                let studentInfo = data.details?.student || {};
                if (!studentInfo.email && data.details?.studentEmail) {
                    studentInfo.email = data.details.studentEmail;
                }
                
                // Si tenemos email, buscar datos completos del usuario
                if (studentInfo.email) {
                    const { data: userData } = await this.supabase
                        .from('users')
                        .select('id, username, email, cohort')
                        .eq('email', studentInfo.email)
                        .single();
                    
                    if (userData) {
                        studentInfo = {
                            ...studentInfo,
                            ...userData,
                            name: userData.username
                        };
                    }
                }
                
                return {
                    success: true,
                    student: studentInfo,
                    recordsProcessed: data.details?.recordsProcessed || 0,
                    details: data.details || {}
                };
            } else {
                // Si llegamos aquí, algo salió mal
                console.error('Respuesta inesperada:', data);
                return {
                    success: false,
                    error: data?.error || data?.message || 'Error procesando el archivo - respuesta inválida'
                };
            }
            
        } catch (error) {
            console.error('Error en procesamiento manual:', error);
            
            // Si es un error de CORS o de red, dar mensaje más claro
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return {
                    success: false,
                    error: 'Error de conexión. Verifica que la función Edge esté activa.'
                };
            }
            
            // Buscar errores específicos comunes
            if (error.message.includes('No se pudo encontrar el email')) {
                return {
                    success: false,
                    error: error.message
                };
            }
            
            if (error.message.includes('Usuario no encontrado')) {
                return {
                    success: false,
                    error: error.message
                };
            }
            
            return {
                success: false,
                error: error.message || 'Error desconocido procesando archivo'
            };
        }
    }
    
    offerManualMapping(fileId, fileName, errorMessage) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;
        
        const detailContent = fileItem.querySelector('.detail-content');
        const fileDetails = fileItem.querySelector('.file-details');
        
        fileDetails.style.display = 'block';
        
        // Usar slug base y nombre probable
        const baseFileName = this.getBaseFileSlug(fileName);
        const possibleName = baseFileName
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
    
    async loadStudentsList(selectId) {
        try {
            const { data: allUsers } = await this.supabase
                .from('users')
                .select('id, email, username, cohort, is_admin')
                .order('username');
            
            const select = document.getElementById(selectId);
            if (!select || !allUsers) return;
            
            // Filtrar solo estudiantes (no administradores)
            const students = allUsers.filter(user => !user.is_admin);
            
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
    
    async loadStudentsListWithSearch(selectId, searchId, initialSearch, fileId) {
        try {
            console.log('🔍 Cargando lista de estudiantes...');
            
            // Primero cargar todos los usuarios
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
                    select.innerHTML = '<option value="">Sin permisos para leer la tabla users</option>';
                }
                return;
            }
            
            if (!allStudents || allStudents.length === 0) {
                console.error('❌ No hay usuarios en la base de datos');
                return;
            }
            
            const select = document.getElementById(selectId);
            const searchInput = document.getElementById(searchId);
            const saveBtn = document.getElementById(`save-mapping-btn-${fileId}`);
            
            console.log('🎯 Elementos encontrados:', {
                select: !!select,
                searchInput: !!searchInput,
                saveBtn: !!saveBtn
            });
            
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

    // Procesamiento local de Excel (cuando la función Edge no está disponible)
    async processExcelLocally(file, fileName) {
        try {
            console.log('📊 Procesando Excel localmente en el navegador...');
            
            // Cargar SheetJS si no está cargado
            if (!window.XLSX) {
                console.log('Cargando librería SheetJS...');
                await this.loadSheetJS();
            }
            
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
                // Usuario no existe, ofrecer crearlo
                return {
                    success: false,
                    error: `Usuario no encontrado: ${studentInfo.email}`,
                    needsUserCreation: true,
                    studentEmail: studentInfo.email
                };
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
    
    async loadSheetJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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
        
        // El formato de Evolcampus es:
        // Fila 0-2: Información del estudiante
        // Fila 3-4: Cabeceras (vacías o con fechas)
        // Fila 5+: Datos de tests
        
        let dataStartRow = -1;
        let dateColumns = [];
        
        // Buscar la fila donde empiezan los datos de tests
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
            
            // Intentar extraer el código del tema (T1, T2, etc.)
            const topicMatch = testName.match(/\b(T\d+)\b/i);
            if (topicMatch) {
                topicCode = topicMatch[1].toUpperCase();
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
                                maxScore: 0
                            };
                        }
                        testsSummary[topicCode].count++;
                        testsSummary[topicCode].totalScore += scoreValue;
                        testsSummary[topicCode].maxScore = Math.max(testsSummary[topicCode].maxScore, scoreValue);
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
    
    // Función auxiliar para parsear fechas en formato español
    parseSpanishDate(dateStr) {
        if (!dateStr) return new Date().toISOString();
        
        // Formato DD/MM/YYYY
        const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
            const [_, day, month, year] = match;
            return new Date(year, month - 1, day).toISOString();
        }
        
        // Si no se puede parsear, devolver fecha actual
        return new Date().toISOString();
    }

    offerUserCreation(fileId, studentEmail, errorMessage) {
        const fileItem = document.getElementById(fileId);
        if (!fileItem) return;
        
        const detailContent = fileItem.querySelector('.detail-content');
        const fileDetails = fileItem.querySelector('.file-details');
        
        fileDetails.style.display = 'block';
        
        detailContent.innerHTML = `
            <div class="user-creation-form">
                <p class="error-message">${errorMessage}</p>
                <p><strong>El usuario con email ${studentEmail} no existe en el sistema.</strong></p>
                <p>Opciones:</p>
                
                <div class="creation-options">
                    <button class="btn btn-sm btn-primary" onclick="window.dashboardAdmin.showPage('bulk-users')">
                        👥 Ir a Carga Masiva para crear usuario
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.excelImportModule.skipFile('${fileId}')">
                        ⏭️ Omitir este archivo
                    </button>
                </div>
                
                <div class="info-box" style="margin-top: 1rem;">
                    <p><small>💡 Tip: Si tienes muchos usuarios nuevos, usa la Carga Masiva para importarlos todos de una vez.</small></p>
                </div>
            </div>
        `;
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
            // Guardar el mapeo usando el nombre base (sin números)
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
            // Buscar el archivo original
            const fileInput = document.getElementById('fileInput');
            if (!fileInput || !fileInput.files) {
                this.dashboard.showNotification('error', 'No se pudo encontrar el archivo original');
                return;
            }
            
            // Buscar el archivo por nombre
            let originalFile = null;
            for (let i = 0; i < fileInput.files.length; i++) {
                if (fileInput.files[i].name === fileName.split('_')[1]) {
                    originalFile = fileInput.files[i];
                    break;
                }
            }
            
            if (!originalFile) {
                // Si no está en el input, intentar con los selectedFiles
                originalFile = this.selectedFiles.find(f => fileName.includes(f.name));
            }
            
            if (!originalFile) {
                this.dashboard.showNotification('error', 'No se pudo encontrar el archivo original para reprocesar');
                return;
            }
            
            // Actualizar estado
            this.updateFileStatus(fileId, 'processing', '🔄 Reprocesando con mapeo...');
            
            // Procesar localmente con el email ya conocido
            const processResult = await this.processExcelLocallyWithEmail(originalFile, fileName, userEmail);
            
            if (processResult.success) {
                this.updateFileStatus(fileId, 'completed', '✅ Procesado exitosamente con mapeo manual', {
                    student: processResult.student,
                    recordsProcessed: processResult.recordsProcessed,
                    details: processResult.details
                });
                
                this.dashboard.showNotification('success', 
                    `✅ Archivo procesado: ${processResult.recordsProcessed} registros para ${processResult.student.email}`
                );
            } else {
                throw new Error(processResult.error || 'Error en el reprocesamiento');
            }
            
        } catch (error) {
            console.error('Error reprocesando archivo:', error);
            this.updateFileStatus(fileId, 'error', `❌ Error: ${error.message}`);
            this.dashboard.showNotification('error', 'Error al reprocesar: ' + error.message);
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
    // --- CSV helpers ---
    async loadPapaParse() {
      return new Promise((resolve, reject) => {
        if (window.Papa) return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async processCsvLocally(file, fileName) {
      try {
        await this.loadPapaParse();
        const text = await file.text();
        const parsed = window.Papa.parse(text, { header: true, skipEmptyLines: true });

        if (parsed.errors.length) {
          throw new Error('CSV malformado: ' + parsed.errors[0].message);
        }

        // Agrupar por email o slug
        const firstRow = parsed.data[0] || {};
        const email = firstRow.email || null;

        if (!email) {
          // Intentar mapeo por slug del nombre de archivo
          const slug = this.getBaseFileSlug(fileName);
          const { data: mapping } = await this.supabase
              .from('excel_name_mappings')
              .select('user_email')
              .eq('excel_name', slug)
              .single();
          if (mapping) {
            firstRow.email = mapping.user_email;
          } else {
            return { success:false, error:'No se encontró email en CSV', needsMapping:true, searchName: slug };
          }
        }

        // Obtener user_id
        const { data: user } = await this.supabase
            .from('users')
            .select('id, username, email, cohort')
            .eq('email', firstRow.email)
            .single();
        if (!user) {
          return { success:false, error:'Usuario no encontrado', needsUserCreation:true, studentEmail:firstRow.email };
        }

        // Convertir cada fila en registro topic_results
        const records = parsed.data.map(row => ({
          student_id: user.id,
          topic_code: row.topic_code || 'GEN',
          activity: row.activity,
          score: parseFloat(row.score) || 0,
          max_score: parseFloat(row.max_score)||10,
          attempts: parseInt(row.attempts)||1,
          first_attempt: row.first_attempt || new Date().toISOString(),
          last_attempt : row.last_attempt  || new Date().toISOString(),
          source: 'csv_bulk',
          created_at: new Date().toISOString()
        }));

        if (records.length) {
          await this.supabase.from('topic_results')
              .upsert(records, { onConflict:'student_id,topic_code,activity' });
        }

        return {
          success:true,
          student:{...user, name:user.username},
          recordsProcessed: records.length,
          details:{ fileName, mode:'csv_local' }
        };
      } catch (err) {
        return { success:false, error: err.message||'Error CSV' };
      }
    }
}