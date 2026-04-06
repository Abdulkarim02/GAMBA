// GAMBA Background Service Worker
const BACKEND_URL = 'http://localhost:8000';

// Only remembers the ONE single last URL analyzed across the entire browser
let lastAnalyzedUrl = '';

// async function performAnalysis(url) {
//     if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return;

//     // Skip if it's the exact same URL as the very last analysis
//     if (lastAnalyzedUrl === url) {
//         console.log('Skipping analysis: Already analyzed this exact URL');
//         return;
//     }

//     lastAnalyzedUrl = url;
//     console.log('Analyzing new URL:', url);

//     try {
//         const response = await fetch(`${BACKEND_URL}/analyze`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ url }),
//         });
//         const data = await response.json();

//         // Store globally in storage so the popup can read it
//         chrome.storage.local.set({
//             currentAnalysis: {
//                 url,
//                 data,
//                 timestamp: Date.now()
//             }
//         });
//     } catch (err) {
//         console.warn('Backend connection failed.');

//         // Clear lastAnalyzedUrl so we can retry this same URL immediately 
//         // if the user switches tabs or clicks reanalyze
//         lastAnalyzedUrl = '';

//         chrome.storage.local.set({
//             currentAnalysis: {
//                 url,
//                 data: {
//                     category: "Backend Offline",
//                     score: 0,
//                     pageEdits: 0,
//                     threatsCount: 0
//                 },
//                 timestamp: Date.now()
//             }
//         });
//     }
// }
const performAnalysis = async ({ url, html, scripts }) => {
  try {
    // HTML request
    const htmlRes = await fetch('https://gamba.almanea.work/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-4b",
        messages: [
          {
            role: "user",
            content: `
You are a cybersecurity analysis engine.

Your job is to analyze webpage HTML for phishing, scams, or suspicious behavior.

STRICT RULES:
- You MUST return ONLY valid JSON
- NO explanations
- NO markdown
- NO extra text
- If unsure, make a best guess (never empty)

OUTPUT FORMAT:
{
  "category": "Safe" | "Suspicious" | "Malicious",
  "score": number (0-100),
  "pageEdits": number,
  "summary": string
}

DEFINITIONS:
- category:
  - Safe → normal website
  - Suspicious → unusual or deceptive patterns
  - Malicious → phishing, scam, credential harvesting

- score:
  Confidence level of your classification

- pageEdits:
  Number of suspicious DOM manipulations, fake overlays, hidden inputs, etc.

- summary:
  REQUIRED.
  A short, clear explanation (1–3 sentences max).
  Must describe WHAT was detected and WHY.
  This will be shown directly to users.

ANALYZE THIS HTML:
${html}
`
          }
        ]
      })
    });

    const htmlJson = await htmlRes.json();
    const htmlText = htmlJson.choices?.[0]?.message?.content || "{}";

    let htmlData;
    try { htmlData = JSON.parse(htmlText); }
    catch { htmlData = { category: "Unknown", score: 0, pageEdits: 0 }; }

    // Scripts request
    const scriptsRes = await fetch('https://gamba.almanea.work/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-4b",
        messages: [
          {
            role: "user",
            content: `
You are a JavaScript security analyzer.

Your job is to detect malicious or suspicious scripts.

STRICT RULES:
- Return ONLY valid JSON
- NO explanations
- NO markdown
- NEVER return empty

OUTPUT FORMAT:
{
  "threatsCount": number
}

DEFINITION:
- threatsCount:
  Number of suspicious behaviors such as:
  - data exfiltration
  - keylogging
  - obfuscation
  - eval / dynamic execution
  - suspicious network requests

ANALYZE THESE SCRIPTS:
${scripts.join("\n\n")}
`
          }
        ]
      })
    });

    const scriptsJson = await scriptsRes.json();
    const scriptsText = scriptsJson.choices?.[0]?.message?.content || "{}";

    let scriptsData;
    try { scriptsData = JSON.parse(scriptsText); }
    catch { scriptsData = { threatsCount: 0 }; }

    await chrome.storage.local.set({
    currentAnalysis: {
        data: {
        category: htmlData.category ?? "Unknown",
        score: htmlData.score ?? 0,
        pageEdits: htmlData.pageEdits ?? 0,
        threatsCount: scriptsData.threatsCount ?? 0,
        summary: htmlData.summary ?? "No summary available",
        },
    },
    });

  } catch (err) {
    console.error('Analysis failed:', err);
    throw err;
  }
};

// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.type === 'EXTRACT_PAGE') {
//     const html = document.documentElement.outerHTML;
//     const scripts = Array.from(document.scripts).map(s => s.outerHTML);

//     chrome.runtime.sendMessage({
//       type: 'ANALYZE_URL',
//       url: window.location.href,
//       html,
//       scripts,
//     });
//   }
// });

// 1. Analyze as soon as the URL changes (don't wait for 'complete' status)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' });

    }
});

// 2. Analyze when the user switches to a different tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            chrome.tabs.sendMessage(activeInfo.tabId, { type: 'EXTRACT_PAGE' });
        }
    } catch (e) {
        console.warn('Tab not found during activation');
    }
});

// 3. Manual message listener for the "Reanalyze" button or popup logic
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('BACKGROUND RECEIVED:', message);
  if (message.type === 'ANALYZE_URL') {
    lastAnalyzedUrl = '';

    performAnalysis({
        url: message.url,
        html: message.html,
        scripts: message.scripts,
    })
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('Manual analysis failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }
});