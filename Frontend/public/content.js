console.log('CONTENT SCRIPT LOADED');


chrome.runtime.onMessage.addListener((msg) => {
  console.log('CONTENT RECEIVED:', msg);
  if (msg.type === 'EXTRACT_PAGE') {
    const html = document.documentElement.outerHTML;
    const scripts = Array.from(document.scripts).map(s => s.outerHTML);

    chrome.runtime.sendMessage({
      type: 'ANALYZE_URL',
      url: window.location.href,
      html,
      scripts,
    });
  }
});

function injectBanner(data) {
  // Remove existing banner
  const existing = document.getElementById('gamba-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'gamba-banner';

  const color =
    data.category === 'Malicious'
      ? '#EA5455'
      : data.category === 'Suspicious'
      ? '#FF9F43'
      : '#28C76F';

  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: ${color};
    color: white;
    z-index: 999999;
    padding: 12px 16px;
    font-family: system-ui;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;

  banner.innerHTML = `
    <strong>GAMBA:</strong> ${data.category} (${data.score}%)
    <div style="font-size:13px; margin-top:4px;">
      ${data.summary}
    </div>
  `;

  document.body.prepend(banner);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.currentAnalysis?.newValue) {
    const data = changes.currentAnalysis.newValue.data;
    injectBanner(data);
  }
});