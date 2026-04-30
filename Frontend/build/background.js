'use strict';

importScripts('keys.js');    // KEY_LLM, KEY_SERPAPI, KEY_TMDB, KEY_SAFEBROWSING, KEY_SEC_LLM
importScripts('prompts.js'); // FORMAT_RULE, PROMPTS, CATEGORIES, fastClassify

console.log('GAMBA: service worker started');

const LLM_URL      = 'https://api.deepinfra.com/v1/openai/chat/completions';
const TMDB_BASE    = 'https://api.themoviedb.org/3';
const MODEL        = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
const VISION_MODEL = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
const GUARD_MODEL  = 'meta-llama/Llama-Guard-4-12B';

let currentController = null;

function abortCurrent() {
  if (currentController) { currentController.abort(); currentController = null; }
}

const _cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(url) {
  const c = _cache.get(url);
  return c && Date.now() - c.ts < CACHE_TTL ? c : null;
}

function setCache(url, payload) {
  _cache.set(url, { ...payload, ts: Date.now() });
}

async function callLLM(prompt, signal, { maxTokens = 2000, system = null, stream = true, screenshot = null, model: modelOverride = null } = {}) {
  const userContent = screenshot
    ? [ { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: screenshot } } ]
    : prompt;

  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: userContent }]
    : [{ role: 'user', content: userContent }];

  const model = modelOverride ?? (screenshot ? VISION_MODEL : MODEL);

  console.log('GAMBA: sending to LLM ───────────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────────');

  const res = await fetch(LLM_URL, {
    method:  'POST',
    signal:  signal instanceof AbortSignal ? signal : undefined,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_LLM}` },
    body:    JSON.stringify({ model, messages, temperature: 0.1, top_p: 1, max_tokens: maxTokens, stream }),
  });

  if (!res.ok) {
    console.warn('GAMBA: LLM HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return '';
  }

  if (!stream) {
    const text = (await res.json()).choices?.[0]?.message?.content?.trim() || '';
    console.log('GAMBA: LLM response ─────────────────────────');
    console.log(text);
    console.log('────────────────────────────────────────────');
    return text;
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let content   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
      } catch {}
    }
  }
  console.log('GAMBA: LLM response ─────────────────────────');
  console.log(content);
  console.log('────────────────────────────────────────────');
  return content;
}

async function callSecLLM(prompt, signal, maxTokens = 500) {
  return callLLM(prompt, signal, { maxTokens, stream: false, model: VISION_MODEL });
}

async function fetchTMDB(title) {
  try {
    const data = await fetch(
      `${TMDB_BASE}/search/multi?api_key=${KEY_TMDB}&query=${encodeURIComponent(title)}&include_adult=false`
    ).then(r => r.json()).catch(() => ({ results: [] }));

    const hits = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (!hits.length) return null;

    const top  = hits.reduce((b, r) => (r.vote_count || 0) > (b.vote_count || 0) ? r : b, hits[0]);
    const d    = await fetch(`${TMDB_BASE}/${top.media_type}/${top.id}?api_key=${KEY_TMDB}`).then(r => r.json());
    const year = (d.release_date || d.first_air_date || '').slice(0, 4);
    const rating  = d.vote_average ? `★${d.vote_average.toFixed(1)} (${(d.vote_count || 0).toLocaleString()} votes)` : 'No rating';
    const seasons = d.number_of_seasons ? ` | ${d.number_of_seasons} seasons` : '';
    const genres  = d.genres?.map(g => g.name).join(', ') || '';

    return `[Page title: "${title}"] → "${d.title || d.name}" (${year}) | ${top.media_type === 'tv' ? 'TV Show' + seasons : 'Movie'} | ${rating} | Genres: ${genres}`;
  } catch { return null; }
}

async function fetchTMDBSeason(tvId, season) {
  try {
    const data = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${season}?api_key=${KEY_TMDB}`).then(r => r.json()).catch(() => null);
    if (!data?.episodes?.length) return null;
    return data.episodes.map(ep => {
      const r = (ep.vote_average && ep.vote_count >= 5) ? ep.vote_average.toFixed(1) : '?';
      return `S${season}E${ep.episode_number} "${ep.name}" ★${r}`;
    }).join(' | ');
  } catch { return null; }
}

