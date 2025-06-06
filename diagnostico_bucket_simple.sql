-- ================================================
-- DIAGNÓSTICO SIMPLE DEL BUCKET (Sin storage.policies)
-- ================================================

-- 1. Ver estado del bucket
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    CASE 
        WHEN public = true THEN '✅ PÚBLICO - Debería funcionar'
        ELSE '❌ PRIVADO - Necesita ser público'
    END as estado
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- 2. Ver si el bucket existe
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ El bucket NO existe'
        WHEN COUNT(*) = 1 THEN '✅ El bucket existe'
        ELSE '⚠️ Hay múltiples buckets con ese nombre'
    END as existe,
    COUNT(*) as cantidad
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- 3. Ver todos los buckets disponibles
SELECT 
    name,
    public,
    file_size_limit,
    created_at
FROM storage.buckets
ORDER BY created_at DESC;

-- 4. Verificar RLS en storage.objects
SELECT 
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS Activado'
        ELSE '🔓 RLS Desactivado'
    END as estado_rls
FROM pg_tables
WHERE schemaname = 'storage'
AND tablename = 'objects';

-- 5. Ver esquema completo de storage
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'storage'
ORDER BY table_name; 