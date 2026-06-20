/* =====================================================================
   Data source interface
   ---------------------------------------------------------------------
   The agent is data-source agnostic. It consumes a normalised
   MatchContext and never talks to a database, an API or a feed
   directly. To run the agent against your own data, implement the
   DataSource interface below (back it with whatever you like — SQL,
   a stats API, a CSV, an in-memory map) and pass it to buildMatchContext.

   A DataSource is any object exposing these async methods. Each returns
   plain JSON; shapes are documented inline.

     teamProfile(code)        -> {
        name, code, elo,             // string, string, number
        formRating,                  // number|null  aggregate squad strength
        xgFor, xgN,                  // number|null, number  (xG, sample size)
        form,                        // [{ opponent, gf, ga, result, venue }]
        regulars,                    // [{ name, club, rating, goals, assists, position }]
        scorers,                     // [{ name, goals, assists }]
        suspended,                   // [string]  player names unavailable
        formation,                   // string|null  e.g. "4-3-3"
        lineup,                      // [{ player_name, pos, rating, club, goals }]
     }

     headToHead(homeCode, awayCode) -> [{ meeting_date, h_team, a_team, hg, ag, league }]

     marketOdds(fixtureId)          -> { home, draw, away, n }  | null
        margin-removed implied probabilities; null when no market exists.

   Every method may return null/empty — the formatter degrades
   gracefully and the model is told when a field is unavailable.
   ===================================================================== */

/* A tiny helper so adapters can fail soft: any rejected lookup becomes
   an empty result rather than aborting the whole forecast. */
export async function safe(promise, fallback) {
  try { return (await promise) ?? fallback; }
  catch { return fallback; }
}
