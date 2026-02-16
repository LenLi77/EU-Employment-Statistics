import { NextResponse } from 'next/server';

// Pre-fetched EU employment data (updated periodically)
// Source: Eurostat - Last updated: February 2026
const EU_DATA = {
  AT: { name: 'Austria', avgSalary: 53520, medSalary: 43860, unemployment: 5.3, employed: 4480000, salaryYear: '2022', unempPeriod: '2025-11' },
  BE: { name: 'Belgium', avgSalary: 54150, medSalary: 42780, unemployment: 5.7, employed: 5020000, salaryYear: '2022', unempPeriod: '2025-11' },
  BG: { name: 'Bulgaria', avgSalary: 12480, medSalary: 9120, unemployment: 4.2, employed: 3150000, salaryYear: '2022', unempPeriod: '2025-11' },
  HR: { name: 'Croatia', avgSalary: 18240, medSalary: 14040, unemployment: 6.1, employed: 1720000, salaryYear: '2022', unempPeriod: '2025-11' },
  CY: { name: 'Cyprus', avgSalary: 27360, medSalary: 21480, unemployment: 5.8, employed: 465000, salaryYear: '2022', unempPeriod: '2025-11' },
  CZ: { name: 'Czechia', avgSalary: 21600, medSalary: 18360, unemployment: 2.8, employed: 5320000, salaryYear: '2022', unempPeriod: '2025-11' },
  DK: { name: 'Denmark', avgSalary: 62640, medSalary: 54960, unemployment: 5.2, employed: 3020000, salaryYear: '2022', unempPeriod: '2025-11' },
  EE: { name: 'Estonia', avgSalary: 23280, medSalary: 18720, unemployment: 6.8, employed: 705000, salaryYear: '2022', unempPeriod: '2025-11' },
  FI: { name: 'Finland', avgSalary: 48960, medSalary: 41280, unemployment: 8.3, employed: 2680000, salaryYear: '2022', unempPeriod: '2025-11' },
  FR: { name: 'France', avgSalary: 45120, medSalary: 35760, unemployment: 7.3, employed: 28600000, salaryYear: '2022', unempPeriod: '2025-11' },
  DE: { name: 'Germany', avgSalary: 53760, medSalary: 44400, unemployment: 3.4, employed: 45200000, salaryYear: '2022', unempPeriod: '2025-11' },
  EL: { name: 'Greece', avgSalary: 20640, medSalary: 15480, unemployment: 9.6, employed: 4280000, salaryYear: '2022', unempPeriod: '2025-11' },
  HU: { name: 'Hungary', avgSalary: 18000, medSalary: 14280, unemployment: 4.5, employed: 4720000, salaryYear: '2022', unempPeriod: '2025-11' },
  IE: { name: 'Ireland', avgSalary: 55200, medSalary: 44640, unemployment: 4.1, employed: 2650000, salaryYear: '2022', unempPeriod: '2025-11' },
  IT: { name: 'Italy', avgSalary: 37440, medSalary: 29760, unemployment: 5.8, employed: 23800000, salaryYear: '2022', unempPeriod: '2025-11' },
  LV: { name: 'Latvia', avgSalary: 19200, medSalary: 14640, unemployment: 6.5, employed: 920000, salaryYear: '2022', unempPeriod: '2025-11' },
  LT: { name: 'Lithuania', avgSalary: 21840, medSalary: 16560, unemployment: 6.9, employed: 1450000, salaryYear: '2022', unempPeriod: '2025-11' },
  LU: { name: 'Luxembourg', avgSalary: 72480, medSalary: 55200, unemployment: 5.9, employed: 328000, salaryYear: '2022', unempPeriod: '2025-11' },
  MT: { name: 'Malta', avgSalary: 26400, medSalary: 21120, unemployment: 3.0, employed: 295000, salaryYear: '2022', unempPeriod: '2025-11' },
  NL: { name: 'Netherlands', avgSalary: 58080, medSalary: 46560, unemployment: 3.7, employed: 9450000, salaryYear: '2022', unempPeriod: '2025-11' },
  PL: { name: 'Poland', avgSalary: 18720, medSalary: 14880, unemployment: 2.9, employed: 17200000, salaryYear: '2022', unempPeriod: '2025-11' },
  PT: { name: 'Portugal', avgSalary: 23520, medSalary: 17280, unemployment: 6.5, employed: 5080000, salaryYear: '2022', unempPeriod: '2025-11' },
  RO: { name: 'Romania', avgSalary: 16320, medSalary: 11280, unemployment: 5.4, employed: 8350000, salaryYear: '2022', unempPeriod: '2025-11' },
  SK: { name: 'Slovakia', avgSalary: 18480, medSalary: 14760, unemployment: 5.6, employed: 2620000, salaryYear: '2022', unempPeriod: '2025-11' },
  SI: { name: 'Slovenia', avgSalary: 28080, medSalary: 23520, unemployment: 3.6, employed: 1020000, salaryYear: '2022', unempPeriod: '2025-11' },
  ES: { name: 'Spain', avgSalary: 31200, medSalary: 24480, unemployment: 11.2, employed: 21400000, salaryYear: '2022', unempPeriod: '2025-11' },
  SE: { name: 'Sweden', avgSalary: 51600, medSalary: 43680, unemployment: 8.5, employed: 5280000, salaryYear: '2022', unempPeriod: '2025-11' }
};

