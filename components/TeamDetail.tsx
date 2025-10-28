import React, { useState, useEffect, useMemo } from 'react';
import type { Team, EloHistoryPoint } from '../types';
import PlayerCard from './PlayerCard';
import EloChart from './EloChart';
import CourtView from './CourtView';
import { fetchTeamAnalysis } from '../services/geminiService';

interface TeamDetailProps {
  team: Team;
  onClose: () => void;
}

type TimeRange = 'week' | 'month' | 'season';

const TeamDetail: React.FC<TeamDetailProps> = ({ team, onClose }) => {
  const [analysis, setAnalysis] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  useEffect(() => {
    const getAnalysis = async () => {
      if (!team) return;
      setIsLoadingAnalysis(true);
      const fetchedAnalysis = await fetchTeamAnalysis(team.name);
      setAnalysis(fetchedAnalysis);
      setIsLoadingAnalysis(false);
    };
    getAnalysis();
  }, [team]);

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

  return (
    <div className="bg-black/30 backdrop-blur-xl rounded-xl p-6 space-y-6 border border-white/10 relative shadow-lg">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        <div style={{backgroundColor: team.logoColor}} className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0">
            {team.abbreviation}
        </div>
        <div>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">{team.name}</h2>
            <p className="text-lg text-gray-300">{team.conference} Conference | ELO: <span className="font-bold text-orange-400">{team.elo}</span></p>
        </div>
      </div>

      <div className="bg-black/20 rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-bold text-orange-400 mb-2">AI Analyst Insights</h3>
        {isLoadingAnalysis ? (
           <div className="flex items-center p-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                <p className="ml-3 text-gray-400">Generating analysis...</p>
           </div>
        ) : (
          <p className="text-gray-300 italic">{analysis}</p>
        )}
      </div>
      
      <div className="bg-black/20 rounded-lg p-4 border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">ELO Trend</h3>
            <div className="flex gap-1 bg-black/30 p-1 rounded-md">
                {(['week', 'month', 'season'] as TimeRange[]).map(range => (
                    <button key={range} onClick={() => setTimeRange(range)} className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${timeRange === range ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
                        {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                ))}
            </div>
          </div>
          <div className="h-60">
               <EloChart data={filteredEloHistory} teamColor={team.logoColor} />
          </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Player Roster</h3>
        <div className="space-y-6">
            <div>
                <h4 className="text-lg font-semibold text-gray-300 mb-3 border-b-2 border-orange-500/50 pb-1">Starters</h4>
                <CourtView players={starters} teamColor={team.logoColor} />
            </div>
            <div>
                <h4 className="text-lg font-semibold text-gray-300 mb-3 border-b-2 border-gray-600/50 pb-1">Bench</h4>
                <div className="space-y-2">
                    {bench.map((player) => (
                        <PlayerCard key={player.id} player={player} teamColor={team.logoColor} />
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetail;