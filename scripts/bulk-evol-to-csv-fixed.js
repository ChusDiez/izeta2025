#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';

// Importar las funciones del parser
import { extractStudent, extractTests } from '../src/utils/evolParser.js';

const CONFIG = {
    outputFile: `evolcampus-bulk-${new Date().toISOString().split('T')[0]}.csv`,
    includeZeroScores: true,
    defaultMaxScore: 10
};

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
        this.stats = {
            filesProcessed: 0,
            totalRecords: 0,
            zeroScoreRecords: 0,
            filesWithErrors: 0,
            uniqueStudents: new Set()
        };
    }

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
                this.stats.filesWithErrors++;
            }
        }
    }

    async processExcelFile(filePath) {
        const fileName = path.basename(filePath);
        const buffer = await fs.readFile(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        
        // Tomar la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        // Extraer información del estudiante usando el parser existente
        const studentInfo = await extractStudent(rawData, fileName);
        
        // Extraer tests usando el parser existente
        const tests = await extractTests(rawData, 'temp_user_id', fileName);
        
        // Procesar cada test
        for (const test of tests) {
            this.results.push({
                file_name: fileName,
                student_email: '', // Sin email por defecto
                student_key: studentInfo.baseSlug || studentInfo.searchName,
                topic_code: test.topic_code,
                activity: test.activity,
                score: test.score,
                max_score: test.max_score,
                attempts: test.attempts,
                first_attempt: test.first_attempt,
                last_attempt: test.last_attempt,
                source: 'evolcampus'
            });
        }
        
        this.stats.totalRecords += tests.length;
        
        // Contar tests con nota 0
        const zeroScores = tests.filter(t => parseFloat(t.score) === 0).length;
        this.stats.zeroScoreRecords += zeroScores;
        
        this.stats.uniqueStudents.add(studentInfo.baseSlug || studentInfo.searchName);
        
        console.log(`   ✅ Extraídos ${tests.length} tests (${zeroScores} con nota 0)`);
        console.log(`   👤 Estudiante: ${studentInfo.searchName}`);
    }

    async generateCSV(outputPath) {
        console.log(`\n📝 Generando CSV: ${outputPath}`);
        
        const csvRows = [CSV_HEADERS.join(',')];
        
        for (const record of this.results) {
            const row = CSV_HEADERS.map(header => {
                const value = record[header] || '';
                // Escapar comillas y comas
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvRows.push(row.join(','));
        }
        
        await fs.writeFile(outputPath, csvRows.join('\n'), 'utf-8');
        console.log(`✅ CSV generado con ${this.results.length} registros`);
    }

    generateReport() {
        console.log(`\n📊 RESUMEN DEL PROCESAMIENTO:`);
        console.log(`   📁 Archivos procesados: ${this.stats.filesProcessed}`);
        console.log(`   📝 Total de registros: ${this.stats.totalRecords}`);
        console.log(`   🎯 Tests con nota 0: ${this.stats.zeroScoreRecords}`);
        console.log(`   👥 Estudiantes únicos: ${this.stats.uniqueStudents.size}`);
        console.log(`   ❌ Archivos con errores: ${this.stats.filesWithErrors}`);
        
        if (this.stats.zeroScoreRecords > 0) {
            const percentage = ((this.stats.zeroScoreRecords / this.stats.totalRecords) * 100).toFixed(1);
            console.log(`   📈 Porcentaje de tests con nota 0: ${percentage}%`);
        }
    }
}

async function main() {
    const directory = process.argv[2];
    
    if (!directory) {
        console.error('❌ Uso: node bulk-evol-to-csv-fixed.js <directorio-con-excels>');
        console.error('   Ejemplo: node bulk-evol-to-csv-fixed.js informes-semanales/expediente-03062025/');
        process.exit(1);
    }
    
    try {
        // Verificar que el directorio existe
        await fs.access(directory);
        
        const processor = new EvolcampusBulkProcessor();
        
        console.log('🚀 Iniciando procesamiento masivo de archivos Excel de Evolcampus...\n');
        
        // Procesar directorio
        await processor.processDirectory(directory);
        
        // Generar CSV
        if (processor.results.length > 0) {
            await processor.generateCSV(CONFIG.outputFile);
        } else {
            console.log('⚠️ No se encontraron datos para procesar');
        }
        
        // Mostrar resumen
        processor.generateReport();
        
        console.log(`\n🎉 Procesamiento completado!`);
        console.log(`📄 Archivo CSV: ${CONFIG.outputFile}`);
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

main(); 