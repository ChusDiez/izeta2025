-- ================================================
-- IMPLEMENTACIÓN DEL NUEVO SISTEMA ELO/IP
-- ================================================

-- 1. Backup de la función actual antes de modificar
CREATE OR REPLACE FUNCTION update_elo_for_simulation_backup(p_simulation_id uuid)
RETURNS void AS $$
DECLARE
  r record;
  new_elo int;
  k_factor int := 32;
BEGIN
  -- Función original guardada como backup
  FOR r IN 
    SELECT 
      ur.*,
      u.current_elo
    FROM user_results ur
    JOIN users u ON ur.user_id = u.id
    WHERE ur.simulation_id = p_simulation_id
    ORDER BY ur.score DESC
  LOOP
    new_elo := r.current_elo + 
      CASE 
        WHEN r.position <= 3 THEN k_factor
        WHEN r.position <= 10 THEN k_factor / 2
        WHEN r.position <= 20 THEN 0
        ELSE -k_factor / 4
      END;
    
    new_elo := GREATEST(new_elo, 800);
    
    UPDATE users 
    SET current_elo = new_elo,
        updated_at = NOW()
    WHERE id = r.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Agregar columna details a elo_history si no existe
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';

-- 3. Nueva función con sistema más generoso
CREATE OR REPLACE FUNCTION update_elo_for_simulation(p_simulation_id uuid)
RETURNS void AS $$
DECLARE
  r record;
  new_elo int;
  bonus_racha int;
  bonus_score int;
  total_change int;
BEGIN
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
      simulation_id,
      elo_before,
      elo_after,
      elo_change,
      position,
      score,
      details
    ) VALUES (
      r.user_id,
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

-- 4. Aplicar boost compensatorio a usuarios existentes
-- SOLO ejecutar UNA VEZ al implementar el nuevo sistema
UPDATE users 
SET current_elo = CASE
  WHEN current_elo = 1000 THEN 1000  -- No tocar los que no han jugado
  WHEN current_elo < 1200 THEN 1000 + ((current_elo - 1000) * 2.0)  -- Boost x2
  WHEN current_elo < 1500 THEN 1000 + ((current_elo - 1000) * 1.8)  -- Boost x1.8
  ELSE 1000 + ((current_elo - 1000) * 1.5)  -- Boost x1.5
END
WHERE current_elo >= 1000;

-- 5. Registrar el cambio en el log
INSERT INTO api_sync_log (
  endpoint,
  status_code,
  details,
  executed_at
) VALUES (
  'elo_system_upgrade',
  200,
  jsonb_build_object(
    'version', 'v2_generoso',
    'changes', 'Increased points per position, added bonuses for streak and high scores',
    'boost_applied', true,
    'date', CURRENT_DATE
  ),
  NOW()
);

-- 6. Verificar el impacto del cambio
SELECT 
  'ANTES DEL CAMBIO' as estado,
  COUNT(*) as usuarios,
  AVG(current_elo)::int as elo_promedio,
  MAX(current_elo) as elo_maximo,
  COUNT(CASE WHEN current_elo >= 2000 THEN 1 END) as usuarios_elite,
  COUNT(CASE WHEN current_elo >= 1500 THEN 1 END) as usuarios_avanzado,
  COUNT(CASE WHEN current_elo >= 1200 THEN 1 END) as usuarios_progresando
FROM users
WHERE current_elo > 1000;

-- 7. Proyección con nuevo sistema
WITH proyeccion AS (
  SELECT 
    'Top 3 siempre' as perfil,
    1000 as elo_inicial,
    60 + 15 + 10 as puntos_semana, -- base + racha media + score alto
    (2000 - 1000) / (60 + 15 + 10) as semanas_a_elite
  UNION ALL
  SELECT 
    'Pos 4-10 constante',
    1000,
    40 + 10 + 5,
    (2000 - 1000) / (40 + 10 + 5)
  UNION ALL
  SELECT 
    'Pos 11-20 regular',
    1000,
    20 + 5,
    (2000 - 1000) / (20 + 5)
)
SELECT 
  perfil,
  puntos_semana as puntos_por_semana,
  ROUND(semanas_a_elite, 1) as semanas_necesarias,
  CASE 
    WHEN semanas_a_elite <= 42 THEN '✅ Alcanzable'
    ELSE '❌ Necesita más tiempo'
  END as factible_oct_25
FROM proyeccion;

-- 8. Mensaje final
SELECT 
  '🎯 NUEVO SISTEMA ELO IMPLEMENTADO' as mensaje,
  'Los usuarios ahora pueden alcanzar División Élite en 20-40 semanas' as descripcion,
  'Recuerda comunicar estos cambios a los estudiantes' as nota; 