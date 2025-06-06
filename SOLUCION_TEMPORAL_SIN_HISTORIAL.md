# 🚀 Solución Temporal - Subir Excel sin Historial

## El Problema Identificado

✅ El bucket `excel-public` funciona (lo probaste desde el Dashboard)
❌ La tabla `excel_import_history` tiene RLS activado y bloquea la escritura

## Solución Rápida (mientras resuelves el RLS)

### Opción 1: Comentar el código del historial

En `admin/js/modules/excel-import.js`, comenta temporalmente las líneas que usan el historial:

1. En el método `uploadFiles()` (aproximadamente línea 340):
```javascript
// Comentar esta línea:
// setTimeout(() => this.loadHistory(), 2000);
```

2. En el método `render()` (aproximadamente línea 145):
```javascript
// Comentar esta línea:
// this.loadHistory();
```

3. Comentar todo el método `loadHistory()` (líneas 375-415):
```javascript
/*
async loadHistory() {
    // ... todo el código ...
}
*/
```

### Opción 2: Modificar loadHistory para que no falle

Reemplaza el método `loadHistory()` con este que maneja el error:

```javascript
async loadHistory() {
    try {
        const { data, error } = await this.supabase
            .from('excel_import_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) {
            console.log('No se puede cargar el historial (RLS activo)');
            document.getElementById('historyBody').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">Historial no disponible temporalmente</td></tr>';
            return;
        }
        
        // ... resto del código ...
    } catch (error) {
        console.error('Error cargando historial:', error);
        // No mostrar notificación de error
    }
}
```

## Proceso Manual Completo

Mientras tanto, puedes:

1. **Subir archivos al bucket** desde el Dashboard de Supabase
2. **Ejecutar la Edge Function manualmente** para procesarlos:

```bash
curl -X POST https://[tu-proyecto].supabase.co/functions/v1/process-excel-evolcampus \
  -H "Authorization: Bearer [tu-anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"bucket": "excel-public", "fileName": "tu-archivo.xlsx"}'
```

## Solución Definitiva

Ejecuta en SQL Editor:
```sql
-- Desactivar RLS
ALTER TABLE excel_import_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE topic_results DISABLE ROW LEVEL SECURITY;
```

Si no tienes permisos, pide al admin del proyecto que lo haga. 