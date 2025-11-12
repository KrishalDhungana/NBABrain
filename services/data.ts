const useMock = (import.meta as any).env?.VITE_USE_MOCK === 'true';

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

// Player data fetcher (supports static JSON produced by notebooks/player_pipeline.py)
export const fetchPlayerData = async () => {
  // Prefer generated dataset; in mock mode fall back to sample for local UI work
  const primaryUrl = '/data/players.json';
  const fallbackUrl = '/data/players.sample.json';
  const url = useMock ? fallbackUrl : primaryUrl;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!useMock) {
      // Try fallback once if primary missing
      try {
        const res = await fetch(fallbackUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed fallback ${fallbackUrl}: ${res.status}`);
        return await res.json();
      } catch (e) {
        console.error('fetchPlayerData fallback error', e);
        throw e;
      }
    }
    console.error('fetchPlayerData error', err);
    throw err;
  }
};