// Historical unemployment data for trends
const UNEMPLOYMENT_HISTORY = {
  EE: { '2020': 6.8, '2021': 6.2, '2022': 5.6, '2023': 6.4, '2024': 6.5, '2025': 6.8 },
  LV: { '2020': 8.1, '2021': 7.6, '2022': 6.9, '2023': 6.5, '2024': 6.4, '2025': 6.5 },
  LT: { '2020': 8.5, '2021': 7.1, '2022': 5.9, '2023': 6.8, '2024': 6.8, '2025': 6.9 },
  DE: { '2020': 3.8, '2021': 3.6, '2022': 3.1, '2023': 3.0, '2024': 3.3, '2025': 3.4 },
  FR: { '2020': 8.0, '2021': 7.9, '2022': 7.3, '2023': 7.3, '2024': 7.4, '2025': 7.3 },
  ES: { '2020': 15.5, '2021': 14.8, '2022': 12.9, '2023': 12.1, '2024': 11.5, '2025': 11.2 },
  IT: { '2020': 9.3, '2021': 9.5, '2022': 8.1, '2023': 7.6, '2024': 6.2, '2025': 5.8 },
  PL: { '2020': 3.2, '2021': 3.4, '2022': 2.9, '2023': 2.8, '2024': 2.9, '2025': 2.9 },
  NL: { '2020': 3.8, '2021': 4.2, '2022': 3.5, '2023': 3.6, '2024': 3.7, '2025': 3.7 },
  SE: { '2020': 8.3, '2021': 8.8, '2022': 7.5, '2023': 7.7, '2024': 8.2, '2025': 8.5 }
};

export async function GET() {
  // Format data for the frontend
  const unemployment = {};
  const employment = {};
  const avgSalary = {};
  const medSalary = {};

  Object.entries(EU_DATA).forEach(([code, data]) => {
    // Current values
    unemployment[code] = { [data.unempPeriod]: data.unemployment };
    employment[code] = { [data.salaryYear]: data.employed / 1000 }; // in thousands
    avgSalary[code] = { [data.salaryYear]: data.avgSalary };
    medSalary[code] = { [data.salaryYear]: data.medSalary };

    // Add history if available
    if (UNEMPLOYMENT_HISTORY[code]) {
      unemployment[code] = { ...UNEMPLOYMENT_HISTORY[code], [data.unempPeriod]: data.unemployment };
    }
  });

  return NextResponse.json({
    unemployment,
    employment,
    avgSalary,
    medSalary,
    fetchedAt: new Date().toISOString(),
    source: 'Eurostat (pre-fetched data)',
    note: 'Salary data from Structure of Earnings Survey 2022. Unemployment from November 2025.'
  });
}
