/* =====================================================================
   Agentic match predictor
   ---------------------------------------------------------------------
   Wraps a chat model in an agent loop that can PLAN and call a
   web_search tool to gather late-breaking info before committing to a
   forecast. The output shape is identical to a single-shot call, so an
   agent forecast is directly comparable to a plain one-shot forecast on
   the same context.

     { model, fixtureId, probs, predOutcome, predScore, reasoning,
       latencyMs, steps, raw, engine }
   ===================================================================== */

import { createAgent } from './runtime';
import { buildMatchContext, buildMessages } from '../context/schema';
import { parsePrediction } from '../parse';
import { AGENT_SYSTEM_PROMPT } from './prompt';
import { makeAgentModel } from './model';
import { makeWebSearchTool } from './webSearch';

/* Pull the plain text out of the agent's final message (model content
   can be a string or an array of content blocks). */
function finalText(result) {
  const msgs = result?.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const role = m?.getType?.() || m?.role || m?._getType?.();
    if (role && role !== 'ai' && role !== 'assistant') continue;
    const c = m?.content;
    if (typeof c === 'string' && c.trim()) return c;
    if (Array.isArray(c)) {
      const t = c.map(p => (typeof p === 'string' ? p : p?.text || '')).join('').trim();
      if (t) return t;
    }
  }
  return '';
}

/* Full agent pipeline for one (match, model).
   `slug` is the OpenRouter model id. `ds` is your DataSource.
   `opts.odds` attaches market signal; omit it for a no-market forecast. */
export async function predictMatch(slug, match, ds, opts = {}) {
  const ctx = await buildMatchContext(match, ds);
  if (opts.odds) ctx.odds = opts.odds;

  const [, userMsg] = buildMessages(ctx, AGENT_SYSTEM_PROMPT);

  const model = makeAgentModel(slug, opts);
  const agent = createAgent({
    model,
    tools: [makeWebSearchTool({ maxCalls: opts.maxSearches ?? 8 })],
    systemPrompt: AGENT_SYSTEM_PROMPT,
  });

  const recursionLimit = opts.recursionLimit ?? 50;
  const t0 = Date.now();
  let result = await agent.invoke(
    { messages: [{ role: 'user', content: `${userMsg.content}\n\nResearch as needed, then forecast this match now.` }] },
    { recursionLimit }
  );

  let content = finalText(result);
  let pred;
  try {
    pred = parsePrediction(content);
  } catch (err) {
    // Nudge once for the full JSON if the model wandered off-contract.
    const nudge =
      String(err.message).includes('MISSING_SCORELINE')
        ? 'Your reply was missing the "scoreline" field. Reply again with ONLY the COMPLETE JSON, including {"scoreline":{"home":<int>,"away":<int>}}.'
        : 'Reply again with ONLY the JSON object specified — no tool calls, no markdown.';
    result = await agent.invoke(
      { messages: [...(result.messages || []), { role: 'user', content: nudge }] },
      { recursionLimit }
    );
    content = finalText(result);
    pred = parsePrediction(content);
  }

  return {
    model: slug,
    fixtureId: match.fixtureId,
    ...pred,
    latencyMs: Date.now() - t0,
    steps: (result.messages || []).length,
    raw: content,
    engine: 'agent',
  };
}
