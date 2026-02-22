import { NextResponse } from 'next/server';

// =====================================================
// MANUAL OVERRIDES FOR BALTIC COUNTRIES
// Update these quarterly from national statistics:
// - Estonia: https://stat.ee/en/find-statistics/statistics-theme/work-life/wages-and-labour-costs
// - Latvia: https://stat.gov.lv/en/statistics-themes/labour-market/wages
// - Lithuania: https://osp.stat.gov.lt/en/statistical-data-on-wages
// =====================================================
const BALTIC_OVERRIDES = {
  EE: {
    avgSalary: 23280,      // Update from stat.ee - Q3 2024: €1940/month * 12
    medSalary: 18720,      // Update from stat.ee
    source: 'Statistics Estonia',
    period: '2024-Q3',
    lastUpdated: '2025-01-15'
  },
  LV: {
    avgSalary: 19560,      // Update from csb.gov.lv - Q3 2024: €1630/month * 12
    medSalary: 14880,      // Update from csb.gov.lv
    source: 'Central Statistical Bureau of Latvia',
    period: '2024-Q3',
    lastUpdated: '2025-01-15'
  },
  LT: {
    avgSalary: 24000,      // Update from stat.gov.lt - Q3 2024: €2000/month * 12
    medSalary: 18000,      // Update from stat.gov.lt
    source: 'Statistics Lithuania',
    period: '2024-Q3',
    lastUpdated: '2025-01-15'
  }
};

// =====================================================
// MINIMUM WAGES (2025) - Monthly gross in EUR
// Source: Eurostat + national sources
// Updated: January 2025
// Note: Some countries have no statutory minimum wage
// =====================================================
const MINIMUM_WAGES = {
  AT: { monthly: null, annual: null, note: 'Collective ~€1,850/mo', effective: 1850 },
  BE: { monthly: 1994, annual: 23928 },
  BG: { monthly: 477, annual: 5724 },
  HR: { monthly: 840, annual: 10080 },
  CY: { monthly: 1000, annual: 12000, note: 'Since 2023' },
  CZ: { monthly: 700, annual: 8400 },
  DK: { monthly: null, annual: null, note: 'Collective ~€3,000/mo', effective: 3000 },
  EE: { monthly: 886, annual: 10632 },
  FI: { monthly: null, annual: null, note: 'Collective ~€1,800/mo', effective: 1800 },
  FR: { monthly: 1802, annual: 21624 },
  DE: { monthly: 2054, annual: 24648, note: '€12.82/hr' },
  EL: { monthly: 910, annual: 10920 },
  HU: { monthly: 675, annual: 8100 },
  IE: { monthly: 2146, annual: 25752, note: '€13.50/hr' },
  IT: { monthly: null, annual: null, note: 'Collective ~€1,200/mo', effective: 1200 },
  LV: { monthly: 700, annual: 8400 },
  LT: { monthly: 924, annual: 11088 },
  LU: { monthly: 2571, annual: 30852, note: 'Highest in EU' },
  MT: { monthly: 835, annual: 10020 },
  NL: { monthly: 2070, annual: 24840, note: '€13.68/hr' },
  PL: { monthly: 1012, annual: 12144 },
  PT: { monthly: 956, annual: 11472 },
  RO: { monthly: 606, annual: 7272 },
  SK: { monthly: 816, annual: 9792 },
  SI: { monthly: 1253, annual: 15036 },
  ES: { monthly: 1323, annual: 15876 },
  SE: { monthly: null, annual: null, note: 'Collective ~€2,200/mo', effective: 2200 }
};

