/* =====================================================================
   Agent: web search tool
   ---------------------------------------------------------------------
   A single LangChain `tool` the agent can call to look up recent,
   real-world information (late team news, injuries/suspensions, manager
   quotes, form, motivation) that is NOT in the static match context.

   Provider order:
     1. Tavily  — if TAVILY_API_KEY is set (LLM-optimised, best quality)
     2. DuckDuckGo HTML — free, no key (lower quality, best-effort)

   Everything is wrapped in a hard timeout. A search that times out or
   errors is SKIPPED, never fatal — the tool returns a short "no results"
   note so the agent simply forecasts without that lookup instead of
   crashing the whole prediction.
   ===================================================================== */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const SEARCH_TIMEOUT_MS = Number(process.env.AGENT_SEARCH_TIMEOUT_MS || 9000);
const MAX_RESULTS = 5;

/* Run `p` but never wait longer than `ms`; on timeout resolve to `onTimeout`. */
function withTimeout(p, ms, onTimeout) {
  return Promise.race([
    p,
    new Promise(resolve => setTimeout(() => resolve(onTimeout), ms)),
  ]);
}

/* ---- Tavily (preferred when a key is present) --------------------- */
async function tavilySearch(query, signal) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null; // signal "not configured" so we fall through
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: MAX_RESULTS,
      include_answer: true,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  const lines = [];
  if (data.answer) lines.push(`Summary: ${data.answer}`);
  for (const r of data.results || []) {
    lines.push(`- ${r.title} (${r.url})\n  ${String(r.content || '').slice(0, 300)}`);
  }
  return lines.length ? lines.join('\n') : null;
}

/* ---- DuckDuckGo HTML (free fallback, best-effort scrape) ---------- */
async function duckduckgoSearch(query, signal) {
  // The HTML endpoint 202s on GET (anti-bot); a form POST returns results.
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'q=' + encodeURIComponent(query),
    signal,
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
  const html = await res.text();
  const out = [];
  const re = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;
  let m;
  const strip = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
  while ((m = re.exec(html)) && out.length < MAX_RESULTS) {
    out.push(`- ${strip(m[1])}\n  ${strip(m[2]).slice(0, 300)}`);
  }
  return out.length ? out.join('\n') : null;
}

async function runSearch(query) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
  try {
    const viaTavily = await tavilySearch(query, ctrl.signal);
    if (viaTavily) return viaTavily;
    const viaDdg = await duckduckgoSearch(query, ctrl.signal);
    if (viaDdg) return viaDdg;
    return null;
  } finally {
    clearTimeout(t);
  }
}

const DEFAULT_MAX_SEARCHES = Number(process.env.AGENT_MAX_SEARCHES || 5);

/* Build a fresh web_search tool with its OWN call budget. A new one is created
   per prediction so the budget is isolated. Once the budget is spent the tool
   stops searching and tells the model to answer — this CAPS how many agent
   steps a search-happy model can burn, instead of letting it loop until the
   recursion limit. */
export function makeWebSearchTool({ maxCalls = DEFAULT_MAX_SEARCHES } = {}) {
  let used = 0;
  return tool(
    async ({ query }) => {
      if (used >= maxCalls) {
        return `Search budget reached (${maxCalls} searches used). Do NOT search again — give your FINAL JSON answer now using everything gathered so far.`;
      }
      used++;
      const left = maxCalls - used;
      const note = `  [${used}/${maxCalls} searches used${left ? '' : ' — this was your LAST search; answer now'}]`;
      try {
        const result = await withTimeout(runSearch(query), SEARCH_TIMEOUT_MS + 500, '__TIMEOUT__');
        if (result === '__TIMEOUT__') return `No web results (search timed out). Proceed using the data already provided.${note}`;
        if (!result) return `No web results found for "${query}". Proceed using the data already provided.${note}`;
        return `Web results for "${query}":\n${result}${note}`;
      } catch (err) {
        return `Web search unavailable (${String(err.message || err).slice(0, 120)}). Proceed using the data already provided.${note}`;
      }
    },
    {
      name: 'web_search',
      description:
        'Search the web for RECENT, real-world football information not in the provided dataset: ' +
        'latest team news, confirmed/probable lineups, injuries, suspensions, manager comments, ' +
        'recent results, and match motivation/stakes. Use focused queries that include team names ' +
        `and the word "2026". You may search at most ${maxCalls} times — use them wisely. ` +
        'Returns a short list of titles + snippets.',
      schema: z.object({
        query: z.string().describe('A focused web search query, e.g. "Brazil team news injuries June 2026".'),
      }),
    }
  );
}
