/* =====================================================================
   Run the agent on a single sample fixture.

     OPENROUTER_API_KEY=... node examples/predictOne.js
     # optional: TAVILY_API_KEY=... for higher-quality web search
   ===================================================================== */

import { predictMatch } from '../src/index.js';
import { sampleDataSource, sampleMatch } from './sampleDataSource.js';

const slug = process.env.MODEL_SLUG || 'anthropic/claude-opus-4.8';

const pred = await predictMatch(slug, sampleMatch, sampleDataSource, {
  maxSearches: 8,
  recursionLimit: 50,
});

console.log(JSON.stringify(pred, null, 2));
