export interface PlayerSkills {
  shooting: number;
  defense: number;
  playmaking: number;
  athleticism: number;
  rebounding: number;
}

export interface PlayerStats {
  gp?: number;
  min?: number;
  ppg: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
  fgPercentage: number;
  fg3m?: number;
  fg3a?: number;
  fg3Pct?: number;
  tov?: number;
  plusMinus?: number;
  per?: number;
  tsPercentage?: number;
  ws?: number;
}

export type PlayerPosition = string;
export type CourtPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Player {
  id: number;
  name: string;
  position: PlayerPosition;
  courtPosition: CourtPosition;
  rating: number;
  skills: PlayerSkills;
  stats: PlayerStats;
  teamName: string;
  teamLogoColor: string;
  teamAbbreviation: string;
  detail?: PlayerDataRecord;
}

export interface EloHistoryPoint {
  date: string; // e.g., "2023-10-25"
  elo: number;
}

export interface GameHistory {
  opponentName: string;
  opponentElo: number;
  score: string; // e.g., "110-105"
  result: 'W' | 'L';
  eloChange: number;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  conferenceRank: number;
}

export interface TeamStats {
  plusMinus: number;
  offensiveRating: number;
  defensiveRating: number;
}

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  conference: 'East' | 'West';
  elo: number;
  eloChangeLast5: number;
  players: Player[];
  logoColor: string;
  eloHistory: EloHistoryPoint[];
  gameHistory: GameHistory[];
  record?: TeamRecord;
  teamStats?: TeamStats;
}

// For "Games Today" Tab
export interface GameHighlight {
  homeTeam: { name: string; elo: number; logoColor: string };
  awayTeam: { name: string; elo: number; logoColor: string };
  score: string;
  status: string; // e.g., "Final"
  homeEloChange: number;
  awayEloChange: number;
}

export interface PlayerPerformance {
  playerName: string;
  teamName: string;
  fantasyScore: number;
  statsLine: string; // e.g., "42 PTS, 12 REB, 8 AST"
}

export interface DailySummary {
  gameHighlights: GameHighlight[];
  playerPerformances: PlayerPerformance[];
}

// Player data for Rankings tab (from data-pipelines/player_pipeline.py)
export interface PlayerIdentity {
  playerId: number | null;
  firstName: string;
  lastName: string;
  name: string;
  teamId: number | null;
  teamCity: string;
  team: string;
  teamAbbreviation: string;
  jersey?: string;
  position: string;
  height?: string;
  weight?: string;
}

export interface PlayerPerGame {
  gp?: number | null;
  min?: number | null;
  pts?: number | null;
  ast?: number | null;
  reb?: number | null;
  stl?: number | null;
  blk?: number | null;
  fgm?: number | null;
  fga?: number | null;
  fgPct?: number | null;
  ftm?: number | null;
  fta?: number | null;
  ftPct?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  fg3Pct?: number | null;
  tov?: number | null;
  plusMinus?: number | null;
}

export interface PlayerAdvanced {
  nbaFantasyPoints?: number | null;
  offRating?: number | null;
  defRating?: number | null;
  netRating?: number | null;
  tsPct?: number | null;
  usgPct?: number | null;
  pie?: number | null;
}

export interface PlayerRatingsPerCategory {
  sco?: number | null;
  ply?: number | null;
  reb?: number | null;
  def?: number | null;
  hst?: number | null;
  imp?: number | null;
}

export interface PlayerRatingsSummary {
  perCategory: PlayerRatingsPerCategory;
  overall: number | null;
}

export interface PlayerStatsBundle {
  perGame: PlayerPerGame;
  advanced: PlayerAdvanced;
}

export interface PlayerDataRecord {
  identity: PlayerIdentity;
  stats: PlayerStatsBundle;
  ratings: PlayerRatingsSummary;
}

export interface PlayerDatasetPayload {
  season: string;
  seasonType: string;
  lastUpdated: string;
  players: PlayerDataRecord[];
}
