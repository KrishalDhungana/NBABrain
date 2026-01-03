import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Team } from '../types';
import EloChart from './EloChart';
import CourtView from './CourtView';
import { fetchTeamAnalysis } from '../services/data';
import BenchGrid from './BenchGrid';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { TeamCategoryRatings } from '../types';

interface TeamDetailProps {
  team: Team;
  allTeams?: Team[];
}

type TimeRange = 'week' | 'month' | 'season';
type StatLine = { key: string; label: string; value?: number; rank?: number; isPercent?: boolean };
type CategoryKey = keyof TeamCategoryRatings;
const CATEGORY_KEYS: CategoryKey[] = ['offense', 'defense', 'pacePressure', 'hustle', 'clutch'];
const TEAM_PROFILE_INFO: Array<{ key: CategoryKey; label: string; description: string }> = [
  { key: 'offense', label: 'Offense', description: '1-99 blend of shot quality, spacing/TS%, and turnover control to show how reliably the team creates efficient looks.' },
  { key: 'defense', label: 'Defense', description: 'Stops driven by opponent shot suppression, defensive rebounding, paint protection, and opponent FG% differential.' },
  { key: 'pacePressure', label: 'Pace & Pressure', description: 'Tempo, points off turnovers/fast breaks, second chances, and pressure on the offensive glass.' },
  { key: 'hustle', label: 'Hustle', description: 'Deflections, loose balls, charges, contested shots, and screen assists — the extra-effort plays.' },
  { key: 'clutch', label: 'Clutch', description: 'Late-game net rating, win rate, shotmaking (TS%), and turnover control in clutch minutes.' },
];

