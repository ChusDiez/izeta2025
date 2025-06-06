-- ================================================
-- SOLUCIÓN INMEDIATA PARA ERROR RLS EN STORAGE
-- ================================================
-- Ejecutar ESTE SCRIPT en el SQL Editor de Supabase

-- PASO 1: Hacer el bucket público temporalmente
UPDATE storage.buckets 
SET public = true
WHERE name = 'evol-excel-import';

-- PASO 2: Verificar que se actualizó
SELECT 
    name,
    public,
    CASE 
        WHEN public THEN '✅ PÚBLICO - Los archivos se pueden subir'
        ELSE '❌ PRIVADO - Error de RLS'
    END as estado
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- Si el bucket no existe, crearlo:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evol-excel-import', 
    'evol-excel-import', 
    true,  -- PÚBLICO
    10485760,  -- 10MB
    ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- RESULTADO ESPERADO:
-- ✅ El bucket ahora es público y deberías poder subir archivos sin error

-- ================================================
-- NOTA IMPORTANTE:
-- ================================================
-- Esta es una solución TEMPORAL. Una vez que funcione,
-- puedes crear políticas más seguras desde el Dashboard:
-- 
-- 1. Ve a Storage → evol-excel-import → Policies
-- 2. Crea una nueva política con estos valores:
--    - Name: "Admins can upload"
--    - Allowed operations: SELECT, INSERT, UPDATE, DELETE
--    - Target roles: authenticated
--    - Policy definition:
--      (SELECT is_admin FROM auth.users WHERE id = auth.uid()) = true
-- 
-- 3. Luego vuelve a hacer el bucket privado:
--    UPDATE storage.buckets SET public = false WHERE name = 'evol-excel-import';
-- ================================================ 