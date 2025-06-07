-- Asegurarse de que el bucket existe y es público
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 52428800, -- 50MB
    allowed_mime_types = ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ]
WHERE name = 'excel-public';

-- Eliminar todas las políticas existentes del bucket
DELETE FROM storage.policies WHERE bucket_id = 'excel-public';

-- Crear política pública para ver archivos (todos pueden ver)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'excel-public');

-- Crear política para que usuarios autenticados puedan subir
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'excel-public' 
    AND auth.role() = 'authenticated'
);

-- Crear política para que usuarios autenticados puedan actualizar sus archivos
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'excel-public' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'excel-public');

-- Crear política para que usuarios autenticados puedan eliminar sus archivos
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'excel-public' AND auth.role() = 'authenticated');

-- Verificar que RLS está habilitado en storage.objects (requerido)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Bucket excel-public configurado correctamente con políticas públicas';
END $$; 