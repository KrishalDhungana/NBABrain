import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import TeamList from './components/TeamList';
import TeamDetail from './components/TeamDetail';
import LoadingSpinner from './components/LoadingSpinner';
import TeamComparisonEloChart from './components/TeamComparisonEloChart';
import PlayerRankingsView from './components/PlayerRankingsView';
import type { Team, Player, DailySummary } from './types';
import EloChangePill from './components/EloChangePill';
import { fetchTeamData, fetchDailySummaryData } from './services/data';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Team Rankings');
  const [teams, setTeams] = useState<Team[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedTeam(null);
      const [fetchedTeams, fetchedSummary] = await Promise.all([
          fetchTeamData(),
          fetchDailySummaryData()
      ]);
      
      if (fetchedTeams && fetchedTeams.length > 0) {
        const sortedTeams = [...fetchedTeams].sort((a, b) => b.elo - a.elo);
        setTeams(sortedTeams);
      } else {
        setError("Failed to load team data. The AI might be taking a break.");
      }

      if(fetchedSummary) {
        setDailySummary(fetchedSummary);
      }

    } catch (err) {
      setError("An unexpected error occurred while fetching data.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    // Default to top-ranked team once teams load
    if (!selectedTeam && teams.length > 0) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  const allPlayers = useMemo((): Player[] => {
    return teams.flatMap(team => 
      team.players.map(player => ({
        ...player,
        teamLogoColor: team.logoColor,
        teamAbbreviation: team.abbreviation,
      }))
    ).sort((a,b) => b.rating - a.rating);
  }, [teams]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-[calc(100vh-200px)]">
          <LoadingSpinner message="Calculating ELOs and Scouting Players..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] bg-black/30 backdrop-blur-xl border border-red-500/50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400">Error</h2>
          <p className="mt-2 text-red-300">{error}</p>
          <button onClick={loadInitialData} className="mt-6 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md font-semibold transition-colors">
            Try Again
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'Team Rankings':
        return <TeamRankingsView teams={teams} selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} />;
      case 'Player Rankings':
        return <PlayerRankingsView players={allPlayers} />;
      case 'Games Today':
        return <GamesTodayView summary={dailySummary} teams={teams} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="container mx-auto p-4 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

const TeamRankingsView: React.FC<{
  teams: Team[], 
  selectedTeam: Team | null, 
  onSelectTeam: (team: any) => void // Allow null selection
}> = ({teams, selectedTeam, onSelectTeam}) => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top: ELO Comparison spans the full width */}
        <div className="lg:col-span-12">
          <TeamComparisonEloChart teams={teams} />
        </div>
        {/* Bottom row: left (wider) = Team Power Rankings; right = Team Detail */}
        <div className="lg:col-span-4">
          <TeamList teams={teams} selectedTeam={selectedTeam} onSelectTeam={onSelectTeam} />
        </div>
        <div className="lg:col-span-8">
          <TeamDetail team={selectedTeam || teams[0]} allTeams={teams} />
        </div>
    </div>
);




