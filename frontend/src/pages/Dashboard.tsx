import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportAPI, adminAPI, dealAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { DateFilterOption } from '../components/DateFilter';

export default function Dashboard() {
  const navigate = useNavigate();

  // Load filter from localStorage or default to 'this-week'
  const [activityDateFilter, setActivityDateFilter] = useState<DateFilterOption>(() => {
    const saved = localStorage.getItem('dashboard-activity-filter');
    return (saved as DateFilterOption) || 'this-week';
  });

  const [activityStartDate, setActivityStartDate] = useState<string | null>(null);
  const [activityEndDate, setActivityEndDate] = useState<string | null>(null);
  const [datesInitialized, setDatesInitialized] = useState(false);


  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => reportAPI.getPipeline().then(r => r.data)
  });

  // Pipeline date filter for Won/Lost (defaults to 'this-month')
  const [pipelineDateFilter, setPipelineDateFilter] = useState<DateFilterOption>(() => {
    const saved = localStorage.getItem('dashboard-pipeline-filter');
    return (saved as DateFilterOption) || 'this-month';
  });

  const [pipelineStartDate, setPipelineStartDate] = useState<string | null>(null);
  const [pipelineEndDate, setPipelineEndDate] = useState<string | null>(null);

  const { data: activityVolume } = useQuery({
    queryKey: ['activityVolume', activityStartDate, activityEndDate],
    queryFn: async () => {
      const params: any = {};
      if (activityStartDate) params.startDate = activityStartDate;
      if (activityEndDate) params.endDate = activityEndDate;
      const res = await reportAPI.getActivityVolume(params);
      return res.data;
    },
    enabled: datesInitialized, // Only run query after dates are initialized
  });

  const { data: hotDeals } = useQuery({
    queryKey: ['hotDeals'],
    queryFn: async () => {
      // Fetch all deals to properly filter
      const res = await dealAPI.getAll({
        limit: 10000,
      });

      // Filter out WON and LOST deals, and deals without expected close dates
      const filtered = res.data.data
        .filter((deal: any) =>
          deal.expectedCloseDate &&
          deal.stage !== 'WON' &&
          deal.stage !== 'LOST'
        )
        // Sort by expected close date (soonest first)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.expectedCloseDate).getTime();
          const dateB = new Date(b.expectedCloseDate).getTime();
          return dateA - dateB;
        })
        // Take first 5
        .slice(0, 5);

      return filtered;
    },
  });

  const { data: closedDeals } = useQuery({
    queryKey: ['closedDeals', pipelineStartDate, pipelineEndDate],
    queryFn: async () => {
      // Fetch all deals
      const res = await dealAPI.getAll({
        limit: 10000,
      });

      // Filter WON and LOST deals within date range
      const filtered = res.data.data.filter((deal: any) => {
        if (deal.stage !== 'WON' && deal.stage !== 'LOST') return false;
        if (!deal.updatedAt) return false;

        const dealDate = new Date(deal.updatedAt);

        if (pipelineStartDate && dealDate < new Date(pipelineStartDate)) return false;
        if (pipelineEndDate && dealDate > new Date(pipelineEndDate)) return false;

        return true;
      });

      // Calculate stats
      const wonDeals = filtered.filter((d: any) => d.stage === 'WON');
      const lostDeals = filtered.filter((d: any) => d.stage === 'LOST');

      const wonValue = wonDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      const lostValue = lostDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

      return {
        won: {
          count: wonDeals.length,
          value: wonValue,
        },
        lost: {
          count: lostDeals.length,
          value: lostValue,
        },
        total: {
          count: filtered.length,
          value: wonValue + lostValue,
        },
      };
    },
  });

  // Set date filter on component mount based on saved or default filter
  useEffect(() => {
    const { start, end } = getDateRange(activityDateFilter);
    setActivityStartDate(start);
    setActivityEndDate(end);
    setDatesInitialized(true);
  }, []);

  // Initialize pipeline date filter
  useEffect(() => {
    const { start, end } = getDateRange(pipelineDateFilter);
    setPipelineStartDate(start);
    setPipelineEndDate(end);
  }, []);

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

  const getDateRange = (option: DateFilterOption): { start: string | null; end: string | null } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date | null = null;
    let end: Date | null = null;

    switch (option) {
      case 'none':
        return { start: null, end: null };

      case 'today':
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'this-week':
        start = new Date(today);
        const dayOfWeek = start.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start.setDate(start.getDate() + diff);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-week':
        start = new Date(today);
        const lastWeekDay = start.getDay();
        const lastWeekDiff = lastWeekDay === 0 ? -6 : 1 - lastWeekDay;
        start.setDate(start.getDate() + lastWeekDiff - 7);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return {
      start: start ? start.toISOString() : null,
      end: end ? end.toISOString() : null,
    };
  };

  const handleActivityDateFilterChange = (option: DateFilterOption) => {
    setActivityDateFilter(option);
    localStorage.setItem('dashboard-activity-filter', option); // Save to localStorage
    const { start, end } = getDateRange(option);
    setActivityStartDate(start);
    setActivityEndDate(end);
  };

  const handlePipelineDateFilterChange = (option: DateFilterOption) => {
    setPipelineDateFilter(option);
    localStorage.setItem('dashboard-pipeline-filter', option);
    const { start, end } = getDateRange(option);
    setPipelineStartDate(start);
    setPipelineEndDate(end);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Pipeline by Stage</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="pipeline-period" className="text-xs text-gray-400">Won/Lost Period:</label>
              <select
                id="pipeline-period"
                value={pipelineDateFilter}
                onChange={(e) => handlePipelineDateFilterChange(e.target.value as DateFilterOption)}
                className="px-2 py-1 bg-dark-800 border border-dark-700 text-white text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="none">All Time</option>
                <option value="today">Today</option>
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            {/* Active pipeline stages */}
            {pipeline
              ?.filter((stage: any) => ['LEAD', 'PROSPECT', 'QUOTE'].includes(stage.stage))
              .map((stage: any) => (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-200">{stage.stage}</span>
                    <span className="text-gray-400">{formatCurrency(stage.totalValue || 0)} ({stage.count})</span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${Math.min((stage.count / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}

            {/* Won deals */}
            {closedDeals && (
              <>
                <div className="border-t border-dark-700 pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-green-400">WON</span>
                    <span className="text-gray-400">{formatCurrency(closedDeals.won.value)} ({closedDeals.won.count})</span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min((closedDeals.won.count / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Lost deals */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-red-400">LOST</span>
                    <span className="text-gray-400">{formatCurrency(closedDeals.lost.value)} ({closedDeals.lost.count})</span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min((closedDeals.lost.count / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hot Deals */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Hot Deals</h2>
          <p className="text-xs text-gray-400 mb-3">Deals with closest expected close dates</p>
          <div className="space-y-1">
            {hotDeals && hotDeals.length > 0 ? (
              hotDeals.map((deal: any) => (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  className="hover:bg-dark-700 px-2 py-1.5 rounded transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white block truncate">{deal.title}</span>
                      <p className="text-xs text-gray-400 truncate">{deal.organization?.name || 'No organization'}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-sm font-semibold text-green-400">{formatCurrency(deal.amount || 0)}</div>
                      {deal.expectedCloseDate && (
                        <div className="text-xs text-gray-400">
                          {new Date(deal.expectedCloseDate).toLocaleDateString('sv-SE')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No upcoming deals</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Volume */}
      <div className="card p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Activity Volume</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="activity-period" className="text-sm text-gray-400">Period:</label>
            <select
              id="activity-period"
              value={activityDateFilter}
              onChange={(e) => handleActivityDateFilterChange(e.target.value as DateFilterOption)}
              className="px-3 py-1.5 bg-dark-800 border border-dark-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="none">All Time</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="last-week">Last Week</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {activityVolume && activityVolume.length > 0 ? (
            <table className="min-w-full divide-y divide-dark-700">
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
              <tbody className="divide-y divide-dark-700">
                {activityVolume.map((item: any) => (
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
          ) : (
            <p className="text-sm text-gray-400">No activity data available for the selected period</p>
          )}
        </div>
      </div>
    </div>
  );
}
