// src/utils/evolParser.js
// Parser reutilizable para archivos Excel de Evolcampus

export function extractStudent(rows, fileName) {
  // 1. Buscar email en las primeras filas
  for (let i = 0; i < 20 && i < rows.length; i++) {
    const rowText = (rows[i] || []).join(' ').toLowerCase();
    const emailMatch = rowText.match(/([a-z0-9._-]+@[a-z0-9._-]+\.[a-z0-9_-]+)/);
    if (emailMatch) {
      console.log(`✅ Email encontrado en fila ${i}: ${emailMatch[1]}`);
      return { email: emailMatch[1], searchName: null };
    }
  }

  // 2. Si no hay email, extraer nombre del archivo
  const baseSlug = fileName
    .replace(/\.xlsx?$/i, '')                           // quitar extensión
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '') // quitar timestamp ISO
    .replace(/-\d{8}-\d{6}$/, '')                      // quitar fecha al final
    .replace(/^expediente-/, '')                        // quitar prefijo
    .toLowerCase();

  const searchName = baseSlug
    .replace(/[^a-z0-9áéíóúñ]+/g, ' ')
    .trim();

  console.log(`⚠️ Sin email en ${fileName}, usando nombre: ${searchName}`);
  return { email: null, searchName, baseSlug };
}

export function extractTests(rows, studentId, fileName) {
  const records = [];
  
  console.log(`🔍 Analizando ${rows.length} filas de ${fileName}`);
  
  // Buscar donde empiezan los datos de tests
  let dataStartRow = -1;
  let dateColumns = [];
  
  // Buscar filas que parezcan tests (empiecen con "Test", "Tema", "T1", etc.)
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (!rows[i] || !rows[i][0]) continue;
    
    const firstCell = rows[i][0].toString().toLowerCase();
    
    if (firstCell.includes('test') || firstCell.includes('tema') || 
        firstCell.match(/^t\d+/) || firstCell.includes('ejercicio')) {
      dataStartRow = i;
      console.log(`✅ Tests encontrados desde fila ${i}`);
      
      // Buscar fechas en la fila anterior
      if (i > 0 && rows[i-1]) {
        rows[i-1].forEach((cell, idx) => {
          if (idx > 0 && cell) {
            const cellStr = cell.toString();
            // Detectar fechas DD/MM/YYYY o YYYY-MM-DD
            if (cellStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || 
                cellStr.match(/\d{4}-\d{2}-\d{2}/)) {
              dateColumns.push({ index: idx, date: cellStr });
            }
          }
        });
        console.log(`📅 Encontradas ${dateColumns.length} columnas de fechas`);
      }
      break;
    }
  }
  
  if (dataStartRow === -1) {
    console.log('❌ No se encontraron datos de tests');
    return records;
  }
  
  // Procesar cada fila de test
  let processedTests = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    
    const testName = row[0].toString().trim();
    if (!testName || testName.length < 3) continue;
    
    // Extraer código del tema
    let topicCode = 'GENERAL';
    const topicMatch = testName.match(/\b(T\d+)\b/i);
    if (topicMatch) {
      topicCode = topicMatch[1].toUpperCase();
    }
    
    // Para cada columna con fecha/nota
    if (dateColumns.length > 0) {
      // Caso 1: Tenemos columnas de fechas identificadas
      dateColumns.forEach(dateCol => {
        const score = row[dateCol.index];
        if (score !== undefined && score !== null && score !== '') {
          const scoreValue = parseFloat(score.toString().replace(',', '.'));
          
          if (!isNaN(scoreValue) && scoreValue >= 0) {
            records.push({
              student_id: studentId,
              topic_code: topicCode,
              activity: testName,
              score: scoreValue,
              max_score: 10,
              attempts: 1,
              first_attempt: parseSpanishDate(dateCol.date),
              last_attempt: parseSpanishDate(dateCol.date),
              source: 'evol_excel',
              created_at: new Date().toISOString()
            });
          }
        }
      });
    } else {
      // Caso 2: No hay fechas claras, buscar cualquier número en las columnas
      for (let col = 1; col < row.length; col++) {
        const cellValue = row[col];
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const scoreValue = parseFloat(cellValue.toString().replace(',', '.'));
          
          if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 10) {
            records.push({
              student_id: studentId,
              topic_code: topicCode,
              activity: testName,
              score: scoreValue,
              max_score: 10,
              attempts: 1,
              first_attempt: new Date().toISOString(),
              last_attempt: new Date().toISOString(),
              source: 'evol_excel',
              created_at: new Date().toISOString()
            });
            break; // Solo tomar la primera nota válida si no hay fechas
          }
        }
      }
    }
    
    processedTests++;
  }
  
  console.log(`✅ Procesados ${processedTests} tests, generados ${records.length} registros`);
  
  // Mostrar resumen
  const topicSummary = {};
  records.forEach(r => {
    if (!topicSummary[r.topic_code]) {
      topicSummary[r.topic_code] = { count: 0, total: 0 };
    }
    topicSummary[r.topic_code].count++;
    topicSummary[r.topic_code].total += r.score;
  });
  
  console.log('📊 Resumen por tema:');
  Object.entries(topicSummary).forEach(([topic, stats]) => {
    const avg = stats.total / stats.count;
    console.log(`  ${topic}: ${stats.count} tests, promedio ${avg.toFixed(2)}`);
  });
  
  return records;
}

// Función auxiliar para parsear fechas españolas
function parseSpanishDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  // Formato DD/MM/YYYY
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [_, day, month, year] = match;
    return new Date(year, month - 1, day).toISOString();
  }
  
  // Formato YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(dateStr).toISOString();
  }
  
  return new Date().toISOString();
} 