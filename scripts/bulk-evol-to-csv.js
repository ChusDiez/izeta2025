#!/usr/bin/env node

// scripts/bulk-evol-to-csv.js
// Script CLI para procesar en lote archivos Excel de Evolcampus
// Uso: node scripts/bulk-evol-to-csv.js <carpeta-con-excels> [--upload]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { format } from '@fast-csv/format';
import { createClient } from '@supabase/supabase-js';
import { extractStudent, extractTests } from '../src/utils/evolParser.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuración
const inputDir = process.argv[2] || '.';
const shouldUpload = process.argv.includes('--upload');
const timestamp = new Date().toISOString().split('T')[0];
const outputCsv = `evolcampus-batch-${timestamp}.csv`;

// Inicializar Supabase si vamos a subir
let supabase = null;
if (shouldUpload) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Estadísticas
const stats = {
  filesProcessed: 0,
  filesWithEmail: 0,
  filesWithoutEmail: 0,
  totalRecords: 0,
  errors: [],
  missingUsers: [],
  successfulUploads: 0
};

async function processExcelFiles() {
  console.log(`\n🚀 Procesando archivos Excel en: ${inputDir}`);
  console.log(`📁 CSV de salida: ${outputCsv}`);
  console.log(`${shouldUpload ? '☁️  Subida a Supabase: ACTIVADA' : '💾 Subida a Supabase: DESACTIVADA'}\n`);
  
  try {
    // Verificar que el directorio existe
    await fs.access(inputDir);
    
    // Leer archivos del directorio
    const files = await fs.readdir(inputDir);
    const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    
    if (excelFiles.length === 0) {
      console.log('❌ No se encontraron archivos Excel en el directorio');
      return;
    }
    
    console.log(`📊 Encontrados ${excelFiles.length} archivos Excel\n`);
    
    // Crear stream CSV
    const csvStream = format({ headers: true });
    const writeStream = await fs.open(outputCsv, 'w').then(f => f.createWriteStream());
    csvStream.pipe(writeStream);
    
    // Cache de usuarios para evitar consultas repetidas
    const userCache = new Map();
    
    // Procesar cada archivo
    for (const [index, fileName] of excelFiles.entries()) {
      console.log(`\n[${index + 1}/${excelFiles.length}] 📄 ${fileName}`);
      
      try {
        // Leer archivo Excel
        const filePath = path.join(inputDir, fileName);
        const buffer = await fs.readFile(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
        
        // Extraer información del estudiante
        const studentInfo = extractStudent(rows, fileName);
        
        if (!studentInfo.email) {
          console.log(`   ⚠️  Sin email detectado`);
          stats.filesWithoutEmail++;
          
          // Intentar buscar en mapeos si tenemos Supabase
          if (supabase && studentInfo.baseSlug) {
            const { data: mapping } = await supabase
              .from('excel_name_mappings')
              .select('user_email')
              .eq('excel_name', studentInfo.baseSlug)
              .single();
            
            if (mapping) {
              studentInfo.email = mapping.user_email;
              console.log(`   ✅ Email encontrado en mapeos: ${studentInfo.email}`);
            } else {
              console.log(`   ❌ No hay mapeo para: ${studentInfo.baseSlug}`);
              stats.missingUsers.push(studentInfo.baseSlug);
              continue;
            }
          } else {
            stats.missingUsers.push(studentInfo.searchName || fileName);
            continue;
          }
        } else {
          stats.filesWithEmail++;
        }
        
        // Buscar usuario en cache o base de datos
        let userId = userCache.get(studentInfo.email);
        
        if (!userId && supabase) {
          const { data: user, error } = await supabase
            .from('users')
            .select('id, username')
            .eq('email', studentInfo.email)
            .single();
          
          if (error || !user) {
            console.log(`   ❌ Usuario no encontrado: ${studentInfo.email}`);
            stats.missingUsers.push(studentInfo.email);
            continue;
          }
          
          userId = user.id;
          userCache.set(studentInfo.email, userId);
          console.log(`   👤 Usuario: ${user.username} (${studentInfo.email})`);
        } else if (!userId) {
          // Si no tenemos Supabase, usar un ID temporal
          userId = `temp-${studentInfo.email}`;
          userCache.set(studentInfo.email, userId);
        }
        
        // Extraer tests
        const tests = extractTests(rows, userId, fileName);
        
        if (tests.length === 0) {
          console.log(`   ⚠️  No se encontraron tests`);
          continue;
        }
        
        console.log(`   📝 ${tests.length} registros extraídos`);
        
        // Escribir al CSV
        for (const test of tests) {
          await new Promise((resolve) => {
            csvStream.write({
              file_name: fileName,
              student_email: studentInfo.email,
              student_id: test.student_id,
              topic_code: test.topic_code,
              activity: test.activity,
              score: test.score,
              max_score: test.max_score,
              attempts: test.attempts,
              first_attempt: test.first_attempt,
              last_attempt: test.last_attempt,
              source: test.source
            }, resolve);
          });
        }
        
        stats.totalRecords += tests.length;
        
        // Subir a Supabase si está habilitado
        if (shouldUpload && supabase) {
          const { error } = await supabase
            .from('topic_results')
            .upsert(tests, { 
              onConflict: 'student_id,topic_code,activity',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`   ❌ Error al subir: ${error.message}`);
            stats.errors.push({ file: fileName, error: error.message });
          } else {
            stats.successfulUploads += tests.length;
            console.log(`   ☁️  Subidos ${tests.length} registros`);
          }
        }
        
        stats.filesProcessed++;
        
      } catch (error) {
        console.error(`   ❌ Error procesando archivo: ${error.message}`);
        stats.errors.push({ file: fileName, error: error.message });
      }
    }
    
    // Cerrar el stream CSV
    await new Promise((resolve) => csvStream.end(resolve));
    
    // Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DEL PROCESAMIENTO');
    console.log('='.repeat(60));
    console.log(`✅ Archivos procesados: ${stats.filesProcessed}/${excelFiles.length}`);
    console.log(`📧 Con email detectado: ${stats.filesWithEmail}`);
    console.log(`❌ Sin email: ${stats.filesWithoutEmail}`);
    console.log(`📝 Total registros extraídos: ${stats.totalRecords}`);
    
    if (shouldUpload) {
      console.log(`☁️  Registros subidos a Supabase: ${stats.successfulUploads}`);
    }
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errores (${stats.errors.length}):`);
      stats.errors.forEach(e => console.log(`   - ${e.file}: ${e.error}`));
    }
    
    if (stats.missingUsers.length > 0) {
      console.log(`\n❌ Usuarios no encontrados (${stats.missingUsers.length}):`);
      const uniqueMissing = [...new Set(stats.missingUsers)];
      uniqueMissing.slice(0, 10).forEach(u => console.log(`   - ${u}`));
      if (uniqueMissing.length > 10) {
        console.log(`   ... y ${uniqueMissing.length - 10} más`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ CSV generado: ${outputCsv}`);
    console.log(`💡 Puedes importar este CSV a Supabase con:`);
    console.log(`   psql -h <host> -U <user> -d <database> -c "\\copy topic_results FROM '${outputCsv}' CSV HEADER"`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
processExcelFiles().catch(console.error); 