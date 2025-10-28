import React, { useState } from 'react';
import type { Player } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface PlayerCardProps {
  player: Player;
  teamColor: string;
}

const StatBox: React.FC<{ label: string, value: number | string }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-bold text-white text-sm">{value}</p>
    </div>
);

const PlayerCard: React.FC<PlayerCardProps> = ({ player, teamColor }) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const { name, position, rating, stats, skills } = player;

  const ratingColor = rating >= 90 ? 'text-orange-400' : rating >= 85 ? 'text-amber-400' : 'text-gray-200';
  const ratingHighlightClass = rating >= 95 ? 'rating-highlight' : '';

  const radarData = [
    { s: 'SHT', A: skills.shooting, fullMark: 99 },
    { s: 'DEF', A: skills.defense, fullMark: 99 },
    { s: 'PLY', A: skills.playmaking, fullMark: 99 },
    { s: 'ATH', A: skills.athleticism, fullMark: 99 },
    { s: 'REB', A: skills.rebounding, fullMark: 99 },
  ];
  
  // Hover interactions removed; values are shown as chips where used

  return (
    <div className="relative bg-black/20 rounded-lg p-4 flex items-center justify-between gap-4 border border-white/10">
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-white">{name}</h3>
        <p className="text-sm text-gray-400 -mt-1">{position}</p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-center justify-center text-center w-20 select-none">
          <span className="text-xs text-gray-400">Rating</span>
          <button onClick={() => setShowDetails(v => !v)} className={`text-3xl font-black ${ratingColor} ${ratingHighlightClass} hover:scale-110 transition-transform`}>{rating}</button>
        </div>
      </div>

      {/* Details popover (same style as starters) */}
      <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 w-72 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-4 text-xs text-left transition-opacity duration-300 z-10 shadow-2xl ${showDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <div>
            <p className="font-extrabold text-xl text-white tracking-tight">{name}</p>
            <p className="text-sm text-gray-400">{position}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">RATING</p>
            <p className={`text-4xl font-black ${rating >= 95 ? 'rating-highlight' : rating >= 90 ? 'text-orange-400' : 'text-amber-400'}`}>{rating}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius={'65%'} data={radarData} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                <Radar
                  dataKey="A"
                  stroke={teamColor}
                  fill={teamColor}
                  fillOpacity={0.6}
                  dot={false}
                  activeDot={false}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">PPG</span><span className="font-semibold text-white">{stats.ppg.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">AST</span><span className="font-semibold text-white">{stats.ast.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">REB</span><span className="font-semibold text-white">{stats.reb.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">STL</span><span className="font-semibold text-white">{stats.stl.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">BLK</span><span className="font-semibold text-white">{stats.blk.toFixed(1)}</span></div>
          </div>
        </div>
        <button onClick={() => setShowDetails(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
};

export default PlayerCard;
