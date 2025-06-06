# 🚨 SOLUCIÓN DEFINITIVA - Desde el Dashboard de Supabase

## El Problema Real
No puedes modificar las tablas del sistema (`storage.objects`) porque son propiedad de Supabase. La solución DEBE hacerse desde el Dashboard.

## 🎯 Solución 1: Configurar desde el Dashboard (RECOMENDADA)

### Pasos exactos:

1. **Entra al Dashboard de Supabase**
   - https://app.supabase.com
   - Selecciona tu proyecto

2. **Ve a Storage**
   - En el menú lateral izquierdo, click en **Storage** 📦

3. **Encuentra el bucket `evol-excel-import`**
   - Si no existe, créalo con el botón **"New bucket"**

4. **Configura el bucket**
   - Click en el bucket `evol-excel-import`
   - Arriba a la derecha, click en **"Edit bucket"** (icono de lápiz)
   - **IMPORTANTE**: 
     - **Public bucket**: Activar ✅
     - **File size limit**: 50MB
     - **Allowed MIME types**: Dejar vacío (permite todos)
   - Click **Save**

5. **Elimina TODAS las políticas RLS**
   - En la misma página del bucket
   - Click en la pestaña **"Policies"**
   - Si hay alguna política listada:
     - Click en el icono de basura 🗑️
     - Confirmar eliminación
   - **NO DEBE QUEDAR NINGUNA POLÍTICA**

6. **Verifica**
   - El bucket debe mostrar "Public" en verde
   - No debe haber políticas en la lista

## 🎯 Solución 2: Crear Bucket Nuevo (Si la anterior no funciona)

### En el Dashboard:

1. **Storage** → **"New bucket"**
2. Configuración:
   - **Bucket name**: `excel-public-uploads`
   - **Public bucket**: ✅ ACTIVADO (MUY IMPORTANTE)
   - **File size limit**: 50MB
3. Click **"Save"**

### En tu código:

Edita `admin/js/modules/excel-import.js`:
```javascript
// Busca esta línea (aproximadamente línea 290):
const { data, error } = await this.supabase.storage
    .from('evol-excel-import')
    
// Cámbiala por:
const { data, error } = await this.supabase.storage
    .from('excel-public-uploads')
```

## 🔍 Para Verificar que Funciona

1. Ve al bucket en el Dashboard
2. Click en **"Upload files"**
3. Sube cualquier archivo Excel
4. Si funciona ahí, funcionará desde tu aplicación

## ⚠️ Si el Dashboard te da error al subir

El problema puede ser:
- Tu usuario no tiene permisos de admin en Supabase
- El proyecto tiene restricciones especiales

En ese caso, contacta al administrador del proyecto Supabase.

## 🚀 Solución Temporal - Usar Supabase CLI

Si tienes acceso a las credenciales del proyecto:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Conectar al proyecto
supabase link --project-ref [tu-project-ref]

# Crear bucket público
supabase storage create excel-public --public
```

## 📝 Información Importante

- **NO** necesitas políticas RLS si el bucket es público
- Un bucket público permite subir/descargar a cualquiera con el link
- Para producción, después configura políticas de seguridad apropiadas

## ❓ Si nada funciona

Comparte:
1. Screenshot del error en el Dashboard al intentar subir
2. Screenshot de la configuración del bucket
3. El URL de tu proyecto Supabase (sin credenciales) 