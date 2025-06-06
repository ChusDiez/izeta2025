-- ================================================
-- SOLUCIÓN RÁPIDA PARA EL ERROR DE RLS EN STORAGE
-- ================================================
-- Ejecutar este script en el SQL Editor de Supabase Dashboard

-- Paso 1: Hacer el bucket temporalmente público para permitir uploads
UPDATE storage.buckets 
SET public = true
WHERE name = 'evol-excel-import';

-- Paso 2: Verificar que se actualizó correctamente
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- Paso 3: Si el bucket no existe, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evol-excel-import', 
    'evol-excel-import', 
    true,  -- Público temporalmente
    10485760,  -- 10MB
    ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760;

-- Resultado esperado:
-- ✅ El bucket 'evol-excel-import' ahora es público
-- ✅ Los usuarios admin pueden subir archivos sin error de RLS
-- ⚠️ IMPORTANTE: Esta es una solución temporal

-- Para una solución más segura después de resolver el problema inicial:
-- 1. Ve a Storage en el Dashboard de Supabase
-- 2. Selecciona el bucket 'evol-excel-import'
-- 3. En la pestaña "Policies", crea una nueva política:
--    - Name: "Admin can do everything"
--    - Allowed operations: SELECT, INSERT, UPDATE, DELETE
--    - Target roles: authenticated
--    - WITH CHECK expression: 
--      (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
-- 4. Luego ejecuta:
--    UPDATE storage.buckets SET public = false WHERE name = 'evol-excel-import'; 