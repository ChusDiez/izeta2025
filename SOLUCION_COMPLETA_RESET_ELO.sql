-- ================================================
-- SOLUCIÓN COMPLETA PARA RESET ELO
-- Este script resuelve TODOS los problemas antes de hacer el reset
-- ================================================

-- PASO 1: Verificar y arreglar estructura de elo_history
-- ================================================
DO $$
BEGIN
    -- Agregar todas las columnas necesarias
    ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS elo_change integer DEFAULT 0;
    ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS position integer;
    ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS score numeric(5,2);
    ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS simulation_id uuid;
    ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
    
    RAISE NOTICE '✅ Estructura de elo_history actualizada';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Error actualizando estructura: %', SQLERRM;
END $$;

-- PASO 2: Actualizar la función para incluir week_number
-- ================================================
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

-- PASO 3: Verificar que todo está listo
-- ================================================
WITH verificacion AS (
    SELECT 
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'week_number') as tiene_week_number,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_change') as tiene_elo_change,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'position') as tiene_position,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'score') as tiene_score,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'simulation_id') as tiene_simulation_id,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'details') as tiene_details
)
SELECT 
    CASE 
        WHEN tiene_week_number AND tiene_elo_change AND tiene_position 
             AND tiene_score AND tiene_simulation_id AND tiene_details 
        THEN '✅ TODO LISTO - Puedes ejecutar reset_y_recalcular_elo.sql'
        ELSE '❌ ERROR - Faltan columnas en elo_history'
    END as estado,
    *
FROM verificacion;

-- Mostrar simulacros disponibles
SELECT 
    '📊 SIMULACROS DISPONIBLES' as info,
    id,
    week_number,
    status,
    start_date,
    end_date
FROM weekly_simulations
ORDER BY week_number;

-- FIN - Si el estado muestra "TODO LISTO", puedes proceder con reset_y_recalcular_elo.sql

-- NOTA IMPORTANTE: Si obtienes error de columna ambigua, asegúrate de usar prefijos de tabla:
-- ur.position (no solo position)
-- ur.score (no solo score)
-- eh.details (no solo details) 