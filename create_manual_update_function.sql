-- Crear la función manual_update_simulations
-- Si ya existe, primero la eliminamos
DROP FUNCTION IF EXISTS manual_update_simulations();

-- Crear la función nueva
CREATE OR REPLACE FUNCTION manual_update_simulations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_completed_count int := 0;
    v_activated_count int := 0;
    v_current_date date := CURRENT_DATE;
BEGIN
    -- Marcar como completados los simulacros pasados
    UPDATE weekly_simulations 
    SET status = 'completed', updated_at = NOW()
    WHERE status != 'completed' 
      AND end_date < v_current_date;
    
    GET DIAGNOSTICS v_completed_count = ROW_COUNT;
    
    -- Activar el simulacro actual
    UPDATE weekly_simulations 
    SET status = 'active', updated_at = NOW()
    WHERE status != 'active'
      AND start_date <= v_current_date 
      AND end_date >= v_current_date;
    
    GET DIAGNOSTICS v_activated_count = ROW_COUNT;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'completed_count', v_completed_count,
        'activated_count', v_activated_count,
        'current_date', v_current_date::text,
        'timestamp', NOW()::text
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Probar la función
SELECT manual_update_simulations(); 