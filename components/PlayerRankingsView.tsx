import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  | 'fantasyPts'
  | 'offRating'
  | 'defRating'
  | 'pie'
  | 'tsPct'
  | 'usgPct'
  | 'rating_sco'
  | 'rating_ply'
  | 'rating_reb'
  | 'rating_def'
  | 'rating_hst'
  | 'rating_imp';

type SortKey = StatKey | 'overall';

type RatingKey = keyof PlayerDataRecord['ratings']['perCategory'];

interface PlayerRow {
  id: string;
  name: string;
  teamName: string;
  teamAbbreviation: string;
  position: string;
  originalPosition: string;
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
  pts: { label: 'PTS', decimals: 1, accessor: p => p.perGame?.pts },
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
  netRating: { label: 'NET RTG', decimals: 1, accessor: p => p.advanced?.netRating },
  fantasyPts: { label: 'FANTASY PTS', decimals: 1, accessor: p => p.advanced?.nbaFantasyPoints },
  offRating: { label: 'OFF RTG', decimals: 1, accessor: p => p.advanced?.offRating },
  defRating: { label: 'DEF RTG', decimals: 1, accessor: p => p.advanced?.defRating },
  pie: { label: 'PIE', decimals: 2, accessor: p => p.advanced?.pie },
  tsPct: { label: 'TS%', decimals: 1, accessor: p => p.advanced?.tsPct, isPercent: true },
  usgPct: { label: 'USG%', decimals: 1, accessor: p => p.advanced?.usgPct, isPercent: true },
  rating_sco: { label: 'SCO', decimals: 0, accessor: p => p.ratings?.perCategory?.sco ?? null },
  rating_ply: { label: 'PLY', decimals: 0, accessor: p => p.ratings?.perCategory?.ply ?? null },
  rating_reb: { label: 'REB', decimals: 0, accessor: p => p.ratings?.perCategory?.reb ?? null },
  rating_def: { label: 'DEF', decimals: 0, accessor: p => p.ratings?.perCategory?.def ?? null },
  rating_hst: { label: 'HST', decimals: 0, accessor: p => p.ratings?.perCategory?.hst ?? null },
  rating_imp: { label: 'IMP', decimals: 0, accessor: p => p.ratings?.perCategory?.imp ?? null },
};

const STAT_GROUPS: Record<'base' | 'advanced' | 'categories', StatKey[]> = {
  base: ['gp', 'min', 'pts', 'ast', 'reb', 'stl', 'blk', 'fg3m', 'tov', 'fgmFga', 'fgPct', 'fg3mFg3a', 'fg3Pct', 'ftmFta', 'ftPct'],
  advanced: ['plusMinus', 'offRating', 'defRating', 'netRating', 'pie', 'tsPct', 'usgPct', 'fantasyPts'],
  categories: ['rating_sco', 'rating_ply', 'rating_reb', 'rating_def', 'rating_hst', 'rating_imp'],
};

const ORDERED_STATS: StatKey[] = [...STAT_GROUPS.base, ...STAT_GROUPS.advanced, ...STAT_GROUPS.categories];

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

const NEGATIVE_STATS = new Set<StatKey>(['tov']);

const FILTER_SELECT_CLASS =
  'px-3 py-1 text-xs sm:text-sm rounded-md border border-white/10 bg-black/20 text-gray-200 hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/60';
const FILTER_OPTION_STYLE: React.CSSProperties = { backgroundColor: '#111827', color: '#F9FAFB' };

const getColorKey = (stat: StatKey): StatKey => STAT_COLOR_ALIASES[stat] ?? stat;

const CATEGORY_INFO = [
  { key: 'SCO', name: 'Scoring', description: 'Measures scoring strength by combining points per possession, usage, and true shooting efficiency.' },
  { key: 'PLY', name: 'Playmaking', description: 'Rewards players who generate assists and potential assists for their position while limiting turnovers.' },
  { key: 'REB', name: 'Rebounding', description: 'Highlights glass cleaners by mixing offensive and defensive rebound rates plus box outs adjusted for role.' },
  { key: 'DEF', name: 'Defense', description: 'Blends steals, blocks, foul avoidance, and how well opponents shoot against the player to capture disruption.' },
  { key: 'HST', name: 'Hustle', description: 'Credits constant activity like deflections, loose balls, contests, charges, and big-man screen assists.' },
  { key: 'IMP', name: 'Impact', description: 'Summarizes overall on-court swing using equal parts PIE and net rating.' },
];

