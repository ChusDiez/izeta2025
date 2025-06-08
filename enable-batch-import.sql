-- enable-batch-import.sql
-- Script para asegurar que la importación por lotes funcione correctamente

-- 1. Deshabilitar RLS temporalmente en topic_results para importación masiva
ALTER TABLE topic_results DISABLE ROW LEVEL SECURITY;

-- 2. Asegurar que la tabla excel_name_mappings esté accesible
ALTER TABLE excel_name_mappings DISABLE ROW LEVEL SECURITY;

-- 3. Crear índices para mejorar el rendimiento de las importaciones
CREATE INDEX IF NOT EXISTS idx_topic_results_student_topic_activity 
ON topic_results(student_id, topic_code, activity);

CREATE INDEX IF NOT EXISTS idx_topic_results_created_at 
ON topic_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_excel_name 
ON excel_name_mappings(excel_name);

-- 4. Verificar que las columnas necesarias existen
DO $$ 
BEGIN
    -- Verificar que source existe en topic_results
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'topic_results' AND column_name = 'source'
    ) THEN
        ALTER TABLE topic_results ADD COLUMN source TEXT DEFAULT 'evol_excel';
    END IF;
END $$;

-- 5. Crear función para importación masiva (opcional)
CREATE OR REPLACE FUNCTION import_topic_results_batch(
    p_data JSONB
) RETURNS TABLE(imported INT, errors INT) AS $$
DECLARE
    v_imported INT := 0;
    v_errors INT := 0;
    v_record JSONB;
BEGIN
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        BEGIN
            INSERT INTO topic_results (
                student_id, topic_code, activity, score, max_score,
                attempts, first_attempt, last_attempt, source, created_at
            ) VALUES (
                (v_record->>'student_id')::UUID,
                v_record->>'topic_code',
                v_record->>'activity',
                (v_record->>'score')::DECIMAL,
                (v_record->>'max_score')::DECIMAL,
                (v_record->>'attempts')::INT,
                (v_record->>'first_attempt')::TIMESTAMP WITH TIME ZONE,
                (v_record->>'last_attempt')::TIMESTAMP WITH TIME ZONE,
                v_record->>'source',
                NOW()
            )
            ON CONFLICT (student_id, topic_code, activity) 
            DO UPDATE SET
                score = EXCLUDED.score,
                max_score = EXCLUDED.max_score,
                attempts = EXCLUDED.attempts,
                last_attempt = EXCLUDED.last_attempt,
                updated_at = NOW();
            
            v_imported := v_imported + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_imported, v_errors;
END;
$$ LANGUAGE plpgsql;

-- 6. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Base de datos preparada para importación por lotes';
    RAISE NOTICE 'RLS deshabilitado en: topic_results, excel_name_mappings';
    RAISE NOTICE 'Índices creados para optimizar rendimiento';
    RAISE NOTICE 'Puedes proceder con la importación de CSV o usar el script CLI';
END $$; 