const GamesTodayView: React.FC<{ summary: DailySummary | null, teams: Team[] }> = ({ summary, teams }) => {
    if (!summary) return <div className="text-center text-gray-400">No game data available for today.</div>;
    
    const sortedHighlights = [...summary.gameHighlights].sort((a,b) => Math.abs(b.homeEloChange) + Math.abs(b.awayEloChange) - (Math.abs(a.homeEloChange) + Math.abs(a.awayEloChange)));
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const cleanScore = (score: string): string => {
        const scores = score.match(/\d+/g);
        if (scores && scores.length >= 2) {
            // Assuming first score is away, second is home
            return `${scores[0]} - ${scores[1]}`;
        }
        return score; // Fallback
    };

    const getTopPerformers = (teamName: string) => {
        const perf = summary.playerPerformances
            .filter(p => p.teamName === teamName)
            .slice(0, 3);
        if (perf.length > 0) return perf;
        // Fallback placeholders
        return [
            { playerName: `${teamName} Star 1`, teamName, fantasyScore: 0, statsLine: '—' },
            { playerName: `${teamName} Star 2`, teamName, fantasyScore: 0, statsLine: '—' },
        ];
    };

    const findRoster = (teamName: string) => {
        const t = teams.find(t => t.name === teamName);
        return t ? t.players : [];
    };

    const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
    const rnd = (seed: number) => {
        // simple deterministic pseudo-random based on seed
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };
    const generateBoxLine = (player: Player | Partial<Player>, seed: number) => {
        const rating = typeof (player as any)?.rating === 'number' ? (player as any).rating as number : 75;
        const stats: any = (player as any)?.stats ?? { ppg: 8, ast: 3, reb: 4, fgPercentage: 0.45 };
        const baseMin = 16 + Math.floor((rating - 72) / 2);
        const minutes = clamp(baseMin + Math.floor(rnd(seed) * 6) - 3, 8, 42);
        const pts = clamp(Math.round(stats.ppg + (rnd(seed+1) * 10 - 5)), 0, 60);
        const ast = clamp(Math.round(stats.ast + (rnd(seed+2) * 4 - 2)), 0, 20);
        const reb = clamp(Math.round(stats.reb + (rnd(seed+3) * 4 - 2)), 0, 20);
        const stl = clamp(Math.round(0.5 + rnd(seed+4) * 2), 0, 6);
        const blk = clamp(Math.round(0.3 + rnd(seed+5) * 2), 0, 6);
        const fga = clamp(Math.round(pts / 2 + 5 + rnd(seed+6) * 6), 1, 35);
        const fgm = clamp(Math.round(fga * clamp(stats.fgPercentage + (rnd(seed+7) * 0.1 - 0.05), 0.3, 0.7)), 0, fga);
        const fta = clamp(Math.round((pts / 4) + rnd(seed+8) * 4), 0, 20);
        const ftm = clamp(Math.round(fta * clamp(0.7 + rnd(seed+9) * 0.2, 0.5, 0.95)), 0, fta);
        const tpa = clamp(Math.round((fga * 0.35) + rnd(seed+10) * 4 - 2), 0, fga);
        const tpm = clamp(Math.round(tpa * clamp(0.32 + rnd(seed+11) * 0.15, 0.2, 0.6)), 0, tpa);
        const plusMinus = Math.round(rnd(seed+12) * 30 - 15);
        return { minutes, pts, ast, reb, stl, blk, fgm, fga, ftm, fta, tpm, tpa, plusMinus };
    };
    const buildBoxScore = (teamName: string, seedBase: number) => {
        const roster = findRoster(teamName);
        const rows = roster.map((p, idx) => ({
            name: p.name,
            position: p.position,
            ...generateBoxLine(p, seedBase + idx)
        }));
        // pad to 15 with placeholders if needed
        for (let i = rows.length; i < 15; i++) {
            rows.push({
                name: `${teamName} Player ${i+1}`,
                position: (i % 5 === 0 ? 'PG' : i % 5 === 1 ? 'SG' : i % 5 === 2 ? 'SF' : i % 5 === 3 ? 'PF' : 'C') as any,
                ...generateBoxLine({} as any, seedBase + i)
            });
        }
        return rows;
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass rounded-xl p-6 shadow-lg">
                <h2 className="text-3xl font-extrabold text-white mb-4">Today's Games</h2>
                 <div className="space-y-4">
                    {sortedHighlights.map((game, index) => (
                        <div key={index} className="glass rounded-lg p-4 border border-white/10 cursor-pointer" onClick={() => setOpenIndex(openIndex === index ? null : index)}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3 text-lg font-bold w-2/5">
                                    <div style={{ backgroundColor: game.awayTeam.logoColor }} className="w-6 h-6 rounded-full flex-shrink-0"></div>
                                    <span>{game.awayTeam.name}</span>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-mono">{cleanScore(game.score)}</p>
                                    <p className="text-xs text-gray-400">{game.status}</p>
                                </div>
                                <div className="flex items-center gap-3 text-lg font-bold w-2/5 justify-end">
                                    <span>{game.homeTeam.name}</span>
                                    <div style={{ backgroundColor: game.homeTeam.logoColor }} className="w-6 h-6 rounded-full flex-shrink-0"></div>
                                </div>
                            </div>
                             <div className="flex justify-between items-center mt-2 text-gray-400 px-2">
                                <EloChangePill change={game.awayEloChange} />
                                <span className="text-xs">ELO CHANGE</span>
                                <EloChangePill change={game.homeEloChange} />
                            </div>
                            {openIndex === index && (
                              <div className="mt-4 border-t border-white/10 pt-4" onClick={(e) => e.stopPropagation()}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {[{ side: 'away', team: game.awayTeam }, { side: 'home', team: game.homeTeam }].map(({team: t}, ti) => {
                                    const box = buildBoxScore(t.name, index * 100 + ti * 1000);
                                    return (
                                      <div key={t.name} className="bg-black/20 rounded-md p-3 border border-white/10">
                                        <div className="overflow-x-auto">
                                          <table className="min-w-full text-xs">
                                            <thead className="text-gray-400">
                                              <tr>
                                                <th className="text-left pr-2 py-1">Player</th>
                                                <th className="text-left pr-2">Pos</th>
                                                <th className="text-right pr-2">MIN</th>
                                                <th className="text-right pr-2">PTS</th>
                                                <th className="text-right pr-2">REB</th>
                                                <th className="text-right pr-2">AST</th>
                                                <th className="text-right pr-2">STL</th>
                                                <th className="text-right pr-2">BLK</th>
                                                <th className="text-right pr-2">FG</th>
                                                <th className="text-right pr-2">3P</th>
                                                <th className="text-right pr-2">FT</th>
                                                <th className="text-right pr-0">+/-</th>
                                              </tr>
                                            </thead>
                                            <tbody className="text-gray-200">
                                              {box.map((row, ri) => (
                                                <tr key={ri} className="border-t border-white/5">
                                                  <td className="pr-2 py-1 whitespace-nowrap">{row.name}</td>
                                                  <td className="pr-2">{row.position}</td>
                                                  <td className="text-right pr-2">{row.minutes}</td>
                                                  <td className="text-right pr-2">{row.pts}</td>
                                                  <td className="text-right pr-2">{row.reb}</td>
                                                  <td className="text-right pr-2">{row.ast}</td>
                                                  <td className="text-right pr-2">{row.stl}</td>
                                                  <td className="text-right pr-2">{row.blk}</td>
                                                  <td className="text-right pr-2">{row.fgm}/{row.fga}</td>
                                                  <td className="text-right pr-2">{row.tpm}/{row.tpa}</td>
                                                  <td className="text-right pr-2">{row.ftm}/{row.fta}</td>
                                                  <td className="text-right pr-0">{row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-1 glass rounded-xl p-6 shadow-lg">
                <h2 className="text-3xl font-extrabold text-white mb-4">Top Performers</h2>
                 <ul className="space-y-3">
                    {[...summary.playerPerformances].sort((a,b) => b.fantasyScore - a.fantasyScore).slice(0,10).map((player, index) => (
                        <li key={index} className="bg-black/20 rounded-lg p-3 border border-white/10">
                            <div className="flex items-start gap-3">
                                <span className="text-xl font-bold text-orange-400 mt-1">{index+1}.</span>
                                <div>
                                    <p className="font-bold text-white">{player.playerName}</p>
                                    <p className="text-xs text-gray-400">{player.statsLine}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="font-black text-2xl text-amber-400">{player.fantasyScore.toFixed(1)}</p>
                                    <p className="text-xs text-gray-500 -mt-1">FPTS</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};


export default App;







