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
