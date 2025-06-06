# 🚨 Solución Final para el Error de Storage

## El Problema
La tabla `storage.policies` no existe en tu versión de Supabase. Las políticas se manejan a través de RLS (Row Level Security) directamente.

## 🔧 Solución Paso a Paso

### Opción 1: Desactivar RLS Temporalmente (Más Rápido)

```sql
-- 1. Ejecutar en SQL Editor:
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 2. Hacer el bucket público:
UPDATE storage.buckets SET public = true WHERE name = 'evol-excel-import';

-- 3. Intentar subir el archivo de nuevo
-- Debería funcionar ahora

-- 4. IMPORTANTE: Después de subir, reactivar RLS:
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

### Opción 2: Crear Bucket Nuevo (Más Seguro)

```sql
-- 1. Crear un bucket completamente nuevo:
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('excel-uploads', 'excel-uploads', true, 52428800);

-- 2. Verificar que se creó:
SELECT * FROM storage.buckets WHERE name = 'excel-uploads';
```

**Luego actualizar el código:**

En `admin/js/modules/excel-import.js` (línea ~290):
```javascript
// Cambiar:
.from('evol-excel-import')
// Por:
.from('excel-uploads')
```

### Opción 3: Usar el Dashboard (Si funciona)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Storage → Buckets
3. Click en `evol-excel-import`
4. En Settings/Configuration:
   - Public bucket: **ON** ✅
   - File upload limit: 50MB
5. Guardar cambios

### 🔍 Para Verificar el Estado Actual

Ejecuta solo esto:
```sql
-- Ver estado del bucket
SELECT 
    name,
    public,
    CASE 
        WHEN public THEN '✅ Público'
        ELSE '❌ Privado'
    END as estado
FROM storage.buckets 
WHERE name = 'evol-excel-import';

-- Ver si RLS está activo
SELECT 
    relname,
    relrowsecurity
FROM pg_class
WHERE relname = 'objects' 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');
```

## 🚀 Solución Recomendada

**Si necesitas que funcione YA:**

1. Ejecuta esto:
```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

2. Sube tu archivo

3. Ejecuta esto después:
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## ❓ Si Nada Funciona

Prueba subir el archivo directamente con curl:

```bash
curl -X POST 'https://[TU-PROYECTO].supabase.co/storage/v1/object/excel-uploads/test.xlsx' \
  -H "apikey: [TU-ANON-KEY]" \
  -H "Authorization: Bearer [TU-ANON-KEY]" \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  --data-binary @tu-archivo.xlsx
```

Y dime qué error te da.

## 📝 Información Necesaria

Para ayudarte mejor, necesito saber:
1. ¿Qué muestra el diagnóstico simple?
2. ¿El bucket aparece como público?
3. ¿Qué error exacto te da al subir desde la aplicación? 