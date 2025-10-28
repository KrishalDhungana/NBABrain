import React from 'react';
import type { Team } from '../types';
import InfoTooltip from './InfoTooltip';

interface TeamListProps {
  teams: Team[];
  selectedTeam: Team | null;
  onSelectTeam: (team: Team) => void;
}

const EloChangeIndicator: React.FC<{ change: number }> = ({ change }) => {
    const isPositive = change >= 0;
    const color = isPositive ? 'text-green-500' : 'text-red-500';
    const symbol = isPositive ? '▲' : '▼';
    return <span className={`text-xs font-mono ${color}`}>{symbol}{Math.abs(change)}</span>;
};

const TeamList: React.FC<TeamListProps> = ({ teams, selectedTeam, onSelectTeam }) => {
  return (
    <div className="bg-black/30 backdrop-blur-xl rounded-xl p-4 border border-white/10 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-white">Team Power Rankings</h2>
        <InfoTooltip text="ELO rating change over the last 5 games." />
      </div>
      <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
        {teams.map((team, index) => {
          const isSelected = selectedTeam?.id === team.id;
          const eloHighlightClass = team.elo > 1600 ? 'elo-highlight' : '';

          return (
            <button
              key={team.id}
              onClick={() => onSelectTeam(team)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 border ${
                isSelected
                  ? 'bg-white/20 shadow-lg border-orange-500'
                  : 'bg-black/20 hover:bg-white/10 border-transparent text-gray-300'
              }`}
            >
              <span className={`font-bold w-6 text-center ${isSelected ? 'text-orange-300' : 'text-gray-400'}`}>{index + 1}</span>
              <div style={{ backgroundColor: team.logoColor }} className="w-5 h-5 rounded-full flex-shrink-0"></div>
              <span className="font-semibold flex-grow">{team.name}</span>
              <EloChangeIndicator change={team.eloChangeLast5} />
              <span className={`ml-2 text-sm font-mono font-bold w-12 text-right ${eloHighlightClass} ${isSelected ? 'text-white' : 'text-orange-400'}`}>{team.elo}</span>
            </button>
          )
        })}
      </div>
    </div>
  );
};

export default TeamList;