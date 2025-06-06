# 🎯 Propuesta de Ajuste del Sistema ELO/IP

## 📊 Análisis del Problema Actual

### Matemáticas del Sistema Actual:
- **ELO Inicial**: 1000 puntos
- **Objetivo División Élite**: 2000 puntos
- **Diferencia necesaria**: 1000 puntos
- **Tiempo disponible**: ~42 semanas (Enero - 25 Octubre)

### Escenarios con Sistema Actual:
| Posición | Puntos/Semana | Semanas Necesarias | ¿Factible? |
|----------|---------------|-------------------|------------|
| Top 3    | +32          | 31 semanas        | ❌ Requiere ser top 3 siempre |
| 4-10     | +16          | 63 semanas        | ❌ Necesita 1.5 años |
| 11-20    | +0           | ∞                 | ❌ Imposible |
| 21+      | -8           | ∞                 | ❌ Retrocede |

## 🚀 Propuestas de Solución

### Opción 1: Aumentar Puntos por Posición (RECOMENDADA)
```javascript
// Sistema propuesto
const PUNTOS_POR_POSICION = {
    top3: 60,      // Era 32
    pos4_10: 40,   // Era 16
    pos11_20: 20,  // Era 0
    pos21_30: 10,  // Era -8
    pos31_plus: 0  // Era -8
};

// Tiempo para llegar a 2000:
// Top 3: 17 semanas
// Pos 4-10: 25 semanas (factible)
// Pos 11-20: 50 semanas (justo, pero posible con esfuerzo)
```

### Opción 2: Sistema de Bonificaciones
```javascript
// Bonificaciones adicionales
const BONIFICACIONES = {
    rachaActiva: {
        semanas3: 10,   // +10 extra si tienes racha de 3
        semanas5: 20,   // +20 extra si tienes racha de 5
        semanas10: 50   // +50 extra si tienes racha de 10
    },
    notaPerfecta: 25,   // Si sacas 10/10
    mejoraTiempo: 15,   // Si mejoras tu tiempo personal
    sinErrores: 20      // Si 0% tasa de error
};
```

### Opción 3: Eventos Especiales y Multiplicadores
```javascript
// Eventos periódicos
const EVENTOS = {
    semanaDoblePuntos: 2,     // Una vez al mes
    simulacroEspecial: 100,   // Puntos extra por simulacro temático
    retoMensual: 150,         // Challenge adicional opcional
};
```

### Opción 4: Sistema Híbrido de Progresión
```javascript
// Base + Performance + Participación
function calcularPuntosELO(posicion, score, participacion) {
    let puntos = 0;
    
    // Puntos base por participar
    puntos += 15;
    
    // Puntos por posición (más generosos)
    if (posicion <= 3) puntos += 50;
    else if (posicion <= 10) puntos += 35;
    else if (posicion <= 20) puntos += 20;
    else if (posicion <= 30) puntos += 10;
    
    // Bonus por score alto
    if (score >= 9) puntos += 20;
    else if (score >= 8) puntos += 10;
    else if (score >= 7) puntos += 5;
    
    return puntos;
}
```

## 📈 Comparativa de Propuestas

| Sistema | Semanas a Élite (promedio) | Pros | Contras |
|---------|---------------------------|------|---------|
| Actual | 63+ | Simple | Inalcanzable |
| Opción 1 | 25-35 | Directo, justo | Puede inflarse |
| Opción 2 | 20-30 | Premia constancia | Más complejo |
| Opción 3 | 15-25 | Emocionante | Requiere planificación |
| Opción 4 | 22-32 | Equilibrado | Más cálculos |

## 🎯 Recomendación Final

**Implementar Opción 1 + elementos de Opción 2:**

```sql
-- Nueva función de cálculo ELO
CREATE OR REPLACE FUNCTION update_elo_for_simulation(p_simulation_id uuid)
RETURNS void AS $$
DECLARE
  r record;
  new_elo int;
  bonus_racha int;
  bonus_score int;
BEGIN
  FOR r IN 
    SELECT 
      ur.*,
      u.current_elo,
      u.current_streak
    FROM user_results ur
    JOIN users u ON ur.user_id = u.id
    WHERE ur.simulation_id = p_simulation_id
    ORDER BY ur.score DESC
  LOOP
    -- Puntos base por posición (más generosos)
    new_elo := r.current_elo + 
      CASE 
        WHEN r.position <= 3 THEN 60
        WHEN r.position <= 10 THEN 40
        WHEN r.position <= 20 THEN 20
        WHEN r.position <= 30 THEN 10
        ELSE 0
      END;
    
    -- Bonus por racha
    bonus_racha := CASE
        WHEN r.current_streak >= 10 THEN 30
        WHEN r.current_streak >= 5 THEN 15
        WHEN r.current_streak >= 3 THEN 5
        ELSE 0
    END;
    
    -- Bonus por puntuación alta
    bonus_score := CASE
        WHEN r.score >= 9.5 THEN 20
        WHEN r.score >= 9 THEN 10
        WHEN r.score >= 8 THEN 5
        ELSE 0
    END;
    
    -- Aplicar bonuses
    new_elo := new_elo + bonus_racha + bonus_score;
    
    -- Mínimo 800, sin máximo
    new_elo := GREATEST(new_elo, 800);
    
    -- Actualizar
    UPDATE users 
    SET current_elo = new_elo,
        updated_at = NOW()
    WHERE id = r.user_id;
    
    -- Registrar en historial
    INSERT INTO elo_history (
      user_id,
      simulation_id,
      elo_before,
      elo_after,
      elo_change,
      position,
      score,
      details
    ) VALUES (
      r.user_id,
      p_simulation_id,
      r.current_elo,
      new_elo,
      new_elo - r.current_elo,
      r.position,
      r.score,
      jsonb_build_object(
        'bonus_racha', bonus_racha,
        'bonus_score', bonus_score
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🔄 Plan de Migración

1. **Comunicar cambios** a los estudiantes
2. **Ajustar ELOs actuales** proporcionalmente:
   ```sql
   -- Boost inicial para compensar tiempo perdido
   UPDATE users 
   SET current_elo = 1000 + ((current_elo - 1000) * 2.5)
   WHERE current_elo > 1000;
   ```
3. **Implementar nuevo sistema** a partir del próximo simulacro
4. **Monitorear progresión** semanalmente

## 📊 Proyección con Sistema Nuevo

Con el sistema propuesto:
- **Estudiante Top**: 15-20 semanas a Élite
- **Estudiante Promedio**: 30-35 semanas a Élite
- **Estudiante Casual**: 40-45 semanas a Élite

Esto hace que sea **alcanzable pero desafiante** llegar a División Élite antes del 25 de octubre. 