import React, { useMemo, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { PlayerDataRecord } from '../types';
import { getRatingBorderGlowClass, getRatingTextClass } from './ratingStyles';

type StatKey =
  | 'gp'
  | 'min'
  | 'pts'
  | 'ast'
  | 'reb'
  | 'stl'
  | 'blk'
  | 'fgmFga'
  | 'fgPct'
  | 'fg3m'
  | 'fg3mFg3a'
  | 'fg3Pct'
  | 'ftmFta'
  | 'ftPct'
  | 'tov'
  | 'plusMinus'
  | 'netRating'
  | 'pie'
  | 'tsPct'
  | 'usgPct';

type SortKey = StatKey | 'overall';

type RatingKey = keyof PlayerDataRecord['ratings']['perCategory'];

interface PlayerRow {
  id: string;
  name: string;
  teamName: string;
  teamAbbreviation: string;
  position: string;
  perGame: PlayerDataRecord['stats']['perGame'];
  advanced: PlayerDataRecord['stats']['advanced'];
  ratings: PlayerDataRecord['ratings'];
}

interface StatDefinition {
  label: string;
  decimals?: number;
  accessor: (player: PlayerRow) => number | null | undefined;
  isPercent?: boolean;
  display?: (player: PlayerRow, value: number | null | undefined) => string;
}

const ratingKeys: RatingKey[] = ['sco', 'ply', 'reb', 'def', 'hst', 'imp'];

const formatPair = (a?: number | null, b?: number | null) => {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return '—';
  return `${a.toFixed(1)} / ${b.toFixed(1)}`;
};

const STAT_DEFINITIONS: Record<StatKey, StatDefinition> = {
  gp: { label: 'GP', decimals: 0, accessor: p => p.perGame?.gp },
  min: { label: 'MIN', decimals: 1, accessor: p => p.perGame?.min },
  pts: { label: 'PPG', decimals: 1, accessor: p => p.perGame?.pts },
  ast: { label: 'AST', decimals: 1, accessor: p => p.perGame?.ast },
  reb: { label: 'REB', decimals: 1, accessor: p => p.perGame?.reb },
  stl: { label: 'STL', decimals: 1, accessor: p => p.perGame?.stl },
  blk: { label: 'BLK', decimals: 1, accessor: p => p.perGame?.blk },
  fgmFga: {
    label: 'FGM/FGA',
    accessor: p => {
      const made = p.perGame?.fgm;
      const att = p.perGame?.fga;
      if (typeof made === 'number' && typeof att === 'number' && att > 0) return made / att;
      return null;
    },
    display: player => formatPair(player.perGame?.fgm, player.perGame?.fga),
  },
  fgPct: { label: 'FG%', decimals: 1, accessor: p => p.perGame?.fgPct, isPercent: true },
  fg3m: { label: '3PM', decimals: 1, accessor: p => p.perGame?.fg3m },
  fg3mFg3a: {
    label: '3PM/3PA',
    accessor: p => {
      const made = p.perGame?.fg3m;
      const att = p.perGame?.fg3a;
      if (typeof made === 'number' && typeof att === 'number' && att > 0) return made / att;
      return null;
    },
    display: player => formatPair(player.perGame?.fg3m, player.perGame?.fg3a),
  },
  fg3Pct: { label: '3P%', decimals: 1, accessor: p => p.perGame?.fg3Pct, isPercent: true },
  ftmFta: {
    label: 'FTM/FTA',
    accessor: p => {
      const made = p.perGame?.ftm;
      const att = p.perGame?.fta;
      if (typeof made === 'number' && typeof att === 'number' && att > 0) return made / att;
      return null;
    },
    display: player => formatPair(player.perGame?.ftm, player.perGame?.fta),
  },
  ftPct: { label: 'FT%', decimals: 1, accessor: p => p.perGame?.ftPct, isPercent: true },
  tov: { label: 'TOV', decimals: 1, accessor: p => p.perGame?.tov },
  plusMinus: { label: '+/-', decimals: 1, accessor: p => p.perGame?.plusMinus },
  netRating: { label: 'NET', decimals: 1, accessor: p => p.advanced?.netRating },
  pie: { label: 'PIE', decimals: 2, accessor: p => p.advanced?.pie },
  tsPct: { label: 'TS%', decimals: 1, accessor: p => p.advanced?.tsPct, isPercent: true },
  usgPct: { label: 'USG%', decimals: 1, accessor: p => p.advanced?.usgPct, isPercent: true },
};

const STAT_GROUPS: Record<'base' | 'advanced', StatKey[]> = {
  base: ['gp', 'min', 'pts', 'ast', 'reb', 'stl', 'blk', 'fgmFga', 'fgPct', 'fg3m', 'fg3mFg3a', 'fg3Pct', 'ftmFta', 'ftPct', 'tov'],
  advanced: ['plusMinus', 'netRating', 'pie', 'tsPct', 'usgPct'],
};

const ORDERED_STATS: StatKey[] = [...STAT_GROUPS.base, ...STAT_GROUPS.advanced];

interface PlayerRankingsViewProps {
  players: PlayerDataRecord[];
  season?: string;
  seasonType?: string;
  lastUpdated?: string;
}

type Filters = {
  limit: number;
  position: string;
  team: string;
  search: string;
};

const STAT_COLOR_ALIASES: Partial<Record<StatKey, StatKey>> = {
  fgmFga: 'fgPct',
  fg3mFg3a: 'fg3Pct',
  ftmFta: 'ftPct',
};

const getColorKey = (stat: StatKey): StatKey => STAT_COLOR_ALIASES[stat] ?? stat;

const PlayerRankingsView: React.FC<PlayerRankingsViewProps> = ({ players, season, seasonType, lastUpdated }) => {
  const [filters, setFilters] = useState<Filters>({ limit: 50, position: 'All', team: 'All', search: '' });
  const [visibleStats, setVisibleStats] = useState<StatKey[]>(['gp', 'min', 'pts', 'ast', 'reb', 'fgPct', 'fg3Pct', 'ftPct', 'tsPct', 'netRating']);
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeRatingId, setActiveRatingId] = useState<string | null>(null);

  const processedPlayers = useMemo<PlayerRow[]>(() => {
    return (players || []).map(record => {
      const name = record.identity.name || `${record.identity.firstName || ''} ${record.identity.lastName || ''}`.trim() || 'Unknown Player';
      return {
        id: String(record.identity.playerId ?? name),
        name,
        teamName: `${record.identity.teamCity || ''} ${record.identity.team || ''}`.replace(/\s+/g, ' ').trim(),
        teamAbbreviation: (record.identity.teamAbbreviation || '').toUpperCase(),
        position: toDisplayPosition(record.identity.position),
        perGame: record.stats?.perGame ?? {},
        advanced: record.stats?.advanced ?? {},
        ratings: record.ratings,
      };
    });
  }, [players]);

  const teams = useMemo(() => {
    const set = new Set(processedPlayers.map(p => p.teamAbbreviation).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [processedPlayers]);

  const statBounds = useMemo(() => {
    const bounds = {} as Record<StatKey, { min: number; max: number }>;
    (Object.keys(STAT_DEFINITIONS) as StatKey[]).forEach(key => {
      const values = processedPlayers
        .map(p => STAT_DEFINITIONS[key].accessor(p))
        .filter((val): val is number => typeof val === 'number' && Number.isFinite(val));
      bounds[key] = {
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0,
      };
    });
    return bounds;
  }, [processedPlayers]);

  const filteredPlayers = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    return processedPlayers
      .filter(p => (filters.position === 'All' ? true : p.position === filters.position))
      .filter(p => (filters.team === 'All' ? true : p.teamAbbreviation === filters.team))
      .filter(p => (searchLower ? p.name.toLowerCase().includes(searchLower) : true));
  }, [processedPlayers, filters]);

  const orderedVisibleStats = useMemo(
    () => ORDERED_STATS.filter(stat => visibleStats.includes(stat)),
    [visibleStats]
  );

  const sortedPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    list.sort((a, b) => {
      const aVal = getSortableValue(a, sortKey);
      const bVal = getSortableValue(b, sortKey);
      if (aVal === bVal) return a.name.localeCompare(b.name);
      if (aVal == null) return sortDir === 'desc' ? 1 : -1;
      if (bVal == null) return sortDir === 'desc' ? -1 : 1;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [filteredPlayers, sortKey, sortDir]);

  const visiblePlayers = sortedPlayers.slice(0, filters.limit);
  const formattedUpdated = lastUpdated ? new Date(lastUpdated).toLocaleString() : null;

  const toggleStat = (stat: StatKey) => {
    setVisibleStats(prev => {
      if (prev.includes(stat)) {
        return prev.filter(s => s !== stat);
      }
      const next = [...prev, stat];
      return ORDERED_STATS.filter(key => next.includes(key));
    });
  };

  const handleHeaderSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!players || players.length === 0) {
    return (
      <div className="glass rounded-xl p-6 border border-white/10 text-center text-gray-300">
        <p className="text-xl font-semibold">No player data available.</p>
        <p className="text-sm text-gray-400 mt-2">Run the player pipeline to generate players.json.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6 shadow-lg space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold text-white">Player Rankings</h2>
        <p className="text-sm text-gray-400">
          Season {season || '—'} {seasonType ? `• ${seasonType}` : ''}
        </p>
      </div>

      <div className="bg-black/25 p-4 rounded-lg border border-white/5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <FilterSelect
            label="Show Top"
            value={filters.limit}
            onChange={value => setFilters(prev => ({ ...prev, limit: Number(value) }))}
            options={[25, 50, 100, 250].map(n => ({ label: `${n}`, value: n }))}
          />
          <FilterSelect
            label="Position"
            value={filters.position}
            onChange={value => setFilters(prev => ({ ...prev, position: String(value) }))}
            options={['All', 'PG', 'SG', 'SF', 'PF', 'C'].map(p => ({ label: p, value: p }))}
          />
          <FilterSelect
            label="Team"
            value={filters.team}
            onChange={value => setFilters(prev => ({ ...prev, team: String(value) }))}
            options={teams.map(t => ({ label: t, value: t }))}
          />
        </div>
        <div className="space-y-2">
          <StatToggleGroup title="Base Stats" stats={STAT_GROUPS.base} visibleStats={visibleStats} onToggle={toggleStat} />
          <StatToggleGroup title="Advanced Stats" stats={STAT_GROUPS.advanced} visibleStats={visibleStats} onToggle={toggleStat} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="text-sm text-gray-400 flex flex-col gap-1 flex-1">
            <span className="font-medium">Search</span>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="bg-gray-900/60 border border-white/10 rounded-md px-3 py-2 text-white"
              placeholder="Search players"
            />
          </label>
          {/* spacer for layout */}
          <span className="h-0 w-0" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide">
              <th className="py-3 pr-4 text-left">Rank</th>
              <th className="py-3 pr-4 text-left">Player</th>
              {orderedVisibleStats.map(stat => (
                <th
                  key={stat}
                  className="py-3 px-2 text-center cursor-pointer whitespace-nowrap"
                  onClick={() => handleHeaderSort(stat)}
                >
                  {STAT_DEFINITIONS[stat].label}
                  {sortKey === stat && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
                </th>
              ))}
              <th className="py-3 pr-4 text-right cursor-pointer" onClick={() => handleHeaderSort('overall')}>
                Overall
                {sortKey === 'overall' && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white">
            {visiblePlayers.map((player, index) => (
              <tr key={`${player.id}-${index}`} className="hover:bg-white/5">
                <td className="py-3 pr-4 text-gray-400 font-semibold">#{index + 1}</td>
                <td className="py-3 pr-4">
                  <div className="font-bold">{player.name}</div>
                  <div className="text-xs text-gray-400">
                    {player.teamName} • {player.position}
                  </div>
                </td>
                {orderedVisibleStats.map(stat => {
                  const def = STAT_DEFINITIONS[stat];
                  const value = def.accessor(player);
                  const text = def.display ? def.display(player, value) : formatStat(value, def);
                  const colorKey = getColorKey(stat);
                  const colorValue = STAT_DEFINITIONS[colorKey].accessor(player);
                  return (
                    <td key={stat} className="py-2 px-2 text-center">
                      <span className={`inline-flex w-full justify-center px-3 py-2 rounded-md text-sm font-semibold ${getStatClasses(colorValue, statBounds[colorKey])}`}>
                        {text}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2 pr-4 text-right relative">
                  {(() => {
                    const borderClass = getRatingBorderGlowClass(player.ratings?.overall);
                    const textClass = getRatingTextClass(player.ratings?.overall);
                    const isActive = activeRatingId === player.id;
                    return (
                      <>
                        <span
                          className={`inline-flex items-center justify-center min-w-[72px] px-3 py-2 rounded-md text-xl font-black bg-transparent transition-all duration-300 ${borderClass} ${
                            isActive ? 'scale-110' : 'scale-100'
                          }`}
                          onMouseEnter={() => setActiveRatingId(player.id)}
                          onMouseLeave={() => setActiveRatingId(null)}
                        >
                          <span className={textClass}>{formatNumber(player.ratings?.overall, 0, '—')}</span>
                        </span>
                        {isActive && (
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/80 border border-white/10 rounded-lg p-3 text-xs z-10 shadow-2xl">
                            <div className="h-24">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius={'60%'} data={ratingKeys.map(key => ({
                                  s: String(key).toUpperCase(),
                                  A: player.ratings?.perCategory?.[key] ?? 0,
                                }))}>
                                  <PolarGrid stroke="rgba(255,255,255,0.2)" />
                                  <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                                  <Radar dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.5} dot={false} activeDot={false} />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {ratingKeys.map(key => (
                                <span key={key} className="bg-white/10 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">
                                  {String(key).toUpperCase()}: {formatNumber(player.ratings?.perCategory?.[key], 0, '—')}
                                </span>
                              ))}
                            </div>
                            <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-black/80 border-l border-t border-white/10 rotate-45" />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visiblePlayers.length === 0 && <div className="text-center text-gray-400">No players match the selected filters.</div>}
      {formattedUpdated && <p className="text-xs text-gray-500 text-right">Last updated {formattedUpdated}</p>}
    </div>
  );
};

const FilterSelect: React.FC<{
  label: string;
  value: any;
  onChange: (value: any) => void;
  options: { label: string | number; value: any }[];
}> = ({ label, value, onChange, options }) => (
  <label className="text-sm text-gray-400 flex flex-col gap-1">
    <span className="font-medium">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} className="bg-gray-900/60 border border-white/10 rounded-md px-3 py-2 text-white">
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

const StatToggleGroup: React.FC<{
  title: string;
  stats: StatKey[];
  visibleStats: StatKey[];
  onToggle: (stat: StatKey) => void;
}> = ({ title, stats, visibleStats, onToggle }) => (
  <div>
    <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
    <div className="flex flex-wrap gap-2">
      {stats.map(stat => (
        <button
          key={stat}
          onClick={() => onToggle(stat)}
          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
            visibleStats.includes(stat)
              ? 'bg-orange-600 border-orange-500 text-white'
              : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/10'
          }`}
        >
          {STAT_DEFINITIONS[stat].label}
        </button>
      ))}
    </div>
  </div>
);

const getStatClasses = (value: number | null | undefined, bounds: { min: number; max: number }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'bg-white/5 text-gray-300';
  const { min, max } = bounds;
  if (max === min) return 'bg-white/10 text-white';
  const percentile = (value - min) / (max - min || 1);
  if (percentile >= 0.75) return 'bg-green-700/80 text-white ring-2 ring-green-200/80 shadow-[0_0_14px_rgba(74,222,128,0.65)]';
  if (percentile >= 0.5) return 'bg-green-500/80 text-white';
  if (percentile >= 0.25) return 'bg-red-500/80 text-white';
  return 'bg-red-900/80 text-white';
};

const formatNumber = (value?: number | null, decimals = 1, fallback: string | number = '—') =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : fallback;

const formatStat = (value: number | null | undefined, config: StatDefinition) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const num = config.isPercent ? value * 100 : value;
  return num.toFixed(config.decimals ?? 1) + (config.isPercent ? '%' : '');
};

const getSortableValue = (player: PlayerRow, key: SortKey): number | null => {
  if (key === 'overall') {
    return typeof player.ratings?.overall === 'number' ? player.ratings.overall : null;
  }
  const val = STAT_DEFINITIONS[key].accessor(player);
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
};

const toDisplayPosition = (value?: string | null) => {
  const normalized = (value || '').trim().toUpperCase();
  if (['PG', 'SG', 'SF', 'PF', 'C'].includes(normalized)) return normalized;
  if (normalized === 'G' || normalized === 'G-F') return 'PG';
  if (normalized === 'GF') return 'SG';
  if (normalized === 'F' || normalized === 'F-G') return 'SF';
  if (normalized === 'FC' || normalized === 'PF/C') return 'PF';
  return 'SF';
};

export default PlayerRankingsView;
