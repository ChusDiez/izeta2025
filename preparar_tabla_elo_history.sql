-- ================================================
-- PREPARAR TABLA ELO_HISTORY PARA EL NUEVO SISTEMA
-- ================================================
-- Ejecutar este script ANTES del reset completo

-- 1. Verificar si la columna 'details' existe
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'elo_history' 
AND column_name = 'details';

-- 2. Agregar columna 'details' si no existe
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';

-- 3. Verificar estructura actual de la tabla
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'elo_history'
ORDER BY ordinal_position;

-- 4. Crear índice en details para búsquedas rápidas (opcional)
CREATE INDEX IF NOT EXISTS idx_elo_history_details 
ON elo_history USING gin (details);

-- 5. Verificar que todo está listo
SELECT 
    '✅ Tabla elo_history preparada' as estado,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'elo_history' 
        AND column_name = 'details'
    ) as columna_details_existe; 