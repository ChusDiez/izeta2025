-- Verificar configuración de importación de Excel

-- 1. Verificar que el bucket existe
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE name = 'evol-excel-import';

-- 2. Verificar políticas del bucket
SELECT 
    name,
    definition,
    check_expression
FROM storage.policies
WHERE bucket_id = 'evol-excel-import';

-- 3. Verificar que la tabla excel_import_history existe
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'excel_import_history'
ORDER BY ordinal_position;

-- 4. Ver últimas importaciones (si las hay)
SELECT 
    id,
    file_name,
    student_email,
    records_imported,
    status,
    error_message,
    created_at
FROM excel_import_history
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar que la función Edge está desplegada
-- (Esto lo debes verificar en Supabase Dashboard -> Functions)

-- 6. Si necesitas crear el bucket manualmente:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('evol-excel-import', 'evol-excel-import', false)
-- ON CONFLICT DO NOTHING; 