'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { 
  EU_COUNTRIES, 
  TAX_DATA, 
  fetchAllEUStats, 
  getLatestValue 
} from '../lib/eurostat';

// =====================================================
// CONSTANTS
// =====================================================
const CACHE_KEY = 'eu_employment_stats_v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// =====================================================
// HELPERS
// =====================================================
function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('en-EU');
}

function formatCurrency(num) {
  if (num === null || num === undefined) return 'N/A';
  return `€${Math.round(num).toLocaleString('en-EU')}`;
}

function formatPercent(num) {
  if (num === null || num === undefined) return 'N/A';
  return `${num.toFixed(1)}%`;
}

function getFlagEmoji(countryCode) {
  const code = countryCode === 'EL' ? 'GR' : countryCode;
  const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

// =====================================================
// CUSTOM HOOK FOR CACHED DATA
// =====================================================
function useCachedEUStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setData(cachedData);
            setLastUpdated(new Date(timestamp));
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Cache read failed:', e);
      }
    }

    // Fetch fresh data
    try {
      const freshData = await fetchAllEUStats();
      
      // Save to cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: freshData,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Cache write failed:', e);
      }
      
      setData(freshData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      
      // Try to use expired cache as fallback
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          setData(cachedData);
          setLastUpdated(new Date(timestamp));
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refresh = () => loadData(true);

  return { data, loading, error, lastUpdated, refresh };
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function EUEmploymentStats() {
  const { data, loading, error, lastUpdated, refresh } = useCachedEUStats();
  const [sortField, setSortField] = useState('averageSalary');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [chartMetric, setChartMetric] = useState('unemploymentRate');

  // Process API data into table format
  const tableData = useMemo(() => {
    if (!data) return [];

    return Object.entries(EU_COUNTRIES).map(([code, name]) => {
      const unemp = getLatestValue(data.unemployment?.[code]);
      const emp = getLatestValue(data.employment?.[code]);
      const avg = getLatestValue(data.avgSalary?.[code]);
      const med = getLatestValue(data.medSalary?.[code]);
      const tax = TAX_DATA[code];

      return {
        code,
        name,
        averageSalary: avg?.value ? Math.round(avg.value) : null,
        averageSalaryYear: avg?.period,
        medianSalary: med?.value ? Math.round(med.value) : null,
        medianSalaryYear: med?.period,
        unemploymentRate: unemp?.value,
        unemploymentPeriod: unemp?.period,
        employmentCount: emp?.value ? Math.round(emp.value * 1000) : null,
        employmentYear: emp?.period,
        taxMin: tax?.min,
        taxMax: tax?.max,
        taxType: tax?.type,
        taxBrackets: tax?.brackets,
        taxNote: tax?.note,
        history: {
          unemployment: data.unemployment?.[code] || {},
          employment: data.employment?.[code] || {}
        }
      };
    });
  }, [data]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...tableData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [tableData, sortField, sortDir]);

  // Chart data
  const chartData = useMemo(() => {
    if (selectedCountry) {
      const country = tableData.find(c => c.code === selectedCountry);
      if (!country) return [];

      const historyKey = chartMetric === 'unemploymentRate' ? 'unemployment' : 'employment';
      const historyData = country.history[historyKey];

      return Object.entries(historyData)
        .map(([period, value]) => ({ period, value }))
        .sort((a, b) => a.period.localeCompare(b.period))
        .slice(-24); // Last 24 periods
    }

    // Comparison chart for all countries
    return sortedData
      .filter(c => c[chartMetric] !== null && c[chartMetric] !== undefined)
      .map(c => ({
        name: c.code,
        fullName: c.name,
        value: c[chartMetric]
      }));
  }, [selectedCountry, chartMetric, tableData, sortedData]);

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Sortable header component
  const SortHeader = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        padding: '12px 16px',
        textAlign: 'left',
        fontSize: '11px',
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        background: sortField === field ? '#f3f4f6' : 'transparent'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {children}
        {sortField === field && (
          <span style={{ color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  // Loading state
  if (loading && !data) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#6b7280' }}>Loading EU employment statistics...</p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>Fetching data from Eurostat</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
              EU Employment Statistics
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Data from Eurostat • {lastUpdated ? `Updated ${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#9ca3af' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ 
              display: 'inline-block',
              animation: loading ? 'spin 1s linear infinite' : 'none'
            }}>↻</span>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Error Banner */}
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            color: '#92400e'
          }}>
            ⚠️ {error} — Showing cached data
          </div>
        )}

        {/* Chart Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                {selectedCountry
                  ? `${EU_COUNTRIES[selectedCountry]} - Historical Trend`
                  : 'EU Countries Comparison'
                }
              </h2>
              {selectedCountry && (
                <button
                  onClick={() => setSelectedCountry(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '4px',
                    padding: 0
                  }}
                >
                  ← Back to all countries
                </button>
              )}
            </div>
            <select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="unemploymentRate">Unemployment Rate</option>
              <option value="employmentCount">Employment Count</option>
              <option value="averageSalary">Average Salary</option>
              <option value="medianSalary">Median Salary</option>
            </select>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            {selectedCountry ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    chartMetric.includes('Salary') ? formatCurrency(value) :
                    chartMetric === 'unemploymentRate' ? formatPercent(value) :
                    formatNumber(value)
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  formatter={(value, name, props) => [
                    chartMetric.includes('Salary') ? formatCurrency(value) :
                    chartMetric === 'unemploymentRate' ? formatPercent(value) :
                    formatNumber(value),
                    props.payload.fullName
                  ]}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Data Table */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              All EU Countries
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Click on a country to see historical trends
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <SortHeader field="name">Country</SortHeader>
                  <SortHeader field="averageSalary">Avg Salary (Annual)</SortHeader>
                  <SortHeader field="medianSalary">Median Salary</SortHeader>
                  <SortHeader field="taxMax">Income Tax</SortHeader>
                  <SortHeader field="employmentCount">Employed</SortHeader>
                  <SortHeader field="unemploymentRate">Unemployment</SortHeader>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((country, index) => (
                  <tr
                    key={country.code}
                    onClick={() => setSelectedCountry(country.code)}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: index % 2 === 0 ? 'white' : '#f9fafb'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f9fafb'}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{getFlagEmoji(country.code)}</span>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827' }}>{country.name}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{country.code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{formatCurrency(country.averageSalary)}</div>
                      {country.averageSalaryYear && (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{country.averageSalaryYear}</div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{formatCurrency(country.medianSalary)}</div>
                      {country.medianSalaryYear && (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{country.medianSalaryYear}</div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>
                        {country.taxType === 'Flat'
                          ? `${country.taxMin}%`
                          : `${country.taxMin}% - ${country.taxMax}%`
                        }
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {country.taxType} ({country.taxBrackets} {country.taxBrackets === 1 ? 'rate' : 'brackets'})
                      </div>
                      {country.taxNote && (
                        <div style={{ fontSize: '12px', color: '#6366f1' }}>{country.taxNote}</div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{formatNumber(country.employmentCount)}</div>
                      {country.employmentYear && (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{country.employmentYear}</div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontWeight: 500,
                          color: country.unemploymentRate < 5 ? '#16a34a' :
                                 country.unemploymentRate < 10 ? '#ca8a04' : '#dc2626'
                        }}>
                          {formatPercent(country.unemploymentRate)}
                        </span>
                        <div style={{
                          width: '60px',
                          height: '8px',
                          background: '#e5e7eb',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            borderRadius: '4px',
                            width: `${Math.min((country.unemploymentRate || 0) * 5, 100)}%`,
                            background: country.unemploymentRate < 5 ? '#22c55e' :
                                        country.unemploymentRate < 10 ? '#eab308' : '#ef4444'
                          }} />
                        </div>
                      </div>
                      {country.unemploymentPeriod && (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{country.unemploymentPeriod}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#9ca3af'
        }}>
          <p>Data sources: Eurostat (une_rt_m, lfsi_emp_a, earn_ses_pub2s) • Tax rates from official government sources (2024)</p>
          <p style={{ marginTop: '8px' }}>Salary data from Structure of Earnings Survey (updated every 4 years)</p>
        </div>
      </main>
    </div>
  );
}
