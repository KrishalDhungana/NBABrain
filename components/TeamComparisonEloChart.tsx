import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { Team } from '../types';

interface TeamComparisonEloChartProps {
  teams: Team[];
}

const COLORS = [
  '#f97316', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899',
  '#14b8a6', '#3b82f6', '#6366f1', '#84cc16', '#d946ef', '#0ea5e9'
];

type TimeRange = 'week' | 'month' | 'season';
type BaselineKey = 'league' | 'west' | 'east';

const BASELINE_SERIES: Record<BaselineKey, { label: string; color: string }> = {
  league: { label: 'League Avg', color: '#9ca3af' },
  west: { label: 'Western Conference Avg', color: '#fde68a' },
  east: { label: 'Eastern Conference Avg', color: '#92400e' },
};

const BASELINE_KEYS = Object.keys(BASELINE_SERIES) as BaselineKey[];

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
    const [timeRange, setTimeRange] = useState<TimeRange>('season');
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [baselineVisibility, setBaselineVisibility] = useState<Record<BaselineKey, boolean>>({
      league: false,
      west: false,
      east: false,
    });
    const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
    const [isBenchmarkMenuOpen, setIsBenchmarkMenuOpen] = useState(false);
    const teamDropdownRef = useRef<HTMLDivElement | null>(null);
    const benchmarkDropdownRef = useRef<HTMLDivElement | null>(null);

    const eastTeams = useMemo(() => teams.filter(t => t.conference === 'East').map(t => t.name), [teams]);
    const westTeams = useMemo(() => teams.filter(t => t.conference === 'West').map(t => t.name), [teams]);
    const topEloTeams = useMemo(() => [...teams].sort((a, b) => b.elo - a.elo).slice(0, 5).map(t => t.name), [teams]);
    const hottestTeams = useMemo(() => [...teams].sort((a, b) => b.eloChangeLast5 - a.eloChangeLast5).slice(0, 5).map(t => t.name), [teams]);
    const coldestTeams = useMemo(() => [...teams].sort((a, b) => a.eloChangeLast5 - b.eloChangeLast5).slice(0, 5).map(t => t.name), [teams]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
          setIsTeamMenuOpen(false);
        }
        if (benchmarkDropdownRef.current && !benchmarkDropdownRef.current.contains(event.target as Node)) {
          setIsBenchmarkMenuOpen(false);
        }
      };

      if (isTeamMenuOpen || isBenchmarkMenuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isTeamMenuOpen, isBenchmarkMenuOpen]);

    const applyPreset = (key: string, teamNames: string[], options?: { closeMenus?: boolean }) => {
        const shouldCloseMenus = options?.closeMenus ?? true;
        const uniqueNames = Array.from(new Set(teamNames));
        setSelectedTeams(uniqueNames);
        setActivePreset(key);
        if (shouldCloseMenus) {
            setIsTeamMenuOpen(false);
            setIsBenchmarkMenuOpen(false);
        }
    };

    const toggleBaseline = (key: BaselineKey) => {
        setBaselineVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTeamSelection = (teamName: string) => {
        setActivePreset(null);
        setSelectedTeams(prev => 
            prev.includes(teamName) 
            ? prev.filter(name => name !== teamName)
            : [...prev, teamName]
        );
    };

    const pillButtonClass = (isActive: boolean) =>
        `px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            isActive
                ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-black/30 border-white/10 text-gray-200 hover:bg-white/10'
        }`;

    const quickButtonClass = (key?: string, isActive?: boolean) => {
        const active = typeof isActive === 'boolean' ? isActive : activePreset === key;
        return `px-3 py-1 text-xs font-semibold rounded-md border transition-colors ${
            active
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'bg-white/5 border-white/10 text-gray-200 hover:border-orange-400 hover:text-white'
        }`;
    };

    const timeRangeContainerClass =
        'flex flex-shrink-0 items-stretch overflow-hidden rounded-md border border-white/10 bg-black/30';

    const timeRangeButtonClass = (isActive: boolean) =>
        `px-3 py-1.5 text-xs font-semibold text-gray-100 transition-colors first:rounded-l-md last:rounded-r-md border-l border-white/10 first:border-l-0 ${
            isActive
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                : 'hover:bg-white/10'
        }`;

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
            let leagueSum = 0, leagueCount = 0;
            let eastSum = 0, eastCount = 0;
            let westSum = 0, westCount = 0;

            teams.forEach(team => {
                const value = teamEloLookups.get(team.name)?.get(date);
                const hasValue = typeof value === 'number' && !Number.isNaN(value);
                dataPoint[team.name] = hasValue ? value : null;
                if (hasValue) {
                    leagueSum += value;
                    leagueCount += 1;
                    if (team.conference === 'East') {
                        eastSum += value;
                        eastCount += 1;
                    } else {
                        westSum += value;
                        westCount += 1;
                    }
                }
            });

            dataPoint[BASELINE_SERIES.league.label] = leagueCount ? Math.round(leagueSum / leagueCount) : null;
            dataPoint[BASELINE_SERIES.west.label] = westCount ? Math.round(westSum / westCount) : null;
            dataPoint[BASELINE_SERIES.east.label] = eastCount ? Math.round(eastSum / eastCount) : null;
            return dataPoint;
        });
    }, [teams, timeRange]);

    const selectedTeamLines = useMemo(() => {
      return selectedTeams.map((teamName, index) => {
        const team = teams.find(t => t.name === teamName);
        const color = team?.logoColor || COLORS[index % COLORS.length];
        return { teamName, color };
      });
    }, [selectedTeams, teams]);

    const activeBenchmarkKeys = useMemo(
      () => BASELINE_KEYS.filter(key => baselineVisibility[key]),
      [baselineVisibility]
    );

    const setAllBenchmarks = (enabled: boolean) => {
        setBaselineVisibility(prev => {
            const updated: Record<BaselineKey, boolean> = { ...prev };
            BASELINE_KEYS.forEach(key => {
                updated[key] = enabled;
            });
            return updated;
        });
    };

    const allBenchmarksSelected = activeBenchmarkKeys.length === BASELINE_KEYS.length;
    const noBenchmarksSelected = activeBenchmarkKeys.length === 0;

  return (
    <div className="glass-light rounded-xl p-6 h-[36rem] lg:h-[40rem] flex flex-col shadow-lg overflow-visible">
        <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-white">ELO Comparison</h2>
                    <p className="text-sm text-gray-400">Select teams to compare their ELO ratings over time.</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full lg:w-auto">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className={timeRangeContainerClass}>
                            {(['week', 'month', 'season'] as TimeRange[]).map(range => (
                                <button
                                  key={range}
                                  onClick={() => setTimeRange(range)}
                                  className={timeRangeButtonClass(timeRange === range)}
                                >
                                    {range.charAt(0).toUpperCase() + range.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative" ref={teamDropdownRef}>
                                <button
                                  onClick={() => {
                                    setIsTeamMenuOpen(prev => !prev);
                                    setIsBenchmarkMenuOpen(false);
                                  }}
                                  className={`${pillButtonClass(isTeamMenuOpen)} flex items-center gap-2`}
                                >
                                  Teams ({selectedTeams.length})
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                {isTeamMenuOpen && (
                                  <div className="absolute right-0 top-full mt-2 w-[22rem] max-h-[26rem] overflow-hidden bg-black/95 border border-white/10 rounded-lg shadow-2xl z-40 backdrop-blur-xl">
                                    <div className="p-3 space-y-3">
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => applyPreset('all', teams.map(t => t.name), { closeMenus: false })} className={quickButtonClass('all')}>Select All</button>
                                        <button onClick={() => applyPreset('none', [], { closeMenus: false })} className={quickButtonClass('none')}>Deselect All</button>
                                        <button onClick={() => applyPreset('west', westTeams, { closeMenus: false })} className={quickButtonClass('west')}>West Only</button>
                                        <button onClick={() => applyPreset('east', eastTeams, { closeMenus: false })} className={quickButtonClass('east')}>East Only</button>
                                        <button onClick={() => applyPreset('top5', topEloTeams, { closeMenus: false })} className={quickButtonClass('top5')}>Top 5</button>
                                        <button onClick={() => applyPreset('hottest', hottestTeams, { closeMenus: false })} className={quickButtonClass('hottest')}>Hottest 5</button>
                                        <button onClick={() => applyPreset('coldest', coldestTeams, { closeMenus: false })} className={quickButtonClass('coldest')}>Coldest 5</button>
                                      </div>
                                      <div className="h-px bg-white/10"></div>
                                      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                                        {teams.map(team => {
                                          const isSelected = selectedTeams.includes(team.name);
                                          return (
                                            <label
                                              key={team.name}
                                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span style={{ backgroundColor: team.logoColor }} className="w-2.5 h-2.5 rounded-full"></span>
                                                <span className="text-sm text-gray-100">{team.name}</span>
                                              </div>
                                              <input
                                                type="checkbox"
                                                className="accent-orange-500 h-4 w-4"
                                                checked={isSelected}
                                                onChange={() => handleTeamSelection(team.name)}
                                              />
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                            <div className="relative" ref={benchmarkDropdownRef}>
                                <button
                                  onClick={() => {
                                    setIsBenchmarkMenuOpen(prev => !prev);
                                    setIsTeamMenuOpen(false);
                                  }}
                                  className={`${pillButtonClass(isBenchmarkMenuOpen)} flex items-center gap-2`}
                                >
                                  Benchmarks ({activeBenchmarkKeys.length})
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                {isBenchmarkMenuOpen && (
                                  <div className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-hidden bg-black/95 border border-white/10 rounded-lg shadow-2xl z-40 backdrop-blur-xl">
                                    <div className="p-3 space-y-3">
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setAllBenchmarks(true)} className={quickButtonClass(undefined, allBenchmarksSelected)}>Select All</button>
                                        <button onClick={() => setAllBenchmarks(false)} className={quickButtonClass(undefined, noBenchmarksSelected)}>Deselect All</button>
                                      </div>
                                      <div className="h-px bg-white/10"></div>
                                      <div className="max-h-48 overflow-y-auto space-y-1">
                                        {BASELINE_KEYS.map(key => {
                                          const series = BASELINE_SERIES[key];
                                          const isActive = baselineVisibility[key];
                                          return (
                                            <label
                                              key={series.label}
                                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed" style={{ borderColor: series.color }}></span>
                                                <span className="text-sm text-gray-100">{series.label}</span>
                                              </div>
                                              <input
                                                type="checkbox"
                                                className="accent-orange-500 h-4 w-4"
                                                checked={isActive}
                                                onChange={() => toggleBaseline(key)}
                                              />
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="flex-grow h-[22rem] lg:h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} />
                <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={() => null} />
                {selectedTeamLines.map(({ teamName, color }) => (
                    <Line
                      key={teamName}
                      type="monotone"
                      dataKey={teamName}
                      stroke={color}
                      strokeWidth={3}
                      strokeOpacity={0.95}
                      dot={false}
                      connectNulls
                      isAnimationActive
                      animationDuration={500}
                      activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
                      style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }}
                    />
                ))}
                {activeBenchmarkKeys.map(key => {
                    const series = BASELINE_SERIES[key];
                    return (
                        <Line
                            key={series.label}
                            type="monotone"
                            dataKey={series.label}
                            stroke={series.color}
                            strokeWidth={2.5}
                            strokeDasharray="6 4"
                            dot={false}
                            connectNulls
                            isAnimationActive
                            activeDot={{ r: 5, fill: series.color, stroke: '#0a0a0a', strokeWidth: 1.5 }}
                        />
                    );
                })}
              </LineChart>
            </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Lines</div>
                <div className="flex flex-wrap gap-2">
                    {selectedTeamLines.map(({ teamName, color }) => (
                        <span key={teamName} className="px-3 py-1 text-xs rounded-full bg-black/30 border border-white/10 text-gray-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                            {teamName}
                        </span>
                    ))}
                    {activeBenchmarkKeys.map(key => {
                        const series = BASELINE_SERIES[key];
                        return (
                            <span key={series.label} className="px-3 py-1 text-xs rounded-full bg-black/30 border border-white/10 text-gray-100 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed" style={{ borderColor: series.color }}></span>
                                {series.label}
                            </span>
                        );
                    })}
                    {selectedTeamLines.length === 0 && activeBenchmarkKeys.length === 0 && (
                        <span className="text-xs text-gray-400">No lines selected. Choose teams or benchmarks to plot.</span>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default TeamComparisonEloChart;
