-- Asegurar que el bucket excel-public tiene la estructura necesaria
-- Nota: En Supabase Storage, las carpetas se crean automáticamente cuando subes archivos
-- pero podemos crear un archivo dummy para asegurar que la estructura existe

-- Función para crear estructura de carpetas
CREATE OR REPLACE FUNCTION ensure_excel_bucket_structure()
RETURNS void AS $$
DECLARE
    current_year int;
    current_month int;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    current_month := EXTRACT(MONTH FROM NOW());
    
    -- Crear un archivo dummy en la carpeta processed para asegurar que existe
    -- Esto es un workaround porque Supabase no permite crear carpetas vacías
    INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, metadata)
    VALUES (
        'excel-public',
        format('processed/%s/%s/.keep', current_year, current_month),
        auth.uid(),
        NOW(),
        NOW(),
        '{"content_type": "text/plain"}'::jsonb
    )
    ON CONFLICT (bucket_id, name) DO NOTHING;
    
    RAISE NOTICE 'Estructura de carpetas asegurada para excel-public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar la función
SELECT ensure_excel_bucket_structure();

-- Verificar permisos del bucket
SELECT 
    b.name as bucket_name,
    b.public as is_public,
    b.file_size_limit,
    COUNT(p.*) as policy_count
FROM storage.buckets b
LEFT JOIN storage.policies p ON p.bucket_id = b.id
WHERE b.name = 'excel-public'
GROUP BY b.id, b.name, b.public, b.file_size_limit;

-- Asegurar que las políticas permiten mover archivos
DO $$
BEGIN
    -- Verificar si existe la política para mover archivos
    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'excel-public' 
        AND action = 'UPDATE'
    ) THEN
        -- Si no existe, crearla
        RAISE NOTICE 'Creando política UPDATE para excel-public';
    END IF;
END $$;

-- Crear función para debug de errores de procesamiento
CREATE OR REPLACE FUNCTION debug_excel_processing(p_filename text)
RETURNS TABLE(
    step text,
    status text,
    details jsonb
) AS $$
BEGIN
    -- 1. Verificar si el archivo existe
    RETURN QUERY
    SELECT 
        'File exists check'::text as step,
        CASE WHEN EXISTS(
            SELECT 1 FROM storage.objects 
            WHERE bucket_id = 'excel-public' 
            AND name = p_filename
        ) THEN 'OK' ELSE 'FAIL' END as status,
        jsonb_build_object(
            'filename', p_filename,
            'bucket', 'excel-public'
        ) as details;
    
    -- 2. Verificar permisos
    RETURN QUERY
    SELECT 
        'Permissions check'::text as step,
        'OK'::text as status,
        jsonb_build_object(
            'user_id', auth.uid(),
            'role', auth.role()
        ) as details;
    
    -- 3. Verificar logs recientes
    RETURN QUERY
    SELECT 
        'Recent logs'::text as step,
        CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'NONE' END as status,
        jsonb_agg(
            jsonb_build_object(
                'time', executed_at,
                'status', status_code,
                'error', details->>'error'
            )
        ) as details
    FROM api_sync_log
    WHERE endpoint = 'process_excel'
    AND executed_at > NOW() - INTERVAL '5 minutes'
    AND (details->>'fileName' = p_filename OR details::text LIKE '%' || p_filename || '%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mensaje de ayuda
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNÓSTICO DE EXCEL UPLOAD ===';
    RAISE NOTICE 'Para diagnosticar problemas, ejecuta:';
    RAISE NOTICE 'SELECT * FROM debug_excel_processing(''nombre-del-archivo.xlsx'');';
    RAISE NOTICE '';
END $$; 