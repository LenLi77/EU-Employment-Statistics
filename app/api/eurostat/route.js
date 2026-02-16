import { NextResponse } from 'next/server';

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

const EU_COUNTRIES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', EL: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden'
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
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });
    
    if (!response.ok) {
      console.error(`Eurostat error ${response.status} for ${dataset}`);
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error(`Fetch error for ${dataset}:`, error);
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
    console.error('Parse error:', e);
  }
  
  return results;
}

export async function GET() {
  console.log('API Route: Fetching Eurostat data...');
  
  try {
    // Fetch all datasets in parallel
    const [unemploymentRaw, employmentRaw, salaryRaw] = await Promise.all([
      // Unemployment rate (monthly, seasonally adjusted)
      fetchEurostatData('une_rt_m', {
        s_adj: 'SA',
        age: 'Y15-74',
        sex: 'T',
        unit: 'PC_ACT'
      }),
      // Employment (annual, thousands)
      fetchEurostatData('lfsi_emp_a', {
        indic_em: 'EMP_LFS',
        sex: 'T',
        age: 'Y15-64',
        unit: 'THS_PER'
      }),
      // Mean annual earnings
      fetchEurostatData('earn_nt_net', {
        estruct: 'SINGLE',
        currency: 'EUR'
      })
    ]);
    
    const unemployment = parseEurostatResponse(unemploymentRaw);
    const employment = parseEurostatResponse(employmentRaw);
    let avgSalary = parseEurostatResponse(salaryRaw);
    
    // If salary data is empty, try alternative dataset
    if (Object.keys(avgSalary).length === 0) {
      console.log('Trying alternative salary dataset...');
      const altSalaryRaw = await fetchEurostatData('ilc_di04', {
        indic_il: 'MED_E',
        unit: 'EUR'
      });
      avgSalary = parseEurostatResponse(altSalaryRaw);
    }
    
    // Try median income dataset
    const medianRaw = await fetchEurostatData('ilc_di03', {
      indic_il: 'MED_E',
      unit: 'EUR'
    });
    const medSalary = parseEurostatResponse(medianRaw);
    
    console.log('Unemployment countries:', Object.keys(unemployment).length);
    console.log('Employment countries:', Object.keys(employment).length);
    console.log('Salary countries:', Object.keys(avgSalary).length);
    
    return NextResponse.json({
      unemployment,
      employment,
      avgSalary,
      medSalary,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API Route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Eurostat data' },
      { status: 500 }
    );
  }
}
