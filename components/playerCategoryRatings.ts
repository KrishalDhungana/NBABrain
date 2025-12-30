import type { Player, PlayerRatingsPerCategory } from '../types';

type CategoryKey = keyof PlayerRatingsPerCategory;

type CategoryConfig = {
  key: CategoryKey;
  label: string;
  abbreviation: string;
  fallbackSkill?: keyof Player['skills'];
  fallbackToRating?: boolean;
};

const CATEGORY_CONFIG: CategoryConfig[] = [
  { key: 'sco', label: 'Scoring', abbreviation: 'SCO', fallbackSkill: 'shooting' },
  { key: 'ply', label: 'Playmaking', abbreviation: 'PLY', fallbackSkill: 'playmaking' },
  { key: 'reb', label: 'Rebounding', abbreviation: 'REB', fallbackSkill: 'rebounding' },
  { key: 'def', label: 'Defense', abbreviation: 'DEF', fallbackSkill: 'defense' },
  { key: 'hst', label: 'Hustle', abbreviation: 'HST', fallbackSkill: 'athleticism' },
  { key: 'imp', label: 'Impact', abbreviation: 'IMP', fallbackToRating: true },
];

const sanitizeRating = (value?: number | null, fallback = 60) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(99, Math.round(value)));
  }
  return fallback;
};

export const getPlayerCategoryRatings = (player: Player) => {
  const perCategory = player.detail?.ratings?.perCategory ?? {};
  return CATEGORY_CONFIG.map(config => {
    const perCategoryValue = perCategory[config.key];
    const fallbackSkillValue = config.fallbackSkill ? player.skills?.[config.fallbackSkill] : undefined;
    const fallback = config.fallbackToRating ? player.rating : fallbackSkillValue;
    return {
      key: config.key,
      label: config.label,
      abbreviation: config.abbreviation,
      value: sanitizeRating(perCategoryValue, sanitizeRating(fallback)),
    };
  });
};

