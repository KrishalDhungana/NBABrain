import React, { useState } from 'react';
import type { Player } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { getRatingBorderGlowClass, getRatingTextClass } from './ratingStyles';

interface BenchGridProps {
  players: Player[];
  teamColor: string;
  activePlayerId: number | null;
  onActiveChange: (id: number | null) => void;
}

const BenchGrid: React.FC<BenchGridProps> = ({ players, teamColor, activePlayerId, onActiveChange }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {players.map((player) => (
        <BenchTile
          key={player.id}
          player={player}
          teamColor={teamColor}
          isActive={activePlayerId === player.id}
          onToggle={() => onActiveChange(activePlayerId === player.id ? null : player.id)}
          onEnter={() => onActiveChange(player.id)}
          onLeave={() => onActiveChange(null)}
        />)
      )}
    </div>
  );
};

const BenchTile: React.FC<{ player: Player; teamColor: string; isActive: boolean; onToggle: () => void; onEnter?: () => void; onLeave?: () => void }> = ({ player, teamColor, isActive, onToggle, onEnter, onLeave }) => {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const radarData = [
    { s: 'SHT', A: player.skills.shooting, fullMark: 99 },
    { s: 'DEF', A: player.skills.defense, fullMark: 99 },
    { s: 'PLY', A: player.skills.playmaking, fullMark: 99 },
    { s: 'ATH', A: player.skills.athleticism, fullMark: 99 },
    { s: 'REB', A: player.skills.rebounding, fullMark: 99 },
  ];

  // Use Recharts default mount animation by mounting popover only when active

  const ratingBorder = getRatingBorderGlowClass(player.rating);
  const ratingText = getRatingTextClass(player.rating);

  return (
    <div className="relative flex flex-col items-center text-center">
      <div
        className={`w-12 h-12 rounded-full bg-black/50 ${ratingBorder} flex items-center justify-center transition-all duration-300 ${
          isActive ? 'scale-110' : ''
        } cursor-default`}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <span className={`${ratingText} font-bold text-lg`}>{player.rating}</span>
      </div>
      <span className="text-xs text-gray-300 font-semibold mt-1 bg-black/40 px-2 py-0.5 rounded-full">{player.position}</span>
      <span className="text-xs text-white mt-1 whitespace-nowrap font-medium">{player.name}</span>

      {/* Popover card */}
      {isActive && (
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-4 text-xs text-left z-10 shadow-2xl cursor-default`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <div>
            <p className="font-extrabold text-xl text-white tracking-tight">{player.name}</p>
            <p className="text-sm text-gray-400">{player.position}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">RATING</p>
            <p className={`text-4xl font-black ${ratingText}`}>{player.rating}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius={'62%'} data={radarData} margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                <Radar dataKey="A" stroke={teamColor} fill={teamColor} fillOpacity={0.6} dot={false} activeDot={false} animationDuration={600} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">PPG</span><span className="font-semibold text-white">{player.stats.ppg.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">AST</span><span className="font-semibold text-white">{player.stats.ast.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">REB</span><span className="font-semibold text-white">{player.stats.reb.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">STL</span><span className="font-semibold text-white">{player.stats.stl.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">BLK</span><span className="font-semibold text-white">{player.stats.blk.toFixed(1)}</span></div>
          </div>
        </div>

        {/* Show exact radar values as chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {['SHT','DEF','PLY','ATH','REB'].map((k, i) => {
            const val = radarData[i].A;
            return <span key={k} className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full font-semibold">{k}: {val}</span>;
          })}
        </div>

        <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-black/60 border-b border-r border-white/10 rotate-45"></div>
      </div>
      )}
    </div>
  );
};

export default BenchGrid;
