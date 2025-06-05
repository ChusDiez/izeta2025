-- Script para sincronizar usuarios de auth.users a public.users
-- Ejecutar manualmente si hay usuarios en auth pero no en public

-- Primero, veamos qué usuarios están en auth pero no en public
CREATE OR REPLACE VIEW missing_users AS
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.email_confirmed_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Ver los usuarios que faltan
SELECT * FROM missing_users;

-- Función para sincronizar un usuario específico
CREATE OR REPLACE FUNCTION sync_auth_user(user_email text)
RETURNS void AS $$
DECLARE
    auth_user record;
BEGIN
    -- Buscar el usuario en auth.users
    SELECT * INTO auth_user 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(user_email)
    LIMIT 1;
    
    IF auth_user.id IS NOT NULL THEN
        -- Insertar en public.users si no existe
        INSERT INTO public.users (
            id,
            email,
            username,
            slug,
            active,
            created_at,
            cohort,
            status
        )
        VALUES (
            auth_user.id,
            LOWER(auth_user.email),
            COALESCE(auth_user.raw_user_meta_data->>'username', SPLIT_PART(auth_user.email, '@', 1)),
            LOWER(REPLACE(COALESCE(auth_user.raw_user_meta_data->>'username', SPLIT_PART(auth_user.email, '@', 1)), ' ', '-')),
            true,
            auth_user.created_at,
            'sin_asignar',
            'active'
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            updated_at = now();
            
        RAISE NOTICE 'Usuario % sincronizado correctamente', user_email;
    ELSE
        RAISE NOTICE 'Usuario % no encontrado en auth.users', user_email;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Ejemplos de uso:
-- SELECT sync_auth_user('luciahita99@hotmail.com');
-- SELECT sync_auth_user('zbendeman@gmail.com');

-- Para sincronizar TODOS los usuarios que faltan de una vez:
CREATE OR REPLACE FUNCTION sync_all_missing_users()
RETURNS TABLE(synced_email text) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.users (
        id,
        email,
        username,
        slug,
        active,
        created_at,
        cohort,
        status
    )
    SELECT 
        au.id,
        LOWER(au.email),
        COALESCE(au.raw_user_meta_data->>'username', SPLIT_PART(au.email, '@', 1)),
        LOWER(REPLACE(COALESCE(au.raw_user_meta_data->>'username', SPLIT_PART(au.email, '@', 1)), ' ', '-')),
        true,
        au.created_at,
        'sin_asignar',
        'active'
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING email;
END;
$$ LANGUAGE plpgsql;

-- Trigger automático para futuros registros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        username,
        slug,
        active,
        created_at,
        cohort,
        status
    )
    VALUES (
        new.id,
        LOWER(new.email),
        COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
        LOWER(REPLACE(COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)), ' ', '-')),
        true,
        new.created_at,
        'sin_asignar',
        'active'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user(); 