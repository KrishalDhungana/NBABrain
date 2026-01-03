import type { Team, Player, PlayerStats, PlayerSkills, DailySummary, GameHighlight } from '../types';

// Small, deterministic helpers to build placeholder data
const daysArray = (n: number): string[] => {
  const arr: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
};

const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

const TEAM_SEED = [
  { id: 1, name: 'Los Angeles Lakers', abbreviation: 'LAL', conference: 'West' as const, baseElo: 1605, color: '#8110ebff' },
  { id: 2, name: 'Boston Celtics', abbreviation: 'BOS', conference: 'East' as const, baseElo: 1660, color: '#16bb5bff' },
  { id: 3, name: 'Golden State Warriors', abbreviation: 'GSW', conference: 'West' as const, baseElo: 1580, color: '#f0d53cff' },
  { id: 4, name: 'Denver Nuggets', abbreviation: 'DEN', conference: 'West' as const, baseElo: 1650, color: '#003c97ff' },
  { id: 5, name: 'Milwaukee Bucks', abbreviation: 'MIL', conference: 'East' as const, baseElo: 1635, color: '#fff4b4ff' },
  { id: 6, name: 'New York Knicks', abbreviation: 'NYK', conference: 'East' as const, baseElo: 1595, color: '#F58426' },
  { id: 7, name: 'Miami Heat', abbreviation: 'MIA', conference: 'East' as const, baseElo: 1570, color: '#ff165cff' },
  { id: 8, name: 'Oklahoma City Thunder', abbreviation: 'OKC', conference: 'West' as const, baseElo: 1620, color: '#007AC1' },
];

// Build a simple 30-day elo curve around base using a smooth variation
const buildEloHistory = (base: number): { date: string; elo: number }[] => {
  const dates = daysArray(30);
  return dates.map((date, idx) => {
    const wiggle = Math.round(20 * Math.sin(idx / 4) + 10 * Math.cos(idx / 7));
    return { date, elo: clamp(base + wiggle, 1450, 1750) };
  });
};

const POSITIONS: Array<Player['position']> = ['PG', 'SG', 'SF', 'PF', 'C'];

const makePlayer = (id: number, name: string, position: Player['position'], teamName: string, teamAbbreviation: string, teamLogoColor: string, base: number): Player => {
  // Add deterministic jitter and lower bench ratings to avoid everyone clustering at 97
  const jitter = Math.sin(id * 1337) * 4; // ~[-4, 4]
  const idxWithinTeam = id % 100; // 1..99, our ids are teamId*100 + idx
  const benchPenalty = idxWithinTeam >= 6 ? 5 : idxWithinTeam >= 4 ? 2 : 0; // last 4 are bench
  const baseRating = base / 22 + 55 + (position === 'PG' ? 2 : 0) + jitter - benchPenalty;
  const rating = clamp(Math.round(baseRating), 72, 96);
  const stats: PlayerStats = {
    ppg: +(15 + (rating - 70) * 0.6 + (position === 'C' ? -2 : 0)).toFixed(1),
    ast: +(3 + (position === 'PG' ? 6 : position === 'SG' ? 2 : 1) + (rating - 80) * 0.05).toFixed(1),
    reb: +(4 + (position === 'C' || position === 'PF' ? 4 : 1) + (rating - 80) * 0.04).toFixed(1),
    stl: +(0.6 + (rating - 80) * 0.02).toFixed(1),
    blk: +(position === 'C' || position === 'PF' ? 0.8 : 0.3 + (rating - 80) * 0.01).toFixed(1),
    fgPercentage: clamp(0.42 + (rating - 80) * 0.003, 0.40, 0.62),
    per: clamp(12 + (rating - 80) * 0.6, 10, 31),
    tsPercentage: clamp(0.50 + (rating - 80) * 0.003, 0.45, 0.68),
    ws: clamp(2 + (rating - 80) * 0.4, 1, 14),
  };
  const skills: PlayerSkills = {
    shooting: clamp(70 + (position === 'SG' || position === 'SF' ? 10 : 0) + Math.round((rating - 80) * 0.8), 60, 99),
    defense: clamp(70 + (position === 'PF' || position === 'C' ? 8 : 0) + Math.round((rating - 80) * 0.7), 60, 99),
    playmaking: clamp(70 + (position === 'PG' ? 12 : 0) + Math.round((rating - 80) * 0.8), 60, 99),
    athleticism: clamp(70 + Math.round((rating - 80) * 0.8), 60, 99),
    rebounding: clamp(70 + (position === 'C' || position === 'PF' ? 12 : 0) + Math.round((rating - 80) * 0.8), 60, 99),
  };

  return { id, name, position, courtPosition: position as Player['courtPosition'], rating, teamName, teamLogoColor, teamAbbreviation, stats, skills };
};

