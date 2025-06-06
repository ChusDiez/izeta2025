-- ================================================
-- FIX RÁPIDO: Error de columnas ambiguas
-- ================================================
-- Si obtienes error "column reference 'position' is ambiguous"
-- ejecuta solo esta parte corregida:

-- Ver top 10 después del recálculo (CORREGIDO)
SELECT 
    '🏆 TOP 10 DESPUÉS DEL RECÁLCULO' as titulo,
    u.username,
    u.current_elo as ip_actual,
    ur.position as posicion_rf1,
    ur.score as puntuacion_rf1,
    (eh.details->>'base_points')::int as puntos_base,
    (eh.details->>'bonus_racha')::int as bonus_racha,
    (eh.details->>'bonus_score')::int as bonus_score,
    (eh.details->>'total_change')::int as cambio_total
FROM users u
LEFT JOIN user_results ur ON u.id = ur.user_id 
    AND ur.simulation_id = (SELECT id FROM weekly_simulations WHERE week_number = 1)
LEFT JOIN elo_history eh ON u.id = eh.user_id 
    AND eh.simulation_id = (SELECT id FROM weekly_simulations WHERE week_number = 1)
WHERE ur.id IS NOT NULL
ORDER BY u.current_elo DESC
LIMIT 10;

-- EXPLICACIÓN DEL ERROR:
-- El error ocurre porque tanto user_results como elo_history tienen columnas con el mismo nombre:
-- - position
-- - score
-- 
-- La solución es usar prefijos de tabla:
-- - ur.position (de user_results)
-- - ur.score (de user_results)
-- - eh.details (de elo_history)
-- - u.username (de users)
-- - u.current_elo (de users) 