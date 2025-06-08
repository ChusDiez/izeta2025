// admin/js/modules/batch-import.js
// Módulo de importación por lotes que sustituye al módulo name-mappings
import { extractStudent, extractTests } from '../../../src/utils/evolParser.js';

export default class BatchImportModule {
    constructor(supabaseClient, dashboardCore) {
        this.supabase = supabaseClient;
        this.dashboard = dashboardCore;
        this.selectedFiles = [];
        this.processedData = [];
        this.csvContent = '';
    }

    async render(container) {
        container.innerHTML = `
            <div class="batch-import-page">
                <h2>🚀 Importación por Lotes de Evolcampus</h2>
                
                <div class="info-box">
                    <h3>📋 Instrucciones</h3>
                    <ol>
                        <li>Descarga todos los informes Excel de Evolcampus (Informes → Alumno)</li>
                        <li>Selecciona o arrastra toda la carpeta de archivos aquí</li>
                        <li>El sistema procesará todos los archivos automáticamente</li>
                        <li>Genera un CSV estructurado y opcionalmente sube a la base de datos</li>
                    </ol>
                    <p><strong>Formato esperado:</strong> expediente-nombre-apellidos.xlsx</p>
                    <p><small>💡 Este módulo sustituye al mapeo manual de nombres - ahora todo es automático</small></p>
                </div>

                <div class="upload-zone" id="uploadZone">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto;">
                        <path d="M7 10L12 5L17 10" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 5V15" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                        <path d="M20 16V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V16" stroke="#0066cc" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>📁 Arrastra archivos Excel aquí</h3>
                    <p>o haz clic para seleccionar múltiples archivos</p>
                    <div id="fileCount"></div>
                    <input type="file" id="fileInput" multiple accept=".xlsx,.xls" style="display: none;">
                </div>

                <div class="actions-bar">
                    <button class="btn btn-secondary" id="clearBtn" disabled>🗑️ Limpiar selección</button>
                    <button class="btn btn-primary" id="processBtn" disabled>⚙️ Procesar archivos</button>
                    <button class="btn btn-success" id="uploadBtn" style="display: none;">☁️ Subir a base de datos</button>
                    <button class="btn btn-warning" id="downloadCsvBtn" style="display: none;">💾 Descargar CSV</button>
                </div>

                <div class="progress-container" id="progressContainer" style="display: none;">
                    <h3>Procesando archivos...</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill">0%</div>
                    </div>
                    <p id="progressText">Preparando...</p>
                </div>

                <div class="stats-grid" id="statsGrid" style="display: none;">
                    <div class="stat-card">
                        <h3 id="statProcessed">0</h3>
                        <p>Archivos procesados</p>
                    </div>
                    <div class="stat-card">
                        <h3 id="statRecords">0</h3>
                        <p>Registros extraídos</p>
                    </div>
                    <div class="stat-card">
                        <h3 id="statErrors">0</h3>
                        <p>Errores</p>
                    </div>
                    <div class="stat-card">
                        <h3 id="statMissing">0</h3>
                        <p>Usuarios no encontrados</p>
                    </div>
                </div>

                <div class="missing-users" id="missingUsers" style="display: none;">
                    <h3>⚠️ Usuarios no encontrados</h3>
                    <p>Los siguientes archivos no se pudieron asociar a ningún usuario:</p>
                    <ul id="missingUsersList"></ul>
                    <div style="margin-top: 15px;">
                        <button class="btn btn-info" onclick="window.batchImportModule.showMappingHelp()">
                            💡 ¿Cómo resolver esto?
                        </button>
                    </div>
                </div>

                <div class="results-container" id="resultsContainer">
                    <h3 style="margin-top: 40px; display: none;" id="resultsTitle">📊 Resultados del procesamiento</h3>
                    <div id="results"></div>
                </div>

                <!-- Modal de ayuda para mapeos -->
                <div id="mappingHelpModal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>💡 Resolver usuarios no encontrados</h3>
                            <button class="close-btn" onclick="window.batchImportModule.closeMappingHelp()">×</button>
                        </div>
                        <div class="modal-body">
                            <h4>Opciones para resolver usuarios no encontrados:</h4>
                            <ol>
                                <li><strong>Verificar emails:</strong> Asegúrate de que los usuarios existen en el sistema</li>
                                <li><strong>Crear mapeos manuales:</strong> Ve al módulo "Importar Excel" para crear mapeos individuales</li>
                                <li><strong>Usar el CSV:</strong> Descarga el CSV y edita manualmente los student_id</li>
                                <li><strong>Crear usuarios:</strong> Añade los usuarios faltantes al sistema primero</li>
                            </ol>
                            <p><strong>Recomendación:</strong> Para archivos sin email, el sistema busca automáticamente en los mapeos existentes.</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="window.batchImportModule.closeMappingHelp()">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .batch-import-page {
                    padding: 2rem;
                }
                
                .upload-zone {
                    border: 3px dashed #0066cc;
                    border-radius: 12px;
                    padding: 60px 20px;
                    text-align: center;
                    background: #f0f7ff;
                    margin: 20px 0;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    user-select: none;
                }
                
                .upload-zone.dragover {
                    background: #e1f0ff;
                    border-color: #0052cc;
                    transform: scale(1.02);
                }
                
                .upload-zone svg {
                    opacity: 0.7;
                    margin-bottom: 15px;
                }
                
                .actions-bar {
                    display: flex;
                    gap: 10px;
                    margin: 20px 0;
                    flex-wrap: wrap;
                }
                
                .progress-container {
                    margin: 30px 0;
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .progress-bar {
                    background: #e0e0e0;
                    height: 30px;
                    border-radius: 15px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                
                .progress-fill {
                    background: #0066cc;
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                
                .stat-card {
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .stat-card h3 {
                    margin: 0;
                    color: #0066cc;
                    font-size: 2em;
                }
                
                .stat-card p {
                    margin: 5px 0 0 0;
                    color: #666;
                }
                
                .results-container {
                    margin-top: 30px;
                }
                
                .result-item {
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 15px;
                    margin: 10px 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .result-item.success {
                    background: #d4edda;
                    border-color: #c3e6cb;
                }
                
                .result-item.error {
                    background: #f8d7da;
                    border-color: #f5c6cb;
                }
                
                .result-item.warning {
                    background: #fff3cd;
                    border-color: #ffeeba;
                }
                
                .missing-users {
                    background: #fff3cd;
                    border: 1px solid #ffeeba;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .missing-users h3 {
                    margin-top: 0;
                    color: #856404;
                }
                
                .missing-users ul {
                    max-height: 200px;
                    overflow-y: auto;
                    margin: 15px 0;
                }
                
                #fileCount {
                    font-size: 0.9em;
                    color: #666;
                    margin-top: 10px;
                }
                
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    width: 90%;
                    max-width: 600px;
                    border-radius: 12px;
                    overflow: hidden;
                }
                
                .modal-header {
                    background: #f8f9fa;
                    padding: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .modal-header h3 {
                    margin: 0;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #666;
                }
                
                .modal-body {
                    padding: 1.5rem;
                }
                
                .modal-footer {
                    background: #f8f9fa;
                    padding: 1rem 1.5rem;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    border-top: 1px solid #e0e0e0;
                }
            </style>
        `;

        // Guardar referencia global
        window.batchImportModule = this;
        
        // Setup event listeners
        setTimeout(() => {
            this.setupEventListeners();
        }, 100);
    }

