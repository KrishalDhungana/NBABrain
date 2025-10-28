import { GoogleGenAI, Type } from "@google/genai";
import type { Team, DailySummary } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const playerStatsSchema = {
    type: Type.OBJECT,
    properties: {
        ppg: { type: Type.NUMBER },
        ast: { type: Type.NUMBER },
        reb: { type: Type.NUMBER },
        stl: { type: Type.NUMBER },
        blk: { type: Type.NUMBER },
        fgPercentage: { type: Type.NUMBER, description: "A number between 0.35 and 0.65" },
        per: { type: Type.NUMBER, description: "Player Efficiency Rating, typically between 10 and 30" },
        tsPercentage: { type: Type.NUMBER, description: "True Shooting Percentage, a number between 0.45 and 0.70" },
        ws: { type: Type.NUMBER, description: "Win Shares, a number between 1.0 and 15.0 for a season" },
    },
    required: ['ppg', 'ast', 'reb', 'stl', 'blk', 'fgPercentage', 'per', 'tsPercentage', 'ws'],
};

const playerSkillsSchema = {
    type: Type.OBJECT,
    properties: {
        shooting: { type: Type.INTEGER, description: "A number between 60 and 99" },
        defense: { type: Type.INTEGER, description: "A number between 60 and 99" },
        playmaking: { type: Type.INTEGER, description: "A number between 60 and 99" },
        athleticism: { type: Type.INTEGER, description: "A number between 60 and 99" },
        rebounding: { type: Type.INTEGER, description: "A number between 60 and 99" },
    },
    required: ['shooting', 'defense', 'playmaking', 'athleticism', 'rebounding'],
};

const playerSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.INTEGER },
        name: { type: Type.STRING },
        position: { type: Type.STRING, enum: ['PG', 'SG', 'SF', 'PF', 'C'] },
        rating: { type: Type.INTEGER, description: "A number between 65 and 99" },
        teamName: { type: Type.STRING },
        stats: playerStatsSchema,
        skills: playerSkillsSchema,
    },
    required: ['id', 'name', 'position', 'rating', 'teamName', 'stats', 'skills'],
};

const eloHistorySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "ISO 8601 date string (YYYY-MM-DD) for each of the last 30 days" },
            elo: { type: Type.INTEGER, description: "ELO rating for that day" },
        },
        required: ['date', 'elo'],
    },
};

const gameHistorySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            opponentName: { type: Type.STRING },
            opponentElo: { type: Type.INTEGER },
            score: { type: Type.STRING, description: "e.g., '115-110'" },
            result: { type: Type.STRING, enum: ['W', 'L'] },
            eloChange: { type: Type.INTEGER },
        },
        required: ['opponentName', 'opponentElo', 'score', 'result', 'eloChange'],
    },
};

const teamDataSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      name: { type: Type.STRING },
      abbreviation: { type: Type.STRING, description: "A 3-letter team abbreviation, e.g., LAL" },
      conference: { type: Type.STRING, enum: ['East', 'West'] },
      elo: { type: Type.INTEGER, description: "A number between 1300 and 1700" },
      eloChangeLast5: { type: Type.INTEGER, description: "Net ELO change over last 5 games" },
      logoColor: { type: Type.STRING, description: "A vibrant hex color code" },
      players: { type: Type.ARRAY, items: playerSchema },
      eloHistory: eloHistorySchema,
      gameHistory: gameHistorySchema,
    },
    required: ['id', 'name', 'abbreviation', 'conference', 'elo', 'eloChangeLast5', 'players', 'logoColor', 'eloHistory', 'gameHistory'],
  },
};

const dailySummarySchema = {
    type: Type.OBJECT,
    properties: {
        gameHighlights: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    homeTeam: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, elo: { type: Type.INTEGER }, logoColor: { type: Type.STRING } } },
                    awayTeam: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, elo: { type: Type.INTEGER }, logoColor: { type: Type.STRING } } },
                    score: { type: Type.STRING, description: "e.g., '115-110'" },
                    status: { type: Type.STRING, description: "e.g., 'Final'" },
                    homeEloChange: { type: Type.INTEGER },
                    awayEloChange: { type: Type.INTEGER },
                },
            },
        },
        playerPerformances: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    playerName: { type: Type.STRING },
                    teamName: { type: Type.STRING },
                    fantasyScore: { type: Type.NUMBER },
                    statsLine: { type: Type.STRING, description: "e.g., '42 PTS, 12 REB, 8 AST'" },
                },
            },
        },
    },
    required: ['gameHighlights', 'playerPerformances'],
};


export const fetchTeamData = async (): Promise<Team[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a JSON array of 12 fictional NBA teams. Ensure team/player names are creative. Each team must have 8 players. Populate all fields, including advanced stats (PER, TS%, WS). Provide a dense 30-day ELO history with an entry for every day. Include a 5-game recent history for each team. Player ratings should be position-aware.",
      config: {
        responseMimeType: "application/json",
        responseSchema: teamDataSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as Team[];
  } catch (error) {
    console.error("Error fetching team data from Gemini:", error);
    return [];
  }
};

export const fetchDailySummaryData = async (): Promise<DailySummary | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a JSON object for a fictional day of 5 NBA games that have concluded. Provide game highlights and a list of the top 8 player performances, ordered by fantasy score.",
            config: {
                responseMimeType: "application/json",
                responseSchema: dailySummarySchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as DailySummary;
    } catch (error) {
        console.error("Error fetching daily summary from Gemini:", error);
        return null;
    }
};


export const fetchTeamAnalysis = async (teamName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Act as an expert NBA analyst. Provide a short, insightful analysis (2-3 sentences) on the strengths and weaknesses of the ${teamName}. Focus on their team composition and potential for the season. Be concise and use engaging, professional language.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching team analysis from Gemini:", error);
    return "Could not generate analysis at this time.";
  }
};