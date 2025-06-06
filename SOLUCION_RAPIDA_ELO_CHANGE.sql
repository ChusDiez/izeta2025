-- ================================================
-- SOLUCIÓN RÁPIDA - AGREGAR elo_change
-- ================================================

-- Ejecutar SOLO ESTO para resolver el error inmediato:
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS elo_change integer DEFAULT 0;

-- Verificar que se agregó:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'elo_history' 
AND column_name = 'elo_change';

-- Si ves la columna, ya puedes volver a ejecutar reset_y_recalcular_elo.sql 