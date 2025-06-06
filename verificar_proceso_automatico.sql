-- ================================================
-- VERIFICAR PROCESO AUTOMÁTICO DE EXCEL
-- ================================================

-- 1. Ver si hay triggers en storage.objects
SELECT 
    tgname as trigger_name,
    tgtype,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'storage.objects'::regclass;

-- 2. Ver si hay funciones relacionadas con Excel
SELECT 
    proname as function_name,
    prosrc as function_code
FROM pg_proc
WHERE prosrc LIKE '%excel%' 
   OR prosrc LIKE '%process%excel%'
   OR proname LIKE '%excel%';

-- 3. Ver configuración de la Edge Function
SELECT 
    name,
    created_at,
    updated_at
FROM supabase_functions.functions
WHERE name LIKE '%excel%';

-- 4. Verificar logs de procesamiento
SELECT 
    endpoint,
    status_code,
    records_synced,
    details,
    executed_at
FROM api_sync_log
WHERE endpoint LIKE '%excel%'
   OR details::text LIKE '%excel%'
ORDER BY executed_at DESC
LIMIT 10;

-- 5. Test manual: Llamar a la Edge Function
-- NOTA: Necesitas reemplazar los valores entre corchetes
/*
SELECT net.http_post(
    url := 'https://[tu-proyecto].supabase.co/functions/v1/process-excel-evolcampus',
    headers := jsonb_build_object(
        'Authorization', 'Bearer [tu-service-role-key]',
        'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
        'bucket', 'excel-public',
        'fileName', '[nombre-del-archivo-subido].xlsx'
    )
);
*/ 