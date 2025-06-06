# Guía de Importación de Excel desde Evolcampus

## 📋 Resumen

Debido a que la API de Evolcampus no proporciona endpoints para obtener los detalles de intentos y notas de cada test individual, hemos implementado un sistema alternativo que permite importar estos datos a través de archivos Excel descargados manualmente desde la plataforma.

## 🔄 Flujo de Trabajo

### 1. Descarga de Informes desde Evolcampus
1. Accede a Evolcampus con tus credenciales
2. Ve a **Informes → Alumno**
3. Selecciona el alumno del que quieres descargar el informe
4. Descarga el archivo Excel (.xlsx)
5. Repite para cada alumno que necesites actualizar

### 2. Subida de Archivos al Sistema
1. Accede al panel de administración de IZETA
2. En el menú lateral, haz clic en **"📥 Importar Excel"**
3. Arrastra los archivos Excel a la zona de carga o haz clic para seleccionarlos
4. Verifica que los archivos aparezcan en la lista
5. Haz clic en **"Subir archivos seleccionados"**

### 3. Procesamiento Automático
Una vez subidos los archivos:
- El sistema procesará automáticamente cada archivo
- Extraerá la información del alumno (email, nombre, etc.)
- Identificará todos los tests y sus notas
- Guardará los datos en la base de datos
- Moverá los archivos procesados a una carpeta de archivo

## 📊 Datos que se Importan

De cada archivo Excel se extraen:
- **Información del alumno**: Nombre, email, DNI (si está disponible)
- **Por cada test**:
  - Asignatura
  - Tema
  - Actividad
  - Nota obtenida
  - Nota máxima
  - Número de intentos
  - Fecha del primer intento
  - Fecha del último intento

## 🔍 Identificación del Alumno

El sistema intenta identificar al alumno de las siguientes formas:
1. **Email en el contenido**: Busca el email dentro del archivo Excel
2. **Email en el nombre del archivo**: Si el archivo se llama `expediente-nombre-apellidos-email@dominio.com.xlsx`
3. **DNI**: Si encuentra un DNI, intenta asociarlo con un usuario existente

⚠️ **Importante**: El alumno debe existir previamente en el sistema con el mismo email que aparece en Evolcampus.

## 📈 Visualización de Datos

Una vez importados, los datos aparecerán:
- En el **dashboard individual del alumno** → pestaña "📚 Evolcampus"
- En los **análisis y estadísticas generales**
- En los **informes de progreso**

Los datos importados desde Excel se combinan automáticamente con los datos obtenidos de la API, mostrando siempre la información más actualizada.

## 🛠️ Configuración Técnica

### Estructura de la Base de Datos
Los datos se almacenan en la tabla `topic_results` con los siguientes campos:
- `student_id`: ID del estudiante en el sistema
- `topic_code`: Código del tema
- `activity`: Nombre de la actividad/test
- `score`: Nota obtenida
- `max_score`: Nota máxima posible
- `attempts`: Número de intentos
- `source`: Origen de los datos (`evol_excel` para importados)

### Bucket de Storage
- Nombre: `evol-excel-import`
- Acceso: Solo Service Role
- Estructura:
  ```
  evol-excel-import/
  ├── archivo1.xlsx          (archivos pendientes)
  ├── archivo2.xlsx
  └── processed/             (archivos procesados)
      └── 2025/
          └── 1/
              ├── archivo1.xlsx
              └── archivo2.xlsx
  ```

## 🔧 Solución de Problemas

### El archivo no se procesa
- Verifica que el email del alumno existe en el sistema
- Comprueba que el archivo tiene el formato correcto (.xlsx)
- Revisa el historial de importaciones para ver mensajes de error

### No se encuentran los datos del alumno
- Asegúrate de que el email en el Excel coincide exactamente con el email registrado
- Verifica que el alumno esté activo en el sistema

### Datos duplicados
- El sistema usa `upsert` para evitar duplicados
- Si un test se importa varias veces, se actualiza con la información más reciente

## 📅 Frecuencia Recomendada

Se recomienda realizar la importación:
- **Semanalmente**: Para mantener los datos actualizados
- **Después de exámenes importantes**: Para tener las notas más recientes
- **Antes de reuniones de seguimiento**: Para tener información actualizada

## 🚀 Mejoras Futuras

Cuando Evolcampus implemente los endpoints necesarios en su API:
1. Desactivaremos la importación manual
2. Los datos se sincronizarán automáticamente
3. Migraremos todos los datos históricos al nuevo sistema

## 📞 Soporte

Si encuentras problemas con la importación de Excel:
1. Revisa esta guía
2. Comprueba el historial de importaciones en el panel
3. Contacta con soporte técnico si el problema persiste 