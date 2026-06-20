/* =====================================================================
   Agent: model factory
   ---------------------------------------------------------------------
   The agent runs through OpenRouter so any chat model (Claude, GPT,
   Gemini, DeepSeek, Llama, ...) can be swapped in by slug without
   touching the harness.

   LangChain's ChatOpenAI speaks the OpenAI-compatible API that
   OpenRouter exposes, so we just repoint its baseURL and pass the key.
   ===================================================================== */

import { ChatOpenAI } from '@langchain/openai';

/* Build a LangChain chat model bound to an OpenRouter slug
   (e.g. 'anthropic/claude-opus-4.8', 'openai/gpt-5.5'). */
export function makeAgentModel(slug, { temperature = 0.3, maxTokens = 2500 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return new ChatOpenAI({
    model: slug,
    temperature,
    maxTokens,
    apiKey: key,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://cup-arena.app',
        'X-Title': 'Open Cup Arena',
      },
    },
  });
}
