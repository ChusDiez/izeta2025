# 🔧 Solución Completa para Error RLS en Subida de Excel

## ❌ Error Actual
```
expediente-lucia-hita-lopez-03062025-224222.xlsx ✗ Error: new row violates row-level security policy
```

## ✅ Solución Inmediata (Ejecutar en orden)

### 1️⃣ Ejecutar en SQL Editor de Supabase:
```sql
-- Archivo: FIX_RLS_STORAGE_INMEDIATO.sql
UPDATE storage.buckets 
SET public = true
WHERE name = 'evol-excel-import';
```

### 2️⃣ Verificar el cambio:
```sql
SELECT name, public FROM storage.buckets WHERE name = 'evol-excel-import';
-- Debe mostrar: public = true
```

### 3️⃣ Intenta subir el archivo de nuevo
Debería funcionar ahora.

## 🔍 Si aún no funciona:

### Opción A: Verificar desde el Dashboard
1. Ve a **Storage** en Supabase Dashboard
2. Busca el bucket `evol-excel-import`
3. Click en el bucket
4. Ve a la pestaña **Configuration**
5. Asegúrate de que **Public bucket** esté activado (toggle ON)

### Opción B: Recrear el bucket
```sql
-- Eliminar bucket existente
DELETE FROM storage.buckets WHERE name = 'evol-excel-import';

-- Crear nuevo bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evol-excel-import', 'evol-excel-import', true, 10485760);
```

### Opción C: Verificar políticas conflictivas
```sql
-- Ver todas las políticas del bucket
SELECT * FROM storage.policies WHERE bucket_id = 'evol-excel-import';

-- Eliminar TODAS las políticas (temporal)
DELETE FROM storage.policies WHERE bucket_id = 'evol-excel-import';
```

## 🛡️ Solución Permanente (después de que funcione)

Una vez que puedas subir archivos:

1. **En el Dashboard de Supabase:**
   - Storage → evol-excel-import → Policies
   - New Policy → "Create a policy from scratch"
   - Name: `Admin can do everything`
   - Allowed operations: SELECT, INSERT, UPDATE, DELETE
   - Target roles: `authenticated`
   
2. **Policy definition:**
```sql
(auth.jwt() ->> 'email') IN (
  SELECT email FROM auth.users u
  JOIN public.users pu ON u.id = pu.id
  WHERE pu.is_admin = true
)
```

3. **Volver a hacer el bucket privado:**
```sql
UPDATE storage.buckets SET public = false WHERE name = 'evol-excel-import';
```

## 🚨 Solución de Emergencia

Si nada funciona, como último recurso:

```sql
-- Desactivar RLS completamente en el schema storage
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Subir archivos...

-- Volver a activar RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
```

## 📝 Verificación Final

Ejecuta esto para confirmar el estado:
```sql
SELECT 
    b.name as bucket,
    b.public,
    COUNT(p.id) as num_policies,
    CASE 
        WHEN b.public THEN '✅ Público - Sin restricciones'
        WHEN COUNT(p.id) = 0 THEN '⚠️ Privado sin políticas - Nadie puede acceder'
        ELSE '🔒 Privado con políticas'
    END as estado
FROM storage.buckets b
LEFT JOIN storage.policies p ON b.id = p.bucket_id
WHERE b.name = 'evol-excel-import'
GROUP BY b.name, b.public;
``` 