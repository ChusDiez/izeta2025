-- ================================================
-- FIX: Corregir función update_elo_for_simulation
-- para incluir week_number en elo_history
-- ================================================

-- Función corregida que incluye week_number
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
    
    -- Registrar en historial con detalles (INCLUYENDO week_number)
    INSERT INTO elo_history (
      user_id,
      week_number,  -- ¡IMPORTANTE! Agregado week_number
      simulation_id,
      elo_before,
      elo_after,
      elo_change,
      position,
      score,
      details
    ) VALUES (
      r.user_id,
      v_week_number,  -- Usar el week_number obtenido
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

-- Verificar que la función se creó correctamente
SELECT 
    '✅ Función actualizada' as estado,
    'Ahora incluye week_number en elo_history' as descripcion,
    'Puedes ejecutar reset_y_recalcular_elo.sql sin errores' as siguiente_paso; 