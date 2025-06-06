-- ================================================
-- VERIFICAR Y ARREGLAR ESTRUCTURA DE ELO_HISTORY
-- ================================================

-- 1. Ver estructura actual de la tabla
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'elo_history'
ORDER BY ordinal_position;

-- 2. Agregar columna simulation_id si no existe
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS simulation_id uuid;

-- 3. Agregar columna details si no existe
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';

-- 4. Verificar que las columnas se agregaron
SELECT 
    '✅ COLUMNAS VERIFICADAS' as estado,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'simulation_id') as tiene_simulation_id,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'details') as tiene_details,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'user_id') as tiene_user_id,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_before') as tiene_elo_before,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_after') as tiene_elo_after;

-- 5. Crear la tabla si no existe (por si acaso)
CREATE TABLE IF NOT EXISTS elo_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    simulation_id uuid REFERENCES weekly_simulations(id),
    elo_before integer NOT NULL DEFAULT 1000,
    elo_after integer NOT NULL DEFAULT 1000,
    elo_change integer NOT NULL DEFAULT 0,
    position integer,
    score numeric(5,2),
    details jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_elo_history_user_id ON elo_history(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_simulation_id ON elo_history(simulation_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_created_at ON elo_history(created_at DESC);

-- 7. Resultado final
SELECT 
    '✅ Tabla elo_history lista para usar' as mensaje,
    'Todas las columnas necesarias están presentes' as estado; 