import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { Team, EloHistoryPoint } from '../types';

interface TeamComparisonEloChartProps {
  teams: Team[];
}

const COLORS = [
  '#f97316', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899',
  '#14b8a6', '#3b82f6', '#6366f1', '#84cc16', '#d946ef', '#0ea5e9'
];

type TimeRange = 'week' | 'month' | 'season';

const formatDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].filter(p => p.value).sort((a, b) => b.value - a.value);
    
    return (
      <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-lg p-3 text-sm shadow-lg">
        <p className="font-bold text-white mb-2">{formatDate(label)}</p>
        <ul className="space-y-1">
          {sortedPayload.map((entry, index) => (
            <li key={`item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div style={{ backgroundColor: entry.stroke }} className="w-2 h-2 rounded-full flex-shrink-0"></div>
                <span className="text-gray-300 font-medium">{entry.name}</span>
              </div>
              <span className="font-bold font-mono" style={{ color: entry.stroke }}>{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
};

const TeamComparisonEloChart: React.FC<TeamComparisonEloChartProps> = ({ teams }) => {
    const [selectedTeams, setSelectedTeams] = useState<string[]>(() => teams.slice(0, 5).map(t => t.name));
    const [timeRange, setTimeRange] = useState<TimeRange>('month');

    const handleTeamSelection = (teamName: string) => {
        setSelectedTeams(prev => 
            prev.includes(teamName) 
            ? prev.filter(name => name !== teamName)
            : [...prev, teamName]
        );
    };

    const chartData = useMemo(() => {
        if (teams.length === 0) return [];
        
        const allHistories = teams.flatMap(t => t.eloHistory);
        if (allHistories.length === 0) return [];

        // Find the latest date across all team histories to make the filter data-relative.
        const latestDate = new Date(
            Math.max(...allHistories.map(p => new Date(p.date).getTime()))
        );
        
        const allDates = new Set<string>();

        if (timeRange !== 'season') {
            const daysToFilter = timeRange === 'week' ? 7 : 30;
            const cutoffDate = new Date(latestDate);
            cutoffDate.setDate(latestDate.getDate() - daysToFilter + 1);

            allHistories.forEach(point => {
                const pointDate = new Date(point.date);
                if (pointDate >= cutoffDate && pointDate <= latestDate) {
                    allDates.add(point.date);
                }
            });
        } else {
            allHistories.forEach(point => allDates.add(point.date));
        }

        const sortedDates = Array.from(allDates).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        const teamEloLookups = new Map<string, Map<string, number>>();
        teams.forEach(team => {
            const dateMap = new Map(team.eloHistory.map(p => [p.date, p.elo]));
            teamEloLookups.set(team.name, dateMap);
        });
        
        return sortedDates.map(date => {
            const dataPoint: { date: string; [key: string]: any } = { date };
            teams.forEach(team => {
                dataPoint[team.name] = teamEloLookups.get(team.name)?.get(date) ?? null;
            });
            return dataPoint;
        });
    }, [teams, timeRange]);


  return (
    <div className="bg-black/30 backdrop-blur-xl rounded-xl p-6 border border-white/10 h-full flex flex-col shadow-lg">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-2xl font-bold text-white">ELO Comparison</h2>
                <p className="text-sm text-gray-400">Select teams to compare their ELO ratings over time.</p>
            </div>
             <div className="flex gap-1 bg-black/30 p-1 rounded-md flex-shrink-0">
                {(['week', 'month', 'season'] as TimeRange[]).map(range => (
                    <button key={range} onClick={() => setTimeRange(range)} className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${timeRange === range ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
                        {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                ))}
            </div>
        </div>
        <div className="flex-grow h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} />
                <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={() => null} />
                {selectedTeams.map((teamName, index) => {
                    const team = teams.find(t => t.name === teamName);
                    return (
                        <Line key={teamName} type="monotone" dataKey={teamName} stroke={team?.logoColor || COLORS[index % COLORS.length]} strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 6, fill: team?.logoColor, stroke: '#fff', strokeWidth: 2 }}/>
                    );
                })}
              </LineChart>
            </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Select Teams:</h3>
            <div className="flex flex-wrap gap-2">
                {teams.map(team => (
                    <button key={team.name} onClick={() => handleTeamSelection(team.name)} className={`px-3 py-1 text-xs rounded-full transition-all flex items-center gap-2 border ${selectedTeams.includes(team.name) ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/20 border-white/10 hover:bg-white/10 text-gray-300'}`}>
                         <div style={{ backgroundColor: team.logoColor }} className="w-3 h-3 rounded-full"></div>
                        {team.name}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
};

export default TeamComparisonEloChart;