// =====================================================
// EU COUNTRY CODES (OECD uses ISO 3166-1 alpha-3)
// =====================================================
const EU_COUNTRY_MAPPING = {
  // OECD code -> Eurostat code
  AUT: 'AT', BEL: 'BE', BGR: 'BG', HRV: 'HR', CYP: 'CY',
  CZE: 'CZ', DNK: 'DK', EST: 'EE', FIN: 'FI', FRA: 'FR',
  DEU: 'DE', GRC: 'EL', HUN: 'HU', IRL: 'IE', ITA: 'IT',
  LVA: 'LV', LTU: 'LT', LUX: 'LU', MLT: 'MT', NLD: 'NL',
  POL: 'PL', PRT: 'PT', ROU: 'RO', SVK: 'SK', SVN: 'SI',
  ESP: 'ES', SWE: 'SE'
};

const EUROSTAT_TO_OECD = Object.fromEntries(
  Object.entries(EU_COUNTRY_MAPPING).map(([oecd, eu]) => [eu, oecd])
);

// Countries in OECD (not all EU members are OECD members)
const OECD_EU_MEMBERS = [
  'AUT', 'BEL', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 
  'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'NLD', 
  'POL', 'PRT', 'SVK', 'SVN', 'ESP', 'SWE'
];

// Non-OECD EU members need fallback data
const NON_OECD_EU = {
  BG: { avgSalary: 14400, medSalary: 10800, year: '2023' },   // Bulgaria
  HR: { avgSalary: 19200, medSalary: 15600, year: '2023' },   // Croatia
  CY: { avgSalary: 28800, medSalary: 22800, year: '2023' },   // Cyprus
  MT: { avgSalary: 27600, medSalary: 22200, year: '2023' },   // Malta
  RO: { avgSalary: 17400, medSalary: 12600, year: '2023' }    // Romania
};

// =====================================================
// OECD API FUNCTIONS
// =====================================================

async function fetchOECDWages() {
  // OECD Average Annual Wages dataset
  // Documentation: https://data-explorer.oecd.org/
  const oecdCountries = OECD_EU_MEMBERS.join('+');
  
  // Fetch in EUR, current prices
  const url = `https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/${oecdCountries}..EUR..?format=jsondata&startPeriod=2020&dimensionAtObservation=AllDimensions`;
  
  console.log('Fetching OECD wages:', url);
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 } // Cache 24 hours
    });
    
    if (!response.ok) {
      console.error('OECD API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return parseOECDResponse(data);
  } catch (error) {
    console.error('OECD fetch error:', error);
    return null;
  }
}

function parseOECDResponse(data) {
  const results = {};
  
  try {
    if (!data?.data?.dataSets?.[0]?.observations) {
      console.log('No OECD observations found');
      return results;
    }
    
    const structure = data.data.structure;
    const observations = data.data.dataSets[0].observations;
    
    // Find dimension positions
    const dimensions = structure.dimensions.observation;
    const refAreaDim = dimensions.find(d => d.id === 'REF_AREA');
    const timeDim = dimensions.find(d => d.id === 'TIME_PERIOD');
    
    if (!refAreaDim || !timeDim) {
      console.log('Missing required dimensions');
      return results;
    }
    
    const refAreaIdx = dimensions.indexOf(refAreaDim);
    const timeIdx = dimensions.indexOf(timeDim);
    
    // Parse observations
    Object.entries(observations).forEach(([key, values]) => {
      const indices = key.split(':').map(Number);
      const countryCode = refAreaDim.values[indices[refAreaIdx]]?.id;
      const year = timeDim.values[indices[timeIdx]]?.id;
      const value = values[0];
      
      if (countryCode && year && value) {
        const euCode = EU_COUNTRY_MAPPING[countryCode];
        if (euCode) {
          if (!results[euCode]) results[euCode] = {};
          results[euCode][year] = Math.round(value);
        }
      }
    });
    
    console.log('Parsed OECD data for', Object.keys(results).length, 'countries');
  } catch (e) {
    console.error('OECD parse error:', e);
  }
  
  return results;
}

// =====================================================
// EUROSTAT API FUNCTIONS (Unemployment & Employment)
// =====================================================

