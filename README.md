<p align="center">
  <img src="logo.png" alt="Open Cup Arena" width="160" />
</p>

<h1 align="center">Open Cup Arena</h1>

<p align="center">An agentic football match forecaster — plan, research the web, then commit to a strict JSON prediction.</p>

---

A research harness that turns any chat LLM into an **agentic forecaster** for
football matches. Instead of a single one-shot call, the model can **plan** and
call a **web-search tool** to gather late-breaking information (confirmed
lineups, injuries, suspensions, manager comments, recent results) before
committing to a forecast — then returns a strict, machine-parseable JSON
prediction.

The agent output uses the exact same contract as a plain single-shot call, so
an agent forecast is **directly comparable** to a one-shot baseline on the same
objective context. That makes it a clean benchmark: same data in, same JSON
out, only the reasoning loop differs.

## How it works

```
match + DataSource
        │
        ▼
 buildMatchContext ───► normalised MatchContext  (Elo, form, key players,
        │                                          head-to-head, optional market)
        ▼
 buildMessages ───────► one objective-data block (identical for every model)
        │
        ▼
 predictMatch ────────► agent loop
        │                 ├─ plan
        │                 ├─ web_search  (budgeted, fail-soft)
        │                 └─ final JSON
        ▼
 parsePrediction ─────► { probs:[h,d,a], predOutcome, predScore:[h,a], reasoning }
```

- **Model-agnostic** — every model is reached through OpenRouter by slug
  (`anthropic/claude-opus-4.8`, `openai/gpt-5.5`, …). Swapping models never
  touches the harness, so the benchmark stays apples-to-apples.
- **Data-source agnostic** — the agent never touches a database directly. It
  consumes a normalised `MatchContext`. To run it on your own data, implement
  the small `DataSource` interface (`src/context/datasource.js`) over whatever
  backend you like.
- **With / without market signal** — pass `opts.odds` to feed margin-removed
  market probabilities, or omit it to forecast purely from fundamentals. The
  two runs share the very same context.
- **Budgeted, fail-soft web search** — Tavily when a key is present, otherwise a
  free DuckDuckGo fallback. Each prediction gets an isolated search budget; a
  search that times out or errors is skipped, never fatal.

## Quick start

```bash
npm install
cp .env.example .env        # add your OPENROUTER_API_KEY
npm run example             # forecasts a sample fixture with an in-memory data source
```

Expected output is a single JSON prediction:

```json
{
  "model": "anthropic/claude-opus-4.8",
  "fixtureId": "demo-1",
  "probs": [0.62, 0.24, 0.14],
  "predOutcome": 0,
  "predScore": [2, 0],
  "reasoning": "...",
  "steps": 7,
  "engine": "agent"
}
```

## Using your own data

Implement the `DataSource` interface (documented in
`src/context/datasource.js`) and pass it to `predictMatch`:

```js
import { predictMatch } from './src/index.js';

const myDataSource = {
  async teamProfile(code) { /* return { name, elo, form, regulars, ... } */ },
  async headToHead(home, away) { /* return [{ meeting_date, hg, ag, ... }] */ },
  async marketOdds(fixtureId) { /* return { home, draw, away, n } | null */ },
};

const pred = await predictMatch('anthropic/claude-opus-4.8', match, myDataSource, {
  maxSearches: 8,            // web-search budget per forecast
  recursionLimit: 50,       // max agent steps (plan + tool calls) per forecast
  odds: await myDataSource.marketOdds(match.fixtureId), // optional market signal
});
```

`examples/sampleDataSource.js` is a complete, minimal example to copy from.

## Layout

```
src/
  agent/
    predict.js       # the plan + web-search agent loop
    runtime.js       # agent runtime adapter
    model.js         # OpenRouter chat-model factory
    webSearch.js     # budgeted, fail-soft web_search tool
    prompt.js        # the forecasting system prompt
  context/
    schema.js        # buildMatchContext + buildMessages (context → prompt)
    datasource.js    # the DataSource interface you implement
  parse.js           # the strict JSON output contract
examples/
  predictOne.js      # runnable single-fixture demo
  sampleDataSource.js
```

## License

Dual-licensed:

- **Noncommercial use** (personal study, academic and nonprofit research,
  experimentation, evaluation) is free under the
  [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
  (full text in [LICENSE.md](./LICENSE.md)).
- **Commercial use requires a separate license.** Please reach out at
  **songjincen@gmail.com** to arrange one.
