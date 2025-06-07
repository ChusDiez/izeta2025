-- Añadir trigger para procesar archivos del bucket excel-public
CREATE OR REPLACE FUNCTION process_uploaded_excel_public()
RETURNS trigger AS $$
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

-- Crear trigger para el bucket excel-public
DROP TRIGGER IF EXISTS on_excel_upload_public ON storage.objects;
CREATE TRIGGER on_excel_upload_public
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'excel-public')
  EXECUTE FUNCTION process_uploaded_excel_public();

-- Verificar que el trigger se creó
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as is_enabled
FROM pg_trigger 
WHERE tgname IN ('on_excel_upload', 'on_excel_upload_public');

-- Nota: Si el trigger no funciona, asegúrate de que la extensión pg_net está habilitada
-- CREATE EXTENSION IF NOT EXISTS pg_net; 