async function fetchEurostatUnemployment() {
  const countries = Object.values(EU_COUNTRY_MAPPING).join('+');
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?format=JSON&geo=${countries}&s_adj=SA&age=Y15-74&sex=T&unit=PC_ACT&sinceTimePeriod=2020-01`;
  
  console.log('Fetching Eurostat unemployment...');
  
  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 }
    });
    
    if (!response.ok) {
      console.error('Eurostat unemployment error:', response.status);
      return null;
    }
    
    return parseEurostatResponse(await response.json());
  } catch (error) {
    console.error('Eurostat unemployment fetch error:', error);
    return null;
  }
}

async function fetchEurostatEmployment() {
  const countries = Object.values(EU_COUNTRY_MAPPING).join('+');
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/lfsi_emp_a?format=JSON&geo=${countries}&indic_em=EMP_LFS&sex=T&age=Y15-64&unit=THS_PER&sinceTimePeriod=2020`;
  
  console.log('Fetching Eurostat employment...');
  
  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 }
    });
    
    if (!response.ok) {
      console.error('Eurostat employment error:', response.status);
      return null;
    }
    
    return parseEurostatResponse(await response.json());
  } catch (error) {
    console.error('Eurostat employment fetch error:', error);
    return null;
  }
}

function parseEurostatResponse(data) {
  if (!data?.value) return {};
  
  const { dimension, value, id } = data;
  const results = {};
  
  try {
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
  } catch (e) {
    console.error('Eurostat parse error:', e);
  }
  
  return results;
}

// =====================================================
// FALLBACK DATA (if APIs fail)
// =====================================================

const FALLBACK_DATA = {
  unemployment: {
    AT: { '2025-11': 5.3 }, BE: { '2025-11': 5.7 }, BG: { '2025-11': 4.2 },
    HR: { '2025-11': 6.1 }, CY: { '2025-11': 5.8 }, CZ: { '2025-11': 2.8 },
    DK: { '2025-11': 5.2 }, EE: { '2025-11': 6.8 }, FI: { '2025-11': 8.3 },
    FR: { '2025-11': 7.3 }, DE: { '2025-11': 3.4 }, EL: { '2025-11': 9.6 },
    HU: { '2025-11': 4.5 }, IE: { '2025-11': 4.1 }, IT: { '2025-11': 5.8 },
    LV: { '2025-11': 6.5 }, LT: { '2025-11': 6.9 }, LU: { '2025-11': 5.9 },
    MT: { '2025-11': 3.0 }, NL: { '2025-11': 3.7 }, PL: { '2025-11': 2.9 },
    PT: { '2025-11': 6.5 }, RO: { '2025-11': 5.4 }, SK: { '2025-11': 5.6 },
    SI: { '2025-11': 3.6 }, ES: { '2025-11': 11.2 }, SE: { '2025-11': 8.5 }
  },
  employment: {
    AT: { '2024': 4480 }, BE: { '2024': 5020 }, BG: { '2024': 3150 },
    HR: { '2024': 1720 }, CY: { '2024': 465 }, CZ: { '2024': 5320 },
    DK: { '2024': 3020 }, EE: { '2024': 705 }, FI: { '2024': 2680 },
    FR: { '2024': 28600 }, DE: { '2024': 45200 }, EL: { '2024': 4280 },
    HU: { '2024': 4720 }, IE: { '2024': 2650 }, IT: { '2024': 23800 },
    LV: { '2024': 920 }, LT: { '2024': 1450 }, LU: { '2024': 328 },
    MT: { '2024': 295 }, NL: { '2024': 9450 }, PL: { '2024': 17200 },
    PT: { '2024': 5080 }, RO: { '2024': 8350 }, SK: { '2024': 2620 },
    SI: { '2024': 1020 }, ES: { '2024': 21400 }, SE: { '2024': 5280 }
  },
  avgSalary: {
    AT: { '2023': 53520 }, BE: { '2023': 54150 }, BG: { '2023': 14400 },
    HR: { '2023': 19200 }, CY: { '2023': 28800 }, CZ: { '2023': 21600 },
    DK: { '2023': 62640 }, EE: { '2023': 23280 }, FI: { '2023': 48960 },
    FR: { '2023': 45120 }, DE: { '2023': 53760 }, EL: { '2023': 20640 },
    HU: { '2023': 18000 }, IE: { '2023': 55200 }, IT: { '2023': 37440 },
    LV: { '2023': 19560 }, LT: { '2023': 24000 }, LU: { '2023': 72480 },
    MT: { '2023': 27600 }, NL: { '2023': 58080 }, PL: { '2023': 18720 },
    PT: { '2023': 23520 }, RO: { '2023': 17400 }, SK: { '2023': 18480 },
    SI: { '2023': 28080 }, ES: { '2023': 31200 }, SE: { '2023': 51600 }
  }
};

