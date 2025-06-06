-- ================================================
-- SOLUCIÓN SIN PERMISOS DE ADMIN
-- ================================================

-- OPCIÓN 1: Verificar si el bucket ya es público
SELECT 
    name,
    public,
    CASE 
        WHEN public = true THEN '✅ El bucket YA ES PÚBLICO - El problema debe ser otro'
        ELSE '❌ El bucket es privado'
    END as estado
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- OPCIÓN 2: Crear un bucket NUEVO que sí puedas controlar
DO $$
DECLARE
    v_bucket_name text := 'excel-temp-' || to_char(now(), 'YYYYMMDDHH24MI');
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES (v_bucket_name, v_bucket_name, true, 52428800);
    
    RAISE NOTICE 'Nuevo bucket creado: %', v_bucket_name;
    RAISE NOTICE 'Actualiza tu código para usar este bucket';
END $$;

-- Ver el bucket recién creado
SELECT name, public, created_at 
FROM storage.buckets 
WHERE public = true
ORDER BY created_at DESC
LIMIT 5;

-- OPCIÓN 3: Verificar qué está bloqueando exactamente
SELECT 
    auth.uid() as tu_user_id,
    auth.role() as tu_rol,
    auth.email() as tu_email,
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND is_admin = true
    ) as eres_admin; 