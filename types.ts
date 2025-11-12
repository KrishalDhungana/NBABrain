export interface PlayerSkills {
  shooting: number;
  defense: number;
  playmaking: number;
  athleticism: number;
  rebounding: number;
}

export interface PlayerStats {
  ppg: number; // Points Per Game
  ast: number; // Assists Per Game
  reb: number; // Rebounds Per Game
  stl: number; // Steals Per Game
  blk: number; // Blocks Per Game
  fgPercentage: number; // Field Goal Percentage
  per: number; // Player Efficiency Rating
  tsPercentage: number; // True Shooting Percentage
  ws: number; // Win Shares
}

export interface Player {
  id: number;
  name: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  rating: number;
  skills: PlayerSkills;
  stats: PlayerStats;
  teamName: string;
  teamLogoColor: string;
  teamAbbreviation: string;
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

// Player data for Rankings tab and ratings
export interface PlayerIdentity {
  playerId: number;
  name: string;
  teamId: number;
  team: string;
  teamAbbreviation: string;
  jersey?: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
}

export interface PlayerPerGame {
  pts: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  fgPct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  tov: number;
  plusMinus: number;
}

export interface PlayerAdvanced {
  nbaFantasyPoints?: number;
  offRating?: number;
  defRating?: number;
  netRating?: number;
  efgPct?: number;
  tsPct?: number;
  usgPct?: number;
  pie?: number;
}

export interface PlayerTrackingHustle {
  potentialAstPer100?: number;
  boxOutsPer36?: number;
  contestedShotsPer36?: number;
  defendedFgPctDiff?: number; // Opp FG% - Player Defended FG%
  screenAssistsPer36?: number;
  deflectionsPer36?: number;
  looseBallsRecoveredPer36?: number;
  chargesDrawnPer36?: number;
}

export interface PlayerRatings {
  sco: number;
  ply: number;
  reb: number;
  def: number;
  hst: number;
  imp: number;
  overall: number; // position-aware overall rating
}

export interface PlayerDetail {
  identity: PlayerIdentity;
  perGame: PlayerPerGame;
  advanced: PlayerAdvanced;
  tracking: PlayerTrackingHustle;
  ratings: PlayerRatings;
}

export interface PlayerRankRow {
  playerId: number;
  name: string;
  team: string;
  teamAbbreviation: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  jersey?: string;
  pts: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  fgPct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  tov: number;
  nbaFantasyPoints?: number;
  plusMinus: number;
  offRating?: number;
  defRating?: number;
  netRating?: number;
  efgPct?: number;
  tsPct?: number;
  usgPct?: number;
  overall: number;
}
