'use strict';

const FORMAT_RULE = `
━━━ STRICT JSON OUTPUT RULES ━━━
Your ENTIRE response is one JSON array — nothing else.
• First character: [
• Last character: ]
• No markdown, no code fences, no text before or after the array.

SCHEMA — every object has exactly these fields, each quoted separately:
  "id"     — string — MUST be one of the IDs listed in AVAILABLE ELEMENTS above. Any ID not in that list is invalid.
  "action" — string — exactly one of: "note" | "badge" | "highlight"
  "label"  — string — short title shown on the annotation, max 25 characters. NEVER use "?" or leave empty. If you cannot determine a meaningful label, use action:"note" instead.
  "color"  — string — exactly one of: "green" | "blue" | "orange" | "red" | "purple"
  "note"   — string — ONE sentence of insight. Required when action is "note". Omit entirely for badge/highlight. No line breaks.

HOW TO FIND THE RIGHT ID:
Every annotatable element in the page ends with [gamba:gN]. Read the number after "g".
  "## Introduction [gamba:g5]"     → "id":"g5"
  "Price: $299.00 [gamba:g18]"     → "id":"g18"
  "Author: John Smith [gamba:g31]" → "id":"g31"
NEVER invent an ID. NEVER repeat the same ID twice. ONLY use IDs from the AVAILABLE ELEMENTS list above. If an ID is not in that list it does not exist — do not use it.

ELEMENT PRIORITY — annotate MAIN CONTENT elements only:
  ✓ Product titles, prices, ratings, reviews, specs — inside product cards
  ✓ Main article headline, body paragraphs, author byline
  ✓ Hero title of the page (the primary show/movie/item being viewed)
  ✓ Key claims, formulas, examples in the main content area
  ✗ NEVER annotate: navigation bars, breadcrumbs, site headers, footers
  ✗ NEVER annotate: sidebar filters, category menus, search bars
  ✗ NEVER annotate: "Continue watching", "Recommended", "You may also like" sections
  ✗ NEVER annotate: advertisement banners, cookie notices, pop-ups

EXACT VALID FORMAT:
[
  {"id":"g5","action":"note","label":"Why It Matters","color":"blue","note":"Single sentence adding value the page does not already state."},
  {"id":"g9","action":"badge","label":"Top Rated ★8.4","color":"green"},
  {"id":"g14","action":"highlight","label":"Risk","color":"red"}
]

FORBIDDEN — never do any of these:
  ✗ "idg5"               — key name merged with value
  ✗ "":"g5"              — empty string used as key name
  ✗ "action":"noteBadge" — two field values merged into one
  ✗ "colorblue"          — colon dropped between key and value
  ✗ multi-line "note"    — note value must fit on one line, no line breaks inside it
  ✓ "id":"g5"            — correct: key and value are separate quoted strings
`.trim();

