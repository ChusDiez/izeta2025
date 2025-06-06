-- ================================================
-- VERIFICACIÓN PREVIA ANTES DEL RESET COMPLETO
-- ================================================
-- Ejecutar este script para asegurarse de que todo está listo

-- 1. Verificar cuántos simulacros hay registrados
SELECT 
    '📊 SIMULACROS REGISTRADOS' as seccion,
    week_number as rf,
    status,
    start_date,
    end_date,
    processed_at,
    (SELECT COUNT(*) FROM user_results WHERE simulation_id = ws.id) as participantes
FROM weekly_simulations ws
ORDER BY week_number;

-- 2. Verificar datos del simulacro RF1 específicamente
WITH rf1_stats AS (
    SELECT 
        COUNT(DISTINCT ur.user_id) as participantes,
        AVG(ur.score) as puntuacion_media,
        MAX(ur.score) as puntuacion_maxima,
        MIN(ur.score) as puntuacion_minima
    FROM user_results ur
    WHERE ur.simulation_id = (SELECT id FROM weekly_simulations WHERE week_number = 1)
)
SELECT 
    '🎯 ESTADÍSTICAS RF1' as seccion,
    participantes,
    ROUND(puntuacion_media::numeric, 2) as nota_media,
    puntuacion_maxima as nota_maxima,
    puntuacion_minima as nota_minima
FROM rf1_stats;

-- 3. Verificar columnas necesarias en users
SELECT 
    '✅ COLUMNAS EN TABLA USERS' as seccion,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_elo') as tiene_current_elo,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_streak') as tiene_current_streak;

-- 4. Verificar columnas en elo_history
SELECT 
    '✅ COLUMNAS EN TABLA ELO_HISTORY' as seccion,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'details') as tiene_details,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'simulation_id') as tiene_simulation_id;

-- 5. Ver estado actual del ELO antes del reset
SELECT 
    '📈 ESTADO ACTUAL DEL ELO' as seccion,
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN current_elo != 1000 THEN 1 END) as usuarios_con_elo_modificado,
    AVG(current_elo)::int as elo_promedio,
    MAX(current_elo) as elo_maximo,
    MIN(current_elo) as elo_minimo
FROM users;

-- 6. Verificar si hay registros en elo_history
SELECT 
    '📋 HISTORIAL DE ELO' as seccion,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos
FROM elo_history;

-- 7. RESUMEN DE ACCIONES A REALIZAR
SELECT 
    '⚠️ ACCIONES DEL RESET' as accion,
    'SE REALIZARÁ' as estado
FROM (VALUES 
    ('1. Backup de users y elo_history'),
    ('2. Reset de TODOS los usuarios a 1000 IP'),
    ('3. Limpieza COMPLETA del historial de ELO'),
    ('4. Recálculo del RF1 con nuevo sistema (60/40/20/10/0 puntos)'),
    ('5. Los que jugaron RF1 tendrán entre 1010-1090 IP aprox')
) AS t(accion);

-- 8. CONFIRMACIÓN FINAL
SELECT 
    '🚨 ADVERTENCIA FINAL' as mensaje,
    'Este proceso es IRREVERSIBLE sin los backups' as advertencia,
    'Asegúrate de estar listo antes de ejecutar reset_y_recalcular_elo.sql' as instruccion; 