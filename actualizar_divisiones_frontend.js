// ================================================
// ACTUALIZACIÓN DE DIVISIONES PARA NUEVO SISTEMA ELO
// ================================================

// Nuevas divisiones ajustadas para el sistema más generoso:
const NUEVAS_DIVISIONES = {
    elite: { min: 1800, name: 'Élite', icon: '⭐', color: '#FFD700' },      // Bajado de 2000
    avanzado: { min: 1400, name: 'Avanzado', icon: '🎯', color: '#C0C0C0' }, // Bajado de 1500
    progresando: { min: 1150, name: 'Progresando', icon: '📈', color: '#CD7F32' }, // Bajado de 1200
    iniciado: { min: 0, name: 'Iniciado', icon: '🌱', color: '#4A5568' }
};

// Función getDivision actualizada
const nuevaGetDivision = `function getDivision(elo) {
    if (elo >= 1800) return { name: 'Élite', icon: '⭐', color: '#FFD700' };
    if (elo >= 1400) return { name: 'Avanzado', icon: '🎯', color: '#C0C0C0' };
    if (elo >= 1150) return { name: 'Progresando', icon: '📈', color: '#CD7F32' };
    return { name: 'Iniciado', icon: '🌱', color: '#4A5568' };
}`;

// Archivos a actualizar:
const archivosActualizar = [
    'admin/js/modules/students.js',
    'admin/js/modules/elo-manual.js',
    'admin/js/modules/analytics.js',
    'admin/js/modules/analytics/index.js',
    'admin/js/modules/student-detail.js',
    'admin/js/modules/risk-analysis.js',
    'public/leaderboard.html'
];

// Instrucciones para actualizar manualmente:
console.log(`
================================================
INSTRUCCIONES PARA ACTUALIZAR DIVISIONES
================================================

1. Buscar y reemplazar en los siguientes archivos:
   ${archivosActualizar.join('\n   ')}

2. Buscar todas las funciones getDivision() y reemplazar los valores:
   - 2000 → 1800 (Élite)
   - 1500 → 1400 (Avanzado)  
   - 1200 → 1150 (Progresando)

3. Ejemplo de la función actualizada:
${nuevaGetDivision}

4. También actualizar cualquier referencia directa a estos números
   en comparaciones o cálculos.

5. Actualizar la documentación y comunicaciones a estudiantes
   sobre los nuevos rangos.

================================================
JUSTIFICACIÓN DE LOS CAMBIOS
================================================

Con el sistema más generoso de puntos:
- Élite (1800): Alcanzable en ~16-25 semanas
- Avanzado (1400): Alcanzable en ~10-15 semanas  
- Progresando (1150): Alcanzable en ~5-8 semanas

Esto mantiene el desafío pero hace los objetivos más alcanzables.
`);

// Script para verificar divisiones actuales en la base de datos
const sqlVerificacion = `
-- Ver distribución actual con divisiones antiguas
SELECT 
    CASE 
        WHEN current_elo >= 2000 THEN '⭐ Élite (2000+) - ANTIGUO'
        WHEN current_elo >= 1500 THEN '🎯 Avanzado (1500-1999) - ANTIGUO'
        WHEN current_elo >= 1200 THEN '📈 Progresando (1200-1499) - ANTIGUO'
        ELSE '🌱 Iniciado (<1200) - ANTIGUO'
    END as division_antigua,
    CASE 
        WHEN current_elo >= 1800 THEN '⭐ Élite (1800+) - NUEVO'
        WHEN current_elo >= 1400 THEN '🎯 Avanzado (1400-1799) - NUEVO'
        WHEN current_elo >= 1150 THEN '📈 Progresando (1150-1399) - NUEVO'
        ELSE '🌱 Iniciado (<1150) - NUEVO'
    END as division_nueva,
    COUNT(*) as usuarios
FROM users
WHERE current_elo > 1000
GROUP BY division_antigua, division_nueva
ORDER BY 1, 2;
`; 