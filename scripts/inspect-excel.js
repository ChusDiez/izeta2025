import XLSX from 'xlsx';
import fs from 'fs';

const filePath = process.argv[2] || 'test-sample/expediente-zaira-lopez-lopez-03062025-224238_1_1.xlsx';

console.log(`🔍 Inspeccionando: ${filePath}`);

const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer' });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

console.log(`📊 Total de filas: ${data.length}`);
console.log(`📋 Hojas disponibles: ${workbook.SheetNames.join(', ')}`);

console.log('\n📝 Primeras 30 filas:');
for (let i = 0; i < Math.min(30, data.length); i++) {
  if (data[i] && data[i].length > 0) {
    const rowText = data[i].join(' | ').substring(0, 100);
    console.log(`[${i.toString().padStart(2, '0')}] ${rowText}`);
  }
}

// Buscar filas que contengan palabras clave de tests
console.log('\n🔍 Buscando filas con palabras clave de tests:');
const keywords = ['asignatura', 'tema', 'actividad', 'test', 'puntuación', 'nota', 'fecha'];

for (let i = 0; i < data.length; i++) {
  if (!data[i]) continue;
  const rowText = data[i].join(' ').toLowerCase();
  
  for (const keyword of keywords) {
    if (rowText.includes(keyword)) {
      console.log(`[${i}] Contiene "${keyword}": ${data[i].join(' | ')}`);
      break;
    }
  }
} 