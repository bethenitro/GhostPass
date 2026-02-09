#!/usr/bin/env node

/**
 * Fix ESM imports by adding .js extensions
 * Required for Vercel serverless functions
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiDir = join(__dirname, '..', 'api');

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        yield* walk(path);
      }
    } else if (entry.name.endsWith('.ts')) {
      yield path;
    }
  }
}

async function fixImports(filePath) {
  let content = await readFile(filePath, 'utf-8');
  let modified = false;

  // Fix relative imports without .js extension
  const importRegex = /from\s+['"](\.\.[\/\\][^'"]+)['"]/g;
  content = content.replace(importRegex, (match, path) => {
    if (!path.endsWith('.js') && !path.endsWith('.ts')) {
      modified = true;
      return match.replace(path, path + '.js');
    }
    return match;
  });

  if (modified) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`Fixed: ${filePath}`);
  }
}

async function main() {
  console.log('Fixing ESM imports in API folder...');
  let count = 0;
  
  for await (const file of walk(apiDir)) {
    await fixImports(file);
    count++;
  }
  
  console.log(`Processed ${count} files`);
}

main().catch(console.error);
