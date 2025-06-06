# 🔄 Instrucciones para Reset Completo del Sistema ELO/IP

## ⚠️ ADVERTENCIA IMPORTANTE
Este proceso **reseteará TODO el progreso de ELO/IP** de todos los usuarios. Es **IRREVERSIBLE** sin los backups.

## 📋 Pasos a Seguir (EN ORDEN)

### 1️⃣ Verificación Previa
Ejecuta en el SQL Editor de Supabase:
```sql
-- Archivo: verificar_antes_reset.sql
```
Este script te mostrará:
- Simulacros registrados
- Estadísticas del RF1
- Estado actual del sistema
- Qué se va a hacer

### 2️⃣ Arreglar la tabla elo_history (OBLIGATORIO)
**⚠️ IMPORTANTE: Este paso es OBLIGATORIO para evitar errores**

Ejecuta:
```sql
-- Archivo: arreglar_elo_history_completo.sql
```

O si tienes prisa, ejecuta solo:
```sql
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS elo_change integer DEFAULT 0;
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS score numeric(5,2);
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS simulation_id uuid;
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
```

### 2️⃣.5 Actualizar la función update_elo_for_simulation (NUEVO - IMPORTANTE)
**⚠️ CRÍTICO: La función debe incluir week_number en los INSERTs**

Ejecuta:
```sql
-- Archivo: fix_elo_function_week_number.sql
```

Este paso corrige el error: "null value in column week_number violates not-null constraint"

### 3️⃣ Ejecutar el Reset Completo
**Solo después de completar los pasos anteriores**, ejecuta:
```sql
-- Archivo: reset_y_recalcular_elo.sql
```

## 🚨 Errores Comunes

### Error: "column elo_change does not exist"
**Solución**: No saltaste el paso 2. Ejecuta:
```sql
ALTER TABLE elo_history ADD COLUMN IF NOT EXISTS elo_change integer DEFAULT 0;
```

### Error: "column simulation_id does not exist"
**Solución**: Ejecuta el script completo del paso 2.

### Error: "null value in column week_number violates not-null constraint"
**Solución**: No saltaste el paso 2.5. Ejecuta:
```sql
-- Archivo: fix_elo_function_week_number.sql
```

## 🎯 ¿Qué hace el script?

1. **Crea backups** de seguridad en:
   - `users_elo_backup_before_reset`
   - `elo_history_backup_before_reset`

2. **Resetea TODOS los usuarios** a 1000 IP

3. **Limpia** todo el historial de ELO

4. **Implementa** el nuevo sistema de cálculo:
   - Top 3: 60 puntos
   - Pos 4-10: 40 puntos
   - Pos 11-20: 20 puntos
   - Pos 21-30: 10 puntos
   - Resto: 0 puntos
   - Bonuses por racha y puntuación alta

5. **Recalcula** el simulacro RF1 con el nuevo sistema

## 📊 Resultado Esperado

Después del reset:
- **Todos los usuarios**: 1000 IP base
- **Participantes del RF1**: Entre 1010-1090 IP aproximadamente
  - Top 3: ~1070-1090 IP
  - Pos 4-10: ~1045-1055 IP
  - Pos 11-20: ~1020-1025 IP
  - Pos 21-30: ~1010 IP

## 🔄 Rollback (si es necesario)

Si necesitas revertir:
```sql
-- Restaurar ELO original
UPDATE users u
SET current_elo = b.current_elo
FROM users_elo_backup_before_reset b
WHERE u.id = b.id;

-- Restaurar historial
TRUNCATE TABLE elo_history;
INSERT INTO elo_history
SELECT * FROM elo_history_backup_before_reset;
```

## ✅ Verificación Post-Reset

Después del reset, verifica:
```sql
-- Ver top 10
SELECT username, current_elo 
FROM users 
ORDER BY current_elo DESC 
LIMIT 10;

-- Ver distribución
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN current_elo > 1000 THEN 1 END) as con_puntos,
    AVG(current_elo)::int as promedio
FROM users;
```

## 📢 Comunicación a Estudiantes

Mensaje sugerido:
> "Hemos actualizado el sistema de Índice de Progreso (IP) para hacerlo más justo y alcanzable. Todos comenzamos desde 1000 IP con un sistema más generoso de puntos. ¡Ahora es posible alcanzar la División Élite antes del 25 de octubre!"

## 🚀 Próximos Pasos

1. Actualizar las divisiones en el frontend (ver `actualizar_divisiones_frontend.js`)
2. Comunicar los cambios a los estudiantes
3. Monitorear el progreso semanalmente 