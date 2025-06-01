# IZETA 2025 - Sistema de Preparación Avanzada

## Estructura del Proyecto

- `/public` - Páginas accesibles por todos los usuarios
- `/admin` - Dashboard administrativo (requiere autenticación)
- `/assets` - Recursos estáticos (CSS, JS, imágenes)
- `/supabase` - Funciones Edge y configuración

## Configuración

1. Copia `assets/js/config.example.js` a `assets/js/config.js`
2. Añade tus credenciales de Supabase
3. No subas `config.js` a Git

## URLs principales

- Página principal: `/public/index.html`
- Enviar resultados: `/public/submit-results.html`
- Ranking público: `/public/leaderboard.html`
- Dashboard admin: `/admin/dashboard.html`