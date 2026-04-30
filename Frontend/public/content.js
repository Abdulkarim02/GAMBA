console.log('CONTENT SCRIPT LOADED');

const COLORS = {
  green:  { bg: '#28C76F', light: '#e8fff3' },
  blue:   { bg: '#007AFF', light: '#e8f1ff' },
  orange: { bg: '#FF9F43', light: '#fff5e8' },
  red:    { bg: '#EA5455', light: '#fff0f0' },
  purple: { bg: '#9333ea', light: '#f5f0ff' },
};

chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: window.location.href });

// ── Loader ───────────────────────────────────────────────────────
const LOADER_PHASES = ['Reading page…', 'Classifying content…', 'Analyzing with AI…', 'Generating insights…'];

function showLoader() {
  if (document.getElementById('gamba-badge')) return;
  const style = document.createElement('style');
  style.id = 'gamba-loader-style';
  style.textContent = `
    @keyframes gamba-dot-pulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.6);opacity:1} }
    @keyframes gamba-badge-in  { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
  `;
  document.head.appendChild(style);
  const c = '#38bdf8';
  const badge = document.createElement('div');
  badge.id = 'gamba-badge';
  badge.style.cssText = `all:initial;position:fixed;bottom:28px;left:50%;transform:translateX(-50%);direction:ltr;unicode-bidi:isolate;background:#0c1524ee;border:1px solid ${c}55;color:${c};font-family:system-ui,sans-serif;font-size:13px;font-weight:600;padding:9px 20px 9px 14px;border-radius:24px;z-index:2147483647;box-shadow:0 4px 20px #00000066;pointer-events:none;display:flex;align-items:center;gap:10px;white-space:nowrap;animation:gamba-badge-in .3s ease forwards;`;
  const dots = [0,1,2].map(i => `<span style="width:5px;height:5px;border-radius:50%;background:${c};display:inline-block;animation:gamba-dot-pulse 1s ease-in-out infinite;animation-delay:${i*0.2}s;"></span>`).join('');
  badge.innerHTML = `<span style="font-size:15px;">◈</span> GAMBA &nbsp;<span style="display:inline-flex;gap:4px;align-items:center;">${dots}</span>&nbsp; <span id="gamba-phase" style="opacity:.7;font-size:11px;">${LOADER_PHASES[0]}</span>`;
  document.body.appendChild(badge);
  let phaseIdx = 0;
  badge._phaseTimer = setInterval(() => {
    phaseIdx = (phaseIdx + 1) % LOADER_PHASES.length;
    const el = document.getElementById('gamba-phase');
    if (el) el.textContent = LOADER_PHASES[phaseIdx];
  }, 3000);
  badge._timer = setTimeout(hideLoader, 90000);
}

function hideLoader() {
  const badge = document.getElementById('gamba-badge');
  if (badge) { clearTimeout(badge._timer); clearInterval(badge._phaseTimer); badge.remove(); }
  document.getElementById('gamba-loader-style')?.remove();
}

