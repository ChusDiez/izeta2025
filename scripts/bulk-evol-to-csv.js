#!/usr/bin/env node

/**
 * Script para procesar masivamente archivos Excel de Evolcampus y generar un CSV unificado
 * Uso: node bulk-excel-to-csv.js <directorio-con-excels> [archivo-mapeos.json]
 */

import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';
import { parse as parseCSV } from 'csv-parse/sync';
import { stringify as stringifyCSV } from 'csv-stringify/sync';

// Configuración
const CONFIG = {
    outputFile: `evolcampus-bulk-${new Date().toISOString().split('T')[0]}.csv`,
    includeZeroScores: true, // IMPORTANTE: incluir tests con nota 0
    defaultMaxScore: 10,
    logFile: 'processing.log'
};

// Estructura del CSV de salida
const CSV_HEADERS = [
    'file_name',
    'student_email',
    'student_key',
    'topic_code',
    'activity',
    'score',
    'max_score',
    'attempts',
    'first_attempt',
    'last_attempt',
    'source'
];

class EvolcampusBulkProcessor {
    constructor() {
        this.results = [];
        this.errors = [];
        this.stats = {
            filesProcessed: 0,
            totalRecords: 0,
            zeroScoreRecords: 0,
            filesWithErrors: 0,
            uniqueStudents: new Set()
        };
        this.mappings = new Map(); // Para mapear nombres a emails
    }

    /**
     * Cargar mapeos de un archivo JSON (opcional)
     */
    async loadMappings(mappingsFile) {
        try {
            const content = await fs.readFile(mappingsFile, 'utf-8');
            const mappings = JSON.parse(content);
            
            // Formato esperado: { "expediente-nombre-apellidos": "email@example.com" }
            Object.entries(mappings).forEach(([key, email]) => {
                this.mappings.set(key.toLowerCase(), email);
            });
            
            console.log(`✅ Cargados ${this.mappings.size} mapeos de estudiantes`);
        } catch (error) {
            console.log('⚠️ No se pudieron cargar mapeos:', error.message);
        }
    }

    /**
     * Procesar un directorio completo de archivos Excel
     */
    async processDirectory(directory) {
        console.log(`🔍 Escaneando directorio: ${directory}`);
        
        const files = await fs.readdir(directory);
        const excelFiles = files.filter(f => 
            f.toLowerCase().endsWith('.xlsx') || 
            f.toLowerCase().endsWith('.xls')
        );
        
        console.log(`📁 Encontrados ${excelFiles.length} archivos Excel`);
        
        for (const [index, file] of excelFiles.entries()) {
            console.log(`\n[${index + 1}/${excelFiles.length}] Procesando: ${file}`);
            
            try {
                await this.processExcelFile(path.join(directory, file));
                this.stats.filesProcessed++;
            } catch (error) {
                console.error(`❌ Error procesando ${file}:`, error.message);
                this.errors.push({ file, error: error.message });
                this.stats.filesWithErrors++;
            }
        }
    }

    /**
     * Procesar un archivo Excel individual
     */
    async processExcelFile(filePath) {
        const fileName = path.basename(filePath);
        const buffer = await fs.readFile(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        
        // Tomar la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        // Extraer información del estudiante
        const studentInfo = this.extractStudentInfo(rawData, fileName);
        
        // Extraer tests
        const tests = this.extractTests(rawData, studentInfo, fileName);
        
        // Agregar al resultado
        this.results.push(...tests);
        this.stats.totalRecords += tests.length;
        
        // Contar tests con nota 0
        const zeroScores = tests.filter(t => parseFloat(t.score) === 0).length;
        this.stats.zeroScoreRecords += zeroScores;
        
        if (studentInfo.email || studentInfo.key) {
            this.stats.uniqueStudents.add(studentInfo.email || studentInfo.key);
        }
        
        console.log(`   ✅ Extraídos ${tests.length} tests (${zeroScores} con nota 0)`);
    }

    /**
     * Extraer información del estudiante
     */
    extractStudentInfo(rows, fileName) {
        const info = {
            email: '',
            key: '',
            baseSlug: ''
        };
        
        // 1. Buscar email en las primeras filas
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            if (!row) continue;
            
            const rowText = row.join(' ').toLowerCase();
            const emailMatch = rowText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            
            if (emailMatch) {
                info.email = emailMatch[1];
                console.log(`   📧 Email encontrado: ${info.email}`);
                return info;
            }
        }
        
        // 2. Si no hay email, usar el nombre del archivo
        info.baseSlug = fileName
            .replace(/\.xlsx?$/i, '')
            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '')
            .replace(/-\d{8}-\d{6}$/, '')
            .toLowerCase();
        
