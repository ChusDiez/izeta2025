-- ================================================
-- CREAR BUCKET PÚBLICO NUEVO - SOLUCIÓN SIMPLE
-- ================================================

-- 1. Crear un bucket completamente nuevo y público
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('excel-public', 'excel-public', true, 52428800);

-- 2. Verificar que se creó correctamente
SELECT 
    name,
    public,
    file_size_limit / 1048576 as size_limit_mb,
    CASE 
        WHEN public = true THEN '✅ LISTO PARA USAR'
        ELSE '❌ Error - No es público'
    END as estado
FROM storage.buckets 
WHERE name = 'excel-public';

-- 3. IMPORTANTE: Actualiza tu código JavaScript
-- En admin/js/modules/excel-import.js línea ~290:
-- Cambia: .from('evol-excel-import')
-- Por: .from('excel-public')

-- 4. Si el bucket ya existe, hacerlo público
UPDATE storage.buckets 
SET public = true, file_size_limit = 52428800
WHERE name = 'excel-public';

-- 5. Mensaje final
SELECT 
    '✅ BUCKET CREADO' as mensaje,
    'excel-public' as nombre_bucket,
    'Ahora actualiza el código JS para usar este bucket' as siguiente_paso; 