const buildTeam = (seed: typeof TEAM_SEED[number]): Team => {
  const eloHistory = buildEloHistory(seed.baseElo);

  const rosterNames = [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'
  ];
  const positions = ['PG','SG','SF','PF','C','SG','SF','PG'] as Array<Player['position']>;

  const players: Player[] = rosterNames.map((label, idx) =>
    makePlayer(
      seed.id * 100 + idx + 1,
      `${seed.abbreviation} ${label}`,
      positions[idx],
      seed.name,
      seed.abbreviation,
      seed.color,
      seed.baseElo
    )
  );

  const opponents = TEAM_SEED.filter(t => t.id !== seed.id);
  const recentDates = daysArray(5);
  const gameHistory = opponents.slice(0, 5).map((opp, i) => {
    const teamElo = eloHistory[eloHistory.length - 1 - i]?.elo ?? seed.baseElo;
    const oppElo = opp.baseElo + (i % 2 === 0 ? 10 : -10);
    const teamWon = teamElo >= oppElo;
    const margin = Math.abs(Math.round((teamElo - oppElo) / 50)) + 3;
    const score = teamWon ? `${100 + margin}-${98}` : `${98}-${100 + margin}`;
    const eloChange = teamWon ? +Math.min(15, Math.max(5, Math.round((oppElo - teamElo) / 40 + 8))) : -Math.min(15, Math.max(5, Math.round((teamElo - oppElo) / 40 + 8)));
    const date = recentDates[recentDates.length - 1 - i] ?? recentDates[0];
    return {
      opponentName: opp.name,
      opponentAbbreviation: opp.abbreviation,
      opponentElo: opp.baseElo,
      score,
      result: teamWon ? 'W' as const : 'L' as const,
      eloChange,
      date,
      home: i % 2 === 0,
      eloBefore: Math.round(teamElo),
      eloAfter: Math.round(teamElo + eloChange),
    };
  });
  const eloChangeLast5 = Math.round(gameHistory.slice(0, 5).reduce((acc, game) => acc + (game.eloChange ?? 0), 0));

  return {
    id: seed.id,
    name: seed.name,
    abbreviation: seed.abbreviation,
    conference: seed.conference,
    elo: eloHistory[eloHistory.length - 1]?.elo ?? seed.baseElo,
    eloChangeLast5,
    players,
    logoColor: seed.color,
    eloHistory,
    gameHistory,
    categoryRatings: {
      offense: clamp(Math.round(70 + (seed.baseElo - 1500) / 5), 60, 95),
      defense: clamp(Math.round(68 + (seed.baseElo - 1500) / 6), 60, 95),
      pacePressure: clamp(65 + (seed.id % 5) * 3, 60, 92),
      hustle: clamp(64 + (seed.id % 7) * 2, 60, 90),
      clutch: clamp(66 + (seed.id % 6) * 3, 60, 94),
    },
  };
};

const TEAMS: Team[] = TEAM_SEED.map(buildTeam);