        // 3. Buscar en mapeos
        if (this.mappings.has(info.baseSlug)) {
            info.email = this.mappings.get(info.baseSlug);
            console.log(`   📧 Email desde mapeo: ${info.email}`);
        } else {
            // Si no hay mapeo, usar el slug como key
            info.key = info.baseSlug;
            console.log(`   🔑 Sin email, usando key: ${info.key}`);
        }
        
        return info;
    }

    /**
     * Extraer tests del Excel
     */
    extractTests(rows, studentInfo, fileName) {
        const records = [];
        
        // Buscar donde empiezan los datos de tests
        let headerRow = -1;
        
        for (let r = 0; r < rows.length; r++) {
            if (!rows[r]) continue;
            const rowText = rows[r].join(' ').toLowerCase();
            
            if (rowText.includes('asignatura') || 
                rowText.includes('tema') || 
                rowText.includes('actividad')) {
                headerRow = r;
                break;
            }
        }
        
        if (headerRow === -1) {
            console.log('   ⚠️ No se encontró cabecera de tests');
            return records;
        }
        
        // Identificar columnas
        const header = rows[headerRow].map(c => (c || '').toString().toLowerCase());
        const columns = {
            subject: header.findIndex(h => h.includes('asignatura')),
            topic: header.findIndex(h => h.includes('tema')),
            activity: header.findIndex(h => h.includes('actividad')),
            maxScore: header.findIndex(h => h.includes('nota máxima') || h.includes('max')),
            score: header.findIndex(h => h === 'nota' || (h.includes('nota') && !h.includes('máxima'))),
            attempts: header.findIndex(h => h.includes('intento')),
            firstAttempt: header.findIndex(h => h.includes('primer intento')),
            lastAttempt: header.findIndex(h => h.includes('último intento'))
        };
        
        // Procesar filas de datos
        for (let r = headerRow + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row[columns.activity]) continue;
            
            const activity = row[columns.activity].toString().trim();
            if (!activity) continue;
            
            // Extraer datos
            const score = parseFloat(row[columns.score]) || 0;
            const maxScore = parseFloat(row[columns.maxScore]) || CONFIG.defaultMaxScore;
            
            // Extraer código del tema
            let topicCode = 'GENERAL';
            const topicText = row[columns.topic] || row[columns.subject] || '';
            
            // Intentar extraer "Tema X"
            const temaMatch = topicText.match(/tema\s*(\d+)/i);
            if (temaMatch) {
                topicCode = `Tema ${temaMatch[1]}`;
            } else if (topicText.match(/\b(T\d+)\b/i)) {
                topicCode = topicText.match(/\b(T\d+)\b/i)[1].toUpperCase();
            } else if (topicText) {
                topicCode = topicText.trim();
            }
            
            // IMPORTANTE: Incluir TODOS los tests, incluso con nota 0
            if (CONFIG.includeZeroScores || score > 0) {
                records.push({
                    file_name: fileName,
                    student_email: studentInfo.email,
                    student_key: studentInfo.key || studentInfo.email,
                    topic_code: topicCode,
                    activity: activity,
                    score: score.toFixed(1),
                    max_score: maxScore,
                    attempts: parseInt(row[columns.attempts]) || 1,
                    first_attempt: this.parseDate(row[columns.firstAttempt]),
                    last_attempt: this.parseDate(row[columns.lastAttempt]),
                    source: fileName
                });
            }
        }
        
        return records;
    }

    /**
     * Parsear fecha en formato español
     */
    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString();
        
        const str = dateStr.toString();
        
        // Formato DD/MM/YYYY
        const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
            const [_, day, month, year] = match;
            return new Date(year, month - 1, day).toISOString();
        }
        
        // Intentar parsear como fecha estándar
        const date = new Date(str);
        if (!isNaN(date)) {
            return date.toISOString();
        }
        
        return new Date().toISOString();
    }

    /**
     * Generar el archivo CSV final
     */
    async generateCSV(outputPath) {
        console.log('\n📝 Generando archivo CSV...');
        
        // Ordenar por estudiante y tema
        this.results.sort((a, b) => {
            if (a.student_email !== b.student_email) {
                return a.student_email.localeCompare(b.student_email);
            }
            return a.topic_code.localeCompare(b.topic_code);
        });
        
        // Generar CSV
        const csvContent = stringifyCSV(this.results, {
            header: true,
            columns: CSV_HEADERS
        });
        
        await fs.writeFile(outputPath, csvContent, 'utf-8');
        console.log(`✅ CSV generado: ${outputPath}`);
    }

    /**
     * Generar reporte de procesamiento
     */
    async generateReport() {
        const report = `
===========================================
REPORTE DE PROCESAMIENTO BULK EVOLCAMPUS
===========================================
Fecha: ${new Date().toLocaleString('es-ES')}

ESTADÍSTICAS:
- Archivos procesados: ${this.stats.filesProcessed}
- Total de registros: ${this.stats.totalRecords}
- Tests con nota 0: ${this.stats.zeroScoreRecords} (${((this.stats.zeroScoreRecords / this.stats.totalRecords) * 100).toFixed(1)}%)
- Estudiantes únicos: ${this.stats.uniqueStudents.size}
- Archivos con errores: ${this.stats.filesWithErrors}

DISTRIBUCIÓN DE NOTAS CERO POR ESTUDIANTE:
${this.getZeroScoreDistribution()}

ERRORES:
${this.errors.length > 0 ? this.errors.map(e => `- ${e.file}: ${e.error}`).join('\n') : 'Ninguno'}

===========================================
        `;
        
        await fs.writeFile(CONFIG.logFile, report, 'utf-8');
        console.log(`\n📊 Reporte guardado en: ${CONFIG.logFile}`);
        console.log(report);
    }

    /**
     * Obtener distribución de notas cero
     */
    getZeroScoreDistribution() {
        const distribution = {};
        
        this.results.forEach(record => {
            if (parseFloat(record.score) === 0) {
                const student = record.student_email || record.student_key;
                distribution[student] = (distribution[student] || 0) + 1;
            }
        });
        
        return Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .map(([student, count]) => `  ${student}: ${count} tests con nota 0`)
            .join('\n');
    }
}

// ===========================================
// MAIN
// ===========================================
async function main() {
    console.log('🚀 PROCESADOR BULK DE EXCEL EVOLCAMPUS\n');
    
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Uso: node bulk-excel-to-csv.js <directorio> [mapeos.json]');
        console.error('Ejemplo: node bulk-excel-to-csv.js ./excels mapeos.json');
        process.exit(1);
    }
    
    const directory = args[0];
    const mappingsFile = args[1];
    
    // Verificar que el directorio existe
    try {
        await fs.access(directory);
    } catch {
        console.error(`❌ El directorio no existe: ${directory}`);
        process.exit(1);
    }
    
    const processor = new EvolcampusBulkProcessor();
    
    // Cargar mapeos si se proporcionaron
    if (mappingsFile) {
        await processor.loadMappings(mappingsFile);
    }
    
    // Procesar directorio
    await processor.processDirectory(directory);
    
    // Generar CSV
    await processor.generateCSV(CONFIG.outputFile);
    
    // Generar reporte
    await processor.generateReport();
    
    console.log('\n✅ Procesamiento completado!');
}

// Ejecutar si es el script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { EvolcampusBulkProcessor };