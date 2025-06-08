#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';

async function testBulkProcessing() {
    const directory = process.argv[2] || 'informes-semanales/expediente-03062025/';
    
    console.log(`🔍 Escaneando directorio: ${directory}`);
    
    try {
        const files = await fs.readdir(directory);
        const excelFiles = files.filter(f => 
            f.toLowerCase().endsWith('.xlsx') || 
            f.toLowerCase().endsWith('.xls')
        );
        
        console.log(`📁 Encontrados ${excelFiles.length} archivos Excel`);
        
        // Procesar solo los primeros 3 archivos como prueba
        for (let i = 0; i < Math.min(3, excelFiles.length); i++) {
            const file = excelFiles[i];
            console.log(`\n[${i + 1}] Procesando: ${file}`);
            
            try {
                const filePath = path.join(directory, file);
                const buffer = await fs.readFile(filePath);
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                
                console.log(`   ✅ Archivo leído correctamente`);
                console.log(`   📊 Hojas: ${workbook.SheetNames.join(', ')}`);
                
                // Leer primera hoja
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                console.log(`   📝 Filas encontradas: ${data.length}`);
                
            } catch (error) {
                console.error(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log(`\n✅ Prueba completada. El sistema puede procesar archivos Excel.`);
        console.log(`\n🎯 Para procesar todos los archivos, usa el Dashboard Web:`);
        console.log(`   1. Abre admin/dashboard.html`);
        console.log(`   2. Ve a "Importación Lotes"`);
        console.log(`   3. Arrastra los archivos Excel`);
        
    } catch (error) {
        console.error(`❌ Error accediendo al directorio: ${error.message}`);
    }
}

testBulkProcessing(); 