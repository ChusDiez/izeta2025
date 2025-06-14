// fix_cohort_csv.js - Fuerza la columna cohorte a "sin_asignar" en un CSV formato email,nombre,cohorte
// Uso: node scripts/fix_cohort_csv.js [input.csv] [output.csv]

import fs from 'fs';
import path from 'path';

const inPath = process.argv[2] || path.join('data', 'alumnos_generado.csv');
const outPath = process.argv[3] || inPath; // sobrescribe si no se indica salida

if (!fs.existsSync(inPath)) {
  console.error(`❌ No se encontró ${inPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(inPath, 'utf-8').split(/\r?\n/);
if (lines.length === 0) {
  console.error('Archivo vacío');
  process.exit(1);
}

const header = lines[0];
const output = [header];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const parts = lines[i].split(',');
  if (parts.length < 3) {
    // Si la línea no tiene suficiente columnas la dejamos igual
    output.push(lines[i]);
    continue;
  }
  parts[2] = 'sin_asignar';
  output.push(parts.join(','));
}

fs.writeFileSync(outPath, output.join('\n'), 'utf-8');
console.log(`✅ Cohorte ajustada a "sin_asignar" en ${outPath}`); 