// =====================================================
// EUROSTAT CONSTANTS & HELPERS
// =====================================================

export const EU_COUNTRIES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', EL: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden'
};

export const TAX_DATA = {
  AT: { min: 0, max: 55, type: 'Progressive', brackets: 7 },
  BE: { min: 25, max: 50, type: 'Progressive', brackets: 4 },
  BG: { min: 10, max: 10, type: 'Flat', brackets: 1 },
  HR: { min: 20, max: 30, type: 'Progressive', brackets: 2 },
  CY: { min: 0, max: 35, type: 'Progressive', brackets: 5 },
  CZ: { min: 15, max: 23, type: 'Progressive', brackets: 2 },
  DK: { min: 0, max: 52, type: 'Progressive', brackets: 3 },
  EE: { min: 22, max: 22, type: 'Flat', brackets: 1, note: 'Tax-free €8400/yr' },
  FI: { min: 12.64, max: 44, type: 'Progressive', brackets: 5 },
  FR: { min: 0, max: 45, type: 'Progressive', brackets: 5 },
  DE: { min: 0, max: 45, type: 'Progressive', brackets: 4 },
  EL: { min: 9, max: 44, type: 'Progressive', brackets: 5 },
  HU: { min: 15, max: 15, type: 'Flat', brackets: 1 },
  IE: { min: 20, max: 40, type: 'Progressive', brackets: 2 },
  IT: { min: 23, max: 43, type: 'Progressive', brackets: 3 },
  LV: { min: 20, max: 31, type: 'Progressive', brackets: 3 },
  LT: { min: 20, max: 32, type: 'Progressive', brackets: 2 },
  LU: { min: 0, max: 42, type: 'Progressive', brackets: 23 },
  MT: { min: 0, max: 35, type: 'Progressive', brackets: 4 },
  NL: { min: 36.97, max: 49.5, type: 'Progressive', brackets: 2 },
  PL: { min: 0, max: 32, type: 'Progressive', brackets: 3 },
  PT: { min: 13.25, max: 48, type: 'Progressive', brackets: 9 },
  RO: { min: 10, max: 10, type: 'Flat', brackets: 1 },
  SK: { min: 19, max: 25, type: 'Progressive', brackets: 2 },
  SI: { min: 16, max: 50, type: 'Progressive', brackets: 5 },
  ES: { min: 19, max: 47, type: 'Progressive', brackets: 6 },
  SE: { min: 32, max: 52, type: 'Progressive', brackets: 2 }
};

export function getLatestValue(countryData) {
  if (!countryData) return null;
  const periods = Object.keys(countryData).sort().reverse();
  return periods.length > 0 ? { value: countryData[periods[0]], period: periods[0] } : null;
}

export async function fetchAllEUStats() {
  try {
    const response = await fetch('/api/eurostat');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Failed to fetch EU stats:', error);
    throw error;
  }
}
