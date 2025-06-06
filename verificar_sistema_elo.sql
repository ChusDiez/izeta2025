-- ========================================
-- VERIFICACIÓN COMPLETA DEL SISTEMA ELO/IP
-- ========================================

-- 1. ESTADÍSTICAS GENERALES DEL SISTEMA
SELECT 
    '📊 ESTADÍSTICAS GENERALES' as seccion,
    COUNT(DISTINCT u.id) as total_usuarios,
    COUNT(DISTINCT CASE WHEN u.current_elo != 1000 THEN u.id END) as usuarios_con_elo_modificado,
    AVG(u.current_elo)::int as elo_promedio,
    MIN(u.current_elo) as elo_minimo,
    MAX(u.current_elo) as elo_maximo,
    COUNT(DISTINCT eh.user_id) as usuarios_con_historial
FROM users u
LEFT JOIN elo_history eh ON u.id = eh.user_id;

-- 2. DISTRIBUCIÓN POR DIVISIONES
SELECT 
    '🏆 DISTRIBUCIÓN POR DIVISIONES' as seccion,
    CASE 
        WHEN current_elo >= 2000 THEN '⭐ Élite (2000+)'
        WHEN current_elo >= 1500 THEN '🎯 Avanzado (1500-1999)'
        WHEN current_elo >= 1200 THEN '📈 Progresando (1200-1499)'
        ELSE '🌱 Iniciado (<1200)'
    END as division,
    COUNT(*) as cantidad_usuarios,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM users
GROUP BY 
    CASE 
        WHEN current_elo >= 2000 THEN '⭐ Élite (2000+)'
        WHEN current_elo >= 1500 THEN '🎯 Avanzado (1500-1999)'
        WHEN current_elo >= 1200 THEN '📈 Progresando (1200-1499)'
        ELSE '🌱 Iniciado (<1200)'
    END
ORDER BY 
    CASE division
        WHEN '⭐ Élite (2000+)' THEN 1
        WHEN '🎯 Avanzado (1500-1999)' THEN 2
        WHEN '📈 Progresando (1200-1499)' THEN 3
        ELSE 4
    END;

-- 3. VERIFICAR COHERENCIA ENTRE current_elo Y elo_history
WITH ultimo_elo AS (
    SELECT 
        user_id,
        MAX(created_at) as ultima_actualizacion,
        LAST_VALUE(elo_after) OVER (
            PARTITION BY user_id 
            ORDER BY created_at 
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) as ultimo_elo_registrado
    FROM elo_history
    GROUP BY user_id, elo_after, created_at
)
SELECT 
    '⚠️ INCOHERENCIAS ELO' as seccion,
    u.username,
    u.email,
    u.current_elo as elo_actual,
    ue.ultimo_elo_registrado,
    (u.current_elo - ue.ultimo_elo_registrado) as diferencia,
    ue.ultima_actualizacion
FROM users u
JOIN ultimo_elo ue ON u.id = ue.user_id
WHERE u.current_elo != ue.ultimo_elo_registrado
LIMIT 10;

-- 4. ÚLTIMOS CAMBIOS DE ELO
SELECT 
    '📈 ÚLTIMOS 10 CAMBIOS DE ELO' as seccion,
    u.username,
    eh.elo_before as elo_antes,
    eh.elo_after as elo_despues,
    eh.elo_change as cambio,
    eh.position as posicion,
    eh.score as puntuacion,
    ws.week_number as simulacro_rf,
    eh.created_at as fecha
FROM elo_history eh
JOIN users u ON eh.user_id = u.id
LEFT JOIN weekly_simulations ws ON eh.simulation_id = ws.id
ORDER BY eh.created_at DESC
LIMIT 10;

-- 5. SIMULACROS Y PROCESAMIENTO DE ELO
SELECT 
    '🎯 ESTADO DE SIMULACROS' as seccion,
    week_number as rf,
    status as estado,
    start_date as inicio,
    end_date as fin,
    processed_at as procesado_el,
    CASE 
        WHEN processed_at IS NOT NULL THEN '✅ Procesado'
        WHEN status = 'completed' THEN '⚠️ Pendiente de procesar'
        WHEN status = 'active' THEN '🟢 En curso'
        ELSE '🔵 Futuro'
    END as estado_procesamiento,
    (SELECT COUNT(*) FROM user_results WHERE simulation_id = ws.id) as resultados_enviados
FROM weekly_simulations ws
ORDER BY week_number DESC
LIMIT 10;

-- 6. USUARIOS SIN ELO INICIAL
SELECT 
    '👤 USUARIOS SIN ACTIVIDAD ELO' as seccion,
    COUNT(*) as usuarios_en_elo_1000,
    STRING_AGG(username, ', ' ORDER BY created_at DESC) as primeros_10_usuarios
FROM (
    SELECT username, created_at 
    FROM users 
    WHERE current_elo = 1000 
    LIMIT 10
) sub;

-- 7. RESUMEN DE ACTIVIDAD POR SIMULACRO
SELECT 
    '📊 PARTICIPACIÓN Y ELO POR SIMULACRO' as seccion,
    ws.week_number as rf,
    COUNT(DISTINCT ur.user_id) as participantes,
    COUNT(DISTINCT eh.user_id) as elos_actualizados,
    AVG(eh.elo_change)::numeric(10,2) as cambio_elo_promedio,
    MIN(eh.elo_change) as mayor_perdida,
    MAX(eh.elo_change) as mayor_ganancia
FROM weekly_simulations ws
LEFT JOIN user_results ur ON ws.id = ur.simulation_id
LEFT JOIN elo_history eh ON ws.id = eh.simulation_id
WHERE ws.status IN ('completed', 'active')
GROUP BY ws.week_number
ORDER BY ws.week_number DESC;

-- 8. TOP 10 USUARIOS POR ELO
SELECT 
    '🏆 TOP 10 RANKING IP' as seccion,
    ROW_NUMBER() OVER (ORDER BY current_elo DESC) as posicion,
    username,
    current_elo as ip_actual,
    cohort as cohorte,
    total_simulations as simulacros_completados,
    average_score as puntuacion_promedio,
    current_streak as racha_actual
FROM users
WHERE current_elo IS NOT NULL
ORDER BY current_elo DESC
LIMIT 10;

-- 9. VERIFICAR FUNCIÓN DE ACTUALIZACIÓN
SELECT 
    '⚙️ FUNCIONES DEL SISTEMA' as seccion,
    proname as nombre_funcion,
    CASE 
        WHEN proname = 'update_elo_for_simulation' THEN '✅ Función de actualización ELO'
        WHEN proname = 'process_weekly_results' THEN '✅ Función de procesamiento semanal'
        WHEN proname = 'update_simulation_status' THEN '✅ Función de cambio de estado'
        ELSE '📌 Otra función relacionada'
    END as descripcion
FROM pg_proc
WHERE proname IN ('update_elo_for_simulation', 'process_weekly_results', 'update_simulation_status', 'manual_update_simulations');

-- 10. VERIFICAR TRIGGERS PROBLEMÁTICOS
SELECT 
    '🔧 TRIGGERS EN weekly_simulations' as seccion,
    tgname as nombre_trigger,
    CASE 
        WHEN tgname LIKE '%update_simulation_status%' THEN '⚠️ TRIGGER PROBLEMÁTICO - ELIMINAR'
        ELSE '✅ OK'
    END as estado
FROM pg_trigger
WHERE tgrelid = 'weekly_simulations'::regclass
AND NOT tgisinternal; 