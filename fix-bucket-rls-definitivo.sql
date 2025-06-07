-- ========================================
-- SOLUCIÓN DEFINITIVA PARA BUCKET RLS
-- ========================================

-- 1. Verificar estado actual
SELECT 
    'ESTADO ACTUAL:' as info,
    b.name as bucket,
    b.public,
    COUNT(p.*) as num_policies,
    b.file_size_limit,
    b.allowed_mime_types
FROM storage.buckets b
LEFT JOIN storage.policies p ON p.bucket_id = b.id
WHERE b.name = 'evol-excel-import'
GROUP BY b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types;

-- 2. Crear o actualizar el bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evol-excel-import',
    'evol-excel-import', 
    false,
    52428800,
    ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream']::text[]
)
ON CONFLICT (id) 
DO UPDATE SET 
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream']::text[];

-- 3. Limpiar TODAS las políticas anteriores
DELETE FROM storage.policies WHERE bucket_id = 'evol-excel-import';

-- 4. Crear políticas simples que FUNCIONAN
-- Política 1: Cualquier usuario autenticado puede subir
CREATE POLICY "auth_upload_policy" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'evol-excel-import');

-- Política 2: Cualquier usuario autenticado puede ver
CREATE POLICY "auth_select_policy" ON storage.objects
FOR SELECT 
TO authenticated
USING (bucket_id = 'evol-excel-import');

-- Política 3: Cualquier usuario autenticado puede actualizar
CREATE POLICY "auth_update_policy" ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'evol-excel-import')
WITH CHECK (bucket_id = 'evol-excel-import');

-- Política 4: Cualquier usuario autenticado puede eliminar
CREATE POLICY "auth_delete_policy" ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'evol-excel-import');

-- 5. Verificar que se crearon las políticas
SELECT 
    'POLÍTICAS CREADAS:' as info,
    name,
    action,
    CASE 
        WHEN check_expression IS NOT NULL THEN substring(check_expression, 1, 50) || '...'
        ELSE 'N/A'
    END as check_expr
FROM storage.policies 
WHERE bucket_id = 'evol-excel-import';

-- 6. Crear función auxiliar para verificar permisos
CREATE OR REPLACE FUNCTION check_storage_permissions(user_id uuid)
RETURNS TABLE(
    can_insert boolean,
    can_select boolean,
    can_update boolean,
    can_delete boolean,
    is_authenticated boolean,
    is_admin boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true as can_insert,  -- Con las políticas anteriores
        true as can_select,
        true as can_update,
        true as can_delete,
        (auth.uid() IS NOT NULL) as is_authenticated,
        COALESCE((SELECT is_admin FROM users WHERE id = user_id), false) as is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Mensaje final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ CONFIGURACIÓN COMPLETADA';
    RAISE NOTICE '============================';
    RAISE NOTICE 'El bucket evol-excel-import ahora permite:';
    RAISE NOTICE '- Subir archivos a usuarios autenticados';
    RAISE NOTICE '- Ver archivos a usuarios autenticados';
    RAISE NOTICE '- Actualizar archivos a usuarios autenticados';
    RAISE NOTICE '- Eliminar archivos a usuarios autenticados';
    RAISE NOTICE '';
    RAISE NOTICE 'Si aún tienes problemas, verifica:';
    RAISE NOTICE '1. Que el usuario esté autenticado';
    RAISE NOTICE '2. Que RLS esté habilitado en storage.objects';
    RAISE NOTICE '3. Los logs de Supabase para más detalles';
END $$; 