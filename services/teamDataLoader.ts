import type { Team, EloHistoryPoint, GameHistory, TeamStats, TeamCategoryRatings, TeamRecord } from '../types';

interface RawTeamDataset {
  season?: string;
  seasonType?: string;
  teams?: RawTeam[];
}

interface RawTeam {
  teamId: number;
  name: string;
  abbreviation: string;
  conference: string;
  seed?: number;
  record?: string;
  categoryRatings?: TeamCategoryRatings;
  teamStats?: RawTeamStats;
  elo?: RawElo;
  games?: RawGame[];
}

interface RawTeamStats {
  offRating?: number;
  offRatingRank?: number;
  defRating?: number;
  defRatingRank?: number;
  netRating?: number;
  netRatingRank?: number;
  threesPerGame?: number;
  threesPerGameRank?: number;
  turnoversPerGame?: number;
  turnoversPerGameRank?: number;
  plusMinus?: number;
  plusMinusRank?: number;
  fgPct?: number;
  fgPctRank?: number;
  fg3Pct?: number;
  fg3PctRank?: number;
  ftPct?: number;
  ftPctRank?: number;
}

interface RawElo {
  current?: number;
  history?: Array<{ date: string; elo: number }>;
}

interface RawGame {
  gameId: string;
  date: string;
  home?: boolean;
  opponentTeamId?: number;
  opponentTeamName: string;
  opponentAbbreviation?: string;
  teamScore: number;
  opponentScore: number;
  margin?: number;
  result: string;
  eloBefore?: number;
  eloAfter?: number;
  eloChange?: number;
}

// Primary team colors (Color 1) aligned with teamcolorcodes.com.
const TEAM_COLORS: Record<string, string> = {
  ATL: '#E03A3E',
  BOS: '#007A33',
  BKN: '#000000',
  CHA: '#1D1160',
  CHI: '#CE1141',
  CLE: '#860038',
  DAL: '#00538C',
  DEN: '#0E2240',
  DET: '#C8102E',
  GSW: '#1D428A',
  HOU: '#CE1141',
  IND: '#002D62',
  LAC: '#C8102E',
  LAL: '#552583',
  MEM: '#5D76A9',
  MIA: '#98002E',
  MIL: '#00471B',
  MIN: '#0C2340',
  NOP: '#0C2340',
  NYK: '#006BB6',
  OKC: '#007AC1',
  ORL: '#0077C0',
  PHI: '#006BB6',
  PHX: '#1D1160',
  POR: '#E03A3E',
  SAC: '#5A2D81',
  SAS: '#C4CED4',
  TOR: '#CE1141',
  UTA: '#002B5C',
  WAS: '#002B5C',
};

const FALLBACK_COLORS = [
  '#f97316', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899',
  '#14b8a6', '#3b82f6', '#6366f1', '#84cc16', '#d946ef', '#0ea5e9'
];

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const num = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : undefined;
};

const roundNumber = (value: unknown): number | undefined => {
  const num = asNumber(value);
  return num === undefined ? undefined : Math.round(num);
};

