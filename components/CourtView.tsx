import React, { useMemo, useState } from 'react';
import type { Player } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface CourtViewProps {
  players: Player[];
  teamColor: string;
  activePlayerId?: number | null;
  onActiveChange?: (id: number | null) => void;
}

// A more standard offensive formation for a half-court view.
// The basket is at the top of the component (top: 0%).
const positionCoordinates = {
  PG: { top: '85%', left: '50%' }, // Point Guard: Top of the key, controlling play
  SG: { top: '65%', left: '85%' }, // Shooting Guard: Right wing
  SF: { top: '65%', left: '15%' }, // Small Forward: Left wing
  PF: { top: '35%', left: '75%' }, // Power Forward: Right low post/block
  C:  { top: '35%', left: '25%' }, // Center: Left low post/block
};


const PlayerMarker: React.FC<{ 
    player: Player; 
    teamColor: string; 
    isActive: boolean;
    onActivate: () => void;
    onDeactivate: () => void;
}> = ({ player, teamColor, isActive, onActivate, onDeactivate }) => {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const ratingColor = player.rating >= 90 ? 'border-orange-400' : player.rating >= 85 ? 'border-amber-400' : 'border-gray-500';
  const radarData = [
    { s: 'SHT', A: player.skills.shooting, fullMark: 99 },
    { s: 'DEF', A: player.skills.defense, fullMark: 99 },
    { s: 'PLY', A: player.skills.playmaking, fullMark: 99 },
    { s: 'ATH', A: player.skills.athleticism, fullMark: 99 },
    { s: 'REB', A: player.skills.rebounding, fullMark: 99 },
  ];

  // Use Recharts default mount animation by mounting popover only when active

  return (
    <div className="relative flex flex-col items-center cursor-default" onMouseEnter={onActivate} onMouseLeave={onDeactivate}>
      <div 
        className={`w-12 h-12 rounded-full bg-black/50 border-2 ${ratingColor} flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : ''} shadow-lg cursor-default`}
        style={{ boxShadow: `0 0 15px ${teamColor}50`}}
      >
        <span className="text-white font-bold text-lg">{player.rating}</span>
      </div>
      <span className="text-xs text-gray-300 font-semibold mt-1 bg-black/40 px-2 py-0.5 rounded-full">{player.position}</span>
      <span className="text-xs text-white mt-1 whitespace-nowrap font-medium">{player.name}</span>
      
      {/* Enhanced Popover */}
      {isActive && (
      <div className={`absolute bottom-full mb-3 w-72 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-4 text-xs text-left z-10 shadow-2xl cursor-default`}>
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
            <div>
                <p className="font-extrabold text-xl text-white tracking-tight">{player.name}</p>
                <p className="text-sm text-gray-400">{player.position}</p>
            </div>
            <div className="text-center">
                <p className="text-xs text-gray-400">RATING</p>
                <p className={`text-4xl font-black ${player.rating >= 95 ? 'rating-highlight' : player.rating >= 90 ? 'text-orange-400' : 'text-amber-400'}`}>{player.rating}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius={'62%'} data={radarData} margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                        <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                        <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                        <Radar 
                            dataKey="A" 
                            stroke={teamColor || '#f97316'} 
                            fill={teamColor || '#f97316'} 
                            fillOpacity={0.6}
                            dot={false}
                            activeDot={false}
                            animationDuration={600}
                        />
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
        {/* Exact radar values as chips */}
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

const CourtView: React.FC<CourtViewProps> = ({ players, teamColor, activePlayerId: controlledActiveId, onActiveChange }) => {
  const [uncontrolledId, setUncontrolledId] = useState<number | null>(null);
  const activePlayerId = controlledActiveId !== undefined ? controlledActiveId : uncontrolledId;

  const positionedPlayers = useMemo(() => {
    const starters = [...players];
    const positions: (keyof typeof positionCoordinates)[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    const assigned = new Map<keyof typeof positionCoordinates, Player>();
    const usedPlayerIds = new Set<number>();

    // First pass: assign players to their natural position
    for (const pos of positions) {
      const playerForPos = starters.find(p => p.position === pos && !usedPlayerIds.has(p.id));
      if (playerForPos) {
        assigned.set(pos, playerForPos);
        usedPlayerIds.add(playerForPos.id);
      }
    }
    
    // Second pass: fill remaining spots with unassigned players
    const remainingPlayers = starters.filter(p => !usedPlayerIds.has(p.id));
    for (const pos of positions) {
      if (!assigned.has(pos) && remainingPlayers.length > 0) {
        const playerToAssign = remainingPlayers.shift()!;
        assigned.set(pos, playerToAssign);
      }
    }
    
    return Array.from(assigned.entries());
  }, [players]);

  const handleActivate = (playerId: number) => {
    if (onActiveChange) onActiveChange(playerId);
    else setUncontrolledId(playerId);
  };
  const handleDeactivate = () => {
    if (onActiveChange) onActiveChange(null);
    else setUncontrolledId(null);
  };

  return (
    <div className="bg-black/20 rounded-lg p-4 border border-white/10 aspect-[4/3] relative">
        {/* Half court SVG background */}
        <svg className="absolute top-0 left-0 w-full h-full text-white/20" preserveAspectRatio="xMidYMid meet" viewBox="0 0 500 470">
            <rect x="0" y="0" width="500" height="470" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="250" cy="470" r="60" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="170" y="0" width="160" height="190" stroke="currentColor" strokeWidth="2" fill="none"/>
            <circle cx="250" cy="190" r="60" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M 210 40 A 40 40 0 0 1 290 40" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M30,0 L30,140 A 237.5 237.5 0 0 0 470 140 L470,0" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="220" y1="40" x2="280" y2="40" stroke="currentColor" strokeWidth="3"/>
            <circle cx="250" cy="52.5" r="15" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>

        {positionedPlayers.map(([pos, player]) => {
            if (!player) return null;
            const coords = positionCoordinates[pos];
            return (
              <div 
                key={player.id} 
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${activePlayerId === player.id ? 'z-20' : ''}`}
                style={{ top: coords.top, left: coords.left }}
              >
                <PlayerMarker 
                    player={player} 
                    teamColor={teamColor} 
                    isActive={activePlayerId === player.id}
                    onActivate={() => handleActivate(player.id)}
                    onDeactivate={handleDeactivate}
                />
              </div>
            );
        })}
    </div>
  );
};

export default CourtView;
