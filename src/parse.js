/* =====================================================================
   Forecast output contract
   ---------------------------------------------------------------------
   Parses the model's final JSON message into a normalised prediction.
   The same contract is used whether the forecast comes from the deep
   agent or any other engine, so results are directly comparable.

   Returns: { probs:[h,d,a], predOutcome, predScore:[home,away], reasoning }
   ===================================================================== */

function extractScore(obj) {
  const raw = obj.scoreline ?? obj.score ?? obj.predicted_score ?? obj.final_score;
  const toInt = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; };

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const h = toInt(raw.home ?? raw.h ?? raw.home_goals);
    const a = toInt(raw.away ?? raw.a ?? raw.away_goals);
    if (h !== null && a !== null) return [h, a];
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    const h = toInt(raw[0]), a = toInt(raw[1]);
    if (h !== null && a !== null) return [h, a];
  }
  if (typeof raw === 'string') {
    const m = raw.match(/(\d+)\s*[-:–]\s*(\d+)/);
    if (m) return [Number(m[1]), Number(m[2])];
  }
  throw new Error('MISSING_SCORELINE');
}

export function parsePrediction(text) {
  // strip markdown code fences some models wrap around the JSON
  const clean = String(text).replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  let obj;
  try {
    obj = JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('model output contained no JSON');
    obj = JSON.parse(m[0]);
  }

  const pr = obj.probabilities || obj.probs || {};
  let h = Number(pr.home_win ?? pr.home ?? pr.h);
  let d = Number(pr.draw ?? pr.d);
  let a = Number(pr.away_win ?? pr.away ?? pr.a);
  if (![h, d, a].every(Number.isFinite)) throw new Error('missing/invalid probabilities in model output');
  const s = h + d + a;
  if (s <= 0) throw new Error('probabilities sum to zero');
  h /= s; d /= s; a /= s;

  const [ph, pa] = extractScore(obj);

  const probs = [h, d, a];
  const predOutcome = probs.indexOf(Math.max(...probs));

  return {
    probs: probs.map(p => Math.round(p * 1e4) / 1e4),
    predOutcome,
    predScore: [ph, pa],
    reasoning: String(obj.reasoning ?? '').trim().slice(0, 2000),
  };
}
