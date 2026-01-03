import React, { useMemo } from 'react';
import type { Team } from '../types';

interface TeamListProps {
  teams: Team[];
  selectedTeam: Team | null;
  onSelectTeam: (team: Team) => void;
}

const clampChange = (value: number, maxAbs: number) => Math.max(Math.min(value, maxAbs), -maxAbs);

const MomentumBar: React.FC<{ change: number }> = ({ change }) => {
  const maxMomentum = 100;
  const clamped = clampChange(change, maxMomentum);
  const isPositive = clamped >= 0;
  const fillPercent = (Math.abs(clamped) / maxMomentum) * 50;
  const fillStyle: React.CSSProperties = {
    width: `${fillPercent}%`,
    ...(isPositive ? { left: '50%' } : { right: '50%' })
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400">
        <span>Momentum (last 5 games)</span>
        <span className={`font-semibold ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
          {isPositive ? '+' : ''}{Math.round(change)}
        </span>
      </div>
      <div className="relative h-1.5 mt-0.5 rounded-full bg-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20"></div>
        <div
          className={`absolute inset-y-0 ${isPositive ? 'bg-green-400/80' : 'bg-red-400/80'}`}
          style={fillStyle}
        />
      </div>
    </div>
  );
};

const TeamList: React.FC<TeamListProps> = ({ teams, selectedTeam, onSelectTeam }) => {
  const { hottestTeam, coldestTeam, topTeam } = useMemo(() => {
    if (teams.length === 0) {
      return { hottestTeam: null, coldestTeam: null, topTeam: null };
    }

    return teams.slice(1).reduce(
      (acc, team) => {
        if (team.eloChangeLast5 > (acc.hottestTeam?.eloChangeLast5 ?? -Infinity)) acc.hottestTeam = team;
        if (team.eloChangeLast5 < (acc.coldestTeam?.eloChangeLast5 ?? Infinity)) acc.coldestTeam = team;
        if (team.elo > (acc.topTeam?.elo ?? -Infinity)) acc.topTeam = team;
        return acc;
      },
      {
        hottestTeam: teams[0],
        coldestTeam: teams[0],
        topTeam: teams[0],
      } as { hottestTeam: Team | null; coldestTeam: Team | null; topTeam: Team | null }
    );
  }, [teams]);

  const highlights: {
    label: string;
    team: Team;
    bg: string;
    border: string;
    accent: string;
    labelClass: string;
    nameClass: string;
  }[] = [];
  if (topTeam) {
    highlights.push({
      label: 'ELO Leader',
      team: topTeam,
      bg: 'bg-amber-500/12',
      border: 'border-amber-300/60',
      accent: 'bg-amber-300',
      labelClass: 'text-amber-50',
      nameClass: 'text-white'
    });
  }
  if (hottestTeam) {
    highlights.push({
      label: 'On Fire',
      team: hottestTeam,
      bg: 'bg-orange-500/14',
      border: 'border-orange-300/50',
      accent: 'bg-orange-500',
      labelClass: 'text-orange-100',
      nameClass: 'text-white'
    });
  }
  if (coldestTeam) {
    highlights.push({
      label: 'Ice Cold',
      team: coldestTeam,
      bg: 'bg-sky-500/12',
      border: 'border-sky-300/50',
      accent: 'bg-sky-400',
      labelClass: 'text-sky-50',
      nameClass: 'text-white'
    });
  }

  return (
    <div className="glass rounded-xl p-4 h-full max-h-[calc(78vh-60px)] overflow-hidden flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold text-white">Team Power Rankings</h2>
      </div>

      {highlights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          {highlights.map((highlight) => (
            <div
              key={highlight.label}
              className={`relative overflow-hidden rounded-xl border ${highlight.border} ${highlight.bg} p-3 min-h-[84px]`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${highlight.accent}`}></div>
              <div className="relative flex flex-col gap-2 pl-2">
                <p className={`text-xs uppercase tracking-wide font-semibold ${highlight.labelClass}`}>{highlight.label}</p>
                <p className={`text-sm font-medium leading-snug break-words ${highlight.nameClass}`}>
                  {highlight.team.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pr-2 pb-2 flex-1 min-h-0 overflow-y-auto rounded-scrollbar">
        {teams.map((team, index) => {
          const isSelected = selectedTeam?.id === team.id;
          const eloClass = team.elo > 1600 ? 'elo-highlight' : 'text-orange-200';
          const eloValue = Math.round(team.elo);
          const eloChange = Math.round(team.eloChangeLast5);

          return (
            <button
              key={team.id}
              onClick={() => onSelectTeam(team)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 border relative overflow-hidden ${
                isSelected
                  ? 'bg-white/15 shadow-lg shadow-orange-500/20 border-orange-400/70'
                  : 'bg-black/25 hover:bg-white/5 border-white/10 text-gray-300'
              }`}
            >
              {isSelected && <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-orange-400/10 via-transparent to-orange-500/5" />}
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold uppercase tracking-wide border ${isSelected ? 'bg-orange-500/20 text-orange-100 border-orange-300/50' : 'bg-white/5 text-gray-300 border-white/10'}`}>{index + 1}</span>
                  <div style={{ backgroundColor: team.logoColor }} className="w-9 h-9 rounded-full flex-shrink-0 border border-white/20 shadow-inner"></div>
                  <div className="leading-tight">
                    <p className={`text-base font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-100'}`}>{team.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Current ELO</p>
                  <p className={`leading-none text-xl font-black tracking-tight ${eloClass}`}>{eloValue}</p>
                </div>
              </div>
              <MomentumBar change={eloChange} />
            </button>
          )
        })}
      </div>
    </div>
  );
};

export default TeamList;


