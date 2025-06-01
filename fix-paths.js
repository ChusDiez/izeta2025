// fix-paths.js
const fs = require('fs');
const path = require('path');

function fixPaths(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Arreglar rutas de scripts
    content = content.replace(/src="\.\.\/assets\//g, 'src="/assets/');
    content = content.replace(/href="\.\.\/assets\//g, 'href="/assets/');
    
    // Arreglar rutas de navegación en archivos admin
    if (filePath.includes('admin/')) {
        content = content.replace(/href="\.\.\/public\//g, 'href="/public/');
        content = content.replace(/href="dashboard\.html"/g, 'href="/admin/dashboard.html"');
        content = content.replace(/href="login\.html"/g, 'href="/admin/login.html"');
        
        // Arreglar window.location
        content = content.replace(/window\.location\.href = 'dashboard\.html'/g, "window.location.href = '/admin/dashboard.html'");
        content = content.replace(/window\.location\.href = 'login\.html'/g, "window.location.href = '/admin/login.html'");
        content = content.replace(/window\.location\.href = '\.\.\/public\//g, "window.location.href = '/public/");
    }
    
    // Arreglar rutas en archivos public
    if (filePath.includes('public/')) {
        content = content.replace(/href="\.\.\/admin\//g, 'href="/admin/');
        content = content.replace(/window\.location\.href = '\.\.\/admin\//g, "window.location.href = '/admin/");
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✓ Arreglado: ${filePath}`);
}

// Arreglar todos los archivos HTML
const htmlFiles = [
    'admin/login.html',
    'admin/dashboard.html',
    'public/index.html',
    'public/leaderboard.html',
    'public/submit-results.html',
    'public/Caballo_20.html',
    'public/Alfil_36.html',
    'public/Torre_48.html',
    'public/Sistema_ELO.html'
];

console.log('🔧 Arreglando rutas...\n');

htmlFiles.forEach(file => {
    fixPaths(file);
});

console.log('\n✅ Rutas arregladas!');