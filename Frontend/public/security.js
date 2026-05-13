'use strict';

// Depends on: keys.js (KEY_SAFEBROWSING), llm.js (callSecLLM), utils.js (parseJSON), api.js (fetchScript)

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

async function analyzeSecurity(html, scripts, signal, pageUrl = '', head = '', domains = [], forms = [], links = []) {
  const resolved  = await Promise.all(scripts.slice(0, 15).map(s => fetchScript(s, signal)));
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
    `Look at this webpage and reply with ONLY a JSON object — no markdown, no extra text.

{"safe":true,"summary":"What this page does and whether it is safe."}

- safe: true if the page is safe, false if it looks suspicious or malicious
- summary: 2-3 sentences — what this page is and whether the user should be concerned

PAGE URL: ${pageUrl}
PAGE HEAD: ${head}${formsBlock}${domainBlock}${linksBlock}

HTML:
${html.slice(0, 40000)}${scriptsBlock}`,
    signal, 300
  );

  const parsed       = parseJSON(raw, null);
  const category     = parsed?.safe === false ? 'Suspicious' : 'Safe';
  const score        = parsed?.safe === false ? 30 : 90;
  const threatsCount = 0;
  const summary      = parsed?.summary || 'Security analysis unavailable.';

  console.log('GAMBA: verdict ───', { category, score, threatsCount, summary });
  return { category, score, threatsCount, summary };
}