const TeamDetail: React.FC<TeamDetailProps> = ({ team, allTeams }) => {
  const [analysis, setAnalysis] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('season');
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const [barsReady, setBarsReady] = useState(false);
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const profileInfoRef = useRef<HTMLDivElement | null>(null);

  const generateAnalysis = async () => {
    setIsLoadingAnalysis(true);
    try {
      const fetched = await fetchTeamAnalysis(team.name);
      setAnalysis(fetched);
    } catch {
      setAnalysis('Bob is taking a water break. Try again in a sec.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Reset AI analysis when switching teams so prior responses don't linger
  useEffect(() => {
    setAnalysis('');
    setIsLoadingAnalysis(false);
    setShowProfileInfo(false);
  }, [team.id]);

  useEffect(() => {
    if (!showProfileInfo) return;
    const handleClick = (event: MouseEvent) => {
      if (!profileInfoRef.current) return;
      if (!profileInfoRef.current.contains(event.target as Node)) {
        setShowProfileInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfileInfo]);

  const filteredEloHistory = useMemo(() => {
    const history = team.eloHistory;
    if (!history || history.length === 0) return [];
    
    if (timeRange === 'season') {
      return history;
    }

    // Find the latest date in the history to use as a reference, making the filter data-relative instead of client-time-relative.
    const latestDate = new Date(
        Math.max(...history.map(p => new Date(p.date).getTime()))
    );

    const daysToFilter = timeRange === 'week' ? 7 : 30;
    const cutoffDate = new Date(latestDate);
    cutoffDate.setDate(latestDate.getDate() - daysToFilter + 1);

    return history.filter(point => {
        // Use new Date(string) for reliable parsing of 'YYYY-MM-DD'
        const pointDate = new Date(point.date);
        return pointDate >= cutoffDate && pointDate <= latestDate;
    });
  }, [team.eloHistory, timeRange]);

  const sortedPlayers = useMemo(() => [...team.players].sort((a, b) => b.rating - a.rating), [team.players]);
  const starters = useMemo(() => sortedPlayers.slice(0, 5), [sortedPlayers]);
  const bench = useMemo(() => sortedPlayers.slice(5), [sortedPlayers]);

  const overallBaseline = useMemo(() => {
    if (!allTeams || allTeams.length === 0) return undefined;
    const sum = allTeams.reduce((acc, t) => acc + t.elo, 0);
    return Math.round(sum / allTeams.length);
  }, [allTeams]);
  const confBaseline = useMemo(() => {
    if (!allTeams || allTeams.length === 0) return undefined;
    const same = allTeams.filter(t => t.conference === team.conference);
    const sum = same.reduce((acc, t) => acc + t.elo, 0);
    return Math.round(sum / same.length);
  }, [allTeams, team.conference]);

  const shortTeam = (full: string) => {
    if (!full) return '—';
    const parts = full.split(' ');
    return parts[parts.length - 1] || full;
  };

  const recentGames = useMemo(() => {
    const sorted = [...team.gameHistory].sort((a, b) => {
      const aDate = new Date(a.date || 0).getTime();
      const bDate = new Date(b.date || 0).getTime();
      return bDate - aDate;
    });
    return sorted.slice(0, 5);
  }, [team.gameHistory]);

  useEffect(() => {
    setBarsReady(false);
    const handle = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(handle);
  }, [team.id]);

  const categoryRanks = useMemo(() => {
    const ranks: Partial<Record<CategoryKey, number>> = {};
    if (!allTeams || allTeams.length === 0) return ranks;

    CATEGORY_KEYS.forEach(key => {
      const sorted = [...allTeams]
        .filter(t => typeof t.categoryRatings?.[key] === 'number')
        .sort((a, b) => (b.categoryRatings?.[key] ?? 0) - (a.categoryRatings?.[key] ?? 0));
      const rank = sorted.findIndex(t => t.id === team.id);
      if (rank >= 0) {
        ranks[key] = rank + 1;
      }
    });

    return ranks;
  }, [allTeams, team.id]);

  const profileRatings = useMemo(() => {
    if (!team.categoryRatings) return [];
    const labelMap: Record<CategoryKey, string> = {
      offense: 'Offense',
      defense: 'Defense',
      pacePressure: 'Pace & Pressure',
      hustle: 'Hustle',
      clutch: 'Clutch',
    };
    return CATEGORY_KEYS.map(key => ({
      key,
      label: labelMap[key],
      value: team.categoryRatings?.[key],
      rank: categoryRanks[key],
    }));
  }, [categoryRanks, team.categoryRatings]);

  const radarProfile = useMemo(
    () => profileRatings.map(item => ({ label: item.label, value: Math.max(0, Math.min(100, item.value ?? 0)) })),
    [profileRatings]
  );

  const statLines = useMemo<StatLine[]>(() => {
    const stats = team.teamStats;
    if (!stats) return [];
    return [
      { key: 'offRating', label: 'Off Rating', value: stats.offRating, rank: stats.offRatingRank },
      { key: 'defRating', label: 'Def Rating', value: stats.defRating, rank: stats.defRatingRank },
      { key: 'netRating', label: 'Net Rating', value: stats.netRating, rank: stats.netRatingRank },
      { key: 'threesPerGame', label: '3PM/G', value: stats.threesPerGame, rank: stats.threesPerGameRank },
      { key: 'turnoversPerGame', label: 'TOV/G', value: stats.turnoversPerGame, rank: stats.turnoversPerGameRank },
      { key: 'plusMinus', label: '+/-', value: stats.plusMinus, rank: stats.plusMinusRank },
      { key: 'fgPct', label: 'FG%', value: stats.fgPct * 100, rank: stats.fgPctRank, isPercent: true },
      { key: 'fg3Pct', label: '3P%', value: stats.fg3Pct * 100, rank: stats.fg3PctRank, isPercent: true },
      { key: 'ftPct', label: 'FT%', value: stats.ftPct * 100, rank: stats.ftPctRank, isPercent: true },
    ];
  }, [team.teamStats]);

  // Use Recharts' built-in polygon animation by remounting Radar on team change

  const recordLabel = team.record ? `${team.record.wins}-${team.record.losses}` : team.record?.raw ?? '—';
  const seedLabel = (team.record?.conferenceRank && team.record.conferenceRank > 0)
    ? team.record.conferenceRank
    : (team.seed && team.seed > 0 ? team.seed : undefined);
  const eloDisplay = Math.round(team.elo);
  const seedConferenceLabel = seedLabel ? `#${seedLabel} in ${team.conference} Conference` : `${team.conference} Conference`;

  const formatGameDate = (date?: string) => {
    if (!date) return '—';
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatStatValue = (value?: number, isPercent?: boolean) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';
    const decimals = isPercent ? 1 : 1;
    const formatted = value.toFixed(decimals);
    return isPercent ? `${formatted}%` : formatted;
  };

  const closeCards = () => setActivePlayerId(null);

  return (
    <div className="glass rounded-xl p-6 space-y-6 border border-white/10 relative shadow-lg" onClick={closeCards}>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{backgroundColor: team.logoColor}} className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0">
              {team.abbreviation}
          </div>
          <div>
              <h2 className="text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-3">
                <span>{team.name}</span>
                <span className="text-sm text-gray-400 font-semibold">({recordLabel})</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">{seedConferenceLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-400">Current ELO</p>
          <p className={`leading-none text-4xl font-black tracking-tight ${team.elo > 1600 ? 'elo-highlight' : 'text-orange-200'}`}>{eloDisplay}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-black/20 rounded-md p-4 border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-400">Team Profile</h4>
            <div ref={profileInfoRef} className="relative">
              <button
                type="button"
                aria-label="How are team profile categories calculated?"
                className="w-4 h-4 rounded-full border border-gray-400 text-gray-400 text-[9px] font-semibold flex items-center justify-center leading-none hover:bg-white/10"
                onClick={e => {
                  e.stopPropagation();
                  setShowProfileInfo(prev => !prev);
                }}
              >
                <span className="inline-block translate-x-[0.5px] -translate-y-[0.5px]">?</span>
              </button>
              {showProfileInfo && (
                <div className="absolute right-0 mt-2 w-72 bg-black/90 border border-white/10 rounded-lg p-4 text-xs text-gray-200 shadow-xl z-20">
                  <p className="text-sm font-semibold text-white">Team Profile</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    1-99 pillars built from this season&apos;s pace, efficiency, hustle, and clutch splits.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {TEAM_PROFILE_INFO.map(item => (
                      <li key={item.key}>
                        <p className="font-semibold text-orange-300 text-[11px]">{item.label}</p>
                        <p className="text-[11px] text-gray-300 leading-snug">{item.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {profileRatings.length > 0 ? (
            <>
              <div className="space-y-3">
                {profileRatings.map(item => {
                  const fill = Math.max(0, Math.min(100, item.value ?? 0));
                  const rankLabel = item.rank ? `(Rank: ${item.rank})` : '';
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <span className="flex-1">{item.label}</span>
                        <span className="w-20 text-right text-[11px] text-gray-400">{rankLabel || '\u00a0'}</span>
                        <span className="w-10 text-right font-semibold text-white">{item.value}</span>
                      </div>
                      <div className="h-[6px] bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full"
                          style={{
                            width: barsReady ? `${fill}%` : '0%',
                            backgroundColor: team.logoColor,
                            transition: 'width 700ms ease, background-color 200ms ease',
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarProfile} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                    <PolarAngleAxis dataKey="label" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                    <Radar
                      key={`team-radar-${team.id}`}
                      dataKey="value"
                      stroke={team.logoColor}
                      fill={team.logoColor}
                      fillOpacity={0.6}
                      dot={false}
                      activeDot={false}
                      animationDuration={700}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No profile ratings available.</p>
          )}
        </div>
        <div className="bg-black/20 rounded-md p-4 border border-white/10">
          <h4 className="text-sm font-semibold text-gray-400">Team Stats</h4>
          {statLines.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
              {statLines.map(stat => (
                <div key={String(stat.key)} className="bg-white/5 rounded-md p-2 border border-white/5">
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-white font-semibold">{formatStatValue(stat.value, stat.isPercent)}</p>
                  {stat.rank ? <p className="text-[10px] text-gray-400">(Rank: {stat.rank})</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Team stats unavailable.</p>
          )}
        </div>
        <div className="bg-black/20 rounded-md p-4 border border-white/10">
          <h4 className="text-sm font-semibold text-gray-400">Last 5 Games</h4>
          {recentGames.length === 0 ? (
            <p className="text-sm text-gray-400 mt-2">No games logged yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentGames.map((g, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">{formatGameDate(g.date)}</p>
                    <p className="text-gray-300">{g.result} {g.home ? 'vs' : '@'} {shortTeam(g.opponentAbbreviation || g.opponentName || '')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold text-right min-w-[78px] ${g.eloChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>{g.score}</span>
                    <span className={`text-sm font-semibold text-right min-w-[48px] ${g.eloChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {g.eloChange >= 0 ? '+' : ''}{Math.round(g.eloChange)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="glass rounded-lg p-4 border border-white/10">
        <div className="mb-2">
          <h3 className="text-lg font-bold text-orange-400">Stephen AI. Smith's Hot Take</h3>
          {(!isLoadingAnalysis && !analysis) && (
            <button onClick={generateAnalysis} className="mt-2 btn-shimmer text-xs">
              Get our AI analyst's thoughts
            </button>
          )}
        </div>
        {isLoadingAnalysis && (
           <div className="flex items-center p-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                <p className="ml-3 text-gray-400">Cooking up insights...</p>
           </div>
        )}
        {!isLoadingAnalysis && analysis && (
          <p className="text-gray-300 italic min-h-[2rem]">{analysis}</p>
        )}
      </div>
      
      <div className="glass rounded-lg p-4 border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">ELO Trend</h3>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {overallBaseline !== undefined && (
                  <span className="inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold bg-white/10 text-gray-200 border border-white/10 leading-none align-middle whitespace-nowrap">
                    <span>League Avg:</span>
                    <span className="ml-1">{overallBaseline}</span>
                  </span>
                )}
                {confBaseline !== undefined && (
                  <span className="inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-200 border border-blue-400/30 leading-none align-middle whitespace-nowrap">
                    <span>Conference Avg:</span>
                    <span className="ml-1">{confBaseline}</span>
                  </span>
                )}
              </div>
              <div className="flex gap-1 bg-black/30 p-1 rounded-md">
                {(['week', 'month', 'season'] as TimeRange[]).map(range => (
                    <button key={range} onClick={() => setTimeRange(range)} className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${timeRange === range ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
                        {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-60">
               <EloChart data={filteredEloHistory} teamColor={team.logoColor} overallBaseline={overallBaseline} confBaseline={confBaseline} />
          </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Current Player Rotation</h3>
        <div className="space-y-6">
            <div>
                <h4 className="text-lg font-semibold text-gray-300 mb-3 border-b-2 border-orange-500/50 pb-1">Starters</h4>
                <CourtView players={starters} teamColor={team.logoColor} activePlayerId={activePlayerId} onActiveChange={setActivePlayerId} />
            </div>
            <div>
                <h4 className="text-lg font-semibold text-gray-300 mb-3 border-b-2 border-gray-600/50 pb-1">Bench</h4>
                <BenchGrid players={bench} teamColor={team.logoColor} activePlayerId={activePlayerId} onActiveChange={setActivePlayerId} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetail;









