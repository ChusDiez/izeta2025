// src/utils/evolParser.js
// Parser reutilizable para archivos Excel de Evolcampus

export function extractStudent(rows, fileName) {
  console.log(`🔍 Procesando archivo: ${fileName}`);
  
  // Los archivos de Evolcampus NO contienen email, solo extraer del nombre del archivo
  const baseSlug = fileName
    .replace(/\.xlsx?$/i, '')                           // quitar extensión
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '') // quitar timestamp ISO
    .replace(/-\d{8}-\d{6}$/, '')                      // quitar fecha al final
    .replace(/^expediente-/, '')                        // quitar prefijo
    .toLowerCase();

  const searchName = baseSlug
    .replace(/[^a-z0-9áéíóúñ]+/g, ' ')
    .trim();

  console.log(`📝 Nombre extraído del archivo: "${searchName}"`);
  console.log(`🔗 Base slug para mapeos: "${baseSlug}"`);
  
  return { 
    email: null,           // Los Excel de Evolcampus NO tienen email
    searchName, 
    baseSlug 
  };
}

export function extractTests(rows, studentId, fileName) {
  const records = [];
  
  console.log(`🔍 Analizando ${rows.length} filas de ${fileName}`);
  
  // Buscar donde empiezan los datos de tests
  let dataStartRow = -1;
  let dateColumns = [];
  
  // Buscar la cabecera de tests (Asignatura | Tema | Actividad...)
  for (let i = 0; i < Math.min(50, rows.length); i++) {
    if (!rows[i]) continue;
    
    const rowText = rows[i].join(' ').toLowerCase();
    
    // Buscar cabecera típica de Evolcampus
    if (rowText.includes('asignatura') && rowText.includes('tema') && rowText.includes('actividad')) {
      dataStartRow = i + 1; // Los datos empiezan en la siguiente fila
      console.log(`✅ Cabecera de tests encontrada en fila ${i}, datos desde fila ${dataStartRow}`);
      
      // Analizar la cabecera para encontrar columnas importantes
      const headers = rows[i];
      headers.forEach((header, idx) => {
        if (header && header.toString().toLowerCase().includes('realización')) {
          dateColumns.push({ index: idx, date: 'fecha_realizacion' });
        }
      });
      
      console.log(`📅 Estructura detectada: ${headers.length} columnas`);
      break;
    }
    
    // Fallback: buscar filas que empiecen con nombres de asignaturas conocidas
    const firstCell = rows[i][0] ? rows[i][0].toString().toLowerCase() : '';
    if (firstCell.includes('jurídicas') || firstCell.includes('sociales') || 
        firstCell.includes('técnico') || firstCell.includes('test por bloques')) {
      dataStartRow = i;
      console.log(`✅ Datos de tests encontrados desde fila ${i} (por asignatura)`);
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
    if (!row || row.length < 3) continue;
    
    // Estructura esperada: Asignatura | Tema | Actividad | Nota máxima | ...
    const asignatura = row[0] ? row[0].toString().trim() : '';
    const tema = row[1] ? row[1].toString().trim() : '';
    const actividad = row[2] ? row[2].toString().trim() : '';
    const notaMaxima = row[3] ? row[3].toString().trim() : '';
    
    // Saltar filas vacías o que no parezcan tests
    if (!asignatura || !actividad || asignatura.length < 3) continue;
    
    // Extraer código del tema del campo tema
    let topicCode = 'GENERAL';
    const topicMatch = tema.match(/tema\s*(\d+)/i);
    if (topicMatch) {
      topicCode = `T${topicMatch[1]}`;
    } else if (asignatura.toLowerCase().includes('jurídicas')) {
      topicCode = 'JURIDICAS';
    } else if (asignatura.toLowerCase().includes('sociales')) {
      topicCode = 'SOCIALES';
    } else if (asignatura.toLowerCase().includes('técnico')) {
      topicCode = 'TECNICO';
    }
    
    // Buscar la nota en las columnas (puede estar en diferentes posiciones)
    let scoreValue = 0; // Por defecto 0 como vimos en la inspección
    
    // Intentar extraer nota de la columna de nota máxima o siguientes
    for (let col = 3; col < Math.min(row.length, 8); col++) {
      const cellValue = row[col];
      if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
        const parsed = parseFloat(cellValue.toString().replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) {
          scoreValue = parsed;
          break;
        }
      }
    }
    
    // Crear registro
    records.push({
      student_id: studentId,
      topic_code: topicCode,
      activity: `${tema} - ${actividad}`.trim().replace(/^-\s*/, ''),
      score: scoreValue,
      max_score: 10,
      attempts: 1,
      first_attempt: new Date().toISOString(),
      last_attempt: new Date().toISOString(),
      source: 'evol_excel',
      created_at: new Date().toISOString()
    });
    
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