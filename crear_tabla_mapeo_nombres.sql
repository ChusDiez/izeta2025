-- ================================================
-- CREAR TABLA DE MAPEO MANUAL DE NOMBRES
-- ================================================

-- Esta tabla permite mapear manualmente nombres del Excel a usuarios
-- cuando el match automático no funciona (caracteres especiales, etc.)

CREATE TABLE IF NOT EXISTS excel_name_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    excel_name text NOT NULL UNIQUE, -- Nombre tal como aparece en el archivo Excel
    user_email text NOT NULL REFERENCES users(email),
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id),
    notes text -- Para anotar por qué fue necesario el mapeo manual
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_name ON excel_name_mappings(excel_name);
CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_email ON excel_name_mappings(user_email);

-- Algunos ejemplos de mapeos que podrías necesitar
-- (caracteres especiales, nombres con tildes, etc.)
INSERT INTO excel_name_mappings (excel_name, user_email, notes) VALUES
    ('ADRIAN GOMEZ MIER', 'adriangomezmier@gmail.com', 'Mayúsculas en Excel'),
    ('Jose Antonio Martin Lopez', 'josenerja20@gmail.com', 'Nombre compuesto diferente'),
    ('MC DelNov', 'mcarmendelnov@hotmail.com', 'Nombre abreviado')
ON CONFLICT (excel_name) DO NOTHING;

-- Vista para ver usuarios sin mapear
CREATE OR REPLACE VIEW usuarios_sin_mapeo AS
SELECT 
    u.email,
    u.username,
    u.cohort,
    CASE 
        WHEN em.id IS NOT NULL THEN '✅ Mapeado'
        ELSE '❌ Sin mapear'
    END as estado_mapeo
FROM users u
LEFT JOIN excel_name_mappings em ON em.user_email = u.email
WHERE u.cohort = 'sin_asignar'
ORDER BY estado_mapeo DESC, u.username;

-- Función para normalizar nombres (quitar tildes, espacios extras, etc.)
CREATE OR REPLACE FUNCTION normalize_name(input_name text) 
RETURNS text AS $$
BEGIN
    RETURN LOWER(
        TRIM(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(input_name, '[áàäâ]', 'a', 'gi'),
                            '[éèëê]', 'e', 'gi'
                        ),
                        '[íìïî]', 'i', 'gi'
                    ),
                    '[óòöô]', 'o', 'gi'
                ),
                '[úùüû]', 'u', 'gi'
            )
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Ejemplos de uso:
-- SELECT normalize_name('José María García López'); -- Devuelve: jose maria garcia lopez
-- SELECT normalize_name('ADRIÁN GÓMEZ MIER'); -- Devuelve: adrian gomez mier

COMMENT ON TABLE excel_name_mappings IS 'Tabla para mapear nombres de Excel a emails cuando el match automático falla';
COMMENT ON COLUMN excel_name_mappings.excel_name IS 'Nombre exacto como aparece en el archivo Excel';
COMMENT ON COLUMN excel_name_mappings.user_email IS 'Email del usuario correspondiente en la tabla users'; 