// =====================================================
// EUROSTAT API SERVICE
// =====================================================

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

export const EU_COUNTRIES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', EL: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden'
};

// Income Tax Data (2024)
export const TAX_DATA = {
  AT: { min: 0, max: 55, type: 'Progressive', brackets: 7 },
  BE: { min: 25, max: 50, type: 'Progressive', brackets: 4 },
  BG: { min: 10, max: 10, type: 'Flat', brackets: 1 },
  HR: { min: 20, max: 30, type: 'Progressive', brackets: 2 },
  CY: { min: 0, max: 35, type: 'Progressive', brackets: 5 },
  CZ: { min: 15, max: 23, type: 'Progressive', brackets: 2 },
  DK: { min: 0, max: 52, type: 'Progressive', brackets: 3 },
  EE: { min: 20, max: 20, type: 'Flat', brackets: 1, note: 'Tax-free €7,848/yr' },
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

async function fetchEurostatData(dataset, params) {
  const geoFilter = Object.keys(EU_COUNTRIES).join('+');
  const queryParams = new URLSearchParams({
    format: 'JSON',
    lang: 'EN',
    geo: geoFilter,
    ...params
  });
  
  const url = `${EUROSTAT_BASE}/${dataset}?${queryParams}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Eurostat API error: ${response.status}`);
    return response.json();
  } catch (error) {
    console.error(`Error fetching ${dataset}:`, error);
    return null;
  }
}

function parseEurostatResponse(data) {
  if (!data?.value) return {};
  
  const { dimension, value, id } = data;
  const results = {};
  
  const geoIndex = dimension.geo.category.index;
  const timeIndex = dimension.time?.category?.index || {};
  const geoKeys = Object.keys(geoIndex);
  const timeKeys = Object.keys(timeIndex);
  const sizes = id.map(dimId => Object.keys(dimension[dimId].category.index).length);
  
  Object.entries(value).forEach(([flatIndex, val]) => {
    const idx = parseInt(flatIndex);
    let remaining = idx;
    const indices = [];
    
    for (let i = sizes.length - 1; i >= 0; i--) {
      indices.unshift(remaining % sizes[i]);
      remaining = Math.floor(remaining / sizes[i]);
    }
    
    const geoIdx = id.indexOf('geo');
    const timeIdx = id.indexOf('time');
    const geo = geoKeys[indices[geoIdx]];
    const time = timeKeys[indices[timeIdx]] || 'latest';
    
    if (!results[geo]) results[geo] = {};
    results[geo][time] = val;
  });
  
  return results;
}

export async function fetchUnemploymentRate() {
  const data = await fetchEurostatData('une_rt_m', {
    s_adj: 'SA',
    age: 'Y15-74',
    sex: 'T',
    unit: 'PC_ACT'
  });
  return parseEurostatResponse(data);
}

export async function fetchEmploymentCount() {
  const data = await fetchEurostatData('lfsi_emp_a', {
    indic_em: 'EMP_LFS',
    sex: 'T',
    age: 'Y15-64',
    unit: 'THS_PER'
  });
  return parseEurostatResponse(data);
}

export async function fetchAverageSalary() {
  const data = await fetchEurostatData('earn_ses_pub2s', {
    indic_se: 'MEAN_E_EUR',
    nace_r2: 'B-S_X_O',
    worktime: 'TOTAL'
  });
  return parseEurostatResponse(data);
}

export async function fetchMedianSalary() {
  const data = await fetchEurostatData('earn_ses_pub2s', {
    indic_se: 'MED_E_EUR',
    nace_r2: 'B-S_X_O',
    worktime: 'TOTAL'
  });
  return parseEurostatResponse(data);
}

export async function fetchAllEUStats() {
  console.log('Fetching EU statistics from Eurostat...');
  
  const [unemployment, employment, avgSalary, medSalary] = await Promise.all([
    fetchUnemploymentRate(),
    fetchEmploymentCount(),
    fetchAverageSalary(),
    fetchMedianSalary()
  ]);
  
  return { unemployment, employment, avgSalary, medSalary };
}

export function getLatestValue(countryData) {
  if (!countryData) return null;
  const periods = Object.keys(countryData).sort().reverse();
  return periods.length > 0 ? { value: countryData[periods[0]], period: periods[0] } : null;
}
