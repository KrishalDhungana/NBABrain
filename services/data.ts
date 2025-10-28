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
