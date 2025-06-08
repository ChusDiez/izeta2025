import fs from 'fs/promises';
import path from 'path';

/**
 * Recursively move every .xlsx/.xls file found under `currentDir`
 * to the root directory (`targetRoot`). After moving, delete any
 * directories that end up empty (ignoring hidden files like .DS_Store).
 */
async function flattenDir(currentDir, targetRoot) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await flattenDir(fullPath, targetRoot);

      // Remove the directory if now empty (ignoring .DS_Store)
      const remaining = (await fs.readdir(fullPath))
        .filter(f => f !== '.DS_Store');
      if (remaining.length === 0) {
        await fs.rm(fullPath, { recursive: true, force: true });
      }
      continue;
    }

    // Skip non‑Excel files
    if (!entry.name.match(/\.xlsx?$/i)) continue;

    // Build destination path in root
    let destName = entry.name;
    let destPath = path.join(targetRoot, destName);

    // If a file with the same name exists, append _1, _2, etc.
    let i = 1;
    while (await exists(destPath)) {
      destName = entry.name.replace(/\.xlsx?$/i, `_${i++}$&`);
      destPath = path.join(targetRoot, destName);
    }

    await fs.rename(fullPath, destPath);
    console.log(`📄 ${entry.name} → ${destName}`);
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------- entry point ----------
const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Uso: node flatten-excel.js <carpeta-raiz>');
  process.exit(1);
}

await flattenDir(path.resolve(targetDir), path.resolve(targetDir));
console.log('✅ Carpeta aplanada');