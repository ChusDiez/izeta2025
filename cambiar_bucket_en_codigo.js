// ================================================
// CAMBIAR BUCKET EN EL CÓDIGO
// ================================================

// Si necesitas cambiar a un bucket diferente, actualiza estos archivos:

// 1. admin/js/modules/excel-import.js
// Buscar línea ~290:
const CAMBIO_EXCEL_IMPORT = `
// BUSCAR:
const { data, error } = await this.supabase.storage
    .from('evol-excel-import')
    .upload(fileName, file, {

// CAMBIAR A:
const { data, error } = await this.supabase.storage
    .from('excel-temp-public')  // <-- Nuevo nombre del bucket
    .upload(fileName, file, {
`;

// 2. supabase/functions/process-excel-evolcampus/index.ts
// Buscar línea ~50:
const CAMBIO_EDGE_FUNCTION = `
// BUSCAR:
const { data: fileData, error: downloadError } = await supabase
    .storage
    .from(bucket)
    .download(fileName);

// El bucket viene como parámetro, así que hay que cambiar donde se llama
`;

// 3. Para hacer el cambio automáticamente, ejecuta estos comandos:
console.log(`
INSTRUCCIONES PARA CAMBIAR EL BUCKET:

1. En terminal, desde la raíz del proyecto:

   # Hacer backup
   cp admin/js/modules/excel-import.js admin/js/modules/excel-import.js.backup

   # En macOS/Linux:
   sed -i '' "s/from('evol-excel-import')/from('excel-temp-public')/g" admin/js/modules/excel-import.js

   # En Windows (PowerShell):
   (Get-Content admin/js/modules/excel-import.js) -replace "from\\('evol-excel-import'\\)", "from('excel-temp-public')" | Set-Content admin/js/modules/excel-import.js

2. Verificar que el cambio se hizo:
   grep "excel-temp-public" admin/js/modules/excel-import.js

3. Si usas el nuevo bucket, asegúrate de crearlo primero en Supabase
`);

// 4. Script SQL para crear el nuevo bucket público
const SQL_NUEVO_BUCKET = `
-- Crear nuevo bucket público sin restricciones
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('excel-temp-public', 'excel-temp-public', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Verificar
SELECT * FROM storage.buckets WHERE name = 'excel-temp-public';
`; 