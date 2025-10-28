import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import TeamList from './components/TeamList';
import TeamDetail from './components/TeamDetail';
import LoadingSpinner from './components/LoadingSpinner';
import TeamComparisonEloChart from './components/TeamComparisonEloChart';
import PlayerRankingsView from './components/PlayerRankingsView';
import type { Team, Player, DailySummary } from './types';
import { fetchTeamData, fetchDailySummaryData } from './services/geminiService';

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
        return <GamesTodayView summary={dailySummary} />;
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <TeamList teams={teams} selectedTeam={selectedTeam} onSelectTeam={onSelectTeam} />
        </div>
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <TeamDetail team={selectedTeam} onClose={() => onSelectTeam(null)} />
          ) : (
            <TeamComparisonEloChart teams={teams} />
          )}
        </div>
    </div>
);


const EloChangeIndicator: React.FC<{ change: number }> = ({ change }) => {
    const isPositive = change >= 0;
    const color = isPositive ? 'text-green-400' : 'text-red-400';
    const symbol = isPositive ? '▲' : '▼';
    return <span className={`${color} font-semibold text-sm`}>{symbol}{Math.abs(change)}</span>;
};

const GamesTodayView: React.FC<{ summary: DailySummary | null }> = ({ summary }) => {
    if (!summary) return <div className="text-center text-gray-400">No game data available for today.</div>;
    
    const sortedHighlights = [...summary.gameHighlights].sort((a,b) => Math.abs(b.homeEloChange) + Math.abs(b.awayEloChange) - (Math.abs(a.homeEloChange) + Math.abs(a.awayEloChange)));

    const cleanScore = (score: string): string => {
        const scores = score.match(/\d+/g);
        if (scores && scores.length >= 2) {
            // Assuming first score is away, second is home
            return `${scores[0]} - ${scores[1]}`;
        }
        return score; // Fallback
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg">
                <h2 className="text-3xl font-extrabold text-white mb-4">Today's Games</h2>
                 <div className="space-y-4">
                    {sortedHighlights.map((game, index) => (
                        <div key={index} className="bg-black/20 rounded-lg p-4 border border-white/10">
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
                                <EloChangeIndicator change={game.awayEloChange} />
                                <span className="text-xs">ELO CHANGE</span>
                                <EloChangeIndicator change={game.homeEloChange} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-1 bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg">
                <h2 className="text-3xl font-extrabold text-white mb-4">Top Performers</h2>
                 <ul className="space-y-3">
                    {summary.playerPerformances.map((player, index) => (
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