/* =====================================================================
   Agent runtime
   ---------------------------------------------------------------------
   Thin adapter over the underlying agent runtime so the rest of the
   codebase depends only on this module. `createAgent` builds a model +
   tools loop that can plan and call tools before producing a final
   message.
   ===================================================================== */

import { createDeepAgent } from 'deepagents';

export function createAgent({ model, tools, systemPrompt }) {
  return createDeepAgent({ model, tools, systemPrompt });
}
