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

const getStatClasses = (value: number, min: number, max: number) => {
    if (max === min) return '';
    const percentile = (value - min) / (max - min);
    if (percentile >= 0.9) return 'bg-green-600/70 ring-2 ring-green-300/80 shadow-[0_0_18px_rgba(34,197,94,0.75)]';
    if (percentile >= 0.75) return 'bg-green-500/50';
    if (percentile <= 0.1) return 'bg-red-700/70';
    if (percentile <= 0.25) return 'bg-red-600/50';
    return '';
};


const PlayerRankingsView: React.FC<{ players: Player[] }> = ({ players }) => {
    const [filter, setFilter] = useState<{ limit: number, position: string, team: string }>({ limit: 50, position: 'All', team: 'All' });
    const [visibleStats, setVisibleStats] = useState<(keyof PlayerStats)[]>(['ppg', 'ast', 'reb', 'stl', 'blk', 'per']);
    const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
    
    const positions = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
    const teams = useMemo(() => {
        const abbrs = Array.from(new Set(players.map(p => p.teamAbbreviation)));
        return ['All', ...abbrs.sort()];
    }, [players]);

    const { filteredPlayers, statBounds } = useMemo(() => {
        const filtered = players
            .filter(p => (filter.position === 'All' || p.position === filter.position))
            .filter(p => (filter.team === 'All' || p.teamAbbreviation === filter.team))
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
        <div className="glass rounded-xl p-6 shadow-lg" onClick={() => setActivePlayerId(null)}>
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
                    <div>
                      <label htmlFor="team-select" className="text-sm font-medium text-gray-400 mr-2">Team:</label>
                      <select id="team-select" value={filter.team} onChange={e => setFilter(f => ({...f, team: e.target.value}))} className="bg-gray-800 border border-white/10 rounded-md px-3 py-1 text-white">
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
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
                    <div key={player.id} className="relative bg-black/20 rounded-md p-2 grid grid-cols-12 items-center gap-2 text-sm border border-white/10" onClick={() => setActivePlayerId(null)}>
                        <span className="font-bold text-gray-400 text-center col-span-1">{index + 1}</span>
                        
                        <div className="col-span-3 flex items-center gap-2">
                            <div style={{ backgroundColor: player.teamLogoColor }} className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md">
                                {player.teamAbbreviation}
                            </div>
                            <div>
                                <p className="font-bold text-white text-base">{player.name}</p>
                                <p className="text-gray-400">{player.position}</p>
                            </div>
                        </div>

                        {(() => { const ordered = STAT_KEYS.filter(k => visibleStats.includes(k)); return (
                        <div className={`col-span-6 grid grid-cols-${(visibleStats.length || 1)} gap-2 text-center`}>
                           {ordered.map(key => (
                                <div key={key} className={`rounded-md py-1 ${getStatClasses(player.stats[key], statBounds[key].min, statBounds[key].max)}`}>
                                    <p className="text-xs text-gray-200">{STAT_LABELS[key]}</p>
                                    <p className="font-semibold text-white">
                                        {key.includes('Percentage') ? (player.stats[key] * 100).toFixed(1) + '%' : player.stats[key].toFixed(1)}
                                    </p>
                                </div>
                            ))}
                        </div>); })()}
                        
                        <div className="relative col-span-2 flex flex-col items-center justify-center">
                            <p className="text-xs text-gray-500">RATING</p>
                            <span onMouseEnter={() => setActivePlayerId(player.id)} onMouseLeave={() => setActivePlayerId(null)} className={`text-2xl font-black transition-transform ${activePlayerId === player.id ? 'scale-110' : ''} ${player.rating > 95 ? 'rating-highlight' : player.rating > 90 ? 'text-orange-400' : 'text-amber-300'}`}>{player.rating}</span>

                            {activePlayerId === player.id && (
                              <div className="absolute bottom-full mb-2 w-56 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg p-3 z-50" onMouseEnter={() => setActivePlayerId(player.id)} onMouseLeave={() => setActivePlayerId(null)}>
                                <div className="w-full h-40">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius={'62%'} data={[
                                      { s: 'SHT', A: player.skills.shooting }, { s: 'DEF', A: player.skills.defense },
                                      { s: 'PLY', A: player.skills.playmaking }, { s: 'ATH', A: player.skills.athleticism }, { s: 'REB', A: player.skills.rebounding }
                                    ]} margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                                      <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                                      <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                                      <Radar dataKey="A" stroke="#fb923c" fill="#fb923c" fillOpacity={0.6} dot={false} activeDot={false} />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {['SHT','DEF','PLY','ATH','REB'].map((k, i) => {
                                    const vals = [player.skills.shooting, player.skills.defense, player.skills.playmaking, player.skills.athleticism, player.skills.rebounding];
                                    const val = vals[i];
                                    return <span key={k} className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full font-semibold">{k}: {val}</span>;
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerRankingsView;

