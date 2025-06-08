#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

async function splitCSVByStudent() {
    const inputFile = process.argv[2] || 'evolcampus-bulk-2025-06-08.csv';
    const outputDir = 'csv-individuales';
    
    console.log(`🔍 Leyendo archivo: ${inputFile}`);
    
    // Crear directorio de salida
    await fs.mkdir(outputDir, { recursive: true });
    
    // Leer CSV
    const csvContent = await fs.readFile(inputFile, 'utf-8');
    const lines = csvContent.split('\n');
    const headers = lines[0];
    
    console.log(`📊 Total de líneas: ${lines.length}`);
    
    // Agrupar por estudiante
    const studentData = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Extraer student_key (columna 3)
        const columns = line.split(',');
        if (columns.length < 3) continue;
        
        const studentKey = columns[2];
        if (!studentKey) continue;
        
        if (!studentData.has(studentKey)) {
            studentData.set(studentKey, []);
        }
        studentData.get(studentKey).push(line);
    }
    
    console.log(`👥 Estudiantes encontrados: ${studentData.size}`);
    
    // Crear archivo por estudiante
    let filesCreated = 0;
    
    for (const [studentKey, records] of studentData.entries()) {
        const fileName = `${studentKey}.csv`;
        const filePath = path.join(outputDir, fileName);
        
        const csvContent = [headers, ...records].join('\n');
        await fs.writeFile(filePath, csvContent, 'utf-8');
        
        filesCreated++;
        if (filesCreated % 50 === 0) {
            console.log(`📝 Creados ${filesCreated} archivos...`);
        }
    }
    
    console.log(`\n✅ Proceso completado:`);
    console.log(`   📁 Directorio: ${outputDir}/`);
    console.log(`   📄 Archivos creados: ${filesCreated}`);
    console.log(`   📊 Registros por archivo: ~${Math.round(lines.length / filesCreated)}`);
    
    // Mostrar algunos ejemplos
    console.log(`\n📋 Ejemplos de archivos creados:`);
    const examples = Array.from(studentData.keys()).slice(0, 5);
    examples.forEach(key => {
        console.log(`   • ${key}.csv (${studentData.get(key).length} tests)`);
    });
}

splitCSVByStudent().catch(console.error); 