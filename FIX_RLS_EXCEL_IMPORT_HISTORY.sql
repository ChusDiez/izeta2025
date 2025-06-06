-- ================================================
-- FIX RLS EN TABLA excel_import_history
-- ================================================

-- 1. Ver estado actual de RLS en excel_import_history
SELECT 
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '❌ RLS ACTIVADO - ESTE ES EL PROBLEMA'
        ELSE '✅ RLS Desactivado'
    END as estado
FROM pg_tables
WHERE tablename = 'excel_import_history'
AND schemaname = 'public';

-- 2. SOLUCIÓN: Desactivar RLS en excel_import_history
ALTER TABLE excel_import_history DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que se desactivó
SELECT 
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '❌ Sigue activado'
        ELSE '✅ RLS Desactivado correctamente'
    END as estado
FROM pg_tables
WHERE tablename = 'excel_import_history';

-- 4. Si el error persiste, también desactivar en topic_results
ALTER TABLE topic_results DISABLE ROW LEVEL SECURITY;

-- 5. Verificar ambas tablas
SELECT 
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '❌ RLS Activado'
        ELSE '✅ RLS Desactivado'
    END as estado
FROM pg_tables
WHERE tablename IN ('excel_import_history', 'topic_results')
AND schemaname = 'public'; 