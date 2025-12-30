const mockEnv = (import.meta as any).env?.VITE_USE_MOCK;
// Default to mock data unless the developer explicitly opts out.
const useMock = mockEnv === undefined ? true : mockEnv === 'true';

export const fetchTeamData = async () => {
  if (useMock) {
    const mod = await import('./mockData');
    return mod.fetchTeamData();
  }
  const mod = await import('./geminiService');
  return mod.fetchTeamData();
};

export const fetchDailySummaryData = async () => {
  if (useMock) {
    const mod = await import('./mockData');
    return mod.fetchDailySummaryData();
  }
  const mod = await import('./geminiService');
  return mod.fetchDailySummaryData();
};

export const fetchTeamAnalysis = async (teamName: string) => {
  if (useMock) {
    const mod = await import('./mockData');
    return mod.fetchTeamAnalysis(teamName);
  }
  const mod = await import('./geminiService');
  return mod.fetchTeamAnalysis(teamName);
};

// Player data fetcher (supports static JSON produced by data-pipelines/player_pipeline.py)
export const fetchPlayerData = async () => {
  const primaryUrl = '/data/players.json';
  const fallbackUrl = '/data/players.sample.json';
  const tryUrls = [primaryUrl];
  // Allow a sample dataset as a final fallback if it exists
  tryUrls.push(fallbackUrl);

  let lastError: unknown;
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
      const payload = await res.json();
      if (payload?.players?.length) {
        return payload;
      }
    } catch (err) {
      lastError = err;
      console.warn(`fetchPlayerData failed for ${url}`, err);
    }
  }

  console.error('fetchPlayerData error', lastError);
  throw lastError ?? new Error('Unable to load player data');
};
