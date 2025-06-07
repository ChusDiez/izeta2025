-- Script para verificar y optimizar la tabla topic_results
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'topic_results'
ORDER BY ordinal_position;

-- 2. Verificar índices existentes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'topic_results';

-- 3. Crear índices adicionales para mejorar el rendimiento
-- Índice para búsquedas por estudiante y tema
CREATE INDEX IF NOT EXISTS idx_topic_results_student_topic 
ON topic_results(student_id, topic_code);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_topic_results_dates 
ON topic_results(first_attempt DESC, last_attempt DESC);

-- Índice para filtrar por source
CREATE INDEX IF NOT EXISTS idx_topic_results_source 
ON topic_results(source);

-- 4. Verificar permisos RLS
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'topic_results';

-- 5. Si RLS está habilitado, crear políticas permisivas
ALTER TABLE topic_results DISABLE ROW LEVEL SECURITY;

-- O si prefieres mantener RLS, crear políticas:
/*
ALTER TABLE topic_results ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios autenticados puedan leer sus propios datos
CREATE POLICY "Users can view own topic results" ON topic_results
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM users 
            WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Política para administradores
CREATE POLICY "Admins can manage all topic results" ON topic_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE email = auth.jwt() ->> 'email' 
            AND is_admin = true
        )
    );

-- Política para el service role
CREATE POLICY "Service role full access to topic results" ON topic_results
    FOR ALL USING (auth.role() = 'service_role');
*/

-- 6. Verificar algunos datos de ejemplo
SELECT 
    tr.student_id,
    u.username,
    tr.topic_code,
    COUNT(*) as test_count,
    AVG(tr.score) as avg_score,
    MAX(tr.score) as max_score,
    MIN(tr.first_attempt) as first_test,
    MAX(tr.last_attempt) as last_test
FROM topic_results tr
JOIN users u ON tr.student_id = u.id
WHERE tr.source = 'evol_excel'
GROUP BY tr.student_id, u.username, tr.topic_code
ORDER BY u.username, tr.topic_code
LIMIT 20;

-- 7. Estadísticas generales
SELECT 
    'Total registros' as metric,
    COUNT(*) as value
FROM topic_results
WHERE source = 'evol_excel'
UNION ALL
SELECT 
    'Estudiantes únicos',
    COUNT(DISTINCT student_id)
FROM topic_results
WHERE source = 'evol_excel'
UNION ALL
SELECT 
    'Temas únicos',
    COUNT(DISTINCT topic_code)
FROM topic_results
WHERE source = 'evol_excel';

-- 8. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Verificación de topic_results completada';
    RAISE NOTICE 'La tabla está lista para recibir datos de Excel';
END $$; 