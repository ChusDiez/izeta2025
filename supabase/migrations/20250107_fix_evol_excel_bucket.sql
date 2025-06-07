-- Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evol-excel-import', 
    'evol-excel-import', 
    false, -- No público para mayor seguridad
    52428800, -- 50MB
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ];

-- Limpiar políticas anteriores
DELETE FROM storage.policies WHERE bucket_id = 'evol-excel-import';

-- IMPORTANTE: Habilitar RLS (requerido por Supabase)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política 1: Los usuarios admin pueden hacer TODO
CREATE POLICY "Admin full access"
ON storage.objects
FOR ALL
USING (
    bucket_id = 'evol-excel-import' 
    AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
)
WITH CHECK (
    bucket_id = 'evol-excel-import' 
    AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Alternativa más simple: Permitir a todos los usuarios autenticados
-- (Descomenta si la política de admin no funciona)
/*
CREATE POLICY "Authenticated can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'evol-excel-import' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated can view"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'evol-excel-import' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated can update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'evol-excel-import' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'evol-excel-import' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'evol-excel-import' 
    AND auth.role() = 'authenticated'
);
*/

-- Verificar resultado
DO $$
DECLARE
    bucket_exists boolean;
    policy_count integer;
BEGIN
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE name = 'evol-excel-import') INTO bucket_exists;
    SELECT COUNT(*) FROM storage.policies WHERE bucket_id = 'evol-excel-import' INTO policy_count;
    
    RAISE NOTICE 'Bucket evol-excel-import existe: %', bucket_exists;
    RAISE NOTICE 'Número de políticas creadas: %', policy_count;
END $$; 