const PlayerRankingsView: React.FC<PlayerRankingsViewProps> = ({ players, season, seasonType, lastUpdated }) => {
  const [filters, setFilters] = useState<Filters>({ limit: 50, position: 'All', team: 'All', search: '' });
  const [visibleStats, setVisibleStats] = useState<StatKey[]>(['pts', 'ast', 'reb', 'stl', 'blk', 'fg3m', 'tov', 'fgPct', 'fg3Pct', 'ftPct']);
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeRatingId, setActiveRatingId] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null);
  const ratingAnchorRef = useRef<HTMLElement | null>(null);
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const categoryInfoRef = useRef<HTMLDivElement | null>(null);

  const processedPlayers = useMemo<PlayerRow[]>(() => {
    return (players || []).map(record => {
      const name = record.identity.name || `${record.identity.firstName || ''} ${record.identity.lastName || ''}`.trim() || 'Unknown Player';
      return {
        id: String(record.identity.playerId ?? name),
        name,
        teamName: `${record.identity.teamCity || ''} ${record.identity.team || ''}`.replace(/\s+/g, ' ').trim(),
        teamAbbreviation: (record.identity.teamAbbreviation || '').toUpperCase(),
        position: toDisplayPosition(record.identity.position),
        originalPosition: formatOriginalPositionLabel(record.identity.position),
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

  const positions = useMemo(() => {
    const set = new Set(processedPlayers.map(p => p.originalPosition).filter(Boolean));
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
      .filter(p => (filters.position === 'All' ? true : p.originalPosition === filters.position))
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
  const activePopoverPlayer = useMemo(
    () => visiblePlayers.find(player => player.id === activeRatingId) ?? null,
    [visiblePlayers, activeRatingId]
  );
  const formattedUpdated = lastUpdated ? new Date(lastUpdated).toLocaleString() : null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

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

  const updatePopoverPosition = useCallback(() => {
    if (!ratingAnchorRef.current) {
      setPopoverPosition(null);
      return;
    }
    const rect = ratingAnchorRef.current.getBoundingClientRect();
    setPopoverPosition({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  }, []);

  const handleRatingEnter = useCallback(
    (playerId: string, target: HTMLElement) => {
      ratingAnchorRef.current = target;
      setActiveRatingId(playerId);
      updatePopoverPosition();
    },
    [updatePopoverPosition]
  );

  const handleRatingLeave = useCallback(() => {
    ratingAnchorRef.current = null;
    setActiveRatingId(null);
    setPopoverPosition(null);
  }, []);

  useEffect(() => {
    if (!showCategoryInfo) return;
    const handleClick = (event: MouseEvent) => {
      if (!categoryInfoRef.current) return;
      if (!categoryInfoRef.current.contains(event.target as Node)) {
        setShowCategoryInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCategoryInfo]);

  useEffect(() => {
    if (!activeRatingId) return;
    const handleScrollOrResize = () => updatePopoverPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeRatingId, updatePopoverPosition]);

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
          {season || '—'} {seasonType ? `• ${seasonType}` : ''}
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
            options={positions.map(p => ({ label: p, value: p }))}
          />
          <FilterSelect
            label="Team"
            value={filters.team}
            onChange={value => setFilters(prev => ({ ...prev, team: String(value) }))}
            options={teams.map(t => ({ label: t, value: t }))}
          />
        </div>
        <div className="space-y-2">
          <StatToggleGroup title="Base Per-Game Stats" stats={STAT_GROUPS.base} visibleStats={visibleStats} onToggle={toggleStat} />
          <StatToggleGroup title="Advanced Per-Game Stats" stats={STAT_GROUPS.advanced} visibleStats={visibleStats} onToggle={toggleStat} />
          <StatToggleGroup
            title="Category Ratings"
            stats={STAT_GROUPS.categories}
            visibleStats={visibleStats}
            onToggle={toggleStat}
            action={
              <div ref={categoryInfoRef} className="relative">
                <button
                  type="button"
                  aria-label="How are category ratings calculated?"
                  className="w-4 h-4 rounded-full border border-gray-400 text-gray-400 text-[9px] font-semibold flex items-center justify-center leading-none hover:bg-white/10"
                  onClick={e => {
                    e.stopPropagation();
                    setShowCategoryInfo(prev => !prev);
                  }}
                >
                  <span className="inline-block translate-x-[0.5px] -translate-y-[0.5px]">?</span>
                </button>
                  {showCategoryInfo && (
                    <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-black/90 border border-white/10 rounded-lg p-4 text-xs text-gray-200 shadow-xl z-20">
                      <p className="text-sm font-semibold text-white">Category Ratings</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Each rating is scaled 1-99 using weighted z-scores from current season data.
                      </p>
                      <ul className="mt-2 space-y-2">
                        {CATEGORY_INFO.map(item => (
                          <li key={item.key}>
                            <p className="font-semibold text-orange-300 text-[11px]">
                              {item.key}: {item.name}
                            </p>
                            <p className="text-[11px] text-gray-300 leading-snug">{item.description}</p>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            }
          />
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

      <div className="relative border border-white/10 shadow-inner overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-scrollbar">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead
              className="sticky top-0 z-10 bg-orange-600 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            >
              <tr className="text-gray-200 text-xs uppercase tracking-wide">
                <th className="py-1.5 px-2 text-center align-middle">Rank</th>
                <th className="py-1.5 px-2 text-center align-middle">Player</th>
                {orderedVisibleStats.map(stat => (
                  <th
                    key={stat}
                    className="py-1.5 px-2 text-center align-middle cursor-pointer whitespace-nowrap"
                    onClick={() => handleHeaderSort(stat)}
                  >
                    {STAT_DEFINITIONS[stat].label}
                    {sortKey === stat && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
                  </th>
                ))}
                <th className="py-1.5 px-2 text-center align-middle cursor-pointer" onClick={() => handleHeaderSort('overall')}>
                  Overall
                  {sortKey === 'overall' && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {visiblePlayers.map((player, index) => (
                <tr key={`${player.id}-${index}`} className="hover:bg-white/5">
                  <td className="py-3 px-2 text-center text-gray-300 font-semibold">#{index + 1}</td>
                  <td className="py-3 px-2 text-center">
                    <div className="font-bold">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      {player.teamName} • {player.originalPosition}
                    </div>
                  </td>
                  {orderedVisibleStats.map(stat => {
                    const def = STAT_DEFINITIONS[stat];
                    const value = def.accessor(player);
                    const text = def.display ? def.display(player, value) : formatStat(value, def);
                    const colorKey = getColorKey(stat);
                    const colorValue = STAT_DEFINITIONS[colorKey].accessor(player);
                    const invertColorScale = NEGATIVE_STATS.has(colorKey);
                    return (
                      <td key={stat} className="py-2 px-2 text-center">
                        <span className={`inline-flex w-full justify-center px-3 py-2 rounded-md text-sm font-semibold ${getStatClasses(colorValue, statBounds[colorKey], invertColorScale)}`}>
                          {text}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center">
                    {(() => {
                      const borderClass = getRatingBorderGlowClass(player.ratings?.overall);
                      const textClass = getRatingTextClass(player.ratings?.overall);
                      const isActive = activeRatingId === player.id;
                      return (
                        <span
                          className={`inline-flex items-center justify-center min-w-[72px] px-3 py-2 rounded-md text-xl font-black bg-transparent transition-all duration-300 ${borderClass} ${
                            isActive ? 'scale-110' : 'scale-100'
                          }`}
                          onMouseEnter={event => handleRatingEnter(player.id, event.currentTarget)}
                          onMouseLeave={handleRatingLeave}
                        >
                          <span className={textClass}>{formatNumber(player.ratings?.overall, 0, '—')}</span>
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {portalTarget && activePopoverPlayer && popoverPosition &&
        createPortal(
          <div
            className="fixed z-50 w-60 max-w-[calc(100vw-2rem)] bg-black/80 border border-white/10 rounded-xl p-4 text-xs text-white shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-md pointer-events-none"
            style={{ left: popoverPosition.left, top: popoverPosition.top - 12, transform: 'translate(-50%, -100%)' }}
          >
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius={'72%'}
                  data={ratingKeys.map(key => ({
                    s: String(key).toUpperCase(),
                    A: activePopoverPlayer.ratings?.perCategory?.[key] ?? 0,
                  }))}
                >
                  <PolarGrid stroke="rgba(255,255,255,0.2)" />
                  <PolarAngleAxis dataKey="s" tick={{ fill: '#d1d5db', fontSize: 10 }} />
                  <Radar dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.45} dot={false} activeDot={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {ratingKeys.map(key => (
                <span key={key} className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  {String(key).toUpperCase()}: {formatNumber(activePopoverPlayer.ratings?.perCategory?.[key], 0, '—')}
                </span>
              ))}
            </div>
            <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-2 w-3.5 h-3.5 bg-black/80 border-l border-t border-white/10 rotate-45" />
          </div>,
          portalTarget
        )}

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
    <select value={value} onChange={e => onChange(e.target.value)} className={`${FILTER_SELECT_CLASS} pr-8`}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={FILTER_OPTION_STYLE}>
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
  action?: React.ReactNode;
}> = ({ title, stats, visibleStats, onToggle, action }) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
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

const getStatClasses = (value: number | null | undefined, bounds: { min: number; max: number }, invert = false) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'bg-white/5 text-gray-300';
  const { min, max } = bounds;
  if (max === min) return 'bg-white/10 text-white';
  let percentile = (value - min) / (max - min || 1);
  percentile = Math.max(0, Math.min(1, invert ? 1 - percentile : percentile));
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

const formatOriginalPositionLabel = (value?: string | null) => {
  const normalized = (value || '').trim().toUpperCase();
  return normalized || '—';
};

export default PlayerRankingsView;
