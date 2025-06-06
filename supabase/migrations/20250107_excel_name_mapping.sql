-- Tabla para mapear nombres de archivos Excel con usuarios
CREATE TABLE IF NOT EXISTS excel_name_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excel_name text NOT NULL UNIQUE,
  user_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  notes text
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS excel_name_mappings_excel_name_idx ON excel_name_mappings(excel_name);
CREATE INDEX IF NOT EXISTS excel_name_mappings_user_email_idx ON excel_name_mappings(user_email);

-- Función para normalizar nombres (quitar tildes, mayúsculas, etc)
CREATE OR REPLACE FUNCTION normalize_name(input_name text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(
    TRANSLATE(
      TRIM(input_name),
      'áéíóúñÁÉÍÓÚÑ',
      'aeiounAEIOUN'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista para ver mapeos con información del usuario
CREATE OR REPLACE VIEW excel_name_mappings_view AS
SELECT 
  m.id,
  m.excel_name,
  m.user_email,
  u.username,
  u.cohort,
  m.created_at,
  m.notes
FROM excel_name_mappings m
JOIN users u ON u.email = m.user_email
ORDER BY m.excel_name;

-- Insertar algunos ejemplos comunes
-- INSERT INTO excel_name_mappings (excel_name, user_email, notes) VALUES
-- ('juan perez', 'juan.perez@email.com', 'Mapeo manual'),
-- ('maria garcia', 'mgarcia@email.com', 'Nombre diferente en Excel'); 