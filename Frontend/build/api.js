'use strict';

// Depends on: config.js (TMDB_BASE), keys.js (KEY_TMDB, KEY_SERPAPI)

async function fetchTMDB(title) {
  try {
    const data = await fetch(
      `${TMDB_BASE}/search/multi?api_key=${KEY_TMDB}&query=${encodeURIComponent(title)}&include_adult=false`
    ).then(r => r.json()).catch(() => ({ results: [] }));

    const hits = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (!hits.length) return null;

    const top     = hits.reduce((b, r) => (r.vote_count || 0) > (b.vote_count || 0) ? r : b, hits[0]);
    const d       = await fetch(`${TMDB_BASE}/${top.media_type}/${top.id}?api_key=${KEY_TMDB}`).then(r => r.json());
    const year    = (d.release_date || d.first_air_date || '').slice(0, 4);
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
