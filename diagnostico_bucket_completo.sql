-- ================================================
-- DIAGNÓSTICO COMPLETO DEL BUCKET
-- ================================================

-- 1. Verificar si el bucket existe y su estado
SELECT 
    id,
    name,
    public,
    created_at,
    updated_at,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- 2. Ver las políticas del bucket (si existen)
SELECT 
    id,
    name,
    bucket_id,
    definition,
    check_expression,
    using_expression
FROM storage.policies 
WHERE bucket_id = 'evol-excel-import';

-- 3. Verificar permisos del usuario actual
SELECT 
    current_user,
    current_setting('is_superuser') as is_superuser,
    has_table_privilege('storage.policies', 'DELETE') as can_delete_policies,
    has_table_privilege('storage.buckets', 'UPDATE') as can_update_buckets;

-- 4. Ver si hay objetos en el bucket
SELECT 
    COUNT(*) as total_files,
    SUM(metadata->>'size')::bigint as total_size_bytes
FROM storage.objects
WHERE bucket_id = 'evol-excel-import';

-- 5. Verificar RLS en las tablas de storage
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'storage'
AND tablename IN ('objects', 'buckets', 'policies');

-- 6. Estado actual resumido
SELECT 
    '📊 ESTADO DEL BUCKET' as titulo,
    CASE 
        WHEN b.public = true THEN '✅ Bucket es PÚBLICO'
        ELSE '❌ Bucket es PRIVADO'
    END as estado_bucket,
    COALESCE(p.num_policies, 0) as numero_politicas,
    CASE 
        WHEN b.public = true AND COALESCE(p.num_policies, 0) = 0 THEN '✅ Debería funcionar'
        WHEN b.public = true AND COALESCE(p.num_policies, 0) > 0 THEN '⚠️ Público pero con políticas restrictivas'
        ELSE '❌ Configuración restrictiva'
    END as diagnostico
FROM storage.buckets b
LEFT JOIN (
    SELECT bucket_id, COUNT(*) as num_policies 
    FROM storage.policies 
    GROUP BY bucket_id
) p ON b.name = p.bucket_id
WHERE b.name = 'evol-excel-import'; 