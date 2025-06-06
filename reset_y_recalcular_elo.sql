-- ================================================
-- RESET COMPLETO Y RECÁLCULO DEL SISTEMA ELO/IP
-- ================================================
-- ⚠️ ADVERTENCIA: Este script reseteará TODO el progreso de ELO
-- Asegúrate de hacer un backup antes de ejecutar

-- 1. Crear tabla de backup por si acaso
CREATE TABLE IF NOT EXISTS users_elo_backup_before_reset AS
SELECT 
    id,
    username,
    email,
    current_elo,
    created_at,
    CURRENT_TIMESTAMP as backup_date
FROM users;

-- 2. Crear backup del historial de ELO
CREATE TABLE IF NOT EXISTS elo_history_backup_before_reset AS
SELECT * FROM elo_history;

-- 3. RESETEAR todos los usuarios a 1000 IP
UPDATE users 
SET current_elo = 1000,
    updated_at = NOW();

-- 4. Limpiar el historial de ELO
TRUNCATE TABLE elo_history;

-- 5. Verificar el reset
SELECT 
    '✅ RESET COMPLETADO' as estado,
    COUNT(*) as usuarios_reseteados,
    AVG(current_elo) as elo_promedio,
    MIN(current_elo) as elo_minimo,
    MAX(current_elo) as elo_maximo
FROM users;

-- 6. Implementar la nueva función de cálculo (si no existe)
CREATE OR REPLACE FUNCTION update_elo_for_simulation(p_simulation_id uuid)
RETURNS void AS $$
DECLARE
  r record;
  new_elo int;
  bonus_racha int;
  bonus_score int;
  total_change int;
  v_week_number int;
