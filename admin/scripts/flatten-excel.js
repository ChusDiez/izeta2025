import fs from 'fs/promises';
import path from 'path';

/**
 * Flatten all .xlsx/.xls files inside `currentDir` into `targetRoot`.
 * Recurses into sub‑directories, moving files up and deleting empty dirs.
 */
async function flattenDir(currentDir, targetRoot) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Recurse first
      await flattenDir(fullPath, targetRoot);

      // If directory is now empty (only maybe .DS_Store), remove it
      const remaining = (await fs.readdir(fullPath))
        .filter(f => f !== '.DS_Store');
      if (remaining.length === 0) {
        await fs.rm(fullPath, { recursive: true, force: true });
      }
      continue;
    }

    // ---------- File case ----------
    if (!entry.name.match(/\.xlsx?$/i)) continue;         // skip non‑Excel

    // Destination path in the *target root* directory
    let destName = entry.name;
    let destPath = path.join(targetRoot, destName);

    // Handle duplicates: add _1, _2, …
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
  try { await fs.access(p); return true; } catch { return false; }
}

// ---------- entry point ----------
const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Uso: node flatten-excel.js <carpeta-raiz>');
  process.exit(1);
}

await flattenDir(path.resolve(targetDir), path.resolve(targetDir));
console.log('✅ Carpeta aplanada');