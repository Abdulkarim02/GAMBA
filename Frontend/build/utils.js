'use strict';

function sanitizeJSONStrings(text) {
  let out = '', inStr = false, esc = false;
  for (const ch of text) {
    if (esc)                  { out += ch; esc = false; continue; }
    if (ch === '\\' && inStr) { out += ch; esc = true;  continue; }
    if (ch === '"')           { inStr = !inStr; out += ch; continue; }
    if (inStr && ch === '\n') { out += '\\n'; continue; }
    if (inStr && ch === '\r') { out += '\\r'; continue; }
    if (inStr && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  return out;
}

function applyRepairs(str) {
  str = str.replace(/"([^"]*?)(action|label|color|note)"\s*:/g,
    (_, pre, k) => pre ? `"${pre}","${k}":` : `"${k}":`);
  str = str.replace(/,\s*"id"\s*:/g, ',{"id":');
  str = str.replace(/""\s*:\s*"(g\d+)"/g, '"id":"$1"');
  str = str.replace(/(?<=[{,]\s*)"(id|action|label|color|note)([^"]+)"/g, '"$1":"$2"');
  return sanitizeJSONStrings(str);
}

function extractAnnotations(text, s) {
  const results = [];
  let i = s + 1;
  while (i < text.length) {
    while (i < text.length && text[i] !== '{' && text[i] !== ']') i++;
    if (i >= text.length || text[i] === ']') break;

    let depth = 0, inStr = false, esc = false, j = i;
    while (j < text.length) {
      const ch = text[j++];
      if (esc)                  { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true;  continue; }
      if (ch === '"')           { inStr = !inStr; continue; }
      if (!inStr && ch === '{') depth++;
      if (!inStr && ch === '}' && --depth === 0) break;
    }
    if (depth !== 0) { i = j; continue; }

    try {
      const obj = JSON.parse(applyRepairs(text.slice(i, j)));
      if (obj && typeof obj === 'object') results.push(obj);
    } catch {}
    i = j;
  }
  return results;
}

function parseArray(text) {
  let s = -1, idx = 0;
  while ((idx = text.indexOf('[', idx)) !== -1) {
    if (text.startsWith('[gamba:', idx)) { idx++; continue; }
    const rest = text.slice(idx + 1).trimStart();
    if (rest.startsWith('{') || rest.startsWith(']')) { s = idx; break; }
    idx++;
  }
  if (s === -1) return [];

  const e = text.lastIndexOf(']');
  if (e > s) {
    try { const arr = JSON.parse(text.slice(s, e + 1)); if (Array.isArray(arr)) return arr; } catch {}
  }

  try {
    const arr = JSON.parse(applyRepairs(e > s ? text.slice(s, e + 1) : text.slice(s)));
    if (Array.isArray(arr)) return arr;
  } catch {}

  const lastBrace = text.lastIndexOf('}');
  if (lastBrace > s) {
    try {
      const arr = JSON.parse(applyRepairs(text.slice(s, lastBrace + 1) + ']'));
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }

  return extractAnnotations(text, s);
}

function buildElementMap(tagged) {
  if (!tagged?.length) return '';
  const vw    = tagged[0]?.vw || 1440;
  const vh    = tagged[0]?.vh || 900;
  const maxId = tagged[tagged.length - 1]?.id || 'g0';
  const lines = tagged.map(e => `  ${e.id} | ${e.tag} | "${e.text.slice(0, 100)}"`).join('\n');
  return `VALID IDs: g0 to ${maxId} only — any ID outside this range does not exist on the page.\n` +
    `AVAILABLE ELEMENTS — use ONLY these IDs (id | tag | text):\n\n` +
    `${lines}\n\n`;
}

function parseJSON(text, fallback) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) return fallback;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return fallback; }
}
