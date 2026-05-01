'use strict';

// Depends on: config.js (GUARD_MODEL), keys.js (KEY_LLM, KEY_SAFEBROWSING), llm.js (callLLM, callSecLLM), utils.js (parseJSON), api.js (fetchScript)

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

async function checkLlamaGuard(pageUrl, html, signal) {
  try {
    const content = `URL: ${pageUrl}\n\nPAGE CONTENT:\n${html.slice(0, 10000)}`;
    const text = (await callLLM(content, signal, { model: GUARD_MODEL, stream: false, maxTokens: 100 })).trim().toLowerCase();
    console.log('GAMBA: Llama Guard response:', text);

    if (text.startsWith('safe')) return null;

    const codes   = [...text.matchAll(/s(\d+)/gi)].map(m => `S${m[1]}`);
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

async function analyzeSecurity(html, scripts, signal, pageUrl = '', head = '', domains = [], forms = [], links = []) {
  const [resolved, guardResult] = await Promise.all([
    Promise.all(scripts.slice(0, 15).map(s => fetchScript(s, signal))),
    checkLlamaGuard(pageUrl, html, signal),
  ]);
  const scannable = resolved.filter(s => s.code);

  const formsBlock   = forms.length   ? `\nFORMS:\n${forms.join('\n')}` : '';
  const domainBlock  = domains.length ? `\nEXTERNAL DOMAINS: ${domains.join(', ')}` : '';
  const linksBlock   = links.length   ? `\nEXTERNAL LINKS (display text → href):\n${links.join('\n')}` : '';
  const scriptsBlock = scannable.length
    ? '\n\n' + scannable.map(({ url, code }, i) => {
        let label = url;
        try { label = new URL(url).hostname + new URL(url).pathname; } catch {}
        return `--- SCRIPT ${i + 1}: ${label} ---\n${code.slice(0, 20000)}`;
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
${html.slice(0, 40000)}${scriptsBlock}`,
    signal, 300
  );

  const parsed     = parseJSON(raw, null);
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