// =====================================================
// MAIN API HANDLER
// =====================================================

export async function GET() {
  console.log('=== EU Employment Stats API ===');
  
  // Fetch data from multiple sources in parallel
  const [oecdWages, eurostatUnemployment, eurostatEmployment] = await Promise.all([
    fetchOECDWages(),
    fetchEurostatUnemployment(),
    fetchEurostatEmployment()
  ]);
  
  // Use fetched data or fallback
  const unemployment = eurostatUnemployment && Object.keys(eurostatUnemployment).length > 0
    ? eurostatUnemployment
    : FALLBACK_DATA.unemployment;
    
  const employment = eurostatEmployment && Object.keys(eurostatEmployment).length > 0
    ? eurostatEmployment
    : FALLBACK_DATA.employment;
    
  let avgSalary = oecdWages && Object.keys(oecdWages).length > 0
    ? oecdWages
    : FALLBACK_DATA.avgSalary;
  
  // Add non-OECD EU countries
  Object.entries(NON_OECD_EU).forEach(([code, data]) => {
    if (!avgSalary[code]) {
      avgSalary[code] = { [data.year]: data.avgSalary };
    }
  });
  
  // Apply Baltic overrides
  const salarySource = {};
  Object.keys(avgSalary).forEach(code => {
    salarySource[code] = 'OECD';
  });
  
  Object.entries(BALTIC_OVERRIDES).forEach(([code, data]) => {
    avgSalary[code] = { 
      ...avgSalary[code],
      [data.period]: data.avgSalary 
    };
    salarySource[code] = data.source;
  });
  
  // Create median salary estimates
  const medSalary = {};
  Object.entries(avgSalary).forEach(([code, years]) => {
    medSalary[code] = {};
    Object.entries(years).forEach(([year, value]) => {
      if (BALTIC_OVERRIDES[code]) {
        medSalary[code][year] = BALTIC_OVERRIDES[code].medSalary;
      } else {
        medSalary[code][year] = Math.round(value * 0.82);
      }
    });
  });
  
  // Build response
  const response = {
    unemployment,
    employment,
    avgSalary,
    medSalary,
    minimumWage: MINIMUM_WAGES,
    salarySource,
    metadata: {
      fetchedAt: new Date().toISOString(),
      sources: {
        salary: 'OECD Average Annual Wages + Baltic national statistics',
        unemployment: 'Eurostat (une_rt_m)',
        employment: 'Eurostat (lfsi_emp_a)',
        minimumWage: 'Eurostat + national sources (January 2025)'
      },
      balticOverrides: Object.fromEntries(
        Object.entries(BALTIC_OVERRIDES).map(([code, data]) => [
          code, 
          { source: data.source, period: data.period, lastUpdated: data.lastUpdated }
        ])
      ),
      dataQuality: {
        oecdData: oecdWages ? 'live' : 'fallback',
        unemploymentData: eurostatUnemployment ? 'live' : 'fallback',
        employmentData: eurostatEmployment ? 'live' : 'fallback'
      }
    }
  };
  
  console.log('Data quality:', response.metadata.dataQuality);
  
  return NextResponse.json(response);
}