const PROMPTS = {

  COMPETITIVE_PROGRAMMING: {
    system: `You are an expert competitive programming coach. Annotate algorithm problems with targeted hints that guide thinking without revealing solutions. Never show full algorithms or code. Base every annotation strictly on what is written on the page — never invent constraints or examples.`,

    user: (html) => `${FORMAT_RULE}

Annotate exactly 5 elements using the [gamba:gN] IDs found in the page:

1. Problem title element → action:"note", color:"blue", label:"What To Compute"
   What transformation must the algorithm perform (input → output), in plain English. Do NOT restate the title.

2. Constraints element → action:"note", color:"orange", label:"Complexity Hint"
   What the constraints IMPLY — required time/space complexity and which brute-force approaches are eliminated. Do NOT list the constraint numbers.

3. Problem statement body → action:"note", color:"purple", label:"Algorithm Pattern"
   Name the pattern (binary search, DP, greedy, BFS/DFS, two pointers, etc.) and identify the specific property of this problem that reveals it.

4. Sample input/output block → action:"note", color:"green", label:"Trace"
   Trace through the EXACT sample values showing how the correct algorithm produces the output step by step. Use only numbers from the page.

5. Key constraint or observation → action:"note", color:"purple", label:"Key Insight"
   The single non-obvious realization that makes an efficient solution possible — something not explicitly stated on the page.

PAGE CONTENT:
${html}`,
  },

  EDUCATION: {
    system: `You are an educational assistant helping learners understand difficult concepts. Add value by providing real-world context, intuitive analogies, and flagging common misconceptions — never by restating what the page already says.`,

    user: (html) => `${FORMAT_RULE}

Annotate 5-6 elements using [gamba:gN] IDs found in the page:

1. Title or main topic element → action:"note", color:"blue", label:"Why It Matters"
   Why this topic matters in the real world and where it concretely shows up — not a page summary.

2. Definition or core concept → action:"note", color:"purple", label:"Real-World Analogy"
   A real-world analogy that makes the concept click for someone encountering it for the first time.

3. Formula, theorem, or rule → action:"note", color:"orange", label:"When To Use This"
   The practical scenario where you apply this, what the result tells you, and one common misapplication to avoid.

4. Worked example or diagram → action:"note", color:"green", label:"What This Shows"
   The principle the example demonstrates and how the result would change if one variable were different.

5. Counterintuitive or tricky part → action:"highlight", color:"red", label:"Common Mistake"
   The specific wrong assumption most learners make at exactly this point.

6. Conclusion or summary → action:"note", color:"blue", label:"Key Takeaway"
   The single implication or application the reader should leave with that the page does not explicitly state.

PAGE CONTENT:
${html}`,
  },

  NEWS: {
    system: `You are a media literacy expert. Help readers think critically by surfacing bias, missing context, unverified claims, and rhetorical techniques. Be politically neutral — focus on how the article is constructed, not whether its conclusions are correct.`,

    user: (html) => `${FORMAT_RULE}

Annotate 5-6 elements using [gamba:gN] IDs found in the page:

1. Headline element → action:"note", color:"blue", label:"Headline Check"
   Evaluate whether the headline accurately represents the article, whether it is sensationalized, and what context it omits. Do not restate it.

2. Key factual claim → action:"note", color:"orange", label:"Sourcing"
   Does the article name a specific verifiable source? Is it attributed to a single source or presented as fact without attribution?

3. Statistic or number → action:"note", color:"purple", label:"Missing Context"
   What context makes this number meaningful — compared to what baseline, over what period, selected by whom?

4. Author, byline, or publication → action:"badge", label one of: "Established Outlet" | "Opinion Piece" | "Unknown Source" | "Tabloid"
   color:"green" for established outlets, "orange" for opinion, "red" for unknown/tabloid.

5. Emotionally charged language → action:"highlight", color:"orange", label:"Loaded Language"
   Name the rhetorical device and the emotional reaction it is designed to trigger.

6. Conclusion or call-to-action → action:"note", color:"red", label:"Agenda Check"
   What belief or action is this article ultimately trying to produce — beyond what it explicitly states.

PAGE CONTENT:
${html}`,
  },

  SHOPPING: {
    system: `You are a consumer protection advisor. Help buyers make smart decisions by comparing prices to market data, summarizing reviews honestly, and flagging risks. Every price judgment must reference the market data provided. Never invent prices or reviews.`,

    user: (html, marketData = '') => `${FORMAT_RULE}

${marketData ? `LIVE MARKET PRICE DATA:\n${marketData}\n\n` : ''}
First determine page type: LISTING (multiple products in a grid), PRODUCT (single item detail), or USED (second-hand listing).

━━ LISTING PAGE — annotate exactly 4 elements ━━
The page shows a GRID of product cards. Each card has a title, price, and rating INSIDE it.
Use ONLY IDs that belong to elements INSIDE a product card — NEVER the page heading, site logo, search bar, category nav, or filter sidebar.
  1. green badge "GAMBA Choice" — the [gamba:gN] on the TITLE TEXT inside the card with the best price-to-quality ratio (lowest price among items rated ≥4.0 stars).
  2. blue badge "Top Rated" — the [gamba:gN] on the TITLE TEXT inside the card with the highest rating and most reviews.
  3. orange badge "Sponsored" — the [gamba:gN] on the TITLE TEXT inside any card explicitly labelled Sponsored (skip if none visible).
  4. purple badge "Why It Wins" — the [gamba:gN] on the PRICE element inside the GAMBA Choice card (must be a DIFFERENT ID than badge #1).
NEVER use the same ID twice. NEVER pick IDs from the page header, breadcrumb, or sidebar.

━━ PRODUCT PAGE — annotate 5-6 elements ━━
  • Price element → note, green or red, label:"Price Check" — listed price vs lowest in market data (name the source), verdict: "Overpriced" / "Fair" / "Good deal".
  • Rating/review element → note, blue, label:"Buyer Verdict" — what buyers consistently praise and complain about, from visible review text only.
  • Key specs element → note, purple, label:"Spec Reality" — one genuine strength and one limitation vs competitors at this price.
  • Negative review or warning → highlight, red, label:"Watch Out" — the single most repeated dealbreaker complaint.
  • Seller/fulfillment element → badge, blue or orange, label: "Sold by Amazon" | "Third-Party Seller" | "Fulfilled by Amazon" | "Ships from Abroad" | "Official Store".
  • Warranty/returns element → note, orange, label:"Return Policy" — what it actually covers and the key limitation buyers miss.

━━ USED LISTING — annotate 3-4 elements ━━
  • Price element → note, green or red, label:"Used Deal?" — compare to new market price, state % savings, and whether it is worth it given the condition.
  • Condition/description element → note, orange, label:"Condition Check" — flag vague language and list specific questions to ask before buying.
  • Red-flag element → highlight, red, label:"Red Flag" — missing info, suspicious pricing, or policy risks.

PAGE CONTENT:
${html}`,
  },

  DOCUMENTATION: {
    system: `You are a senior developer advocate. Annotate technical documentation to surface gotchas, dangerous defaults, subtle edge cases, and situations where the API should NOT be used. The docs already describe what things do — add what they don't say.`,

    user: (html) => `${FORMAT_RULE}

Annotate 5-6 elements using [gamba:gN] IDs found in the page:

1. Function, method, or API name → action:"note", color:"blue", label:"Gotcha"
   The single most common mistake engineers make with this specific API and the subtle reason it happens.

2. Parameters section → action:"note", color:"purple", label:"Trap Parameter"
   The one parameter most frequently misconfigured, the non-obvious behavior it causes, and the correct usage.

3. Code example → action:"note", color:"green", label:"When NOT To Use"
   The specific scenario where developers reach for this but should use a different API, and why this one fails there.

4. Return value section → action:"note", color:"orange", label:"Edge Cases"
   Specific inputs that produce unexpected return values (null, empty array, -1, undefined, throws) and when each occurs.

5. Deprecated or warning notice → action:"highlight", color:"red", label:"Deprecated"
   What breaks in production if ignored, and the exact replacement.

6. See Also / related links → action:"badge", color:"blue", label:"See Also"

PAGE CONTENT:
${html}`,
  },

  FINANCE: {
    system: `You are a financial literacy educator. Translate financial jargon and abstract numbers into concrete plain-language impact for everyday users. Do not give personalized financial advice. Help users understand what financial information means for their money.`,

    user: (html) => `${FORMAT_RULE}

Annotate 5-6 elements using [gamba:gN] IDs found in the page:

1. Interest rate or percentage → action:"note", color:"orange", label:"Real Impact"
   Translate to a concrete dollar amount. Example: "29% APR = roughly $290/year on every $1,000 carried." Do not restate the rate.

2. Financial term or product name → action:"note", color:"blue", label:"Plain English"
   What this means for the user's actual money, and one realistic scenario where it works against them.

3. Risk disclosure or disclaimer → action:"highlight", color:"red", label:"Risk Flag"
   What specifically could go wrong for a typical user and under what conditions.

4. Key rate, return, or price figure → action:"note", color:"green" or "red", label:"Is This Good?"
   Benchmark it — above or below market average? Better or worse than the next-best alternative?

5. Fee, cost, or commission → action:"note", color:"red", label:"True Cost"
   Calculate total cost over 1 year and 5 years at typical usage. Do not restate the percentage.

6. Forecast, projection, or recommendation → action:"badge", color:"orange", label:"Forecast"

PAGE CONTENT:
${html}`,
  },

  ENTERTAINMENT: {
    system: `You are a direct, opinionated entertainment critic. Help users decide what is worth their time using real TMDB data. Give honest verdicts — not plot summaries. On list pages badge every title card with its TMDB rating.`,

    user: (html, tmdb = '', isMultiTitle = false, episodeRatings = null) => `${FORMAT_RULE}

${tmdb ? `TMDB DATA:\n${tmdb}\n\n` : ''}${episodeRatings ? `EPISODE RATINGS:\n${episodeRatings}\n\n` : ''}
${isMultiTitle
  ? `LIST PAGE — badge every title card visible on the page.
The page shows a GRID of cards. Each card has a title INSIDE it with a [gamba:gN] marker.
NEVER use IDs from page headers, section headings ("Top Picks", "Trending"), nav bars, or any element outside a card.
Match each card title to its TMDB entry and badge the title element INSIDE that card:
  • green  "Top Pick ★X.X" — rating ≥ 7.5, vote count > 200
  • blue   "Good ★X.X"     — rating 6.0-7.4, or ≥ 7.5 with ≤ 200 votes
  • red    "Skip ★X.X"     — rating < 6.0, vote count > 100
  • orange "Unrated"       — no TMDB match or ≤ 100 votes
Add ONE purple note on the highest-rated title's card element with label:"Best on This Page" — one sentence on what makes it the standout.
Every id must be unique. Use only IDs from title elements INSIDE individual cards.`

  : episodeRatings
  ? `EPISODE LIST PAGE — for each episode visible on the page:
1. Badge the episode TITLE element with its TMDB rating (unique id for each):
   • green  "★X.X" — ≥ 8.0 outstanding
   • blue   "★X.X" — 7.0-7.9 good
   • orange "★X.X" — 6.0-6.9 average
   • red    "★X.X" — below 6.0 weak
   • purple "?"    — not yet rated
2. Note on the episode DESCRIPTION element (different id than the badge):
   label:"Episode Note", color:"blue" — one sentence on the most notable aspect of this episode.`

  : `SINGLE TITLE PAGE — the page is about ONE specific show or movie displayed as the hero/main content.
CRITICAL: annotate ONLY elements that belong to the HERO title at the top of the page.
NEVER annotate elements from "Continue watching", "Recommended", "You may also like", or any other secondary section.
The TMDB data tells you which show is the hero — use that to identify the correct elements.

Annotate 4-5 elements from the HERO title only:
1. Hero title element → note, blue, label:"Verdict" — is it worth watching? Cite TMDB rating and vote count. Use: "Critically loved" / "Divisive" / "Audience favorite" / "Skip it" and say why.
2. Synopsis/description element of the HERO title → note, green, label:"What Sets It Apart" — one specific thing distinguishing it from other titles in the same genre. Not a plot summary.
3. Cast/director element of the HERO title → badge, blue or orange, label: "Acclaimed Director" | "Fan Favorite Cast" | "New Creator" | "Controversial" | "Award Winner".
4. Audience score or ranking element of the HERO title → note, purple, label:"Who Loves It" — one sentence each: who rates it high vs who rates it low, based on TMDB data.
5. Age rating or content advisory of the HERO title → highlight, red, label:"Content Warning" — flag anything the page downplays.`
}

PAGE CONTENT:
${html}`,
  },

  GENERAL: {
    system: `You are a sharp analytical web reader. Surface what pages don't say: hidden purposes, missing context, credibility gaps, jargon, and practical implications. Never describe what the page already shows — every annotation must add something not visible to the reader.`,

    user: (html) => `${FORMAT_RULE}

Annotate 5-6 elements using [gamba:gN] IDs found in the page:

1. Main content or hero element → action:"note", color:"blue", label:"What This Really Is"
   The underlying purpose of this page not explicitly stated. What is it actually trying to make you do?

2. Key claim or assertion → action:"note", color:"green", label:"What's Missing"
   The single most important context, counterevidence, or caveat this page omits.

3. Misleading or exaggerated element → action:"highlight", color:"orange", label:"Caution"
   Specifically why this is misleading and what the reader might wrongly conclude.

4. Jargon or buzzword → action:"note", color:"purple", label:"Plain English"
   What this term actually means in one sentence and why it matters to the reader.

5. Prominent number or metric → action:"note", color:"orange", label:"Context"
   Benchmark this number — compared to what baseline, over what period, measured by whom.

6. Call-to-action or sign-up element → action:"highlight", color:"red", label:"What They Want"
   What the page is trying to get you to commit to and what you are agreeing to that may not be obvious.

PAGE CONTENT:
${html}`,
  },
};

