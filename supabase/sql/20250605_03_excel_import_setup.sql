-- Crear bucket para importar archivos Excel
-- NOTA: Este bucket debe crearse manualmente en el panel de Supabase Storage
-- Nombre: evol-excel-import

-- Políticas RLS para el bucket evol-excel-import
-- Permitir solo al service role leer y escribir
INSERT INTO storage.buckets (id, name, public)
VALUES ('evol-excel-import', 'evol-excel-import', false)
ON CONFLICT DO NOTHING;

-- Política para subir archivos (solo service role)
CREATE POLICY "Service role can upload Excel files" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'evol-excel-import' 
  AND auth.role() = 'service_role'
);

-- Política para leer archivos (solo service role)
CREATE POLICY "Service role can read Excel files" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'evol-excel-import' 
  AND auth.role() = 'service_role'
);

-- Política para mover archivos (solo service role)
CREATE POLICY "Service role can update Excel files" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'evol-excel-import' 
  AND auth.role() = 'service_role'
);

-- Política para eliminar archivos (solo service role)
CREATE POLICY "Service role can delete Excel files" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'evol-excel-import' 
  AND auth.role() = 'service_role'
);

-- Crear función para procesar automáticamente archivos subidos
CREATE OR REPLACE FUNCTION process_uploaded_excel()
RETURNS trigger AS $$
DECLARE
  _bucket_id text;
  _file_name text;
BEGIN
  -- Solo procesar archivos .xlsx o .xls
  IF NEW.name LIKE '%.xlsx' OR NEW.name LIKE '%.xls' THEN
    -- Solo procesar archivos en la raíz del bucket (no en processed/)
    IF NOT NEW.name LIKE 'processed/%' THEN
      -- Llamar a la función Edge de forma asíncrona
      PERFORM
        net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/process-excel-evolcampus',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'bucket', NEW.bucket_id,
            'fileName', NEW.name
          )
        );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para procesar archivos automáticamente
DROP TRIGGER IF EXISTS on_excel_upload ON storage.objects;
CREATE TRIGGER on_excel_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'evol-excel-import')
  EXECUTE FUNCTION process_uploaded_excel();

-- Tabla adicional para tracking de archivos procesados
CREATE TABLE IF NOT EXISTS excel_import_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name       text NOT NULL,
  student_email   text,
  records_imported int DEFAULT 0,
  status          text DEFAULT 'pending', -- pending, processing, completed, error
  error_message   text,
  processed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS excel_import_history_status_idx ON excel_import_history(status);
CREATE INDEX IF NOT EXISTS excel_import_history_created_idx ON excel_import_history(created_at DESC); 