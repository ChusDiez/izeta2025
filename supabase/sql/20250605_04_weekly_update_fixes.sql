-- Correcciones para el sistema de simulacros semanales

-- 1. Función para cambiar automáticamente el estado de los simulacros
CREATE OR REPLACE FUNCTION update_simulation_status()
RETURNS void AS $$
DECLARE
  current_date_val date := CURRENT_DATE;
BEGIN
  -- Marcar como completados los simulacros que ya terminaron
  UPDATE weekly_simulations 
  SET status = 'completed',
      updated_at = NOW()
  WHERE status = 'active' 
    AND end_date < current_date_val;
  
  -- Activar el simulacro actual
  UPDATE weekly_simulations 
  SET status = 'active',
      updated_at = NOW()
  WHERE status = 'future' 
    AND start_date <= current_date_val
    AND end_date >= current_date_val;
  
  -- Log de cambios
  INSERT INTO api_sync_log (endpoint, status_code, details, executed_at)
  VALUES (
    'update_simulation_status',
    200,
    jsonb_build_object(
      'date', current_date_val,
      'action', 'automatic_status_update'
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función simplificada para procesar resultados (evitar stack depth)
-- Primero eliminar la función existente si tiene un tipo de retorno diferente
DROP FUNCTION IF EXISTS process_weekly_results(int);

CREATE OR REPLACE FUNCTION process_weekly_results(p_week_number int)
RETURNS json AS $$
DECLARE
  v_simulation_id uuid;
  v_processed_count int := 0;
  v_result json;
BEGIN
  -- Obtener ID del simulacro
  SELECT id INTO v_simulation_id
  FROM weekly_simulations
  WHERE week_number = p_week_number;
  
  IF v_simulation_id IS NULL THEN
    RETURN json_build_object('error', 'Simulacro no encontrado');
  END IF;
  
  -- Calcular posiciones basándose en score
  WITH ranked_results AS (
    SELECT 
      ur.id,
      ur.user_id,
      ur.score,
      RANK() OVER (ORDER BY ur.score DESC, ur.submitted_at ASC) as position
    FROM user_results ur
    WHERE ur.simulation_id = v_simulation_id
  )
  UPDATE user_results ur
  SET position = rr.position
  FROM ranked_results rr
  WHERE ur.id = rr.id;
  
  -- Marcar simulacro como procesado
  UPDATE weekly_simulations
  SET processed_at = NOW()
  WHERE id = v_simulation_id;
  
  -- Contar resultados procesados
  SELECT COUNT(*) INTO v_processed_count
  FROM user_results
  WHERE simulation_id = v_simulation_id;
  
  -- Actualizar ELO de forma separada para evitar recursión
  PERFORM update_elo_for_simulation(v_simulation_id);
  
  RETURN json_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'simulation_id', v_simulation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función separada para actualizar ELO (evitar stack depth)
CREATE OR REPLACE FUNCTION update_elo_for_simulation(p_simulation_id uuid)
RETURNS void AS $$
DECLARE
  r record;
  new_elo int;
  k_factor int := 32;
BEGIN
  -- Procesar cada resultado del simulacro
  FOR r IN 
    SELECT 
      ur.*,
      u.current_elo
    FROM user_results ur
    JOIN users u ON ur.user_id = u.id
    WHERE ur.simulation_id = p_simulation_id
    ORDER BY ur.score DESC
  LOOP
    -- Calcular nuevo ELO basado en posición
    new_elo := r.current_elo + 
      CASE 
        WHEN r.position <= 3 THEN k_factor
        WHEN r.position <= 10 THEN k_factor / 2
        WHEN r.position <= 20 THEN 0
        ELSE -k_factor / 4
      END;
    
    -- Asegurar que el ELO no baje de 800
    new_elo := GREATEST(new_elo, 800);
    
    -- Actualizar ELO del usuario
    UPDATE users 
    SET current_elo = new_elo,
        updated_at = NOW()
    WHERE id = r.user_id;
    
    -- Registrar en historial
    INSERT INTO elo_history (
      user_id,
      simulation_id,
      elo_before,
      elo_after,
      elo_change,
      position,
      score
    ) VALUES (
      r.user_id,
      p_simulation_id,
      r.current_elo,
      new_elo,
      new_elo - r.current_elo,
      r.position,
      r.score
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear extensión pg_cron si no existe
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Programar actualización diaria a las 00:01
-- NOTA: Este comando debe ejecutarse como superusuario en Supabase Dashboard
-- SELECT cron.schedule(
--   'update-simulation-status',
--   '1 0 * * *', -- Todos los días a las 00:01
--   'SELECT update_simulation_status();'
-- );

-- 6. Programar procesamiento semanal los lunes a las 02:00
-- SELECT cron.schedule(
--   'weekly-elo-update',
--   '0 2 * * 1', -- Lunes a las 02:00
--   'SELECT net.http_post(
--     url := ''https://hindymhwohevsqumekyv.supabase.co/functions/v1/weekly-update'',
--     headers := jsonb_build_object(
--       ''Authorization'', ''Bearer '' || current_setting(''app.settings.supabase_service_role_key''),
--       ''Content-Type'', ''application/json''
--     ),
--     body := jsonb_build_object(''trigger'', ''cron'')
--   );'
-- );

-- 7. Función para ejecutar manualmente la actualización
CREATE OR REPLACE FUNCTION manual_update_simulations()
RETURNS json AS $$
BEGIN
  -- Actualizar estados
  PERFORM update_simulation_status();
  
  -- Retornar estado actual
  RETURN json_build_object(
    'success', true,
    'active_simulations', (
      SELECT json_agg(row_to_json(s))
      FROM weekly_simulations s
      WHERE status = 'active'
    ),
    'updated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Vista para el leaderboard que siempre muestra el simulacro activo
CREATE OR REPLACE VIEW active_simulation_leaderboard AS
SELECT 
  ur.user_id,
  u.username,
  u.current_elo,
  ur.score,
  ur.position,
  ur.correct_answers,
  ur.wrong_answers,
  ur.blank_answers,
  ur.submitted_at,
  ws.week_number,
  ws.id as simulation_id
FROM weekly_simulations ws
JOIN user_results ur ON ur.simulation_id = ws.id
JOIN users u ON u.id = ur.user_id
WHERE ws.status = 'active'
ORDER BY ur.position ASC;

-- Permisos
GRANT SELECT ON active_simulation_leaderboard TO authenticated;
GRANT SELECT ON active_simulation_leaderboard TO anon; 