const pickColor = (abbreviation: string, index: number): string => {
  const key = (abbreviation || '').toUpperCase();
  return TEAM_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

const normalizeConference = (value: string | undefined): 'East' | 'West' => {
  return (value || '').toLowerCase().includes('west') ? 'West' : 'East';
};

const parseRecord = (raw: string | undefined, seed?: number): TeamRecord | undefined => {
  if (!raw) return seed ? { wins: 0, losses: 0, conferenceRank: seed, seed, raw } : undefined;
  const match = raw.match(/(\d+)\s*-\s*(\d+)/);
  const wins = match ? Number(match[1]) : undefined;
  const losses = match ? Number(match[2]) : undefined;
  if (wins === undefined || losses === undefined) {
    return seed ? { wins: 0, losses: 0, conferenceRank: seed, seed, raw } : undefined;
  }
  const conferenceRank = seed ?? undefined;
  return {
    wins,
    losses,
    conferenceRank: conferenceRank ?? 0,
    seed: conferenceRank ?? seed,
    raw,
  };
};

const mapTeamStats = (stats?: RawTeamStats): TeamStats | undefined => {
  if (!stats) return undefined;
  return {
    offRating: asNumber(stats.offRating) ?? 0,
    offRatingRank: roundNumber(stats.offRatingRank) ?? 0,
    defRating: asNumber(stats.defRating) ?? 0,
    defRatingRank: roundNumber(stats.defRatingRank) ?? 0,
    netRating: asNumber(stats.netRating) ?? 0,
    netRatingRank: roundNumber(stats.netRatingRank) ?? 0,
    threesPerGame: asNumber(stats.threesPerGame) ?? 0,
    threesPerGameRank: roundNumber(stats.threesPerGameRank) ?? 0,
    turnoversPerGame: asNumber(stats.turnoversPerGame) ?? 0,
    turnoversPerGameRank: roundNumber(stats.turnoversPerGameRank) ?? 0,
    plusMinus: asNumber(stats.plusMinus) ?? 0,
    plusMinusRank: roundNumber(stats.plusMinusRank) ?? 0,
    fgPct: asNumber(stats.fgPct) ?? 0,
    fgPctRank: roundNumber(stats.fgPctRank) ?? 0,
    fg3Pct: asNumber(stats.fg3Pct) ?? 0,
    fg3PctRank: roundNumber(stats.fg3PctRank) ?? 0,
    ftPct: asNumber(stats.ftPct) ?? 0,
    ftPctRank: roundNumber(stats.ftPctRank) ?? 0,
  };
};

const mapEloHistory = (elo?: RawElo): EloHistoryPoint[] => {
  if (!elo?.history || !Array.isArray(elo.history)) return [];
  return [...elo.history]
    .filter(point => point?.date)
    .map(point => ({
      date: point.date,
      elo: roundNumber(point.elo) ?? 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const computeEloChangeLastN = (history: EloHistoryPoint[], games: GameHistory[], n: number): number => {
  if (games.length > 0) {
    const sorted = [...games].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const change = sorted
      .slice(0, n)
      .reduce((acc, game) => acc + (game.eloChange ?? 0), 0);
    return Math.round(change);
  }

  if (!history.length) return 0;
  if (history.length <= n) return Math.round(history[history.length - 1].elo - history[0].elo);
  const fromIdx = history.length - n - 1;
  const start = history[fromIdx]?.elo ?? history[0].elo;
  const end = history[history.length - 1].elo;
  return Math.round(end - start);
};

const mapGameHistory = (games?: RawGame[]): GameHistory[] => {
  if (!games || !Array.isArray(games)) return [];
  return [...games]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(game => {
      const score = `${roundNumber(game.teamScore) ?? 0}-${roundNumber(game.opponentScore) ?? 0}`;
      return {
        opponentName: game.opponentTeamName ?? 'Opponent',
        opponentAbbreviation: game.opponentAbbreviation,
        score,
        result: game.result === 'W' ? 'W' : 'L',
        eloChange: roundNumber(game.eloChange) ?? 0,
        date: game.date,
        home: !!game.home,
        eloBefore: roundNumber(game.eloBefore),
        eloAfter: roundNumber(game.eloAfter),
      } as GameHistory;
    });
};

const ensureHistory = (history: EloHistoryPoint[], elo: number): EloHistoryPoint[] => {
  if (history.length) return history;
  const today = new Date().toISOString().slice(0, 10);
  return [{ date: today, elo }];
};

const normalizeCategories = (raw?: TeamCategoryRatings): TeamCategoryRatings | undefined => {
  if (!raw) return undefined;
  return {
    offense: roundNumber(raw.offense) ?? 0,
    defense: roundNumber(raw.defense) ?? 0,
    pacePressure: roundNumber(raw.pacePressure) ?? 0,
    hustle: roundNumber(raw.hustle) ?? 0,
    clutch: roundNumber(raw.clutch) ?? 0,
  };
};

const mapTeam = (raw: RawTeam, index: number, meta: RawTeamDataset): Team => {
  const history = ensureHistory(mapEloHistory(raw.elo), roundNumber(raw.elo?.current) ?? 0);
  const elo = roundNumber(raw.elo?.current) ?? history[history.length - 1].elo ?? 0;
  const gameHistory = mapGameHistory(raw.games);
  const eloChangeLast5 = computeEloChangeLastN(history, gameHistory, 5);

  return {
    id: raw.teamId ?? index,
    name: raw.name,
    abbreviation: (raw.abbreviation || '').toUpperCase(),
    conference: normalizeConference(raw.conference),
    seed: raw.seed,
    elo,
    eloChangeLast5,
    players: [],
    logoColor: pickColor(raw.abbreviation, index),
    eloHistory: history,
    gameHistory,
    record: parseRecord(raw.record, raw.seed),
    teamStats: mapTeamStats(raw.teamStats),
    categoryRatings: normalizeCategories(raw.categoryRatings),
    season: meta.season,
    seasonType: meta.seasonType,
  };
};

const TEAM_DATA_URLS = ['/data/teams.json', '/data/teams.sample.json'];

export const loadTeamsFromJson = async (): Promise<Team[]> => {
  for (const url of TEAM_DATA_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const payload: RawTeamDataset = await res.json();
      if (!payload?.teams || !Array.isArray(payload.teams) || payload.teams.length === 0) continue;
      return payload.teams.map((team, idx) => mapTeam(team, idx, payload));
    } catch (err) {
      console.warn(`Failed to load team data from ${url}`, err);
    }
  }
  return [];
};

export default loadTeamsFromJson;
