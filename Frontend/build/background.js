// GAMBA Background Service Worker
const BACKEND_URL = 'http://localhost:8000';

// Only remembers the ONE single last URL analyzed across the entire browser
let lastAnalyzedUrl = '';

async function performAnalysis(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return;

    // Skip if it's the exact same URL as the very last analysis
    if (lastAnalyzedUrl === url) {
        console.log('Skipping analysis: Already analyzed this exact URL');
        return;
    }

    lastAnalyzedUrl = url;
    console.log('Analyzing new URL:', url);

    try {
        const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        const data = await response.json();

        // Store globally in storage so the popup can read it
        chrome.storage.local.set({
            currentAnalysis: {
                url,
                data,
                timestamp: Date.now()
            }
        });
    } catch (err) {
        console.warn('Backend connection failed.');

        // Clear lastAnalyzedUrl so we can retry this same URL immediately 
        // if the user switches tabs or clicks reanalyze
        lastAnalyzedUrl = '';

        chrome.storage.local.set({
            currentAnalysis: {
                url,
                data: {
                    category: "Backend Offline",
                    score: 0,
                    pageEdits: 0,
                    threatsCount: 0
                },
                timestamp: Date.now()
            }
        });
    }
}

// 1. Analyze as soon as the URL changes (don't wait for 'complete' status)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
        performAnalysis(changeInfo.url);
    }
});

// 2. Analyze when the user switches to a different tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            performAnalysis(tab.url);
        }
    } catch (e) {
        console.warn('Tab not found during activation');
    }
});

// 3. Manual message listener for the "Reanalyze" button or popup logic
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ANALYZE_URL') {
        // Force analysis by clearing the cache first
        lastAnalyzedUrl = '';
        performAnalysis(message.url).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            console.error('Manual analysis failed:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }
});
