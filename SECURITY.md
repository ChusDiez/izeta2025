# 🔒 Guía de Seguridad - IZETA 2025

## 📋 Resumen de la Migración de Seguridad

### ✅ Cambios Realizados

1. **Centralización de credenciales** en `assets/js/env-config.js`
2. **Eliminación de credenciales hardcodeadas** en 6 archivos HTML
3. **Creación de sistema de configuración** flexible para desarrollo/producción
4. **Actualización de .gitignore** para proteger archivos sensibles

### 📁 Archivos Actualizados

#### Frontend (credenciales públicas centralizadas):
- ✅ `/assets/js/config.js` - Actualizado para usar configuración centralizada
- ✅ `/public/submit-results.html` - Credenciales removidas
- ✅ `/admin/dashboard.html` - Usando nuevo sistema
- ✅ `/admin/bulk-users.html` - Credenciales removidas
- ✅ `/admin/elo_manual.html` - Credenciales removidas
- ✅ `/admin/login.html` - Credenciales removidas
- ✅ `/admin/scripts/test_weekly_update.html` - Credenciales removidas

#### Nuevos archivos de configuración:
- 📄 `/assets/js/env-config.js` - Configuración de producción
- 📄 `/assets/js/env-config.local.example.js` - Plantilla para desarrollo
- 📄 `/assets/js/config-loader.js` - Cargador inteligente (opcional)
- 📄 `/.env.example` - Plantilla de variables de entorno
- 📄 `/SECURITY.md` - Esta documentación

## 🚀 Guía de Implementación

### Para Desarrollo Local

1. **Copiar la plantilla de configuración**:
   ```bash
   cp assets/js/env-config.local.example.js assets/js/env-config.local.js
   ```

2. **Editar con tus credenciales reales**:
   ```javascript
   const ENV_CONFIG = {
       SUPABASE_URL: 'tu_supabase_url_aqui',
       SUPABASE_ANON_KEY: 'tu_supabase_anon_key_aqui',
       BASE_PATH: '', // Vacío para desarrollo local
       APP_NAME: 'IZETA 2025 - DEV'
   };
   ```

3. **El archivo está en .gitignore**, no se subirá a Git

### Para Producción (GitHub Pages)

1. **El archivo `env-config.js` contiene las credenciales de producción**
2. **GitHub Pages usará automáticamente este archivo**
3. **No necesitas hacer cambios adicionales**

### Para Supabase Functions

Las funciones Edge ya están configuradas correctamente para usar variables de entorno:
- `SUPABASE_URL` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

Configúralas en el dashboard de Supabase:
1. Ve a Settings → Edge Functions
2. Añade las variables de entorno necesarias

## 🔐 Mejores Prácticas de Seguridad

### ✅ LO QUE DEBES HACER:

1. **Usar siempre el sistema de configuración centralizado**
2. **Mantener `env-config.local.js` fuera del control de versiones**
3. **Rotar las credenciales periódicamente**
4. **Usar diferentes credenciales para desarrollo y producción**
5. **Configurar las variables de entorno en Supabase Dashboard**

### ❌ LO QUE NO DEBES HACER:

1. **NUNCA hardcodear credenciales en archivos**
2. **NUNCA commitear archivos `.local.js`**
3. **NUNCA compartir credenciales por canales inseguros**
4. **NUNCA usar la Service Role Key en el frontend**

## 🔄 Proceso de Rotación de Credenciales

Si necesitas cambiar las credenciales:

1. **Genera nuevas credenciales en Supabase**
2. **Actualiza `env-config.js` para producción**
3. **Actualiza `env-config.local.js` para desarrollo**
4. **Actualiza las variables de entorno en Supabase Functions**
5. **Despliega los cambios**
6. **Verifica que todo funcione**
7. **Revoca las credenciales antiguas**

## 📊 Arquitectura de Seguridad

```
┌─────────────────────────────────────────┐
│          GitHub Pages (Frontend)         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     env-config.js (Público)     │   │
│  │  - SUPABASE_URL                 │   │
│  │  - SUPABASE_ANON_KEY           │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Supabase Backend              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Edge Functions (Privado)      │   │
│  │  - SUPABASE_SERVICE_ROLE_KEY   │   │
│  │  - RESEND_API_KEY              │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## 🛠️ Solución de Problemas

### Error: "No se encontró configuración de entorno"
- Verifica que `env-config.js` esté en la ubicación correcta
- Para desarrollo, crea `env-config.local.js`

### Error: "Invalid API key"
- Verifica que las credenciales sean correctas
- Asegúrate de usar las credenciales del entorno correcto

### Las funciones Edge no funcionan
- Verifica las variables de entorno en Supabase Dashboard
- Revisa los logs de las funciones Edge

## 📞 Contacto

Si tienes dudas sobre la implementación de seguridad, contacta al equipo de desarrollo.

---

**Última actualización**: Enero 2025 