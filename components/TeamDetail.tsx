import React, { useState, useEffect, useMemo } from 'react';
import type { Team, EloHistoryPoint } from '../types';
import EloChart from './EloChart';
import EloChangePill from './EloChangePill';
import CourtView from './CourtView';
import { fetchTeamAnalysis } from '../services/data';
import BenchGrid from './BenchGrid';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface TeamDetailProps {
  team: Team;
  allTeams?: Team[];
}

type TimeRange = 'week' | 'month' | 'season';

const TeamDetail: React.FC<TeamDetailProps> = ({ team, allTeams }) => {
  const [analysis, setAnalysis] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);

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
  }, [team.id]);

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

  const { starters, bench } = useMemo(() => {
    const sortedPlayers = [...team.players].sort((a, b) => b.rating - a.rating);
    return {
      starters: sortedPlayers.slice(0, 5),
      bench: sortedPlayers.slice(5),
    };
  }, [team.players]);

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
    const parts = full.split(' ');
    return parts[parts.length - 1] || full;
  };

  const ratingRanks = useMemo(() => {
    if (!allTeams || !team.teamStats) return null;
    const withStats = allTeams.filter(t => t.teamStats);
    const offSorted = [...withStats].sort((a,b) => (b.teamStats!.offensiveRating) - (a.teamStats!.offensiveRating));
    const defSorted = [...withStats].sort((a,b) => (a.teamStats!.defensiveRating) - (b.teamStats!.defensiveRating));
    const netSorted = [...withStats].sort((a,b) => (b.teamStats!.plusMinus) - (a.teamStats!.plusMinus));
    const offRank = offSorted.findIndex(t => t.id === team.id) + 1;
    const defRank = defSorted.findIndex(t => t.id === team.id) + 1;
    const netRank = netSorted.findIndex(t => t.id === team.id) + 1;
    const total = withStats.length;
    return { offRank, defRank, netRank, total };
  }, [allTeams, team]);

  // Compute team profile (starters' averaged skills) for Team Profile radar
  const teamProfile = useMemo(() => {
    const starters = [...team.players].sort((a,b) => b.rating - a.rating).slice(0,5);
    const sum = starters.reduce((acc, p) => ({
      shooting: acc.shooting + p.skills.shooting,
      defense: acc.defense + p.skills.defense,
      playmaking: acc.playmaking + p.skills.playmaking,
      athleticism: acc.athleticism + p.skills.athleticism,
      rebounding: acc.rebounding + p.skills.rebounding,
    }), { shooting: 0, defense: 0, playmaking: 0, athleticism: 0, rebounding: 0 });
    const n = starters.length || 1;
    const avg = {
      shooting: Math.round(sum.shooting / n),
      defense: Math.round(sum.defense / n),
      playmaking: Math.round(sum.playmaking / n),
      athleticism: Math.round(sum.athleticism / n),
      rebounding: Math.round(sum.rebounding / n),
    };
    const data = [
      { s: 'SHT', A: avg.shooting, fullMark: 99 },
      { s: 'DEF', A: avg.defense, fullMark: 99 },
      { s: 'PLY', A: avg.playmaking, fullMark: 99 },
      { s: 'ATH', A: avg.athleticism, fullMark: 99 },
      { s: 'REB', A: avg.rebounding, fullMark: 99 },
    ];
    const list = [
      { key: 'SHT', label: 'SHT', value: avg.shooting },
      { key: 'DEF', label: 'DEF', value: avg.defense },
      { key: 'PLY', label: 'PLY', value: avg.playmaking },
      { key: 'ATH', label: 'ATH', value: avg.athleticism },
      { key: 'REB', label: 'REB', value: avg.rebounding },
    ];
    return { data, list };
  }, [team.players]);

  // Use Recharts' built-in polygon animation by remounting Radar on team change

  const closeCards = () => setActivePlayerId(null);

  return (
    <div className="glass rounded-xl p-6 space-y-6 border border-white/10 relative shadow-lg" onClick={closeCards}>

      <div className="flex items-center gap-4">
        <div style={{backgroundColor: team.logoColor}} className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0">
            {team.abbreviation}
        </div>
        <div>
            <h2 className="text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-3">
              <span>{team.name}</span>
              {team.record && (
                <span className="text-sm text-gray-400 font-semibold">({team.record.wins}-{team.record.losses})</span>
              )}
            </h2>
            <p className="text-lg text-gray-300 flex items-center gap-3 flex-wrap">
              <span>{team.record ? `#${team.record.conferenceRank} in ${team.conference} Conference` : `${team.conference} Conference`} | ELO: <span className="font-bold text-orange-400">{team.elo}</span></span>
              <span className="flex items-center gap-2">
                <EloChangePill change={team.eloChangeLast5} />
                <span className="text-sm text-gray-400">Last 5 games</span>
              </span>
            </p>
        </div>
      </div>

      {/* Team snapshot: record, ranking, team stats, last 5 */}
      <div className="glass rounded-lg p-4 border border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="hidden bg-black/20 rounded-md p-3 border border-white/10">
            <h4 className="text-sm font-semibold text-gray-400">Team Profile</h4>
            <p className="mt-1 text-white text-lg font-bold">
              {team.record ? `${team.record.wins}-${team.record.losses}` : '—'}
            </p>
            <p className="text-sm text-gray-300">
              {team.record ? `Conference Rank: ${team.record.conferenceRank}` : '—'}
            </p>
          </div>
          <div className="bg-black/20 rounded-md p-3 border border-white/10">
            <h4 className="text-sm font-semibold text-gray-400">Team Profile</h4>
            <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius={'68%'} data={teamProfile.data} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                    <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                    <Radar key={`team-radar-${team.id}`} dataKey="A" stroke={team.logoColor} fill={team.logoColor} fillOpacity={0.6} dot={false} activeDot={false} animationDuration={700} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {teamProfile.list.map(item => (
                  <span key={item.key} className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-black/20 rounded-md p-3 border border-white/10">
            <h4 className="text-sm font-semibold text-gray-400">Team Stats</h4>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400">Off Rating</p>
                <p className="text-white font-semibold">{team.teamStats?.offensiveRating ?? '—'}</p>
                {ratingRanks && <p className="text-[10px] text-gray-400">Rank: {ratingRanks.offRank}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Def Rating</p>
                <p className="text-white font-semibold">{team.teamStats?.defensiveRating ?? '—'}</p>
                {ratingRanks && <p className="text-[10px] text-gray-400">Rank: {ratingRanks.defRank}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Net Rating</p>
                <p className="text-white font-semibold">{team.teamStats?.plusMinus ?? '—'}</p>
                {ratingRanks && <p className="text-[10px] text-gray-400">Rank: {ratingRanks.netRank}</p>}
              </div>
            </div>
          </div>
          <div className="bg-black/20 rounded-md p-3 border border-white/10">
            <h4 className="text-sm font-semibold text-gray-400">Last 5 Games</h4>
            <ul className="mt-1 space-y-1 text-sm">
              {team.gameHistory.slice(0,5).map((g, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-gray-300">{g.result} vs {shortTeam(g.opponentName)}</span>
                  <span className="flex items-center gap-3">
                    <span className={`font-mono ${g.result === 'W' ? 'text-green-400' : 'text-red-400'}`}>{g.score}</span>
                    <EloChangePill change={g.eloChange} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-orange-400">AI Analyst Insights</h3>
          <button onClick={generateAnalysis} className="px-3 py-1.5 text-xs rounded-md bg-orange-600 hover:bg-orange-500 font-semibold">
            Ask Bob for a hot take
          </button>
        </div>
        {isLoadingAnalysis ? (
           <div className="flex items-center p-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                <p className="ml-3 text-gray-400">Cooking up insights...</p>
           </div>
        ) : (
          <p className="text-gray-300 italic min-h-[2rem]">{analysis || 'Click the button to get Bob the AI scout’s quick thoughts.'}</p>
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
                    <span className="ml-1 font-mono">{overallBaseline}</span>
                  </span>
                )}
                {confBaseline !== undefined && (
                  <span className="inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-200 border border-blue-400/30 leading-none align-middle whitespace-nowrap">
                    <span>Conf Avg:</span>
                    <span className="ml-1 font-mono">{confBaseline}</span>
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
               <EloChart key={`${team.id}-${timeRange}`} data={filteredEloHistory} teamColor={team.logoColor} overallBaseline={overallBaseline} confBaseline={confBaseline} />
          </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Player Roster</h3>
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









