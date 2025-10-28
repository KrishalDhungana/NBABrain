import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { Player, PlayerStats } from '../types';

const STAT_KEYS: (keyof PlayerStats)[] = ['ppg', 'ast', 'reb', 'stl', 'blk', 'fgPercentage', 'per', 'tsPercentage', 'ws'];
const STAT_LABELS: Record<keyof PlayerStats, string> = {
    ppg: 'PPG',
    ast: 'AST',
    reb: 'REB',
    stl: 'STL',
    blk: 'BLK',
    fgPercentage: 'FG%',
    per: 'PER',
    tsPercentage: 'TS%',
    ws: 'WS'
};

const getStatBgColor = (value: number, min: number, max: number) => {
    if (max === min) return '';
    const percentile = (value - min) / (max - min);
    if (percentile > 0.85) return 'bg-green-500/30';
    if (percentile > 0.65) return 'bg-green-500/15';
    if (percentile < 0.15) return 'bg-red-500/30';
    if (percentile < 0.35) return 'bg-red-500/15';
    return '';
};


const PlayerRankingsView: React.FC<{ players: Player[] }> = ({ players }) => {
    const [filter, setFilter] = useState<{ limit: number, position: string }>({ limit: 50, position: 'All' });
    const [visibleStats, setVisibleStats] = useState<(keyof PlayerStats)[]>(['ppg', 'ast', 'reb', 'stl', 'blk', 'per']);
    
    const positions = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];

    const { filteredPlayers, statBounds } = useMemo(() => {
        const filtered = players
            .filter(p => filter.position === 'All' || p.position === filter.position)
            .slice(0, filter.limit);
        
        const bounds: Record<string, {min: number, max: number}> = {};
        STAT_KEYS.forEach(key => {
            const values = players.map(p => p.stats[key]);
            bounds[key] = { min: Math.min(...values), max: Math.max(...values) };
        });

        return { filteredPlayers: filtered, statBounds: bounds };
    }, [players, filter]);

    const toggleStat = (stat: keyof PlayerStats) => {
        setVisibleStats(prev => 
            prev.includes(stat)
            ? prev.filter(s => s !== stat)
            : [...prev, stat]
        )
    }

    return (
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg">
            <h2 className="text-3xl font-extrabold text-white mb-4">Player Rankings</h2>
            <div className="bg-black/20 p-3 rounded-md space-y-4 border border-white/10">
                <div className="flex gap-4 items-center flex-wrap">
                    <div>
                      <label htmlFor="limit-select" className="text-sm font-medium text-gray-400 mr-2">Show Top:</label>
                      <select id="limit-select" value={filter.limit} onChange={e => setFilter(f => ({...f, limit: parseInt(e.target.value)}))} className="bg-gray-800 border border-white/10 rounded-md px-3 py-1 text-white">
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                      </select>
                    </div>
                     <div>
                      <label htmlFor="pos-select" className="text-sm font-medium text-gray-400 mr-2">Position:</label>
                      <select id="pos-select" value={filter.position} onChange={e => setFilter(f => ({...f, position: e.target.value}))} className="bg-gray-800 border border-white/10 rounded-md px-3 py-1 text-white">
                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-400 mb-2">Display Stats:</p>
                    <div className="flex flex-wrap gap-2">
                        {STAT_KEYS.map(stat => (
                            <button key={stat} onClick={() => toggleStat(stat)} className={`px-3 py-1 text-xs rounded-md transition-colors border ${visibleStats.includes(stat) ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/20 border-white/10 hover:bg-white/10 text-gray-300'}`}>
                                {STAT_LABELS[stat]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-2">
                {filteredPlayers.map((player, index) => (
                    <div key={player.id} className="bg-black/20 rounded-md p-3 grid grid-cols-12 items-center gap-4 text-sm border border-white/10">
                        <span className="font-bold text-gray-400 text-center col-span-1">{index + 1}</span>
                        
                        <div className="col-span-3 flex items-center gap-3">
                            <div style={{ backgroundColor: player.teamLogoColor }} className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md">
                                {player.teamAbbreviation}
                            </div>
                            <div>
                                <p className="font-bold text-white text-base">{player.name}</p>
                                <p className="text-gray-400">{player.position}</p>
                            </div>
                        </div>

                        <div className={`col-span-6 grid grid-cols-${visibleStats.length || 1} gap-2 text-center`}>
                           {visibleStats.map(key => (
                                <div key={key} className={`rounded-md py-1 ${getStatBgColor(player.stats[key], statBounds[key].min, statBounds[key].max)}`}>
                                    <p className="text-xs text-gray-500">{STAT_LABELS[key]}</p>
                                    <p className="font-semibold text-white">
                                        {key.includes('Percentage') ? (player.stats[key] * 100).toFixed(1) + '%' : player.stats[key].toFixed(1)}
                                    </p>
                                </div>
                            ))}
                        </div>
                        
                        <div className="group relative col-span-2 flex flex-col items-center justify-center">
                            <p className="text-xs text-gray-500">RATING</p>
                            <p className={`text-2xl font-black ${player.rating > 95 ? 'rating-highlight' : player.rating > 90 ? 'text-orange-400' : 'text-amber-300'}`}>{player.rating}</p>
                            
                            <div className="absolute bottom-full mb-2 w-48 h-48 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                                    { s: 'SHT', A: player.skills.shooting }, { s: 'DEF', A: player.skills.defense },
                                    { s: 'PLY', A: player.skills.playmaking }, { s: 'ATH', A: player.skills.athleticism }, { s: 'REB', A: player.skills.rebounding }
                                  ]}>
                                    <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                                    <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                                    <Radar dataKey="A" stroke="#fb923c" fill="#fb923c" fillOpacity={0.6} />
                                  </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerRankingsView;