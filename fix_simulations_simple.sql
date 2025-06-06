-- SOLUCIÓN SIMPLE: Actualizar estados de simulacros directamente
-- Ejecuta este código en el SQL Editor de Supabase

-- 1. Ver el estado actual de los simulacros
SELECT 
    week_number as "Semana",
    status as "Estado Actual",
    start_date as "Inicio",
    end_date as "Fin",
    CASE 
        WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN '🟢 DEBERÍA ESTAR ACTIVO'
        WHEN end_date < CURRENT_DATE THEN '⚫ DEBERÍA ESTAR COMPLETADO'
        ELSE '🔵 DEBERÍA ESTAR FUTURO'
    END as "Estado Esperado"
FROM weekly_simulations
ORDER BY week_number DESC;

-- 2. Actualizar simulacros completados (fecha fin < hoy)
UPDATE weekly_simulations 
SET 
    status = 'completed',
    updated_at = NOW()
WHERE 
    status != 'completed' 
    AND end_date < CURRENT_DATE;

-- 3. Desactivar todos los simulacros activos que no deberían estarlo
UPDATE weekly_simulations 
SET 
    status = 'completed',
    updated_at = NOW()
WHERE 
    status = 'active' 
    AND (start_date > CURRENT_DATE OR end_date < CURRENT_DATE);

-- 4. Activar el simulacro actual (fecha inicio <= hoy <= fecha fin)
UPDATE weekly_simulations 
SET 
    status = 'active',
    updated_at = NOW()
WHERE 
    status != 'active'
    AND start_date <= CURRENT_DATE 
    AND end_date >= CURRENT_DATE;

-- 5. Ver el resultado después de los cambios
SELECT 
    week_number as "Semana",
    status as "Estado Nuevo",
    start_date as "Inicio",
    end_date as "Fin",
    CASE 
        WHEN status = 'active' THEN '✅ ACTIVO'
        WHEN status = 'completed' THEN '✅ COMPLETADO'
        ELSE '✅ FUTURO'
    END as "Verificación"
FROM weekly_simulations
ORDER BY week_number DESC; 