async function searchShopping(query) {
  try {
    const params = new URLSearchParams({ engine: 'google_shopping', q: query, api_key: KEY_SERPAPI, num: '10' });
    const res    = await fetch(`https://serpapi.com/search?${params}`);
    const data   = await res.json();
    if (!res.ok) return '';

    const items  = (data.shopping_results || []).slice(0, 10);
    const prices = items.map(r => parseFloat((r.price || '').replace(/[^0-9.]/g, ''))).filter(p => p > 0);
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const clean  = median > 0 ? prices.filter(p => p >= median / 3 && p <= median * 3) : prices;
    const avg    = clean.length ? (clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2) : null;
    const symbol = (items.find(r => r.price)?.price || '').match(/^[^\d]*/)?.[0]?.trim() || '';
    const lines  = items.map(r => `• ${r.title} — ${r.price} (${r.source})${r.rating ? ` ★${r.rating}` : ''}`).join('\n');

    return (avg ? `Market average (${clean.length} listings): ${symbol}${avg}\n\n` : '') + lines;
  } catch { return ''; }
}

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
  // value+key merged: "g33action":"x" → "g33","action":"x"
  str = str.replace(/"([^"]*?)(action|label|color|note)"\s*:/g,
    (_, pre, k) => pre ? `"${pre}","${k}":` : `"${k}":`);
  // missing '{' before "id"
  str = str.replace(/,\s*"id"\s*:/g, ',{"id":');
  // empty-string key: {"":"g12"} → {"id":"g12"}
  str = str.replace(/""\s*:\s*"(g\d+)"/g, '"id":"$1"');
  // colon dropped: "colorblue" → "color":"blue"
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

  // lastIndexOf(']') may land inside a string value — truncate at last '}'
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
  const lines = tagged.map(e => {
    const pos = e.w != null ? ` | x:${e.x} y:${e.y} w:${e.w} h:${e.h}` : '';
    return `  ${e.id} | ${e.tag}${pos} | "${e.text.slice(0, 100)}"`;
  }).join('\n');
  return `VIEWPORT: ${vw}x${vh}px\n` +
    `VALID IDs: g0 to ${maxId} only — any ID outside this range does not exist on the page.\n` +
    `AVAILABLE ELEMENTS — use ONLY these IDs (id | tag | x y w h pixels | text):\n` +
    `  x near 0 or ${vw} = sidebar/nav. x near ${Math.round(vw/2)} = main content.\n` +
    `  Large w*h = prominent hero/card. Small w*h = label/secondary. Low y = near top.\n\n` +
    `${lines}\n\n`;
}

function parseJSON(text, fallback) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) return fallback;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return fallback; }
}


const THREAT_TYPES = [
  'None', 'Tracking', 'Keylogger', 'Formjacking', 'Data Exfiltration',
  'Phishing', 'Ad Phishing', 'Ad Injection', 'Cryptomining', 'Malware',
  'Redirect Attack', 'Clickjacking', 'Scareware', 'Session Hijacking',
];
const THREAT_RANK = { Safe: 0, Suspicious: 1, Malicious: 2 };

async function checkSafeBrowsing(pageUrl, domains) {
  if (!KEY_SAFEBROWSING) return [];
  const urls = [pageUrl, ...domains.map(d => `https://${d}`)].slice(0, 500);
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${KEY_SAFEBROWSING}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'gamba-extension', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: urls.map(u => ({ url: u })),
          },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches || [];
  } catch { return []; }
}

