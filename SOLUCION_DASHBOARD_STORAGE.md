# 🔧 Solución desde el Dashboard de Supabase

## 🎯 Método 1: Desde la interfaz web (MÁS FÁCIL)

### Paso 1: Acceder al Storage
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, click en **Storage** 📦

### Paso 2: Configurar el bucket
1. Busca el bucket `evol-excel-import`
2. Click en los **3 puntos** (...) al lado del nombre
3. Selecciona **Edit bucket**
4. **IMPORTANTE**: Activa el toggle **"Public bucket"** ✅
5. Click en **Save**

### Paso 3: Eliminar políticas restrictivas
1. Click en el bucket `evol-excel-import`
2. Ve a la pestaña **Policies**
3. Si hay políticas listadas:
   - Click en cada política
   - Click en **Delete policy**
   - Confirmar eliminación

### Paso 4: Verificar permisos
1. En la misma página del bucket
2. Debería decir **"Public bucket"** en la parte superior
3. NO debería haber políticas listadas

## 🎯 Método 2: Crear un nuevo bucket (Si nada funciona)

### En el Dashboard:
1. **Storage** → **New bucket**
2. Name: `excel-imports-public` (nombre diferente)
3. **Public bucket**: ✅ ACTIVADO
4. **File size limit**: 10MB
5. **Allowed MIME types**: 
   ```
   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   application/vnd.ms-excel
   ```
6. Click **Create bucket**

### Actualizar el código JavaScript:
En `admin/js/modules/excel-import.js`, cambiar línea ~290:
```javascript
// Cambiar de:
.from('evol-excel-import')
// A:
.from('excel-imports-public')
```

## 🎯 Método 3: Subir archivo manualmente (Para probar)

### Desde el Dashboard:
1. Ve a **Storage** → click en el bucket
2. Click en **Upload files**
3. Selecciona tu archivo Excel
4. Si da error, copia el mensaje exacto

### Posibles errores y soluciones:

#### Error: "Policy violation"
- El bucket no es realmente público
- Hay políticas RLS activas

#### Error: "File type not allowed"
- Ve a configuración del bucket
- Agrega los MIME types de Excel

#### Error: "File too large"
- Aumenta el límite en configuración del bucket

## 🚨 Solución Nuclear (Último recurso)

Si NADA funciona, en el **SQL Editor**:

```sql
-- 1. Eliminar el bucket problemático completamente
DELETE FROM storage.objects WHERE bucket_id = 'evol-excel-import';
DELETE FROM storage.buckets WHERE id = 'evol-excel-import';

-- 2. Crear uno nuevo sin restricciones
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('excel-public', 'excel-public', true, 52428800); -- 50MB

-- 3. Verificar
SELECT * FROM storage.buckets WHERE name = 'excel-public';
```

## 📱 Información adicional necesaria

Para ayudarte mejor, necesito saber:
1. ¿Qué error exacto te da al subir manualmente?
2. ¿Puedes acceder a la configuración del bucket en el Dashboard?
3. ¿El toggle de "Public bucket" está activado?
4. ¿Hay políticas listadas en la pestaña Policies?

## 🔍 Script de verificación rápida

Ejecuta esto para ver el estado actual:
```sql
SELECT 
    b.name,
    b.public,
    COUNT(p.id) as policies_count,
    CASE 
        WHEN b.public = true AND COUNT(p.id) = 0 THEN '✅ OK'
        WHEN b.public = false THEN '❌ Bucket privado'
        WHEN COUNT(p.id) > 0 THEN '⚠️ Tiene políticas'
        ELSE '❓ Estado desconocido'
    END as status
FROM storage.buckets b
LEFT JOIN storage.policies p ON b.id = p.bucket_id
WHERE b.name = 'evol-excel-import'
GROUP BY b.id, b.name, b.public;
``` 