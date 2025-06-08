# 🚀 Procesamiento por Lotes de Excel - IZETA

Este documento explica las diferentes opciones para procesar los archivos Excel de Evolcampus de forma masiva.

## 📋 Opciones Disponibles

### 1. 🌐 Herramienta Web (Recomendado para <100 archivos)
- **URL**: `/admin/batch-import.html`
- **Ventajas**: 
  - No requiere configuración
  - Interfaz visual amigable
  - Feedback en tiempo real
- **Limitaciones**: 
  - Puede ser lento con muchos archivos
  - Depende del navegador

### 2. 🖥️ Script CLI (Recomendado para >100 archivos)
- **Comando**: `npm run process-evol <carpeta>`
- **Ventajas**:
  - Muy rápido (procesa 400 archivos en <1 min)
  - No depende del navegador
  - Puede automatizarse con cron
- **Requisitos**: Node.js instalado

## 🛠️ Instalación del Script CLI

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (.env)
VITE_SUPABASE_URL=tu_url_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_key
```

## 📝 Uso del Script CLI

### Generar CSV sin subir
```bash
npm run process-evol ~/Descargas/ExcelsEvolcampus
```

### Generar CSV y subir a Supabase
```bash
npm run process-evol-upload ~/Descargas/ExcelsEvolcampus
```

## 📊 Formato del CSV Generado

El CSV contiene las siguientes columnas:
- `file_name`: Nombre del archivo Excel original
- `student_email`: Email del estudiante
- `student_id`: ID del usuario en Supabase
- `topic_code`: Código del tema (T1, T2, etc.)
- `activity`: Nombre del test/actividad
- `score`: Puntuación obtenida
- `max_score`: Puntuación máxima (normalmente 10)
- `attempts`: Número de intentos
- `first_attempt`: Fecha del primer intento
- `last_attempt`: Fecha del último intento
- `source`: Origen de los datos ('evol_excel')

## 🔄 Flujo de Trabajo Recomendado

1. **Descarga semanal de Evolcampus**
   - Cada viernes, descarga todos los informes individuales
   - Guárdalos en una carpeta (ej: `~/Evolcampus/Semana23/`)

2. **Procesamiento**
   ```bash
   # Procesar y generar CSV
   npm run process-evol ~/Evolcampus/Semana23/
   
   # Revisar el CSV generado
   # evolcampus-batch-2024-01-17.csv
   ```

3. **Subida a Supabase**
   - Opción A: Usar el flag --upload en el script
   - Opción B: Usar psql para importar el CSV
   ```bash
   psql -h tu-host -U postgres -d postgres \
     -c "\copy topic_results FROM 'evolcampus-batch-2024-01-17.csv' CSV HEADER"
   ```

## ⚠️ Solución de Problemas

### "Usuario no encontrado"
- Verifica que el email del estudiante existe en la tabla `users`
- Para archivos sin email, usa la tabla `excel_name_mappings`

### "Error al parsear Excel"
- Asegúrate de que el formato del Excel sea el estándar de Evolcampus
- El script busca tests que empiecen con "Test", "Tema", "T1", etc.

### Rendimiento lento
- Para >200 archivos, usa el script CLI en lugar de la web
- Considera procesar en lotes más pequeños

## 🤖 Automatización

Para automatizar el proceso semanalmente:

```bash
# Crontab ejemplo (cada viernes a las 18:00)
0 18 * * 5 cd /ruta/proyecto && npm run process-evol-upload ~/Evolcampus/Nueva/
```

## 📈 Monitoreo

Después de cada importación, verifica:
1. Número de registros importados
2. Usuarios no encontrados
3. Archivos con errores

El dashboard mostrará automáticamente los nuevos datos importados. 