-- enable-batch-import-parts.sql
-- Script dividido en partes para ejecutar en Dashboard de Supabase

-- ========================================
-- PARTE 1: Deshabilitar RLS
-- ========================================
ALTER TABLE topic_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE excel_name_mappings DISABLE ROW LEVEL SECURITY;

-- ========================================
-- PARTE 2: Crear índices
-- ========================================
CREATE INDEX IF NOT EXISTS idx_topic_results_student_topic_activity 
ON topic_results(student_id, topic_code, activity);

CREATE INDEX IF NOT EXISTS idx_topic_results_created_at 
ON topic_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_excel_name 
ON excel_name_mappings(excel_name);

-- ========================================
-- PARTE 3: Añadir columna source si no existe
-- (Ejecutar solo si la columna no existe)
-- ========================================
-- ALTER TABLE topic_results ADD COLUMN source TEXT DEFAULT 'evol_excel';

-- ========================================
-- PARTE 4: Función de importación masiva
-- ========================================
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