BEGIN
  -- Obtener el week_number del simulacro
  SELECT week_number INTO v_week_number
  FROM weekly_simulations
  WHERE id = p_simulation_id;
  
  -- Si no encontramos el simulacro, salir
  IF v_week_number IS NULL THEN
    RAISE EXCEPTION 'No se encontró el simulacro con ID %', p_simulation_id;
  END IF;

  -- Procesar cada resultado del simulacro
  FOR r IN 
    SELECT 
      ur.*,
      u.current_elo,
      u.current_streak
    FROM user_results ur
    JOIN users u ON ur.user_id = u.id
    WHERE ur.simulation_id = p_simulation_id
    ORDER BY ur.score DESC
  LOOP
    -- Sistema de puntos más generoso por posición
    new_elo := r.current_elo + 
      CASE 
        WHEN r.position <= 3 THEN 60   -- Top 3: 60 puntos
        WHEN r.position <= 10 THEN 40  -- Pos 4-10: 40 puntos
        WHEN r.position <= 20 THEN 20  -- Pos 11-20: 20 puntos
        WHEN r.position <= 30 THEN 10  -- Pos 21-30: 10 puntos
        ELSE 0                          -- Resto: 0 puntos (no pierden)
      END;
    
    -- Bonus por racha activa
    bonus_racha := CASE
        WHEN r.current_streak >= 10 THEN 30
        WHEN r.current_streak >= 5 THEN 15
        WHEN r.current_streak >= 3 THEN 5
        ELSE 0
    END;
    
    -- Bonus por puntuación alta
    bonus_score := CASE
        WHEN r.score >= 9.5 THEN 20
        WHEN r.score >= 9.0 THEN 10
        WHEN r.score >= 8.0 THEN 5
        ELSE 0
    END;
    
    -- Aplicar todos los bonuses
    new_elo := new_elo + bonus_racha + bonus_score;
    
    -- Asegurar que el ELO no baje de 800
    new_elo := GREATEST(new_elo, 800);
    
    -- Calcular cambio total
    total_change := new_elo - r.current_elo;
    
    -- Actualizar ELO del usuario
    UPDATE users 
    SET current_elo = new_elo,
        updated_at = NOW()
    WHERE id = r.user_id;
    
    -- Registrar en historial con detalles
    INSERT INTO elo_history (
      user_id,
      week_number,
      simulation_id,
      elo_before,
      elo_after,
      elo_change,
      position,
      score,
      details
    ) VALUES (
      r.user_id,
      v_week_number,
      p_simulation_id,
      r.current_elo,
      new_elo,
      total_change,
      r.position,
      r.score,
      jsonb_build_object(
        'base_points', CASE 
          WHEN r.position <= 3 THEN 60
          WHEN r.position <= 10 THEN 40
          WHEN r.position <= 20 THEN 20
          WHEN r.position <= 30 THEN 10
          ELSE 0
        END,
        'bonus_racha', bonus_racha,
        'bonus_score', bonus_score,
        'total_change', total_change,
        'sistema', 'v2_generoso'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Buscar el simulacro RF 1
SELECT 
    id,
    week_number,
    status,
    start_date,
    end_date,
    processed_at
FROM weekly_simulations
WHERE week_number = 1;

-- 8. Procesar el simulacro 1 con el nuevo sistema
DO $$
DECLARE
    v_simulation_id uuid;
    v_user_count int;
BEGIN
    -- Obtener el ID del simulacro 1
    SELECT id INTO v_simulation_id
    FROM weekly_simulations
    WHERE week_number = 1;
    
    IF v_simulation_id IS NULL THEN
        RAISE NOTICE 'No se encontró el simulacro RF1';
        RETURN;
    END IF;
    
    -- Verificar cuántos usuarios participaron
    SELECT COUNT(DISTINCT user_id) INTO v_user_count
    FROM user_results
    WHERE simulation_id = v_simulation_id;
    
    RAISE NOTICE 'Procesando simulacro RF1 con % participantes', v_user_count;
    
    -- Actualizar posiciones si no están calculadas
    WITH ranked_results AS (
        SELECT 
            ur.id,
            ur.user_id,
            ur.score,
            RANK() OVER (ORDER BY ur.score DESC, ur.submitted_at ASC) as new_position
        FROM user_results ur
        WHERE ur.simulation_id = v_simulation_id
    )
    UPDATE user_results ur
    SET position = rr.new_position
    FROM ranked_results rr
    WHERE ur.id = rr.id
    AND (ur.position IS NULL OR ur.position = 0);
    
    -- Aplicar el nuevo cálculo de ELO
    PERFORM update_elo_for_simulation(v_simulation_id);
    
    -- Marcar como procesado
    UPDATE weekly_simulations
    SET processed_at = NOW()
    WHERE id = v_simulation_id;
    
    RAISE NOTICE 'Simulacro RF1 procesado exitosamente';
END $$;

-- 9. Verificar resultados del recálculo
WITH stats AS (
    SELECT 
        u.id,
        u.username,
        u.current_elo,
        ur.position,
        ur.score,
        eh.elo_change,
        eh.details
    FROM users u
    LEFT JOIN user_results ur ON u.id = ur.user_id 
        AND ur.simulation_id = (SELECT id FROM weekly_simulations WHERE week_number = 1)
    LEFT JOIN elo_history eh ON u.id = eh.user_id 
        AND eh.simulation_id = (SELECT id FROM weekly_simulations WHERE week_number = 1)
    WHERE ur.id IS NOT NULL
)
SELECT 
    '📊 RESULTADO DEL RECÁLCULO' as titulo,
    COUNT(*) as usuarios_procesados,
    AVG(current_elo)::int as elo_promedio,
    MAX(current_elo) as elo_maximo,
    MIN(current_elo) as elo_minimo,
    COUNT(CASE WHEN current_elo > 1000 THEN 1 END) as usuarios_con_puntos
FROM stats;

-- 10. Ver top 10 después del recálculo
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

-- 11. Ver distribución por divisiones con el nuevo sistema
SELECT 
    CASE 
        WHEN current_elo >= 1060 THEN '📈 Progresando (1060+)'
        WHEN current_elo > 1000 THEN '🌱 Iniciado con puntos (1001-1059)'
        ELSE '⚪ Sin participación (1000)'
    END as division,
    COUNT(*) as usuarios,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM users
GROUP BY 
    CASE 
        WHEN current_elo >= 1060 THEN '📈 Progresando (1060+)'
        WHEN current_elo > 1000 THEN '🌱 Iniciado con puntos (1001-1059)'
        ELSE '⚪ Sin participación (1000)'
    END
ORDER BY 1;

-- 12. Registrar en el log
INSERT INTO api_sync_log (
    endpoint,
    status_code,
    details,
    executed_at
) VALUES (
    'elo_complete_reset_and_recalc',
    200,
    jsonb_build_object(
        'action', 'reset_and_recalculate',
        'simulation', 'RF1',
        'new_system', 'v2_generoso',
        'date', CURRENT_TIMESTAMP
    ),
    NOW()
);

-- 13. Mensaje final
SELECT 
    '✅ PROCESO COMPLETADO' as estado,
    'Todos los usuarios reseteados a 1000 IP' as paso1,
    'Simulacro RF1 recalculado con nuevo sistema' as paso2,
    'Los usuarios que participaron en RF1 ahora tienen entre 1000-1100 IP aprox' as resultado; 