-- ================================================
-- VERIFICAR PROCESO DE IMPORTACIÓN DE EXCEL MEJORADO
-- ================================================

-- 1. Verificar que el bucket existe y está configurado correctamente
SELECT 
    name,
    public,
    CASE 
        WHEN name = 'evol-excel-import' THEN '✅ Bucket correcto'
        ELSE '❌ Bucket incorrecto'
    END as estado
FROM storage.buckets 
WHERE name IN ('evol-excel-import', 'excel-public');

-- 2. Verificar usuarios importados de alumnos_sin_asignar.csv
-- (Deberían estar en la tabla users con sus nombres y emails)
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as usuarios_con_email,
    COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as usuarios_con_nombre
FROM users
WHERE cohort = 'sin_asignar';

-- 3. Buscar ejemplos de usuarios por nombre (prueba de búsqueda)
-- Cambiar 'Andres Peral' por un nombre real del Excel
SELECT 
    id,
    email,
    username,
    cohort
FROM users
WHERE username ILIKE '%Andres Peral%'
   OR username ILIKE '%pablo rodriguez%'
   OR username ILIKE '%Trini Rodríguez%'
LIMIT 5;

-- 4. Ver últimos archivos subidos al bucket
SELECT 
    name,
    created_at,
    metadata->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'evol-excel-import'
  AND name NOT LIKE 'processed/%'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Ver archivos procesados
SELECT 
    name,
    created_at
FROM storage.objects
WHERE bucket_id = 'evol-excel-import'
  AND name LIKE 'processed/%'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Ver últimos registros procesados en topic_results
SELECT 
    tr.id,
    u.email,
    u.username,
    tr.topic_code,
    tr.activity,
    tr.score,
    tr.source,
    tr.created_at
FROM topic_results tr
JOIN users u ON tr.student_id = u.id
WHERE tr.source = 'evol_excel'
ORDER BY tr.created_at DESC
LIMIT 10;

-- 7. Ver logs de procesamiento
SELECT 
    endpoint,
    status_code,
    records_synced,
    details->>'fileName' as file_name,
    details->>'studentEmail' as student_email,
    details->>'recordsProcessed' as records_processed,
    executed_at
FROM api_sync_log
WHERE endpoint = 'process_excel'
ORDER BY executed_at DESC
LIMIT 10;

-- 8. Verificar trigger automático
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ Trigger activo'
        ELSE '❌ Trigger inactivo'
    END as estado
FROM pg_trigger
WHERE tgname = 'on_excel_upload';

-- INSTRUCCIONES PARA SOLUCIONAR PROBLEMAS:
-- ==========================================
-- 
-- Si el archivo no se procesa:
-- 1. Verificar que se subió al bucket 'evol-excel-import' (query 4)
-- 2. Verificar que el trigger está activo (query 8)
-- 3. Ver si hay errores en los logs (query 7)
-- 
-- Si no encuentra el email del alumno:
-- 1. Verificar que el usuario existe en la BD (query 3)
-- 2. Asegurarse de que el nombre en el archivo coincide con username en la BD
-- 3. El formato del archivo debe ser: expediente-nombre-apellidos-fecha.xlsx
-- 
-- Para importar usuarios desde alumnos_sin_asignar.csv:
-- INSERT INTO users (email, username, cohort, created_at)
-- SELECT 
--     LOWER(TRIM(email)),
--     nombre,
--     'sin_asignar',
--     NOW()
-- FROM (
--     -- Aquí deberías pegar los datos del CSV
--     VALUES 
--     ('andresphdz98@gmail.com', 'Andres Peral Hernández'),
--     ('pablitorguez96@gmail.com', 'pablo rodriguez chacon'),
--     -- etc...
-- ) AS csv_data(email, nombre)
-- ON CONFLICT (email) DO UPDATE 
-- SET username = EXCLUDED.username
-- WHERE users.username IS NULL; 