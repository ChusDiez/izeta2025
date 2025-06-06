-- Script para hacer administrador a chus@iz.academy

-- 1. Primero verificar el estado actual
SELECT id, email, username, is_admin, created_at 
FROM users 
WHERE email = 'chus@iz.academy';

-- 2. Hacer administrador a chus@iz.academy
UPDATE users 
SET is_admin = true 
WHERE email = 'chus@iz.academy';

-- 3. Verificar que se actualizó correctamente
SELECT id, email, username, is_admin 
FROM users 
WHERE email = 'chus@iz.academy';

-- 4. (Opcional) Ver todos los administradores actuales
SELECT id, email, username, is_admin, created_at 
FROM users 
WHERE is_admin = true
ORDER BY created_at DESC; 