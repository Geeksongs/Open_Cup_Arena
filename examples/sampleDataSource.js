/* =====================================================================
   Example in-memory DataSource
   ---------------------------------------------------------------------
   A minimal DataSource backed by a couple of hand-written fixtures, so
   the example runs without any database or external feed. Swap this for
   your own adapter (SQL / stats API / CSV) to forecast real matches.
   ===================================================================== */

const TEAMS = {
  BRA: {
    name: 'Brazil', code: 'BRA', elo: 2010, formRating: 7.4, xgFor: 2.1, xgN: 6,
    formation: '4-2-3-1',
    form: [
      { opponent: 'Argentina', gf: 1, ga: 1, result: 'D', venue: 'away' },
      { opponent: 'Chile', gf: 3, ga: 0, result: 'W', venue: 'home' },
    ],
    regulars: [{ name: 'Vinicius Jr', club: 'Real Madrid', rating: 7.9, goals: 18, assists: 9, position: 'LW' }],
    scorers: [{ name: 'Vinicius Jr', goals: 18, assists: 9 }],
    suspended: [],
    lineup: [],
  },
  SRB: {
    name: 'Serbia', code: 'SRB', elo: 1760, formRating: 6.8, xgFor: 1.3, xgN: 5,
    formation: '3-4-2-1',
    form: [
      { opponent: 'Switzerland', gf: 2, ga: 3, result: 'L', venue: 'away' },
      { opponent: 'Denmark', gf: 0, ga: 0, result: 'D', venue: 'home' },
    ],
    regulars: [{ name: 'Dusan Vlahovic', club: 'Juventus', rating: 7.1, goals: 16, assists: 3, position: 'ST' }],
    scorers: [{ name: 'Dusan Vlahovic', goals: 16, assists: 3 }],
    suspended: [],
    lineup: [],
  },
};

export const sampleDataSource = {
  async teamProfile(code) {
    return TEAMS[code] || null;
  },
  async headToHead() {
    return [
      { meeting_date: '2022-11-24', h_team: 'Brazil', a_team: 'Serbia', hg: 2, ag: 0, league: 'World Cup' },
    ];
  },
  async marketOdds() {
    return null; // no market for the sample fixture
  },
};

export const sampleMatch = {
  fixtureId: 'demo-1',
  homeCode: 'BRA', homeName: 'Brazil',
  awayCode: 'SRB', awayName: 'Serbia',
  competition: 'FIFA World Cup 2026',
  group: 'G', stage: 'group',
  venue: 'MetLife Stadium', city: 'East Rutherford',
  kickoff: '2026-06-18T19:00:00Z',
};
