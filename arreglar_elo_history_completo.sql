-- ================================================
-- ARREGLAR TABLA ELO_HISTORY - TODAS LAS COLUMNAS
-- ================================================
-- Ejecutar ANTES del reset para evitar errores

-- 1. Ver estructura actual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'elo_history'
ORDER BY ordinal_position;

-- 2. Agregar TODAS las columnas que faltan
ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS elo_change integer DEFAULT 0;

ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS position integer;

ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS score numeric(5,2);

ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS simulation_id uuid;

ALTER TABLE elo_history 
ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';

-- 3. Si la tabla no tiene las columnas básicas, recrearla
DO $$
BEGIN
    -- Verificar si existe la tabla
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'elo_history') THEN
        CREATE TABLE elo_history (
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
        
        CREATE INDEX idx_elo_history_user_id ON elo_history(user_id);
        CREATE INDEX idx_elo_history_simulation_id ON elo_history(simulation_id);
        CREATE INDEX idx_elo_history_created_at ON elo_history(created_at DESC);
        
        RAISE NOTICE 'Tabla elo_history creada desde cero';
    END IF;
END $$;

-- 4. Verificar que todo está bien
SELECT 
    '✅ VERIFICACIÓN FINAL' as estado,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'user_id') as tiene_user_id,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'simulation_id') as tiene_simulation_id,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_before') as tiene_elo_before,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_after') as tiene_elo_after,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'elo_change') as tiene_elo_change,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'position') as tiene_position,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'score') as tiene_score,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elo_history' AND column_name = 'details') as tiene_details;

-- 5. Mensaje final
SELECT 
    '✅ Tabla elo_history lista' as mensaje,
    'Ahora puedes ejecutar reset_y_recalcular_elo.sql sin errores' as instruccion; 