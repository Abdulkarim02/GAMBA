import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv(filepath) {
  try {
    return Object.fromEntries(
      readFileSync(filepath, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
        .filter(([k]) => k)
    );
  } catch { return {}; }
}

const env = loadEnv(resolve(root, '.env'));
const KEYS = ['KEY_LLM', 'KEY_SERPAPI', 'KEY_TMDB', 'KEY_SAFEBROWSING', 'KEY_SEC_LLM'];

const output = KEYS.map(k => `const ${k} = '${env[k] ?? ''}';`).join('\n') + '\n';

for (const dir of ['public', 'build']) {
  const dest = resolve(root, dir, 'keys.js');
  try {
    mkdirSync(resolve(root, dir), { recursive: true });
    writeFileSync(dest, output);
    console.log('wrote', dest);
  } catch (e) {
    console.warn('could not write', dest, e.message);
  }
}
