export function extractTests(rows, studentId, fileName = '') {
  const records = [];

  // 1️⃣  Localizar fila cabecera buscando las palabras clave, sin depender de columna 0
  let headerRow = -1;
  for (let r = 0; r < rows.length; r++) {
    if (!rows[r]) continue;
    const rowText = rows[r].join(' ').toLowerCase();
    if (rowText.includes('asignatura')   // castellano
        || rowText.includes('subject'))  // por si viene en inglés
    {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return records;   // sin cabecera, sin tests

  const header = rows[headerRow].map(c => (c ?? '').toString().trim().toLowerCase());

  // 2️⃣  Posiciones de columnas relevantes con includes (no igualdad exacta)
  const col = {
    subject  : header.findIndex(c => c.includes('asignatura') || c.includes('subject')),
    topic    : header.findIndex(c => c.includes('tema') || c.includes('topic')),
    activity : header.findIndex(c => c.includes('actividad') || c.includes('activity')),
    maxScore : header.findIndex(c => c.includes('nota máxima') || c.includes('max')),
    score    : header.findIndex(c => c === 'nota' || (c.includes('nota') && !c.includes('máxima')) || c === 'score'),
    attempts : header.findIndex(c => c.includes('intentos') || c.includes('attempt')),
    first    : header.findIndex(c => c.includes('primer intento') || c.includes('first attempt')),
    last     : header.findIndex(c => c.includes('último intento') || c.includes('last attempt')),
    corrected: header.findIndex(c => c.includes('corregido') || c.includes('corrected'))
  };

  // 3️⃣  Procesar las filas siguientes
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[col.activity]) continue;   // sin actividad → salto

    const rec = {
      student_id   : studentId,
      topic_code   : row[col.topic]   || row[col.subject] || `TOPIC-${r}`,
      activity     : row[col.activity],
      max_score    : parseFloat(row[col.maxScore]) || 100,
      score        : parseFloat(row[col.score])    || 0,
      attempts     : parseInt(row[col.attempts])   || 1,
      first_attempt: row[col.first] ? parseDate(row[col.first]) : new Date().toISOString(),
      last_attempt : row[col.last]  ? parseDate(row[col.last])  : new Date().toISOString(),
      corrected_by : row[col.corrected] || '',
      source       : fileName || 'evol_excel',
      created_at   : new Date().toISOString()
    };

    records.push(rec);
  }
  return records;
}

// Util para fechas en formato dd/mm/yyyy
function parseDate(str) {
  if (!str) return new Date().toISOString();
  const [d,m,y] = str.split(/[\/\-]/).map(n => parseInt(n,10));
  if (!y) return new Date().toISOString();
  return new Date(Date.UTC(y, m-1, d)).toISOString();
}