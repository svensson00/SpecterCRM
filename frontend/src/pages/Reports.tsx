import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { adminAPI } from '../lib/api';
import DateFilter from '../components/DateFilter';

interface PipelineReport {
  stage: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

interface WinRateReport {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  avgDealSize: number;
}

interface CycleTimeReport {
  avgCycleTime: number;
  medianCycleTime: number;
}

interface ActivityVolumeReport {
  type: string;
  count: number;
  completed: number;
  completionRate: number;
}

interface TopAccount {
  organizationId: string;
  organizationName: string;
  totalRevenue: number;
  dealCount: number;
  avgDealSize: number;
}

interface ForecastItem {
  month: string;
  totalValue: number;
  dealCount: number;
  weightedValue: number;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<string | null>(() => {
    return sessionStorage.getItem('reports_startDate') || null;
  });
  const [endDate, setEndDate] = useState<string | null>(() => {
    return sessionStorage.getItem('reports_endDate') || null;
  });

  // Save filter state to sessionStorage
  useEffect(() => {
    if (startDate) {
      sessionStorage.setItem('reports_startDate', startDate);
    } else {
      sessionStorage.removeItem('reports_startDate');
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      sessionStorage.setItem('reports_endDate', endDate);
    } else {
      sessionStorage.removeItem('reports_endDate');
    }
  }, [endDate]);

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const handleDateFilterChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const { data: pipeline, error: pipelineError } = useQuery<PipelineReport[]>({
    queryKey: ['reports', 'pipeline', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/pipeline', { params });
      console.log('Reports - Pipeline response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - pipeline data:', pipeline);
  console.log('Reports - pipeline error:', pipelineError);

  const { data: winRate, error: winRateError } = useQuery<WinRateReport>({
    queryKey: ['reports', 'win-rate', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/win-rate', { params });
      console.log('Reports - Win Rate response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - winRate data:', winRate);
  console.log('Reports - winRate error:', winRateError);

  const { data: cycleTime, error: cycleTimeError } = useQuery<CycleTimeReport>({
    queryKey: ['reports', 'cycle-time', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/cycle-time', { params });
      console.log('Reports - Cycle Time response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - cycleTime data:', cycleTime);
  console.log('Reports - cycleTime error:', cycleTimeError);

  const { data: activityVolume, error: activityVolumeError } = useQuery<ActivityVolumeReport[]>({
    queryKey: ['reports', 'activity-volume', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/activity-volume', { params });
      console.log('Reports - Activity Volume response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - activityVolume data:', activityVolume);
  console.log('Reports - activityVolume error:', activityVolumeError);

  const { data: topAccounts, error: topAccountsError } = useQuery<TopAccount[]>({
    queryKey: ['reports', 'top-accounts', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/top-accounts', { params });
      console.log('Reports - Top Accounts response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - topAccounts data:', topAccounts);
  console.log('Reports - topAccounts error:', topAccountsError);

  const { data: forecast, error: forecastError } = useQuery<ForecastItem[]>({
    queryKey: ['reports', 'forecast', startDate, endDate],
    queryFn: async () => {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/forecast', { params });
      console.log('Reports - Forecast response:', res.data);
      return res.data;
    },
  });

  console.log('Reports - forecast data:', forecast);
  console.log('Reports - forecast error:', forecastError);

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency || 'USD';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
      </div>

      <DateFilter onChange={handleDateFilterChange} storageKey="reports" />

      <div className="space-y-6">
        {(pipelineError || winRateError || cycleTimeError || activityVolumeError || topAccountsError || forecastError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded space-y-2">
            <p className="font-semibold">Errors loading reports:</p>
            {pipelineError && <p>Pipeline: {(pipelineError as any)?.message || 'Unknown error'}</p>}
            {winRateError && <p>Win Rate: {(winRateError as any)?.message || 'Unknown error'}</p>}
            {cycleTimeError && <p>Cycle Time: {(cycleTimeError as any)?.message || 'Unknown error'}</p>}
            {activityVolumeError && <p>Activity Volume: {(activityVolumeError as any)?.message || 'Unknown error'}</p>}
            {topAccountsError && <p>Top Accounts: {(topAccountsError as any)?.message || 'Unknown error'}</p>}
            {forecastError && <p>Forecast: {(forecastError as any)?.message || 'Unknown error'}</p>}
          </div>
        )}

        {/* Win Rate Overview */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Win Rate Overview</h2>
          </div>
          {winRate && (
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Total Deals</p>
                  <p className="text-2xl font-bold text-white">{winRate.totalDeals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Won</p>
                  <p className="text-2xl font-bold text-green-600">{winRate.wonDeals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Lost</p>
                  <p className="text-2xl font-bold text-red-600">{winRate.lostDeals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-white">{formatPercent(winRate.winRate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Avg Deal Size</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(winRate.avgDealSize)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cycle Time */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Sales Cycle Time</h2>
          </div>
          {cycleTime && (
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Average Cycle Time</p>
                  <p className="text-2xl font-bold text-white">{cycleTime.avgCycleTime.toFixed(0)} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Median Cycle Time</p>
                  <p className="text-2xl font-bold text-white">{cycleTime.medianCycleTime.toFixed(0)} days</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pipeline by Stage */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Pipeline by Stage</h2>
          </div>
          {pipeline && pipeline.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Avg Value
                    </th>
                  </tr>
                </thead>
                <tbody className="card divide-y divide-gray-700">
                  {pipeline.map((item) => (
                    <tr key={item.stage} className="hover:bg-dark-900 transition-colors">
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm font-medium text-white">
                        {item.stage}
                      </td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">{item.count}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-white">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">
                        {formatCurrency(item.avgValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-gray-400">No pipeline data available</p>
            </div>
          )}
        </div>

        {/* Activity Volume */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Activity Volume</h2>
          </div>
          {activityVolume && activityVolume.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Completion Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="card divide-y divide-gray-700">
                  {activityVolume.map((item) => (
                    <tr key={item.type} className="hover:bg-dark-900 transition-colors">
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm font-medium text-white">{item.type}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">{item.count}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">{item.completed}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-white">
                        {formatPercent(item.completionRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-gray-400">No activity data available</p>
            </div>
          )}
        </div>

        {/* Top Accounts */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Top Accounts by Revenue</h2>
          </div>
          {topAccounts && topAccounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Deals
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Avg Deal Size
                    </th>
                  </tr>
                </thead>
                <tbody className="card divide-y divide-gray-700">
                  {topAccounts.map((account) => (
                    <tr key={account.organizationId} className="hover:bg-dark-900 transition-colors">
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm font-medium text-white">
                        {account.organizationName}
                      </td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-white">
                        {formatCurrency(account.totalRevenue)}
                      </td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">{account.dealCount}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">
                        {formatCurrency(account.avgDealSize)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-gray-400">No account data available</p>
            </div>
          )}
        </div>

        {/* Forecast */}
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Revenue Forecast (Next 6 Months)</h2>
          </div>
          {forecast && forecast.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Deals
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Pipeline Value
                    </th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Weighted Value
                    </th>
                  </tr>
                </thead>
                <tbody className="card divide-y divide-gray-700">
                  {forecast.map((item) => (
                    <tr key={item.month} className="hover:bg-dark-900 transition-colors">
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm font-medium text-white">{item.month}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-400">{item.dealCount}</td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-white">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-6 py-1.5 whitespace-nowrap text-sm text-green-600 font-medium">
                        {formatCurrency(item.weightedValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-gray-400">No forecast data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
