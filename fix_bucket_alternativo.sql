-- ================================================
-- SOLUCIÓN ALTERNATIVA PARA EL BUCKET
-- ================================================

-- OPCIÓN 1: Forzar el bucket a ser público sin tocar políticas
UPDATE storage.buckets 
SET 
    public = true,
    file_size_limit = 52428800, -- 50MB
    allowed_mime_types = NULL -- Permitir todos los tipos
WHERE id = 'evol-excel-import' OR name = 'evol-excel-import';

-- Verificar el cambio
SELECT * FROM storage.buckets WHERE name = 'evol-excel-import';

-- OPCIÓN 2: Si las políticas están bloqueando, desactivarlas temporalmente
-- En lugar de DELETE, intentar UPDATE
UPDATE storage.policies 
SET 
    definition = '{"operation": "SELECT"}',
    check_expression = 'true',
    using_expression = 'true'
WHERE bucket_id = 'evol-excel-import';

-- OPCIÓN 3: Crear un bucket completamente nuevo con nombre diferente
DO $$
BEGIN
    -- Intentar crear nuevo bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('excel-temp-public', 'excel-temp-public', true, 52428800)
    ON CONFLICT (id) DO UPDATE
    SET public = true, file_size_limit = 52428800;
    
    RAISE NOTICE 'Bucket excel-temp-public creado/actualizado';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creando bucket: %', SQLERRM;
END $$;

-- OPCIÓN 4: Ver qué está bloqueando exactamente
WITH bucket_info AS (
    SELECT 
        b.id,
        b.name,
        b.public,
        b.owner,
        b.created_at,
        b.file_size_limit
    FROM storage.buckets b
    WHERE b.name = 'evol-excel-import'
),
policy_info AS (
    SELECT 
        COUNT(*) as policy_count,
        STRING_AGG(name, ', ') as policy_names
    FROM storage.policies
    WHERE bucket_id = 'evol-excel-import'
)
SELECT 
    bi.*,
    pi.policy_count,
    pi.policy_names,
    CASE 
        WHEN bi.public = true THEN 'El bucket ES público'
        ELSE 'El bucket NO es público'
    END as estado_publico,
    CASE 
        WHEN pi.policy_count > 0 THEN 'HAY políticas que pueden estar bloqueando'
        ELSE 'NO hay políticas'
    END as estado_politicas
FROM bucket_info bi
CROSS JOIN policy_info pi;

-- OPCIÓN 5: Intentar subir un archivo de prueba directamente
-- Esto te dirá el error exacto
DO $$
DECLARE
    v_bucket_id text;
BEGIN
    -- Obtener el ID del bucket
    SELECT id INTO v_bucket_id
    FROM storage.buckets
    WHERE name = 'evol-excel-import';
    
    -- Intentar insertar un objeto de prueba
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
        v_bucket_id,
        'test.txt',
        auth.uid(),
        '{"size": 10, "mimetype": "text/plain"}'::jsonb
    );
    
    RAISE NOTICE 'Archivo de prueba creado exitosamente';
    
    -- Eliminar el archivo de prueba
    DELETE FROM storage.objects 
    WHERE bucket_id = v_bucket_id AND name = 'test.txt';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al subir archivo de prueba: %', SQLERRM;
        RAISE NOTICE 'Este es el error que está causando el problema';
END $$; 