    setupEventListeners() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const clearBtn = document.getElementById('clearBtn');
        const processBtn = document.getElementById('processBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const downloadCsvBtn = document.getElementById('downloadCsvBtn');
        
        if (!uploadZone || !fileInput) {
            console.error('Elementos del DOM no encontrados');
            return;
        }
        
        // Click en la zona de carga
        uploadZone.addEventListener('click', () => fileInput.click());
        
        // Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // Botones
        clearBtn?.addEventListener('click', () => this.clearSelection());
        processBtn?.addEventListener('click', () => this.processFiles());
        uploadBtn?.addEventListener('click', () => this.uploadToSupabase());
        downloadCsvBtn?.addEventListener('click', () => this.downloadCSV());
    }

    handleFiles(files) {
        this.selectedFiles = Array.from(files).filter(f => 
            f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );
        
        this.updateUI();
    }

    clearSelection() {
        this.selectedFiles = [];
        this.processedData = [];
        this.csvContent = '';
        document.getElementById('fileInput').value = '';
        this.updateUI();
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('statsGrid').style.display = 'none';
        document.getElementById('missingUsers').style.display = 'none';
        document.getElementById('results').innerHTML = '';
        document.getElementById('resultsTitle').style.display = 'none';
    }

    updateUI() {
        const hasFiles = this.selectedFiles.length > 0;
        const clearBtn = document.getElementById('clearBtn');
        const processBtn = document.getElementById('processBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const downloadCsvBtn = document.getElementById('downloadCsvBtn');
        const fileCount = document.getElementById('fileCount');
        
        if (clearBtn) clearBtn.disabled = !hasFiles;
        if (processBtn) processBtn.disabled = !hasFiles;
        
        if (hasFiles) {
            fileCount.textContent = `${this.selectedFiles.length} archivos Excel seleccionados`;
        } else {
            fileCount.textContent = '';
        }
        
        if (uploadBtn) uploadBtn.style.display = this.processedData.length > 0 ? 'inline-block' : 'none';
        if (downloadCsvBtn) downloadCsvBtn.style.display = this.csvContent ? 'inline-block' : 'none';
    }

    async processFiles() {
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const results = document.getElementById('results');
        const resultsTitle = document.getElementById('resultsTitle');
        
        progressContainer.style.display = 'block';
        results.innerHTML = '';
        resultsTitle.style.display = 'block';
        this.processedData = [];
        
        const stats = {
            processed: 0,
            records: 0,
            errors: 0,
            missing: []
        };
        
        const userCache = new Map();
        
        // Cargar SheetJS dinámicamente
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
        }
        
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            const progress = Math.round(((i + 1) / this.selectedFiles.length) * 100);
            
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${progress}%`;
            progressText.textContent = `Procesando: ${file.name}`;
            
            try {
                // Leer Excel
                const buffer = await file.arrayBuffer();
                const workbook = window.XLSX.read(buffer, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = window.XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1, 
                    raw: false, 
                    dateNF: 'dd/mm/yyyy' 
                });
                
                // Extraer estudiante (los Excel de Evolcampus NO tienen email)
                const studentInfo = await extractStudent(rows, file.name);
                
                // Buscar email en mapeos usando el baseSlug
                if (studentInfo.baseSlug) {
                    const { data: mapping } = await this.supabase
                        .from('excel_name_mappings')
                        .select('user_email')
                        .eq('excel_name', studentInfo.baseSlug)
                        .single();
                    
                    if (mapping) {
                        studentInfo.email = mapping.user_email;
                        console.log(`✅ Mapeo encontrado: ${studentInfo.baseSlug} → ${studentInfo.email}`);
                    } else {
                        console.log(`⚠️ Sin mapeo para: ${studentInfo.baseSlug}`);
                    }
                }
                
                if (!studentInfo.email) {
                    stats.missing.push(`${file.name} (${studentInfo.searchName})`);
                    this.addResult(file.name, 'warning', `Sin mapeo para: ${studentInfo.searchName}`);
                    // NO hacer continue - procesar el archivo de todas formas
                    studentInfo.email = ''; // Email vacío para CSV
                }
                
                // Buscar usuario (solo si hay email)
                let userId = null;
                if (studentInfo.email) {
                    userId = userCache.get(studentInfo.email);
                    if (!userId) {
                        const { data: user } = await this.supabase
                            .from('users')
                            .select('id, username')
                            .eq('email', studentInfo.email)
                            .single();
                        
                        if (!user) {
                            stats.missing.push(`${file.name} (${studentInfo.email})`);
                            this.addResult(file.name, 'warning', `Usuario no encontrado: ${studentInfo.email}`);
                            userId = null; // Sin usuario, pero seguir procesando
                        } else {
                            userId = user.id;
                            userCache.set(studentInfo.email, userId);
                        }
                    }
                } else {
                    // Sin email, usar identificador temporal basado en el nombre del archivo
                    userId = `temp_${studentInfo.baseSlug || studentInfo.searchName.replace(/\s+/g, '_')}`;
                }
                
                // Extraer tests
                const tests = await extractTests(rows, userId, file.name);
                
                if (tests.length === 0) {
                    this.addResult(file.name, 'warning', 'No se encontraron tests');
                    continue;
                }
                
                this.processedData.push(...tests.map(t => ({
                    ...t,
                    file_name: file.name,
                    student_email: studentInfo.email || '',
                    student_key: studentInfo.baseSlug || studentInfo.searchName
                })));
                
                stats.records += tests.length;
                stats.processed++;
                
                this.addResult(file.name, 'success', `${tests.length} registros extraídos`);
                
            } catch (error) {
                stats.errors++;
                this.addResult(file.name, 'error', error.message);
            }
        }
        
        // Generar CSV
        if (this.processedData.length > 0) {
            this.generateCSV();
        }
        
        // Mostrar estadísticas
        this.updateStats(stats);
        this.updateUI();
        
        progressContainer.style.display = 'none';
        
        // Mostrar notificación de resumen
        this.dashboard.showNotification('success', 
            `Procesamiento completado: ${stats.processed} archivos, ${stats.records} registros`
        );
    }

    addResult(fileName, status, message) {
        const results = document.getElementById('results');
        const item = document.createElement('div');
        item.className = `result-item ${status}`;
        item.innerHTML = `
            <div>
                <strong>${fileName}</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.9em;">${message}</p>
            </div>
            <span>${status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️'}</span>
        `;
        results.appendChild(item);
    }

    updateStats(stats) {
        document.getElementById('statsGrid').style.display = 'grid';
        document.getElementById('statProcessed').textContent = stats.processed;
        document.getElementById('statRecords').textContent = stats.records;
        document.getElementById('statErrors').textContent = stats.errors;
        document.getElementById('statMissing').textContent = stats.missing.length;
        
        if (stats.missing.length > 0) {
            document.getElementById('missingUsers').style.display = 'block';
            const list = document.getElementById('missingUsersList');
            list.innerHTML = stats.missing.map(m => `<li>${m}</li>`).join('');
        }
    }

    generateCSV() {
        const headers = [
            'file_name', 'student_email', 'student_key', 'student_id', 'topic_code', 
            'activity', 'score', 'max_score', 'attempts', 
            'first_attempt', 'last_attempt', 'source'
        ];
        
        const rows = this.processedData.map(row => 
            headers.map(h => {
                const value = row[h];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );
        
        this.csvContent = [headers.join(','), ...rows].join('\n');
    }

    downloadCSV() {
        const blob = new Blob([this.csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        link.href = URL.createObjectURL(blob);
        link.download = `evolcampus-batch-${timestamp}.csv`;
        link.click();
    }

    async uploadToSupabase() {
        if (this.processedData.length === 0) return;
        
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Subiendo...';
        
        try {
            // Preparar datos para topic_results
            const topicResults = this.processedData.map(({ file_name, student_email, ...rest }) => rest);
            
            // Subir en lotes de 100
            const batchSize = 100;
            let uploaded = 0;
            
            for (let i = 0; i < topicResults.length; i += batchSize) {
                const batch = topicResults.slice(i, i + batchSize);
                const { error } = await this.supabase
                    .from('topic_results')
                    .upsert(batch, { 
                        onConflict: 'student_id,topic_code,activity',
                        ignoreDuplicates: false 
                    });
                
                if (error) throw error;
                uploaded += batch.length;
                
                uploadBtn.textContent = `⏳ Subiendo... ${uploaded}/${topicResults.length}`;
            }
            
            this.dashboard.showNotification('success', 
                `✅ ${uploaded} registros subidos exitosamente a la base de datos`
            );
            
            uploadBtn.textContent = '✅ Subido exitosamente';
            setTimeout(() => {
                uploadBtn.textContent = '☁️ Subir a base de datos';
                uploadBtn.disabled = false;
            }, 3000);
            
        } catch (error) {
            console.error('Error al subir:', error);
            this.dashboard.showNotification('error', 'Error al subir: ' + error.message);
            uploadBtn.textContent = '☁️ Subir a base de datos';
            uploadBtn.disabled = false;
        }
    }

    showMappingHelp() {
        document.getElementById('mappingHelpModal').style.display = 'flex';
    }

    closeMappingHelp() {
        document.getElementById('mappingHelpModal').style.display = 'none';
    }
}
