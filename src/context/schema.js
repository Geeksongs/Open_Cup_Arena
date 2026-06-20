/* =====================================================================
   Match context: assembly + prompt formatting
   ---------------------------------------------------------------------
   buildMatchContext() pulls each field from a DataSource (see
   datasource.js) and assembles the normalised MatchContext object.
   buildMessages() renders that object into the objective-data block the
   agent reads. The SAME block is used for every model, so the benchmark
   stays apples-to-apples.

   Market odds are attached by the caller only when a market exists, so a
   "with market signal" and a "without market signal" forecast can be run
   from the very same context.
   ===================================================================== */

import { safe } from './datasource';

/* Standard Elo expectancy with a small home-advantage term. */
function eloHomeWinExpectancy(homeElo, awayElo) {
  const adj = (homeElo + 60) - awayElo;
  return Math.round((1 / (1 + Math.pow(10, -adj / 400))) * 100) / 100;
}

/* Assemble the full objective context for one fixture from a DataSource. */
export async function buildMatchContext(match, ds) {
  const [home, away, h2h] = await Promise.all([
    safe(ds.teamProfile(match.homeCode), { name: match.homeName, code: match.homeCode, elo: 1500 }),
    safe(ds.teamProfile(match.awayCode), { name: match.awayName, code: match.awayCode, elo: 1500 }),
    safe(ds.headToHead(match.homeCode, match.awayCode), []),
  ]);

  return {
    fixtureId: match.fixtureId,
    competition: match.competition ?? 'FIFA World Cup 2026',
    group: match.group ?? '?',
    stage: match.stage ?? 'group',
    venue: match.venue ?? 'TBD',
    city: match.city ?? '',
    kickoff: match.kickoff ?? '',
    home, away, h2h,
    eloHomeWinExpectancy: eloHomeWinExpectancy(home.elo, away.elo),
    odds: null, // attached by the caller when a market exists
  };
}

/* ---- presentation helpers ---------------------------------------- */

function fmtForm(t) {
  const seq = (t.form || []).map(m => `${m.venue === 'home' ? 'H' : 'A'} ${m.result} ${m.gf}-${m.ga} vs ${m.opponent}`).join(' | ');
  return `  ${t.name} — recent form ${seq || 'n/a'}, weighted squad rating ${t.formRating ?? 'n/a'}` +
    `, season xG ${t.xgFor ?? 'n/a'}${t.xgN ? ` (${t.xgN} matches)` : ''}`;
}

function fmtLineup(t) {
  if (!t.lineup || !t.lineup.length) return null;
  const xi = t.lineup.map(p => `${p.player_name}${p.rating ? ` (${p.rating})` : ''}`).join(', ');
  return `  ${t.name} (${t.formation || '?'}): ${xi}`;
}

function fmtPlayers(t) {
  const regs = (t.regulars || []).map(p => `${p.name} (${p.club}, ${p.rating ?? '?'})`).join(', ');
  const sc = (t.scorers || []).map(p => `${p.name} ${p.goals}g`).join(', ');
  const susp = (t.suspended || []).length ? t.suspended.join(', ') : 'none';
  return `  ${t.name}: key players — ${regs || 'n/a'}\n    top scorers (club season): ${sc || 'n/a'}\n    suspended (accumulated cards): ${susp}  [injuries: not available for the World Cup]`;
}

function fmtH2H(ctx) {
  if (!ctx.h2h.length) return '  No recent head-to-head meetings on record.';
  const lines = ctx.h2h.map(m => `    ${m.meeting_date}: ${m.h_team} ${m.hg}-${m.ag} ${m.a_team} (${m.league})`);
  return `  Last ${ctx.h2h.length} meetings:\n${lines.join('\n')}`;
}

/* Render the objective-data block + system prompt into chat messages.
   `systemPrompt` is injected so the agent and any single-shot baseline
   can share the exact same context with different instructions. */
export function buildMessages(ctx, systemPrompt) {
  const oddsBlock = ctx.odds
    ? `\n=== MARKET (implied probabilities, margin-removed${ctx.odds.n ? `, ${ctx.odds.n} books` : ''}) ===\n  home win ${ctx.odds.home}, draw ${ctx.odds.draw ?? 'n/a'}, away win ${ctx.odds.away}`
    : '';

  const lh = fmtLineup(ctx.home), la = fmtLineup(ctx.away);
  const lineupBlock = (lh || la)
    ? `\n=== CONFIRMED STARTING XI ===\n${lh || `  ${ctx.home.name}: not yet announced`}\n${la || `  ${ctx.away.name}: not yet announced`}`
    : '';

  const user =
`=== FIXTURE ===
${ctx.home.name} (home) vs ${ctx.away.name} (away)
${ctx.competition} — Group ${ctx.group}, ${ctx.stage} stage
Venue: ${ctx.venue}, ${ctx.city} | Kickoff (UTC): ${ctx.kickoff}${lineupBlock}

=== TEAM STRENGTH (Elo) ===
  ${ctx.home.name}: ${ctx.home.elo}   ${ctx.away.name}: ${ctx.away.elo}
  Elo home win expectancy ≈ ${ctx.eloHomeWinExpectancy}

=== RECENT FORM ===
${fmtForm(ctx.home)}
${fmtForm(ctx.away)}

=== KEY PLAYERS ===
${fmtPlayers(ctx.home)}
${fmtPlayers(ctx.away)}

=== HEAD-TO-HEAD ===
${fmtH2H(ctx)}${oddsBlock}

Forecast this match now.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: user },
  ];
}
