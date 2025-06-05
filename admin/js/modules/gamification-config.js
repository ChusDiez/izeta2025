// admin/js/modules/gamification-config.js
// Configuración compartida del sistema de gamificación profesional

export const GAMIFICATION_CONFIG = {
    // Sistema de divisiones
    divisions: {
        elite: {
            min: 2000,
            max: 9999,
            name: 'Élite',
            icon: '⭐',
            color: '#FFD700',
            description: 'Top 10% - Rendimiento excepcional'
        },
        advanced: {
            min: 1500,
            max: 1999,
            name: 'Avanzado',
            icon: '🎯',
            color: '#C0C0C0',
            description: 'Top 25% - Progreso destacado'
        },
        progressing: {
            min: 1200,
            max: 1499,
            name: 'Progresando',
            icon: '📈',
            color: '#CD7F32',
            description: 'Top 50% - En buen camino'
        },
        initiated: {
            min: 0,
            max: 1199,
            name: 'Iniciado',
            icon: '🌱',
            color: '#4A5568',
            description: 'Fase inicial de preparación'
        }
    },
    
    // Hitos y logros
    milestones: [
        {
            id: 'first_7',
            name: 'Primera nota superior a 7',
            description: 'Alcanza tu primera puntuación por encima de 7/10',
            icon: '📊',
            points: 50,
            condition: {
                type: 'score',
                operator: '>',
                value: 7,
                count: 1
            }
        },
        {
            id: 'consistency_month',
            name: 'Mes completo de participación',
            description: 'Participa en todos los simulacros durante un mes',
            icon: '📅',
            points: 100,
            condition: {
                type: 'streak_monthly',
                value: 4
            }
        },
        {
            id: 'improvement_1',
            name: 'Mejora de +1 punto en media',
            description: 'Mejora tu puntuación media en al menos 1 punto',
            icon: '📈',
            points: 150,
            condition: {
                type: 'improvement',
                value: 1,
                period: 'month'
            }
        },
        {
            id: 'mastery_topic',
            name: 'Dominio temático',
            description: 'Obtén más de 8/10 en un bloque específico',
            icon: '🎯',
            points: 200,
            condition: {
                type: 'topic_score',
                operator: '>',
                value: 8
            }
        },
        {
            id: 'low_blanks',
            name: 'Eficiencia total',
            description: 'Completa un simulacro con menos de 5 respuestas en blanco',
            icon: '⚡',
            points: 75,
            condition: {
                type: 'blanks',
                operator: '<',
                value: 5
            }
        },
        {
            id: 'time_management',
            name: 'Gestión óptima del tiempo',
            description: 'Logra más de 0.1 puntos por minuto de eficiencia',
            icon: '⏱️',
            points: 125,
            condition: {
                type: 'efficiency',
                operator: '>',
                value: 0.1
            }
        }
    ],
    
    // Tipos de reconocimientos mensuales
    recognitions: {
        'mayor_progreso': {
            name: 'Mayor Progreso',
            icon: '📈',
            description: 'El estudiante con mayor mejora en su puntuación',
            metric: 'improvement'
        },
        'mas_constante': {
            name: 'Más Constante',
            icon: '🎯',
            description: 'Mayor ratio de participación y constancia',
            metric: 'participation_rate'
        },
        'mejor_gestion_tiempo': {
            name: 'Mejor Gestión del Tiempo',
            icon: '⏱️',
            description: 'Mayor eficiencia en puntos por minuto',
            metric: 'time_efficiency'
        },
        'superacion': {
            name: 'Superación Personal',
            icon: '💪',
            description: 'Mayor reducción en tasa de errores',
            metric: 'error_reduction'
        }
    },
    
    // Mensajes motivacionales profesionales
    messages: {
        improvement_detected: "Tu rendimiento muestra una tendencia positiva del {percent}%",
        goal_achieved: "Has alcanzado tu objetivo de mantener media superior a {score}",
        new_division: "Tu progreso te sitúa ahora en la división {division}",
        analysis_available: "Nuevo análisis de patrones disponible en tu panel",
        milestone_achieved: "¡Enhorabuena! Has alcanzado el hito: {milestone}",
        monthly_recognition: "Has sido reconocido este mes por: {recognition}"
    }
};

// Funciones helper para el sistema de gamificación
export class GamificationHelper {
    /**
     * Obtener la división de un estudiante basándose en su IP (ELO)
     */
    static getDivision(elo) {
        for (const [key, division] of Object.entries(GAMIFICATION_CONFIG.divisions)) {
            if (elo >= division.min && elo <= division.max) {
                return division;
            }
        }
        return GAMIFICATION_CONFIG.divisions.initiated;
    }
    
    /**
     * Calcular el percentil de un estudiante
     */
    static calculatePercentile(elo, allElos) {
        const sorted = allElos.sort((a, b) => a - b);
        const index = sorted.findIndex(e => e >= elo);
        return ((sorted.length - index) / sorted.length) * 100;
    }
    
    /**
     * Verificar si un estudiante ha alcanzado un hito
     */
    static checkMilestone(milestone, studentData) {
        const condition = milestone.condition;
        
        switch (condition.type) {
            case 'score':
                return studentData.scores.some(score => 
                    this.evaluateCondition(score, condition.operator, condition.value)
                );
                
            case 'streak_monthly':
                return studentData.monthlyStreak >= condition.value;
                
            case 'improvement':
                return studentData.improvement >= condition.value;
                
            case 'topic_score':
                return Object.values(studentData.topicScores || {}).some(score =>
                    this.evaluateCondition(score, condition.operator, condition.value)
                );
                
            case 'blanks':
                return studentData.lastBlanks !== undefined && 
                    this.evaluateCondition(studentData.lastBlanks, condition.operator, condition.value);
                
            case 'efficiency':
                return studentData.timeEfficiency !== undefined &&
                    this.evaluateCondition(studentData.timeEfficiency, condition.operator, condition.value);
                
            default:
                return false;
        }
    }
    
    /**
     * Evaluar una condición
     */
    static evaluateCondition(value, operator, target) {
        switch (operator) {
            case '>': return value > target;
            case '>=': return value >= target;
            case '<': return value < target;
            case '<=': return value <= target;
            case '=': return value === target;
            default: return false;
        }
    }
    
    /**
     * Formatear un mensaje con variables
     */
    static formatMessage(messageKey, variables = {}) {
        let message = GAMIFICATION_CONFIG.messages[messageKey] || messageKey;
        
        Object.entries(variables).forEach(([key, value]) => {
            message = message.replace(`{${key}}`, value);
        });
        
        return message;
    }
    
    /**
     * Obtener el color de probabilidad
     */
    static getProbabilityColor(probability) {
        if (probability >= 70) return '#10b981'; // Verde
        if (probability >= 50) return '#f59e0b'; // Amarillo
        if (probability >= 30) return '#ef4444'; // Rojo
        return '#991b1b'; // Rojo oscuro
    }
}

// Exportar por defecto la configuración
export default GAMIFICATION_CONFIG; 