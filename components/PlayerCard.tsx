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
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
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
  
  const CustomizedDot = ({ cx, cy, payload, stroke }: any) => {
    if (activeSkill === payload.s) {
        return (
            <g transform={`translate(${cx},${cy})`}>
                <circle r={6} fill={stroke} stroke="#fff" strokeWidth={2} />
                <text textAnchor="middle" y={-10} fill="#fff" fontSize="12" fontWeight="bold">
                    {payload.A}
                </text>
            </g>
        );
    }
    return <circle cx={cx} cy={cy} r={3} fill={stroke} />;
  };

  return (
    <div className="bg-black/20 rounded-lg p-4 flex items-center justify-between gap-4 border border-white/10">
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-white">{name}</h3>
        <p className="text-sm text-gray-400 -mt-1">{position}</p>
        <div className="grid grid-cols-5 gap-x-3 gap-y-2 mt-3">
            <StatBox label="PPG" value={stats.ppg.toFixed(1)} />
            <StatBox label="AST" value={stats.ast.toFixed(1)} />
            <StatBox label="REB" value={stats.reb.toFixed(1)} />
            <StatBox label="STL" value={stats.stl.toFixed(1)} />
            <StatBox label="BLK" value={stats.blk.toFixed(1)} />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
          <div className="w-24 h-24">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                    <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                    <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                    <Radar 
                        dataKey="A" 
                        stroke={teamColor} 
                        fill={teamColor} 
                        fillOpacity={0.6}
                        // FIX: Explicitly type the 'data' parameter as 'any' to resolve incorrect TypeScript inference.
                        // The 'recharts' library passes a data payload object to onClick, not a standard MouseEvent.
                        onClick={(data: any) => setActiveSkill(prev => prev === data.payload.s ? null : data.payload.s)}
                        dot={<CustomizedDot />}
                        activeDot={false}
                    />
                </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col items-center justify-center text-center w-20">
            <span className="text-xs text-gray-400">Rating</span>
            <span className={`text-3xl font-black ${ratingColor} ${ratingHighlightClass}`}>{rating}</span>
          </div>
      </div>
    </div>
  );
};

export default PlayerCard;