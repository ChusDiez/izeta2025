// excel_to_csv.js - Convierte una hoja de Excel a alumnos.csv con el formato email,nombre,cohorte
// Uso: node scripts/excel_to_csv.js [ruta_entrada.xlsx] [ruta_salida.csv]

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = process.argv[2] || path.join('data', 'matrículas.xlsx');
const outputPath = process.argv[3] || path.join('data', 'alumnos_generado.csv');

if (!fs.existsSync(inputPath)) {
  console.error(`❌ No se encontró el archivo ${inputPath}`);
  process.exit(1);
}

console.log(`📥 Leyendo ${inputPath} ...`);

const workbook = XLSX.readFile(inputPath);
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

if (rawRows.length === 0) {
  console.error('❌ La hoja está vacía');
  process.exit(1);
}

// Buscar la fila que contenga la cabecera email
let headerRowIndex = rawRows.findIndex(r => r.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('email')));
if (headerRowIndex === -1) {
  console.error('❌ No se encontró una fila de cabecera con la palabra "email"');
  process.exit(1);
}

const headerRow = rawRows[headerRowIndex].map(h => h.toString().toLowerCase().trim());
const emailIdx = headerRow.findIndex(h => ['email', 'correo', 'e-mail'].includes(h));
const nameIdx = headerRow.findIndex(h => ['alumno', 'nombre', 'name', 'username', 'full name'].includes(h));
const cohortIdx = headerRow.findIndex(h => ['cohorte', 'cohort', 'grupo', 'curso'].includes(h));

if (emailIdx === -1 || nameIdx === -1) {
  console.error('❌ No se pudieron detectar las columnas de email y nombre.');
  process.exit(1);
}

console.log(`📑 Columnas detectadas (fila ${headerRowIndex}): email=${emailIdx}, nombre=${nameIdx}, cohorte=${cohortIdx}`);

const lines = ['email,nombre,cohorte'];
for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || row.length === 0) continue;
  const email = (row[emailIdx] || '').toString().trim().toLowerCase();
  if (!email) continue;
  const nombre = (row[nameIdx] || '').toString().trim();
  const cohorte = (cohortIdx !== -1 ? (row[cohortIdx] || '').toString().trim() : 'sin_asignar') || 'sin_asignar';
  lines.push(`${email},${nombre},${cohorte}`);
}

fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
console.log(`✅ CSV generado: ${outputPath} (${lines.length - 1} registros)`); 