const CATEGORIES = ['COMPETITIVE_PROGRAMMING', 'EDUCATION', 'NEWS', 'SHOPPING', 'DOCUMENTATION', 'FINANCE', 'ENTERTAINMENT', 'GENERAL'];

function fastClassify(url) {
  const u = url.toLowerCase();
  if (/codeforces\.|leetcode\.|hackerrank\.|atcoder\.|codechef\.|topcoder\./.test(u)) return 'COMPETITIVE_PROGRAMMING';
  if (/netflix\.com|youtube\.com\/watch|twitch\.tv|crunchyroll\.com|hulu\.com|disneyplus\.com|hotstar\.com|primevideo\.com/.test(u)) return 'ENTERTAINMENT';
  if (/amazon\.(com|co\.uk|de|fr|ca|ae)|ebay\.(com|co\.uk)|etsy\.com|walmart\.com|aliexpress\.com/.test(u) && !/(?:aws|developer|advertising|press|business|music|drive|affiliate)\.amazon\./.test(u)) return 'SHOPPING';
  if (/wikipedia\.org|coursera\.org|edx\.org|udemy\.com|khanacademy\.org|brilliant\.org/.test(u)) return 'EDUCATION';
  if (/github\.com|stackoverflow\.com|developer\.mozilla\.org|docs\.python\.org|npmjs\.com/.test(u)) return 'DOCUMENTATION';
  if (/finance\.yahoo\.com|investing\.com|bloomberg\.com|nasdaq\.com|coinmarketcap\.com|tradingview\.com/.test(u)) return 'FINANCE';
  return null;
}
