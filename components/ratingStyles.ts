export const getRatingBorderGlowClass = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'border border-gray-600';
  }
  if (value >= 96) {
    return 'border-2 border-orange-300/90 shadow-[0_0_16px_rgba(249,115,22,0.6)]';
  }
  if (value >= 90) {
    return 'border border-orange-400/80 shadow-[0_0_8px_rgba(249,115,22,0.35)]';
  }
  if (value >= 80) {
    return 'border border-amber-400/70';
  }
  return 'border border-gray-500';
};

export const getRatingTextClass = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'text-gray-300';
  }
  if (value >= 96) {
    return 'rating-highlight text-white';
  }
  if (value >= 90) {
    return 'text-orange-400';
  }
  if (value >= 80) {
    return 'text-amber-400';
  }
  return 'text-gray-300';
};
