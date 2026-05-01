'use strict';

importScripts('keys.js');     // KEY_LLM, KEY_SERPAPI, KEY_TMDB, KEY_SAFEBROWSING, KEY_SEC_LLM
importScripts('config.js');   // LLM_URL, TMDB_BASE, MODEL, VISION_MODEL, GUARD_MODEL
importScripts('utils.js');    // parseArray, parseJSON, buildElementMap, applyRepairs, …
importScripts('prompts.js');  // FORMAT_RULE, PROMPTS, CATEGORIES, fastClassify
importScripts('api.js');      // fetchTMDB, fetchTMDBSeason, searchShopping, fetchScript
importScripts('llm.js');      // callLLM, callSecLLM
importScripts('security.js'); // analyzeSecurity, checkLlamaGuard, checkSafeBrowsing

console.log('GAMBA: service worker started');

let currentController = null;

function abortCurrent() {
  if (currentController) { currentController.abort(); currentController = null; }
}

const _cache    = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(url) {
  const c = _cache.get(url);
  return c && Date.now() - c.ts < CACHE_TTL ? c : null;
}

function setCache(url, payload) {
  _cache.set(url, { ...payload, ts: Date.now() });
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

    const match    = CATEGORIES.find(c => raw.trim().toUpperCase().includes(c));
    const category = match || 'GENERAL';
    console.log('GAMBA: category =', category);
    return category;
  } catch {
    return 'GENERAL';
  }
}

async function analyzeContent(url, html, head, signal, elemMap = '', screenshot = null) {
  const fast     = fastClassify(url);
  const category = fast ?? await classifyPage(url, head, signal);
  if (fast) console.log('GAMBA: category =', category, '(fast)');
  const content  = elemMap + html.slice(0, 80000);

  if (category === 'SHOPPING') {
    const year     = new Date().getFullYear();
    const queryRaw = await callLLM(
      `You are reading a shopping page. Reply with ONE search query to find comparable items at current market prices.

Rules:
- PRODUCT page  → key specs only, not brand/model: e.g. "QD-OLED 27-inch 240Hz gaming monitor USD ${year}"
- USED listing  → brand + model number only: e.g. "iPhone 15 Pro 256GB used"
- LISTING page  → reply with exactly the word: LISTING

Reply with ONLY the query string or the word LISTING.

PAGE:
${content.slice(0, 30000)}`,
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
${content.slice(0, 40000)}`,
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
    const valid   = annotations.filter(a => validIds.has(a.id));
    const dropped = annotations.length - valid.length;
    if (dropped > 0) console.warn(`GAMBA: dropped ${dropped} hallucinated IDs`);
    return valid;
  };

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