// ── Extract & Tag ────────────────────────────────────────────────
// Assigns data-gamba-id to every visible text-bearing element,
// then returns a stripped HTML snapshot for the AI.
function extractAndTag() {
  document.querySelectorAll('[data-gamba-id]').forEach(el => el.removeAttribute('data-gamba-id'));

  let gid = 0;
  const tagged = [];
  const seen = new Set();

  // Always root from document.body — narrowing to sub-elements consistently picks wrong containers.
  // isChrome() handles nav/header/footer filtering instead.
  const root = document.body;

  function isChrome(el) {
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const tag = cur.tagName?.toLowerCase();
      if (['nav','header','footer','aside'].includes(tag)) return true;
      const role = cur.getAttribute?.('role') || '';
      if (['navigation','banner','contentinfo','complementary'].includes(role)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function stamp(el) {
    if (!el || seen.has(el) || isChrome(el)) return;
    const text = (el.textContent || el.innerText || '').trim();
    if (!text || text.length < 3) return;
    seen.add(el);
    const id = `g${gid++}`;
    el.setAttribute('data-gamba-id', id);
    const base = el.tagName.toLowerCase();
    const ip = el.getAttribute('itemprop');
    const td = el.getAttribute('data-testid') || el.getAttribute('data-qa');
    const rect = el.getBoundingClientRect();
    const vw   = Math.round(window.innerWidth  || 1);
    const vh   = Math.round(window.innerHeight || 1);
    tagged.push({
      id,
      tag:  ip ? `${base}[${ip}]` : td ? `${base}[${td}]` : base,
      text: text.slice(0, 120),
      x:  Math.round(rect.left),
      y:  Math.round(rect.top + (window.scrollY || 0)),
      w:  Math.round(rect.width),
      h:  Math.round(rect.height),
      vw,
      vh,
    });
  }

  const SEMANTIC = new Set(['h1','h2','h3','h4','h5','h6','p','li','td','th','dt','dd',
    'blockquote','caption','figcaption','label','button','a','time','mark','code','pre','cite','q']);
  const SKIP_TAGS = new Set(['script','style','noscript','template','svg','canvas','iframe','head']);

  function canStamp(el) {
    if (!el || typeof el.tagName !== 'string') return false;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return false;
    const elId = el.id || '';
    const elCls = typeof el.className === 'string' ? el.className : '';
    if (elId.startsWith('gamba-') || elCls.includes('gamba-')) return false;
    return true;
  }

  // Pass 1 — stamp semantic elements in content-importance order (no count cap).
  const PRIORITY = [
    'h1,h2,h3,h4,h5,h6',
    'p,blockquote,figcaption,dt,dd,caption',
    'th,td',
    'li',
    'a,button,label,time,mark,code,pre,cite,q',
  ];
  for (const sel of PRIORITY) {
    for (const el of root.querySelectorAll(sel)) {
      if (canStamp(el)) stamp(el);
    }
  }

  // Pass 2 — stamp every remaining leaf container (no count cap).
  for (const el of root.querySelectorAll('*')) {
    if (!canStamp(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (SEMANTIC.has(tag)) continue;
    const text = el.textContent?.trim();
    if (!text || text.length < 3) continue;
    if (![...el.children].some(c => (c.textContent?.trim().length || 0) >= 3)) stamp(el);
  }

  // JSON-LD structured data as markdown frontmatter
  const ldLines = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try {
      [].concat(JSON.parse(s.textContent)).forEach(item => {
        const type = item['@type'] || '';
        if (!['Product','Movie','TVSeries','Book','Course','MusicAlbum','VideoGame'].includes(type)) return;
        const parts = [`[${type}]`];
        if (item.name) parts.push(`Name: ${item.name}`);
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offer?.price) parts.push(`Price: ${offer.priceCurrency || ''} ${offer.price}`);
        const r = item.aggregateRating;
        if (r) parts.push(`Rating: ${r.ratingValue}/5 (${r.reviewCount || '?'} reviews)`);
        ldLines.push(parts.join(' | '));
      });
    } catch {}
  });

  const header = [
    `# ${document.title}`,
    document.querySelector('meta[name="description"]')?.content
      ? `> ${document.querySelector('meta[name="description"]').content.slice(0, 200)}` : '',
    ldLines.length ? `> STRUCTURED DATA: ${ldLines.join(' || ')}` : '',
  ].filter(Boolean).join('\n');

  // Large DOM fast path — flat text only, no clone (avoids freeze on YouTube/Netflix).
  if (document.body.querySelectorAll('*').length > 5000) {
    const md = tagged.map(e => {
      const realEl = document.querySelector(`[data-gamba-id="${e.id}"]`);
      const fullText = realEl ? (realEl.textContent || '').trim() : e.text;
      return `${e.tag}: ${fullText} [gamba:${e.id}]`;
    }).join('\n');
    return { html: header + '\n\n' + md, tagged };
  }

  // Normal path — clone full document.body so the LLM sees ALL page text,
  // not just stamped elements. Stamped elements get [gN] markers embedded inline.
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style,svg,canvas,iframe,noscript,picture,video,audio,link').forEach(e => e.remove());

  // Embed gamba ID markers as inline text on each stamped element in the clone.
  clone.querySelectorAll('[data-gamba-id]').forEach(el => {
    el.appendChild(document.createTextNode(` [${el.getAttribute('data-gamba-id')}]`));
  });

  // Strip all attributes except data-gamba-id to keep Turndown output clean.
  clone.querySelectorAll('*').forEach(el => {
    const gid = el.getAttribute('data-gamba-id');
    while (el.attributes.length) el.removeAttribute(el.attributes[0].name);
    if (gid) el.setAttribute('data-gamba-id', gid);
  });

  const tdService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
  tdService.remove(['script','style','svg','canvas','iframe','noscript','picture','video','audio','link','img']);

  const md = tdService.turndown(clone).replace(/\n{3,}/g, '\n\n').trim();
  return { html: header + '\n\n' + md, tagged };
}

// ── Extract trigger ──────────────────────────────────────────────
let _analyzing = false;
let _analyzedUrl = '';
let _analyzedAt = 0;

function doExtract() {
  if (_analyzing) return;
  const url = location.href;
  if (url === _analyzedUrl && Date.now() - _analyzedAt < 30000) return;
  _analyzing = true;
  _analyzedUrl = url;
  _analyzedAt = Date.now();
  setTimeout(() => { _analyzing = false; }, 120000);
  showLoader();

  const SETTLE_MS = 300;
  const MAX_WAIT_MS = 7000;
  let done = false;
  let debounceTimer = null;

  function buildHead() {
    return [
      `<title>${document.title}</title>`,
      ...Array.from(document.querySelectorAll('meta[name], meta[property], meta[http-equiv]')).map(m => m.outerHTML).slice(0, 40),
    ].join('\n');
  }

  function collectExternalDomains() {
    const host = location.hostname;
    const seen = new Set();
    const add = str => {
      try { const h = new URL(str, location.href).hostname; if (h && h !== host) seen.add(h); } catch {}
    };
    document.querySelectorAll('script[src]').forEach(el => add(el.src));
    document.querySelectorAll('img[src]').forEach(el => add(el.src));
    document.querySelectorAll('link[href]').forEach(el => add(el.href));
    document.querySelectorAll('iframe[src]').forEach(el => add(el.src));
    document.querySelectorAll('form[action]').forEach(el => add(el.action));
    // Scan inline scripts for fetch/XHR/WebSocket URLs — skip large config blobs
    document.querySelectorAll('script:not([src])').forEach(el => {
      const text = el.textContent || '';
      if (text.length > 50000) return; // skip large data scripts (YouTube initial data, etc.)
      const re = /['"`](https?:\/\/[^'"`\s]{8,})['"`]/g;
      let m;
      while ((m = re.exec(text)) !== null) add(m[1]);
    });
    return [...seen];
  }

  function collectForms() {
    return [...document.querySelectorAll('form')].slice(0, 10).map(f => {
      const inputs = [...f.querySelectorAll('input')].map(i =>
        `<input type="${i.type || 'text'}" name="${i.name}" placeholder="${i.placeholder}">`
      ).join(' ');
      return `<form action="${f.action}" method="${f.method || 'get'}"> ${inputs} </form>`;
    });
  }

  function collectLinks() {
    const host = location.hostname;
    return [...document.querySelectorAll('a[href]')]
      .filter(a => {
        try { return new URL(a.href).hostname !== host; } catch { return false; }
      })
      .slice(0, 60)
      .map(a => {
        const text = (a.textContent || '').trim().slice(0, 80);
        return `${text} → ${a.href}`;
      });
  }

  function runExtract() {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(debounceTimer);

    const { html, tagged } = extractAndTag();
    const scripts = Array.from(document.scripts)
      .filter(s => !s.src?.startsWith('chrome-extension://'))
      .map(s => {
        if (s.src) return `<script src="${s.src}">`;
        const t = s.textContent || '';
        if (t.length > 50000) return null; // skip large data blobs
        return t;
      })
      .filter(s => s && !s.includes('gamba') && !s.includes('GAMBA'))
      .slice(0, 30);
    const domains = collectExternalDomains();
    const forms   = collectForms();
    const links   = collectLinks();

    console.log('GAMBA:', html.length, 'chars,', tagged.length, 'tagged,', domains.length, 'external domains,', forms.length, 'forms,', links.length, 'external links');
    chrome.runtime.sendMessage({ type: 'ANALYZE_URL', url: location.href, html, head: buildHead(), scripts, tagged, domains, forms, links });

    // Watch for late-loading content (SPAs that fetch data after initial render).
    // Fire a re-extraction once the DOM has been quiet for 500ms, or stop after 15s.
    const lateUrl = location.href;
    let lateDebounce = null;
    const lateObserver = new MutationObserver(() => {
      clearTimeout(lateDebounce);
      lateDebounce = setTimeout(checkLate, 500);
    });
    lateObserver.observe(document.documentElement, { childList: true, subtree: true });
    const lateHardStop = setTimeout(() => { lateObserver.disconnect(); clearTimeout(lateDebounce); }, 15000);

    function checkLate() {
      lateObserver.disconnect();
      clearTimeout(lateHardStop);
      if (location.href !== lateUrl) return;
      const untagged = [...document.querySelectorAll('h1,h2,h3,[itemprop="name"],[itemprop="description"]')]
        .filter(el => !el.getAttribute('data-gamba-id') && (el.innerText?.trim().length || 0) > 10);
      if (untagged.length < 2) return;
      console.log('GAMBA: late content —', untagged.length, 'untagged important elements, re-extracting');
      const { html: html2, tagged: tagged2 } = extractAndTag();
      chrome.runtime.sendMessage({ type: 'ANALYZE_URL', url: location.href, html: html2, head: buildHead(), scripts, tagged: tagged2, domains, forms, links, forceRefresh: true });
    }
  }

  const observer = new MutationObserver(() => { clearTimeout(debounceTimer); debounceTimer = setTimeout(runExtract, SETTLE_MS); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  debounceTimer = setTimeout(runExtract, SETTLE_MS);
  setTimeout(runExtract, MAX_WAIT_MS);
}

// ── SPA navigation ───────────────────────────────────────────────
let _lastUrl = location.href;
(function watchUrl() {
  const check = () => {
    const cur = location.href;
    if (cur === _lastUrl) return;
    _lastUrl = cur;
    _analyzing = false;
    document.querySelectorAll('.gamba-annotation').forEach(el => el.remove());
    document.querySelectorAll('[data-gamba-highlight]').forEach(el => {
      el.style.outline = ''; el.style.boxShadow = ''; el.removeAttribute('data-gamba-highlight');
    });
    doExtract();
  };
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = (...a) => { _push(...a);    check(); };
  history.replaceState = (...a) => { _replace(...a); check(); };
  window.addEventListener('popstate', check);
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'EXTRACT_PAGE') doExtract();
  if (msg.type === 'INJECT_CONTENT') {
    _analyzing = false;
    hideLoader();
    if (msg.annotations?.length && (msg.forceRefresh || !document.querySelector('.gamba-annotation'))) {
      applyAnnotations(msg.annotations);
    }
  }
});

// Self-trigger on load — don't rely solely on EXTRACT_PAGE round-trip from background.
// The _analyzing guard prevents double-runs if EXTRACT_PAGE also arrives.
doExtract();

// Walk up from el to find the nearest ancestor that looks like a product card:
// has an <img>, is between 150–500px tall (rejects huge sections), and isn't overflow-clipped.
function findCardContainer(el) {
  // Return the innermost ancestor that looks like a product card:
  // has an img, is narrower than half the viewport (rejects full-width grid rows/columns),
  // and is wider than 80px (rejects tiny icon wrappers).
  const maxW = window.innerWidth * 0.5;
  let cur = el.parentElement;
  for (let i = 0; i < 15 && cur && cur !== document.body; i++, cur = cur.parentElement) {
    const w = cur.clientWidth;
    if (w > 80 && w < maxW && cur.querySelector('img')) return cur;
  }
  return null;
}

// For notes, find the nearest ancestor that is safe to insert after —
// escapes table cells, accordion rows, and other constrained containers.
function safeInsertTarget(el) {
  const ESCAPE_TAGS = new Set(['td', 'th', 'tr', 'li', 'dt', 'dd', 'summary', 'details']);
  let cur = el;
  while (cur && cur !== document.body) {
    const tag = cur.tagName?.toLowerCase();
    if (ESCAPE_TAGS.has(tag)) cur = cur.parentElement;
    else break;
  }
  // Also escape if the element is inside a collapsed details/accordion
  let check = el.parentElement;
  while (check && check !== document.body) {
    if (check.tagName?.toLowerCase() === 'details' && !check.open) return null;
    check = check.parentElement;
  }
  return cur && cur !== document.body ? cur : el;
}

// ── Apply Annotations ────────────────────────────────────────────
// The AI picks the element ID and action type; we render it.
// Badges are pinned top-right on the nearest card container when one exists.
// Multiple badges on the same card stack vertically.
function applyOne(item, target, cardBadgeCount) {
  if (!item.label || item.label === '?') return; // skip badges with no meaningful label
  const c = COLORS[item.color] || COLORS.blue;
  if (item.action === 'badge') {
    const badge = document.createElement('span');
    badge.className = 'gamba-annotation';
    badge.textContent = '✦ ' + (item.label || 'GAMBA');
    const card = findCardContainer(target);
    if (card) {
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      const offset = cardBadgeCount.get(card) || 0;
      cardBadgeCount.set(card, offset + 1);
      badge.style.cssText = `position:absolute;top:${8 + offset * 30}px;right:8px;background:${c.bg};color:white;font-family:system-ui,sans-serif;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;z-index:9999;box-shadow:0 2px 10px ${c.bg}88;pointer-events:none;letter-spacing:0.3px;direction:ltr;unicode-bidi:isolate;`;
      card.appendChild(badge);
    } else {
      badge.style.cssText = `display:inline-block;background:${c.bg};color:white;font-family:system-ui,sans-serif;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;margin:0 4px 4px 0;box-shadow:0 2px 6px ${c.bg}66;pointer-events:none;letter-spacing:0.3px;vertical-align:middle;direction:ltr;unicode-bidi:isolate;`;
      target.insertAdjacentElement('beforebegin', badge);
    }
  } else if (item.action === 'highlight') {
    target.setAttribute('data-gamba-highlight', '1');
    target.style.outline = `3px solid ${c.bg}`;
    target.style.boxShadow = `0 0 16px ${c.bg}55`;
  } else if (item.action === 'note') {
    const insertAfter = safeInsertTarget(target);
    if (!insertAfter) return; // inside a collapsed section — skip
    const note = document.createElement('div');
    note.className = 'gamba-annotation';
    note.style.cssText = `all:initial;display:block;box-sizing:border-box;direction:ltr;unicode-bidi:isolate;background:${c.light};border-left:4px solid ${c.bg};border-radius:0 8px 8px 0;padding:10px 14px;margin:10px 0;font-family:system-ui,sans-serif;font-size:13px;line-height:1.55;color:#1a1a1a;box-shadow:0 2px 10px ${c.bg}22;`;
    note.innerHTML = `<span style="display:inline-block;background:${c.bg};color:white;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;margin-bottom:6px;letter-spacing:0.4px;">✦ GAMBA · ${item.label || 'Note'}</span><br><span style="color:#333;font-size:12px;">${item.note || ''}</span>`;
    insertAfter.insertAdjacentElement('afterend', note);
  }
}

function applyAnnotations(annotations) {
  document.querySelectorAll('.gamba-annotation').forEach(el => el.remove());
  document.querySelectorAll('[data-gamba-highlight]').forEach(el => {
    el.style.outline = ''; el.style.boxShadow = ''; el.removeAttribute('data-gamba-highlight');
  });

  const cardBadgeCount = new Map();
  const usedIds = new Set();
  const failed = []; // items where target wasn't found (SPA re-render)

  for (const item of annotations) {
    const key = `${item.id}:${item.action}`;
    if (usedIds.has(key)) continue;
    usedIds.add(key);
    try {
      const target = document.querySelector(`[data-gamba-id="${item.id}"]`);
      if (!target) { failed.push(item); continue; }
      applyOne(item, target, cardBadgeCount);
    } catch (e) {
      console.warn('GAMBA annotation failed:', item.id, e);
    }
  }

  // Retry failed annotations after 1.5s — handles SPAs (Crunchyroll, Netflix, etc.)
  // that re-render components between extraction and annotation time.
  if (failed.length) {
    console.log('GAMBA: retrying', failed.length, 'annotations in 1.5s');
    setTimeout(() => {
      const retryCardBadgeCount = new Map();
      for (const item of failed) {
        try {
          const target = document.querySelector(`[data-gamba-id="${item.id}"]`);
          if (target) applyOne(item, target, retryCardBadgeCount);
        } catch {}
      }
    }, 1500);
  }
}

// ── Security Banner ──────────────────────────────────────────────
function injectBanner(data) {
  document.getElementById('gamba-banner')?.remove();
  const isMalicious  = data.category === 'Malicious';
  const isSuspicious = data.category === 'Suspicious';
  const color = isMalicious ? '#EA5455' : isSuspicious ? '#FF9F43' : '#28C76F';

  const banner = document.createElement('div');
  banner.id = 'gamba-banner';
  banner.style.cssText = `position:fixed;top:0;left:0;width:100%;background:${color};color:white;z-index:999999;padding:12px 48px 12px 16px;font-family:system-ui;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.2);transition:opacity 0.4s ease;`;
  banner.innerHTML = `<strong>GAMBA:</strong> ${data.category} (${data.score}%)<div style="font-size:13px;margin-top:4px;">${data.summary}</div><button id="gamba-banner-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;opacity:0.85;">✕</button>`;
  document.body.prepend(banner);
  const dismiss = () => { banner.style.opacity = '0'; setTimeout(() => banner.remove(), 400); };
  document.getElementById('gamba-banner-close').addEventListener('click', dismiss);
  setTimeout(dismiss, 7000);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.currentAnalysis?.newValue) {
    _analyzing = false;
    hideLoader();
    injectBanner(changes.currentAnalysis.newValue.data);
  }
});
