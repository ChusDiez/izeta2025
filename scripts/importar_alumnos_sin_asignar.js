// Script para importar usuarios desde alumnos_sin_asignar.csv
// Ejecutar con: node importar_alumnos_sin_asignar.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parse/sync');
const path = require('path');

// Configuración de Supabase
const SUPABASE_URL = 'https://ffmoihpbjqqjrajtpxgo.supabase.co';
const SUPABASE_SERVICE_KEY = 'tu_service_role_key_aqui'; // IMPORTANTE: Reemplazar con tu key real

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importarAlumnos() {
    try {
        // Leer archivo CSV
        const csvPath = path.join(__dirname, 'data', 'alumnos_sin_asignar.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Parsear CSV
        const records = csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        console.log(`📋 Encontrados ${records.length} registros en el CSV`);
        
        // Preparar datos para inserción
        const usuarios = records.map(record => ({
            email: record.email.toLowerCase().trim(),
            username: record.nombre,
            cohort: record.cohorte || 'sin_asignar',
            active: true,
            created_at: new Date().toISOString()
        }));
        
        // Insertar en lotes de 100
        const batchSize = 100;
        let totalInserted = 0;
        let totalUpdated = 0;
        
        for (let i = 0; i < usuarios.length; i += batchSize) {
            const batch = usuarios.slice(i, i + batchSize);
            
            console.log(`\n🔄 Procesando lote ${Math.floor(i/batchSize) + 1} de ${Math.ceil(usuarios.length/batchSize)}`);
            
            // Insertar o actualizar
            const { data, error } = await supabase
                .from('users')
                .upsert(batch, {
                    onConflict: 'email',
                    ignoreDuplicates: false
                })
                .select();
            
            if (error) {
                console.error('❌ Error en lote:', error);
                continue;
            }
            
            if (data) {
                totalInserted += data.length;
                console.log(`✅ Procesados ${data.length} usuarios`);
            }
        }
        
        console.log(`\n📊 Resumen:`);
        console.log(`- Total registros en CSV: ${records.length}`);
        console.log(`- Total procesados: ${totalInserted}`);
        
        // Verificar algunos usuarios
        console.log(`\n🔍 Verificando algunos usuarios:`);
        const ejemplos = ['Andres Peral Hernández', 'pablo rodriguez chacon', 'Trini Rodríguez González'];
        
        for (const nombre of ejemplos) {
            const { data, error } = await supabase
                .from('users')
                .select('email, username')
                .ilike('username', `%${nombre}%`)
                .single();
            
            if (data) {
                console.log(`✅ ${nombre} -> ${data.email}`);
            } else {
                console.log(`❌ No encontrado: ${nombre}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar importación
console.log('🚀 Iniciando importación de alumnos_sin_asignar.csv...\n');
importarAlumnos()
    .then(() => console.log('\n✅ Importación completada'))
    .catch(err => console.error('\n❌ Error en importación:', err)); 