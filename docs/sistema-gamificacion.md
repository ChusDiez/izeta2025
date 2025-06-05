# Sistema de Gamificación Profesional - IZETA 2025

## 📊 Índice de Progreso (IP) - Anteriormente ELO

El sistema ELO ha sido rebrandeado como **Índice de Progreso (IP)** para reflejar mejor su propósito: medir la evolución acumulada basada en constancia y mejora continua.

## 🏆 Sistema de Divisiones

El sistema clasifica a los estudiantes en 4 divisiones según su IP:

| División | Rango IP | Icono | Descripción |
|----------|----------|-------|-------------|
| **Élite** | 2000+ | ⭐ | Top 10% - Rendimiento excepcional |
| **Avanzado** | 1500-1999 | 🎯 | Top 25% - Progreso destacado |
| **Progresando** | 1200-1499 | 📈 | Top 50% - En buen camino |
| **Iniciado** | 0-1199 | 🌱 | Fase inicial de preparación |

## 🎯 Sistema de Hitos y Logros

Los estudiantes pueden alcanzar los siguientes hitos:

### Hitos Disponibles

1. **Primera nota superior a 7** (50 puntos)
   - Alcanza tu primera puntuación por encima de 7/10

2. **Mes completo de participación** (100 puntos)
   - Participa en todos los simulacros durante un mes

3. **Mejora de +1 punto en media** (150 puntos)
   - Mejora tu puntuación media en al menos 1 punto

4. **Dominio temático** (200 puntos)
   - Obtén más de 8/10 en un bloque específico

5. **Eficiencia total** (75 puntos)
   - Completa un simulacro con menos de 5 respuestas en blanco

6. **Gestión óptima del tiempo** (125 puntos)
   - Logra más de 0.1 puntos por minuto de eficiencia

## 🏅 Reconocimientos Mensuales

Cada mes se otorgan reconocimientos automáticos en las siguientes categorías:

- **📈 Mayor Progreso**: El estudiante con mayor mejora en su puntuación
- **🎯 Más Constante**: Mayor ratio de participación y constancia
- **⏱️ Mejor Gestión del Tiempo**: Mayor eficiencia en puntos por minuto
- **💪 Superación Personal**: Mayor reducción en tasa de errores

## 💻 Implementación Técnica

### Módulos Principales

1. **`elo-manual.js`** - Panel principal del sistema de gamificación
2. **`gamification-config.js`** - Configuración centralizada
3. **`students.js`** - Integración visual en la tabla de estudiantes

### Uso del Sistema

```javascript
// Importar la configuración
import { GAMIFICATION_CONFIG, GamificationHelper } from './gamification-config.js';

// Obtener la división de un estudiante
const division = GamificationHelper.getDivision(student.current_elo);

// Verificar hitos alcanzados
const milestone = GAMIFICATION_CONFIG.milestones[0];
const achieved = GamificationHelper.checkMilestone(milestone, studentData);

// Formatear mensajes motivacionales
const message = GamificationHelper.formatMessage('improvement_detected', {
    percent: 15
});
```

### Integración en la Base de Datos

El sistema utiliza las siguientes tablas:

- `users`: Campo `current_elo` (ahora mostrado como IP)
- `user_achievements`: Para almacenar hitos alcanzados
- `monthly_recognitions`: Para los reconocimientos mensuales

### Vista en el Dashboard

El nuevo sistema se accede desde:
- **Admin**: Menú lateral → "Sistema ELO" (pronto será renombrado a "Índice de Progreso")
- **Estudiantes**: Las divisiones se muestran con iconos junto al nombre

## 🚀 Próximos Pasos

1. **Fase 1** (Completada):
   - ✅ Implementar divisiones visuales
   - ✅ Rebranding en la UI
   - ✅ Sistema de tabs en el panel

2. **Fase 2** (Pendiente):
   - Sistema de hitos funcional con BD
   - Reconocimientos mensuales automáticos
   - Notificaciones al alcanzar hitos

3. **Fase 3** (Futuro):
   - Panel "Mi Progreso" para estudiantes
   - Exportación de certificados
   - Estadísticas avanzadas por división

## 📝 Notas para el Desarrollador

- El término "ELO" se mantiene en la base de datos para compatibilidad
- En la UI siempre mostrar "Índice de Progreso" o "IP"
- Los colores de las divisiones están definidos en `gamification-config.js`
- Los mensajes motivacionales son profesionales, sin elementos infantiles

## 🔧 Configuración

Para ajustar los rangos de las divisiones o añadir nuevos hitos, editar:
```
admin/js/modules/gamification-config.js
```

Los cambios se reflejarán automáticamente en todos los módulos que usen esta configuración. 