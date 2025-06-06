-- ================================================
-- TEST SIMPLE DE SUBIDA
-- ================================================

-- 1. Primero, ejecutar el diagnóstico simple:
SELECT 
    name,
    public,
    file_size_limit,
    CASE 
        WHEN public = true THEN '✅ El bucket ES público'
        ELSE '❌ El bucket NO es público - ESTE ES EL PROBLEMA'
    END as diagnostico
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- 2. Si el bucket no es público, hacerlo público:
UPDATE storage.buckets 
SET public = true
WHERE name = 'evol-excel-import';

-- 3. Verificar el cambio:
SELECT name, public FROM storage.buckets WHERE name = 'evol-excel-import';
-- Debe mostrar: public = true

-- Si después de esto sigue sin funcionar, el problema es RLS.
-- En ese caso, ejecuta SOLO ESTO:

-- 4. Desactivar RLS temporalmente:
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- AHORA INTENTA SUBIR TU ARCHIVO

-- 5. Después de subir, IMPORTANTE reactivar RLS:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 