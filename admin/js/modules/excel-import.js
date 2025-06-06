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
                    <p><strong>Formato esperado:</strong> expediente-nombre-apellidos-email.xlsx</p>
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            this.loadHistory();
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
        
        for (const file of this.selectedFiles) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item processing';
            fileItem.innerHTML = `
                <div>
                    <strong>${file.name}</strong>
                    <span class="status-badge status-processing">Procesando...</span>
                </div>
            `;
            fileList.appendChild(fileItem);
            
            try {
                // Generar nombre único para el archivo
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `${timestamp}_${file.name}`;
                
                console.log(`Subiendo archivo como: ${fileName}`);
                
                // Subir archivo al bucket
                const { data, error } = await this.supabase.storage
                    .from('excel-uploads')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Actualizar UI
                fileItem.className = 'file-item completed';
                fileItem.innerHTML = `
                    <div>
                        <strong>${file.name}</strong>
                        <span class="status-badge status-completed">✓ Subido exitosamente</span>
                    </div>
                `;
                
                this.dashboard.showNotification('success', `Archivo ${file.name} subido correctamente`);
                
            } catch (error) {
                console.error('Error subiendo archivo:', error);
                fileItem.className = 'file-item error';
                fileItem.innerHTML = `
                    <div>
                        <strong>${file.name}</strong>
                        <span class="status-badge status-error">✗ Error: ${error.message}</span>
                    </div>
                `;
                
                this.dashboard.showNotification('error', `Error subiendo ${file.name}: ${error.message}`);
            }
        }
        
        // Limpiar
        this.selectedFiles = [];
        document.getElementById('fileInput').value = '';
        uploadBtn.textContent = '📤 Subir archivos seleccionados';
        uploadBtn.disabled = true;
        
        // Actualizar historial después de 2 segundos
        setTimeout(() => this.loadHistory(), 2000);
    }

    async loadHistory() {
        try {
            const { data, error } = await this.supabase
                .from('excel_import_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            const historyBody = document.getElementById('historyBody');
            
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