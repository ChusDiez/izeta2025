-- Crear tabla para mapeos de nombres de Excel
CREATE TABLE IF NOT EXISTS excel_name_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    excel_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_excel_name ON excel_name_mappings(excel_name);
CREATE INDEX IF NOT EXISTS idx_excel_name_mappings_user_email ON excel_name_mappings(user_email);

-- RLS (Row Level Security)
ALTER TABLE excel_name_mappings ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso a administradores
CREATE POLICY "Admins can manage excel name mappings" ON excel_name_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.jwt() ->> 'email' 
            AND users.role = 'admin'
        )
    );

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_excel_name_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_excel_name_mappings_updated_at
    BEFORE UPDATE ON excel_name_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_excel_name_mappings_updated_at(); 