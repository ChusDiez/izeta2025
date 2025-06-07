-- Script para solucionar problemas de permisos en excel_name_mappings
-- Ejecutar en el SQL Editor de Supabase Dashboard

-- 1. Verificar el estado actual de RLS
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'excel_name_mappings';

-- 2. OPCIÓN A: Deshabilitar RLS temporalmente (RÁPIDO)
ALTER TABLE excel_name_mappings DISABLE ROW LEVEL SECURITY;

-- 3. OPCIÓN B: Crear políticas más permisivas (RECOMENDADO)
-- Primero eliminar políticas existentes
DROP POLICY IF EXISTS "Admins can manage excel name mappings" ON excel_name_mappings;

-- Crear políticas nuevas más permisivas
CREATE POLICY "Authenticated users can read mappings" ON excel_name_mappings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert mappings" ON excel_name_mappings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role has full access to mappings" ON excel_name_mappings
    FOR ALL USING (auth.role() = 'service_role');

-- 4. Verificar que las políticas se crearon
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'excel_name_mappings';

-- 5. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Permisos de excel_name_mappings configurados correctamente';
    RAISE NOTICE 'Los usuarios autenticados ahora pueden leer e insertar mapeos';
END $$; 