// Enrich teams with record, team stats, and conference ranking
(() => {
  const byConf: Record<'East' | 'West', Team[]> = { East: [], West: [] } as any;
  TEAMS.forEach(t => byConf[t.conference].push(t));
  (['East', 'West'] as const).forEach(conf => {
    const ranked = [...byConf[conf]].sort((a, b) => b.elo - a.elo);
    ranked.forEach((team, idx) => {
      const gp = 60; // pretend 60 games played so far
      const elo = team.elo;
      const winPct = 1 / (1 + Math.pow(10, (1500 - elo) / 400));
      const noise = Math.sin(team.id * 97) * 1.5; // small deterministic offset
      const wins = Math.max(10, Math.min(gp - 5, Math.round(winPct * gp + noise)));
      const losses = gp - wins;
      const offRtg = +(108 + (elo - 1500) / 12 + Math.sin(team.id) * 1.2).toFixed(1);
      const defRtg = +(109 - (elo - 1500) / 16 + Math.cos(team.id) * 1.2).toFixed(1);
      const netRating = +(offRtg - defRtg).toFixed(1);
      const threesPerGame = +(11 + (elo - 1500) / 80 + Math.sin(team.id) * 0.6).toFixed(1);
      const turnoversPerGame = +(14 - (elo - 1500) / 120 + Math.cos(team.id) * 0.4).toFixed(1);
      const fgPct = +clamp(0.44 + (elo - 1500) / 3500, 0.43, 0.52).toFixed(3);
      const fg3Pct = +clamp(0.33 + (elo - 1500) / 5000, 0.32, 0.41).toFixed(3);
      const ftPct = +clamp(0.74 + (elo - 1500) / 5000, 0.72, 0.86).toFixed(3);
      team.seed = idx + 1;
      (team as any).record = { wins, losses, conferenceRank: idx + 1, seed: idx + 1 };
      (team as any).teamStats = {
        offRating: offRtg,
        defRating: defRtg,
        netRating,
        threesPerGame,
        turnoversPerGame,
        plusMinus: netRating,
        fgPct,
        fg3Pct,
        ftPct,
        offRatingRank: 0,
        defRatingRank: 0,
        netRatingRank: 0,
        threesPerGameRank: 0,
        turnoversPerGameRank: 0,
        plusMinusRank: 0,
        fgPctRank: 0,
        fg3PctRank: 0,
        ftPctRank: 0,
      };
    });
  });
  const rankTeams = (key: keyof Team['teamStats'], ascending = false) => {
    const sorted = [...TEAMS].filter(t => t.teamStats).sort((a, b) => {
      const aVal = (a.teamStats as any)?.[key] ?? 0;
      const bVal = (b.teamStats as any)?.[key] ?? 0;
      return ascending ? aVal - bVal : bVal - aVal;
    });
    sorted.forEach((team, idx) => {
      if (!team.teamStats) return;
      const rankKey = `${key as string}Rank`;
      (team.teamStats as any)[rankKey] = idx + 1;
    });
  };
  rankTeams('offRating');
  rankTeams('defRating', true);
  rankTeams('netRating');
  rankTeams('threesPerGame');
  rankTeams('turnoversPerGame', true);
  rankTeams('plusMinus');
  rankTeams('fgPct');
  rankTeams('fg3Pct');
  rankTeams('ftPct');
})();

const buildDailySummary = (teams: Team[]): DailySummary => {
  const pairs: [Team, Team][] = [
    [teams[1], teams[0]],
    [teams[3], teams[2]],
    [teams[4], teams[5]],
    [teams[6], teams[7]],
    [teams[0], teams[2]],
  ];
  const gameHighlights: GameHighlight[] = pairs.map(([home, away], idx) => {
    const homeElo = home.elo;
    const awayElo = away.elo;
    const homeFavored = homeElo >= awayElo;
    const margin = Math.max(2, Math.round(Math.abs(homeElo - awayElo) / 50) + 1);
    const score = homeFavored ? `${100 - (idx % 5)}-${100 - (idx % 3) + margin}` : `${100 - (idx % 3) + margin}-${100 - (idx % 5)}`;
    const homeEloChange = homeFavored ? +Math.min(12, Math.max(4, Math.round((awayElo - homeElo) / 50 + 7))) : -Math.min(12, Math.max(4, Math.round((homeElo - awayElo) / 50 + 7)));
    const awayEloChange = -homeEloChange;
    return {
      homeTeam: { name: home.name, elo: homeElo, logoColor: home.logoColor },
      awayTeam: { name: away.name, elo: awayElo, logoColor: away.logoColor },
      score,
      status: 'Final',
      homeEloChange,
      awayEloChange,
    };
  });

  const playerPerformances = TEAMS.slice(0, 8).map((team, i) => {
    const top = [...team.players].sort((a, b) => b.rating - a.rating)[0];
    const fpts = top.stats.ppg * 1 + top.stats.reb * 1.2 + top.stats.ast * 1.5 + top.stats.blk * 3 + top.stats.stl * 3;
    return {
      playerName: top.name,
      teamName: team.name,
      fantasyScore: +(fpts + (i % 3)).toFixed(1),
      statsLine: `${Math.round(top.stats.ppg)} PTS, ${Math.round(top.stats.reb)} REB, ${Math.round(top.stats.ast)} AST`,
    };
  }).sort((a, b) => b.fantasyScore - a.fantasyScore).slice(0, 8);

  return { gameHighlights, playerPerformances };
};

// Public API compatible with geminiService
export const fetchTeamData = async (): Promise<Team[]> => {
  // Simulate latency
  await new Promise(r => setTimeout(r, 200));
  return TEAMS;
};

export const fetchDailySummaryData = async (): Promise<DailySummary | null> => {
  await new Promise(r => setTimeout(r, 150));
  return buildDailySummary(TEAMS);
};

export const fetchTeamAnalysis = async (teamName: string): Promise<string> => {
  await new Promise(r => setTimeout(r, 80));
  return `${teamName} show solid form and balanced roster depth. ELO trend suggests competitive consistency with room to climb against elite opponents.`;
};
