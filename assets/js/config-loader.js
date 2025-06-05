// config-loader.js - Cargador inteligente de configuración
// Este archivo detecta el entorno y carga la configuración apropiada

(function() {
    'use strict';
    
    // Detectar si estamos en desarrollo local
    const isLocalDevelopment = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname.includes('192.168.');
    
    // Detectar si estamos en GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    // Función para cargar script dinámicamente
    function loadScript(src, onLoad) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onLoad;
        script.onerror = function() {
            console.error('Error cargando configuración:', src);
        };
        document.head.appendChild(script);
    }
    
    // Determinar qué configuración cargar
    if (isLocalDevelopment) {
        // Intentar cargar configuración local primero
        loadScript('/assets/js/env-config.local.js', function() {
            console.log('✅ Configuración local cargada');
            // Si falla, cargar la configuración por defecto
            if (typeof ENV_CONFIG === 'undefined') {
                loadScript('/assets/js/env-config.js');
            }
        });
    } else {
        // En producción, cargar configuración de producción
        const basePath = isGitHubPages ? '/izeta2025' : '';
        loadScript(basePath + '/assets/js/env-config.js', function() {
            console.log('✅ Configuración de producción cargada');
        });
    }
    
    // Agregar información útil al objeto window para debugging
    window.ENV_INFO = {
        isLocalDevelopment,
        isGitHubPages,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        pathname: window.location.pathname
    };
})(); 