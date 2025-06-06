# 🚨 IMPORTANTE: Eliminar Trigger Problemático

## Problema
Hay un trigger recursivo en la tabla `weekly_simulations` que está causando un error de "stack depth limit exceeded". Este trigger debe ser eliminado URGENTEMENTE.

## Solución

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu [Supabase Dashboard](https://supabase.com/dashboard/project/hindymhwohevsqumekyv)
2. Ve a **Database → Tables**
3. Busca la tabla `weekly_simulations`
4. Haz clic en los **3 puntos** (⋮) → **View Triggers**
5. Busca cualquier trigger que contenga:
   - `trigger_update_simulation_status`
   - `update_simulation_status_trigger`
   - O cualquier trigger que llame a `update_simulation_status()`
6. **ELIMINA** estos triggers

### Opción 2: Desde SQL Editor

Ejecuta este código en el SQL Editor:

```sql
-- Ver todos los triggers de la tabla
SELECT 
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'weekly_simulations'::regclass;

-- Eliminar TODOS los triggers de la tabla
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'weekly_simulations'::regclass
        AND tgisinternal = false
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.tgname || ' ON weekly_simulations';
    END LOOP;
END $$;
```

## Después de Eliminar el Trigger

### Usar el Nuevo Botón en el Admin

1. Ve a tu panel de administración
2. Ve a la sección **Simulacros**
3. Haz clic en el botón **"🔄 Actualizar Estados"**
4. ¡Listo! Los estados se actualizarán sin problemas

### El botón hace lo siguiente:
- ✅ Marca como "completed" los simulacros cuya fecha de fin ya pasó
- ✅ Activa el simulacro cuya fecha incluye hoy
- ✅ NO causa recursión ni errores
- ✅ Muestra una notificación con el resultado

## Ventajas del Botón Manual

1. **Control Total**: Decides cuándo actualizar los estados
2. **Sin Errores**: No hay triggers recursivos
3. **Feedback Visual**: Ves exactamente qué pasó
4. **Seguro**: No hay riesgo de loops infinitos

## Opcional: Actualización Automática Diaria

Si quieres que se actualice automáticamente cada día, puedes configurar un cron job DESPUÉS de eliminar el trigger:

```sql
-- En Supabase Dashboard → Database → Extensions → pg_cron
SELECT cron.schedule(
  'update-simulations-daily',
  '5 0 * * *', -- Todos los días a las 00:05
  $$
  SELECT net.http_post(
    url := 'https://hindymhwohevsqumekyv.supabase.co/functions/v1/update-simulation-status',
    headers := jsonb_build_object(
      'Authorization', 'Bearer [TU_SERVICE_ROLE_KEY]',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Pero recomiendo empezar con el botón manual hasta estar seguro de que todo funciona bien. 