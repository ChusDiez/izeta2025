-- ================================================
-- SCRIPT MEJORADO PARA MAPEAR TODOS LOS ALUMNOS
-- ================================================
-- Versión 2: Maneja mejor las variaciones de nombres

-- 1. Crear tabla temporal para generar todas las variaciones posibles
CREATE TEMP TABLE IF NOT EXISTS name_variations AS
WITH user_names AS (
    SELECT 
        id,
        email,
        username,
        cohort,
        -- Nombre original
        username as original_name,
        -- Nombre en minúsculas
        LOWER(username) as lower_name,
        -- Nombre sin tildes
        LOWER(TRANSLATE(username, 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU')) as no_accents,
        -- Nombre con guiones como en el archivo
        REPLACE(LOWER(TRANSLATE(username, 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU')), ' ', '-') as file_format
    FROM users
    WHERE role = 'user' 
    AND active = true
)
SELECT * FROM user_names;

-- 2. Insertar mapeos principales (formato del archivo)
INSERT INTO excel_name_mappings (excel_name, user_email, notes)
SELECT DISTINCT ON (file_format)
    file_format as excel_name,
    email as user_email,
    'Mapeo automático principal - ' || cohort as notes
FROM name_variations
ON CONFLICT (excel_name) DO UPDATE
SET user_email = EXCLUDED.user_email,
    notes = 'Actualizado: ' || EXCLUDED.notes;

-- 3. Insertar variaciones adicionales (sin guiones, con espacios)
INSERT INTO excel_name_mappings (excel_name, user_email, notes)
SELECT DISTINCT ON (no_accents)
    no_accents as excel_name,
    email as user_email,
    'Mapeo variación sin guiones - ' || cohort as notes
FROM name_variations
WHERE no_accents NOT IN (SELECT excel_name FROM excel_name_mappings)
ON CONFLICT (excel_name) DO NOTHING;

-- 4. Casos especiales - Lucía Hita López
-- Crear múltiples variaciones para casos problemáticos
INSERT INTO excel_name_mappings (excel_name, user_email, notes)
VALUES 
    ('lucia hita lopez', 'lhital99@gmail.com', 'Variación sin tildes con espacios'),
    ('lucia-hita-lopez', 'lhital99@gmail.com', 'Variación sin tildes con guiones'),
    ('lucía hita lópez', 'lhital99@gmail.com', 'Variación con tildes y espacios'),
    ('lucía-hita-lópez', 'lhital99@gmail.com', 'Variación con tildes y guiones')
ON CONFLICT (excel_name) DO UPDATE
SET user_email = EXCLUDED.user_email;

-- 5. Detectar y resolver conflictos
WITH conflicts AS (
    SELECT 
        nv1.email as email1,
        nv1.username as name1,
        nv2.email as email2,
        nv2.username as name2,
        nv1.file_format
    FROM name_variations nv1
    JOIN name_variations nv2 ON nv1.file_format = nv2.file_format
    WHERE nv1.email < nv2.email
)
SELECT 
    '⚠️ CONFLICTO' as tipo,
    file_format as nombre_archivo,
    name1,
    email1,
    name2,
    email2
FROM conflicts;

-- 6. Estadísticas finales
SELECT 
    'ESTADÍSTICAS DE MAPEO' as titulo,
    COUNT(DISTINCT user_email) as usuarios_mapeados,
    COUNT(*) as total_mapeos,
    ROUND(COUNT(*)::numeric / COUNT(DISTINCT user_email), 2) as mapeos_por_usuario
FROM excel_name_mappings;

-- 7. Verificar usuarios sin mapear
SELECT 
    '⚠️ USUARIOS SIN MAPEAR' as alerta,
    email,
    username
FROM users
WHERE role = 'user' 
AND active = true
AND email NOT IN (SELECT DISTINCT user_email FROM excel_name_mappings);

-- 8. Ver mapeos de Lucía específicamente
SELECT 
    '✅ MAPEOS DE LUCÍA HITA' as info,
    excel_name,
    user_email,
    notes
FROM excel_name_mappings
WHERE user_email = 'lhital99@gmail.com'
ORDER BY excel_name;

-- 9. Limpiar tabla temporal
DROP TABLE IF EXISTS name_variations;

-- ================================================
-- RESULTADO:
-- - Cada usuario tiene múltiples mapeos
-- - Se manejan variaciones con/sin tildes
-- - Se detectan conflictos automáticamente
-- ================================================ 