-- SOLUCIÓN: Eliminar trigger recursivo y actualizar estados

-- 1. Ver qué triggers existen en la tabla
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'weekly_simulations';

-- 2. ELIMINAR EL TRIGGER PROBLEMÁTICO
DROP TRIGGER IF EXISTS trigger_update_simulation_status ON weekly_simulations;
DROP TRIGGER IF EXISTS update_simulation_status_trigger ON weekly_simulations;
DROP TRIGGER IF EXISTS auto_update_simulation_status ON weekly_simulations;

-- 3. Ahora SÍ podemos actualizar los estados sin problemas
-- Completar simulacros pasados
UPDATE weekly_simulations 
SET status = 'completed', updated_at = NOW()
WHERE status != 'completed' 
  AND end_date < CURRENT_DATE;

-- Activar el simulacro actual
UPDATE weekly_simulations 
SET status = 'active', updated_at = NOW()
WHERE status != 'active' 
  AND start_date <= CURRENT_DATE 
  AND end_date >= CURRENT_DATE;

-- 4. Ver el resultado
SELECT 
    week_number as "Semana RF",
    status as "Estado",
    to_char(start_date, 'DD/MM/YYYY') as "Inicio",
    to_char(end_date, 'DD/MM/YYYY') as "Fin",
    CASE 
        WHEN status = 'active' THEN '✅ ACTIVO CORRECTAMENTE'
        WHEN status = 'completed' THEN '✅ COMPLETADO'
        ELSE '🔵 FUTURO'
    END as "Verificación"
FROM weekly_simulations
ORDER BY week_number DESC
LIMIT 10;

-- 5. OPCIONAL: Crear un trigger SEGURO que no cause recursión
-- Este trigger solo registra cambios, no modifica nada
CREATE OR REPLACE FUNCTION log_simulation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar el cambio, NO modificar nada
    INSERT INTO api_sync_log (endpoint, status_code, details, executed_at)
    VALUES (
        'simulation_status_change',
        200,
        jsonb_build_object(
            'week_number', NEW.week_number,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'changed_at', NOW()
        ),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Solo crear este trigger si quieres logging
-- CREATE TRIGGER log_simulation_changes
-- AFTER UPDATE OF status ON weekly_simulations
-- FOR EACH ROW
-- WHEN (OLD.status IS DISTINCT FROM NEW.status)
-- EXECUTE FUNCTION log_simulation_status_change(); 