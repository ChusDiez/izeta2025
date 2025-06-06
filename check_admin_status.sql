-- 1. Ver la estructura de la tabla users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Ver todos los usuarios y su estado de admin
SELECT 
    id,
    email,
    username,
    is_admin,
    created_at
FROM users
ORDER BY created_at
LIMIT 20;

-- 3. Para hacer a un usuario administrador, ejecuta:
-- UPDATE users 
-- SET is_admin = true 
-- WHERE email = 'tu-email@ejemplo.com';

-- 4. Verificar que el cambio se aplicó
-- SELECT id, email, username, is_admin 
-- FROM users 
-- WHERE email = 'tu-email@ejemplo.com'; 