// Llama Guard 4 category codes → human-readable threat types
const GUARD_CATEGORY_MAP = {
  S1: 'Malware',           // Violent Crimes / destructive code
  S2: 'Phishing',          // Non-Violent Crimes — fraud, scams, phishing
  S3: 'Data Exfiltration', // Privacy violations — stealing personal data
  S4: 'Malware',           // Malicious code / exploitation
  S5: 'Scareware',         // Defamation / fake warnings
  S6: 'Ad Phishing',       // Misleading ads / financial scams
  S7: 'Tracking',          // Privacy — behavioral tracking
  S8: 'Session Hijacking', // Credential / session theft
};

async function checkLlamaGuard(pageUrl, html, signal) {
  try {
    const content = `URL: ${pageUrl}\n\nPAGE CONTENT (first 3000 chars):\n${html.slice(0, 3000)}`;
    const res = await fetch(LLM_URL, {
      method: 'POST',
      signal: signal instanceof AbortSignal ? signal : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_LLM}` },
      body: JSON.stringify({
        model: GUARD_MODEL,
        messages: [{ role: 'user', content }],
        max_tokens: 100,
        stream: false,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = (json.choices?.[0]?.message?.content || '').trim().toLowerCase();
    console.log('GAMBA: Llama Guard response:', text);

    if (text.startsWith('safe')) return null;

    // Parse "unsafe\nS2,S5" or "unsafe\nS2\nS5"
    const codes = [...text.matchAll(/s(\d+)/gi)].map(m => `S${m[1]}`);
    const threats = [...new Set(codes.map(c => GUARD_CATEGORY_MAP[c]).filter(Boolean))];
    const threatType = threats[0] || 'Malware';

    return {
      label: 'Llama Guard 4',
      threatType,
      summary: `Llama Guard flagged this page as unsafe. Violated categories: ${codes.join(', ')}. Mapped threats: ${threats.join(', ') || threatType}.`,
      threats: codes.map(c => `${c}: ${GUARD_CATEGORY_MAP[c] || 'Unknown'}`),
    };
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('GAMBA: Llama Guard failed', e.message);
    return null;
  }
}

async function fetchScript(s, signal) {
  const m = s.match(/^<script src="([^"]+)">/);
  if (!m) return { url: 'inline', code: s };
  const url = m[1];
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return { url, code: null };
    return { url, code: await res.text() };
  } catch { return { url, code: null }; }
}

async function analyzeSecurity(html, scripts, signal, pageUrl = '', head = '', domains = [], forms = [], links = []) {
  // Phase 1 (parallel): fetch script content + run Llama Guard
  const [resolved, guardResult] = await Promise.all([
    Promise.all(scripts.slice(0, 8).map(s => fetchScript(s, signal))),
    checkLlamaGuard(pageUrl, html, signal),
  ]);
  const scannable = resolved.filter(s => s.code);

  // Phase 2: single batched LLM call — analyze HTML + all scripts + produce verdict in one shot
  const formsBlock   = forms.length   ? `\nFORMS:\n${forms.join('\n')}` : '';
  const domainBlock  = domains.length ? `\nEXTERNAL DOMAINS: ${domains.join(', ')}` : '';
  const linksBlock   = links.length   ? `\nEXTERNAL LINKS (display text → href):\n${links.join('\n')}` : '';
  const scriptsBlock = scannable.length
    ? '\n\n' + scannable.map(({ url, code }, i) => {
        let label = url;
        try { label = new URL(url).hostname + new URL(url).pathname; } catch {}
        return `--- SCRIPT ${i + 1}: ${label} ---\n${code.slice(0, 8000)}`;
      }).join('\n\n')
    : '';

  const raw = await callSecLLM(
    `You are a cybersecurity analyst. Analyze this page and its scripts. Reply with ONLY a JSON object — no markdown, no extra text.

{"category":"Safe","score":100,"threatsCount":0,"summary":"No threats detected."}

Rules:
- category: exactly "Safe" | "Suspicious" | "Malicious"
- score: 100=completely safe, 0=extremely dangerous
- threatsCount: number of distinct threats found
- summary: 1-2 sentences plain English — name tracking companies if present (e.g. "Shares data with Google Analytics and LinkedIn Ads.")
- Phishing/Malware/Formjacking/Keylogger → Malicious, score<30
- Tracking alone → Safe

PHISHING: URL domain ≠ displayed brand → Phishing. Form submits to different domain → Phishing. Login/payment fields on wrong domain → Phishing. Urgency language ("verify now", "account suspended") → Phishing. Link text says one brand but href points to a different domain → Phishing.
SCRIPTS: keydown listener capturing input → Keylogger. Reading form fields + external fetch → Formjacking. eval/atob/obfuscated strings → Malware. Cookies/localStorage sent externally → Session Hijacking. Heavy CPU/WebAssembly loops → Cryptomining.

PAGE URL: ${pageUrl}
PAGE HEAD: ${head}${formsBlock}${domainBlock}${linksBlock}

HTML:
${html.slice(0, 15000)}${scriptsBlock}`,
    signal, 300
  );

  const parsed       = parseJSON(raw, null);
  let category     = ['Safe','Suspicious','Malicious'].find(c => parsed?.category === c) || 'Unknown';
  let score        = parseInt(parsed?.score,        10) || 50;
  let threatsCount = parseInt(parsed?.threatsCount, 10) || 0;
  let summary      = parsed?.summary || 'Security analysis unavailable.';

  if (guardResult) {
    if (category !== 'Malicious') { category = 'Suspicious'; score = Math.min(score, 40); }
    threatsCount++;
    summary = `${summary} Llama Guard: ${guardResult.summary}`;
  }

  console.log('GAMBA: verdict ───', { category, score, threatsCount, summary });
  return { category, score, threatsCount, summary };
}

async function classifyPage(url, head, signal) {
  try {
    const raw = await callLLM(
      `Classify this web page. Reply with EXACTLY one word from the list — nothing else, no punctuation, no explanation.

COMPETITIVE_PROGRAMMING — coding challenge / algorithm problem (LeetCode, Codeforces, HackerRank); has time/memory limits, input/output format, sample test cases
EDUCATION — learning content: Wikipedia, online courses, tutorials, textbooks, study guides, how-to explanations
NEWS — journalism or opinion: news articles, press releases, blog posts about current events
SHOPPING — e-commerce or marketplace: product listings, single product pages, used/second-hand listings
DOCUMENTATION — technical reference: API docs, function/method reference, Stack Overflow, GitHub READMEs
FINANCE — financial data: stocks, crypto, banking, investment rates, loan calculators, economic indicators
ENTERTAINMENT — streaming (Netflix, YouTube), social media, gaming, music, anime/movie databases
GENERAL — anything that does not clearly fit any category above

PAGE URL: ${url}
PAGE HEAD:
${head}`,
      signal,
      { maxTokens: 10, stream: false }
    );

    const match = CATEGORIES.find(c => raw.trim().toUpperCase().includes(c));
    const category = match || 'GENERAL';
    console.log('GAMBA: category =', category);
    return category;
  } catch {
    return 'GENERAL';
  }
}

async function analyzeContent(url, html, head, signal, elemMap = '', screenshot = null) {
  // URL heuristic skips the classifyPage LLM call for known sites
  const fast = fastClassify(url);
  const category = fast ?? await classifyPage(url, head, signal);
  if (fast) console.log('GAMBA: category = ', category, '(fast)');
  const content  = elemMap + html.slice(0, 40000);

  if (category === 'SHOPPING') {
    const year = new Date().getFullYear();
    const queryRaw = await callLLM(
      `You are reading a shopping page. Reply with ONE search query to find comparable items at current market prices.

Rules:
- PRODUCT page  → key specs only, not brand/model: e.g. "QD-OLED 27-inch 240Hz gaming monitor USD ${year}"
- USED listing  → brand + model number only: e.g. "iPhone 15 Pro 256GB used"
- LISTING page  → reply with exactly the word: LISTING

Reply with ONLY the query string or the word LISTING.

PAGE:
${content.slice(0, 15000)}`,
      signal,
      { maxTokens: 50, stream: false }
    );

    const query     = queryRaw.trim().replace(/^["']|["']$/g, '');
    const isListing = query.toUpperCase() === 'LISTING';
    const market    = !isListing ? await searchShopping(query) : '';
    const typeHint  = isListing
      ? '⚑ PAGE IS A LISTING (grid of multiple products). Follow ONLY the "LISTING PAGE" section — output exactly 4 annotations.\n\n'
      : '⚑ PAGE IS A SINGLE ITEM (product detail or used listing). Follow ONLY the "PRODUCT PAGE" or "USED LISTING" section.\n\n';
    const raw = await callLLM(typeHint + PROMPTS.SHOPPING.user(content, market), signal, { maxTokens: 3000, system: PROMPTS.SHOPPING.system, screenshot });
    return { category, annotations: parseArray(raw) };
  }

  if (category === 'ENTERTAINMENT') {
    const typeRaw = await callLLM(
      `Analyze this entertainment page and classify it. Reply with ONLY valid JSON — no explanation, no markdown.

Return exactly one of:
- {"type":"episode_list","show":"Exact Show Name","season":1}
- {"type":"multi_show","titles":["Title 1","Title 2", ... up to 25]}
- {"type":"single","title":"Exact Title"}

Rules: copy titles exactly as shown, strip trailing site names only (e.g. "— Netflix"), default season to 1 if unknown.

PAGE HEAD:
${head}

PAGE CONTENT:
${content.slice(0, 20000)}`,
      signal,
      { maxTokens: 500, stream: false }
    );

    let pageType = null;
    try { const s = typeRaw.indexOf('{'), e = typeRaw.lastIndexOf('}'); if (s !== -1 && e > s) pageType = JSON.parse(typeRaw.slice(s, e + 1)); } catch {}

    const cat = PROMPTS.ENTERTAINMENT;

    if (pageType?.type === 'episode_list' && pageType.show) {
      const [search, show] = await Promise.all([
        fetch(`${TMDB_BASE}/search/tv?api_key=${KEY_TMDB}&query=${encodeURIComponent(pageType.show)}`).then(r => r.json()).catch(() => ({ results: [] })),
        fetchTMDB(pageType.show),
      ]);
      const tvId   = search.results?.[0]?.id;
      const epData = tvId ? await fetchTMDBSeason(tvId, pageType.season || 1) : null;
      const raw    = await callLLM(cat.user(`SHOW INFO: ${show || pageType.show}\n\n${content}`, '', false, epData), signal, { maxTokens: 3000, system: cat.system, screenshot });
      return { category, annotations: parseArray(raw) };
    }

    if (pageType?.type === 'multi_show' && pageType.titles?.length) {
      const tmdbResults = await Promise.all(pageType.titles.slice(0, 25).map(t => fetchTMDB(t)));
      const tmdbBlock   = tmdbResults.filter(Boolean).join('\n');
      const raw         = await callLLM(cat.user(content, tmdbBlock, true), signal, { maxTokens: 3000, system: cat.system, screenshot });
      return { category, annotations: parseArray(raw) };
    }

    const title = pageType?.title || (() => {
      const m = head.match(/<title>([^<]+)<\/title>/i);
      return (m?.[1] || '').replace(/\s*[-–|:]\s*[^-–|:]+$/, '').trim();
    })();
    const tmdb = title ? await fetchTMDB(title) : '';
    const raw  = await callLLM(cat.user(content, tmdb || ''), signal, { maxTokens: 2000, system: cat.system, screenshot });
    return { category, annotations: parseArray(raw) };
  }

  const p   = PROMPTS[category] || PROMPTS.GENERAL;
  const raw = await callLLM(p.user(content), signal, { maxTokens: 2000, system: p.system, screenshot });
  return { category, annotations: parseArray(raw) };
}

function safeSendMessage(tabId, message) {
  if (message.type === 'INJECT_CONTENT' && message.annotations?.length) {
    console.log('GAMBA: injecting annotations ────────────────');
    console.log(JSON.stringify(message.annotations, null, 2));
    console.log('────────────────────────────────────────────');
  }
  chrome.tabs.sendMessage(tabId, message, () => { chrome.runtime.lastError; });
}

const performAnalysis = async ({ tabId, url, html, head = '', scripts = [], tagged = [], forceRefresh = false, domains = [], forms = [], links = [] }) => {
  abortCurrent();
  currentController = new AbortController();
  const { signal } = currentController;

  const { selectedMode } = await chrome.storage.local.get(['selectedMode']);
  const mode = selectedMode || 'Both';

  if (forceRefresh) _cache.delete(url);

  const cached = getCached(url);
  if (cached) {
    console.log('GAMBA: cache hit for', url);
    if (cached.annotations?.length && tabId) safeSendMessage(tabId, { type: 'INJECT_CONTENT', annotations: cached.annotations });
    await chrome.storage.local.set({ currentAnalysis: { url, data: cached.data, timestamp: Date.now() } });
    return;
  }

  let data = { category: 'Unknown', score: 0, pageEdits: 0, threatsCount: 0, summary: '' };

  const elemMap  = buildElementMap(tagged);
  const validIds = new Set(tagged.map(t => t.id));

  const filterAnnotations = (annotations) => {
    const valid = annotations.filter(a => validIds.has(a.id));
    const dropped = annotations.length - valid.length;
    if (dropped > 0) console.warn(`GAMBA: dropped ${dropped} hallucinated IDs`);
    return valid;
  };

  // Capture screenshot for vision-enhanced content analysis
  let screenshot = null;
  try {
    screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
  } catch (e) {
    console.warn('GAMBA: screenshot failed', e.message);
  }

  try {
    if (mode === 'Malicious Code') {
      data = await analyzeSecurity(html, scripts, signal, url, head, domains, forms, links);
      setCache(url, { data, annotations: [] });

    } else if (mode === 'AI') {
      const { category, annotations } = await analyzeContent(url, html, head, signal, elemMap, screenshot);
      data.category = category;
      const safe = filterAnnotations(annotations);
      if (tabId) safeSendMessage(tabId, { type: 'INJECT_CONTENT', annotations: safe, forceRefresh });
      setCache(url, { data, annotations: safe });

    } else {
      const [secData, contentData] = await Promise.all([
        analyzeSecurity(html, scripts, signal, url, head, domains, forms, links),
        analyzeContent(url, html, head, signal, elemMap, screenshot),
      ]);
      data = { ...secData, category: contentData.category };
      const safe = filterAnnotations(contentData.annotations);
      if (tabId) safeSendMessage(tabId, { type: 'INJECT_CONTENT', annotations: safe, forceRefresh });
      setCache(url, { data, annotations: safe });
    }

    await chrome.storage.local.set({ currentAnalysis: { url, data, timestamp: Date.now() } });

  } catch (err) {
    if (err.name !== 'AbortError') { console.error('GAMBA: analysis error:', err); throw err; }
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) abortCurrent();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) safeSendMessage(activeInfo.tabId, { type: 'EXTRACT_PAGE' });
  } catch {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('GAMBA: message received:', message.type);
  if (message.type === 'CONTENT_READY') {
    safeSendMessage(sender.tab.id, { type: 'EXTRACT_PAGE' });
    return;
  }

  if (message.type === 'ANALYZE_URL') {
    performAnalysis({
      tabId:        sender.tab?.id,
      url:          message.url,
      html:         message.html,
      head:         message.head         || '',
      scripts:      message.scripts      || [],
      tagged:       message.tagged       || [],
      forceRefresh: message.forceRefresh || false,
      domains:      message.domains      || [],
      forms:        message.forms        || [],
      links:        message.links        || [],
    })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
