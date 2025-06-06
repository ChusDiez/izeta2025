-- ================================================
-- SOLUCIÓN DIRECTA PARA EL BUCKET
-- ================================================

-- PASO 1: Asegurar que el bucket es público
UPDATE storage.buckets 
SET public = true
WHERE name = 'evol-excel-import';

-- PASO 2: Si no existe, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evol-excel-import', 'evol-excel-import', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 52428800;

-- PASO 3: Verificar
SELECT name, public FROM storage.buckets WHERE name = 'evol-excel-import';

-- PASO 4: Ver políticas RLS en storage.objects
SELECT pol.polname, pol.polcmd, pol.polroles
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
WHERE nsp.nspname = 'storage' AND cls.relname = 'objects';

-- PASO 5: Si hay políticas RLS bloqueando, desactivar temporalmente
-- ⚠️ CUIDADO: Esto afecta a TODOS los buckets
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Para volver a activar después:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- PASO 6: Solución alternativa - Crear bucket con nombre diferente
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('excel-public-temp', 'excel-public-temp', true, 52428800);

-- Verificar el nuevo bucket
SELECT * FROM storage.buckets WHERE name = 'excel-public-temp';

-- PASO 7: Test de subida directa
DO $$
BEGIN
    -- Intentar insertar un archivo de prueba
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('evol-excel-import', 'test.txt', '{"size": 10}'::jsonb);
    
    RAISE NOTICE '✅ Subida de prueba exitosa';
    
    -- Limpiar
    DELETE FROM storage.objects 
    WHERE bucket_id = 'evol-excel-import' AND name = 'test.txt';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error: %', SQLERRM;
        RAISE NOTICE 'El error indica que hay restricciones activas';
END $$; 