'use strict';

// Depends on: config.js (CONTENT_LLM_URL, SEC_LLM_URL, MODEL, VISION_MODEL), keys.js (KEY_CONTENT_LLM, KEY_LLM)

async function callLLM(prompt, signal, { maxTokens = 2000, system = null, stream = true, screenshot = null, model: modelOverride = null } = {}) {
  const userContent = screenshot
    ? [ { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: screenshot } } ]
    : prompt;

  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: userContent }]
    : [{ role: 'user', content: userContent }];

  const model = modelOverride ?? MODEL;

  console.log('GAMBA: sending to LLM ───────────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────────');

  const res = await fetch(CONTENT_LLM_URL, {
    method:  'POST',
    signal:  signal instanceof AbortSignal ? signal : undefined,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_CONTENT_LLM}` },
    body:    JSON.stringify({ model, messages, temperature: 2, top_p: 1.0, frequency_penalty: 0, presence_penalty: 0, max_tokens: maxTokens, stream }),
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
  console.log('GAMBA: sending to SEC LLM ───────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────────');

  const res = await fetch(SEC_LLM_URL, {
    method:  'POST',
    signal:  signal instanceof AbortSignal ? signal : undefined,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_SEC_LLM}` },
    body:    JSON.stringify({ model: SEC_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 2, top_p: 1, max_tokens: maxTokens, stream: false }),
  });

  if (!res.ok) {
    console.warn('GAMBA: SEC LLM HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return '';
  }

  const text = (await res.json()).choices?.[0]?.message?.content?.trim() || '';
  console.log('GAMBA: SEC LLM response ─────────────────────');
  console.log(text);
  console.log('────────────────────────────────────────────');
  return text;
}
