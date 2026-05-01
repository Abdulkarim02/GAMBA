'use strict';

// Depends on: config.js (LLM_URL, MODEL, VISION_MODEL), keys.js (KEY_LLM)

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

function callSecLLM(prompt, signal, maxTokens = 500) {
  return callLLM(prompt, signal, { maxTokens, stream: false, model: VISION_MODEL });
}
