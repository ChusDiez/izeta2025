-- Verificar si las funciones existen
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('manual_update_simulations', 'update_simulation_status', 'process_weekly_results')
ORDER BY routine_name;

-- Si manual_update_simulations no existe, vamos a crearla de forma más simple
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'manual_update_simulations'
    ) THEN
        -- Crear versión simplificada
        EXECUTE '
        CREATE OR REPLACE FUNCTION manual_update_simulations()
        RETURNS json AS $func$
        DECLARE
            current_date_val date := CURRENT_DATE;
            active_count int;
            completed_count int;
        BEGIN
            -- Marcar como completados los simulacros que ya terminaron
            UPDATE weekly_simulations 
            SET status = ''completed'',
                updated_at = NOW()
            WHERE status = ''active'' 
              AND end_date < current_date_val;
            
            GET DIAGNOSTICS completed_count = ROW_COUNT;
            
            -- Activar el simulacro actual
            UPDATE weekly_simulations 
            SET status = ''active'',
                updated_at = NOW()
            WHERE status = ''future'' 
              AND start_date <= current_date_val
              AND end_date >= current_date_val;
            
            GET DIAGNOSTICS active_count = ROW_COUNT;
            
            RETURN json_build_object(
                ''success'', true,
                ''completed'', completed_count,
                ''activated'', active_count,
                ''current_date'', current_date_val,
                ''timestamp'', NOW()
            );
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
    END IF;
END $$;

-- Probar la función
SELECT manual_update_simulations();

-- Ver el estado actual de los simulacros
SELECT 
    id,
    week_number,
    status,
    start_date,
    end_date,
    CASE 
        WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 'Debería estar activo'
        WHEN end_date < CURRENT_DATE THEN 'Debería estar completado'
        ELSE 'Debería estar futuro'
    END as estado_esperado
FROM weekly_simulations
ORDER BY week_number DESC
LIMIT 10; 