import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dealAPI, adminAPI } from '../lib/api';
import { exportToCSV, flattenForExport } from '../utils/csv';

const STAGE_COLORS: Record<string, string> = {
  LEAD: 'bg-purple-500/20 text-purple-400',
  PROSPECT: 'bg-blue-500/20 text-blue-400',
  QUOTE: 'bg-yellow-500/20 text-yellow-400',
  WON: 'bg-green-500/20 text-green-400',
  LOST: 'bg-red-500/20 text-red-400',
};

type SortField = 'title' | 'organization' | 'amount' | 'expectedCloseDate' | 'stage' | 'probability' | 'owner';
type SortDirection = 'asc' | 'desc';

const STAGES = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];

export default function Deals() {
  const [search, setSearch] = useState(() => {
    return sessionStorage.getItem('deals_search') || '';
  });
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>(() => {
    return (sessionStorage.getItem('deals_sortField') as SortField) || 'title';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (sessionStorage.getItem('deals_sortDirection') as SortDirection) || 'asc';
  });
  const [selectedStages, setSelectedStages] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('deals_selectedStages');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Save filter state to sessionStorage
  useEffect(() => {
    if (search) {
      sessionStorage.setItem('deals_search', search);
    } else {
      sessionStorage.removeItem('deals_search');
    }
  }, [search]);

  useEffect(() => {
    sessionStorage.setItem('deals_sortField', sortField);
  }, [sortField]);

  useEffect(() => {
    sessionStorage.setItem('deals_sortDirection', sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    sessionStorage.setItem('deals_selectedStages', JSON.stringify(selectedStages));
  }, [selectedStages]);

  // Fetch all deals for proper sorting and filtering
  const { data, isLoading } = useQuery({
    queryKey: ['deals', search],
    queryFn: () => dealAPI.getAll({ search, limit: 10000 }).then(r => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const updateDateMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      dealAPI.update(id, { expectedCloseDate: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (error: any) => {
      alert('Error updating date: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateAmountMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      dealAPI.update(id, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setEditingAmountId(null);
    },
    onError: (error: any) => {
      alert('Error updating amount: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleDateChange = (dealId: string, newDate: string) => {
    if (newDate) {
      // Convert YYYY-MM-DD to ISO 8601 datetime
      const isoDate = new Date(newDate + 'T00:00:00').toISOString();
      updateDateMutation.mutate({ id: dealId, date: isoDate });
    }
  };

  const handleAmountChange = (dealId: string, newAmount: string) => {
    const amount = parseFloat(newAmount);
    if (!isNaN(amount) && amount >= 0) {
      updateAmountMutation.mutate({ id: dealId, amount });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleStage = (stage: string) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
    setPage(1); // Reset to first page when filter changes
  };

  const filteredAndSortedDeals = useMemo(() => {
    if (!data?.data) return [];

    let deals = [...data.data];

    // Filter by stage if any stages are selected
    if (selectedStages.length > 0) {
      deals = deals.filter((deal: any) => selectedStages.includes(deal.stage));
    }

    // Sort
    deals.sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'organization':
          aValue = (a.organization?.name || '').toLowerCase();
          bValue = (b.organization?.name || '').toLowerCase();
          break;
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'expectedCloseDate':
          aValue = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
          bValue = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
          break;
        case 'stage':
          aValue = (a.stage || '').toLowerCase();
          bValue = (b.stage || '').toLowerCase();
          break;
        case 'probability':
          aValue = a.probability || 0;
          bValue = b.probability || 0;
          break;
        case 'owner':
          aValue = a.owner ? `${a.owner.firstName} ${a.owner.lastName}`.toLowerCase() : '';
          bValue = b.owner ? `${b.owner.firstName} ${b.owner.lastName}`.toLowerCase() : '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return deals;
  }, [data?.data, sortField, sortDirection, selectedStages]);

  // Client-side pagination
  const ITEMS_PER_PAGE = 20;
  const totalFilteredItems = filteredAndSortedDeals.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredItems / ITEMS_PER_PAGE));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDeals = filteredAndSortedDeals.slice(startIndex, endIndex);

  // Reset page if it exceeds total pages
  if (page > totalPages && totalPages > 0 && !isLoading) {
    setPage(totalPages);
  }

  const handleExport = async () => {
    try {
      const response = await dealAPI.getAll({ limit: 10000 });
      const allDeals = response.data.data;
      const flattened = flattenForExport(allDeals);
      exportToCSV(flattened, 'deals');
    } catch (error) {
      alert('Error exporting deals');
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency || 'USD';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Deals</h1>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
          >
            Export CSV
          </button>
          <Link
            to="/deals/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Deal
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search deals..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset to first page when search changes
          }}
          className="block w-full px-4 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <div className="card shadow sm:rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">Filter by Stage</label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((stage) => (
              <button
                key={stage}
                onClick={() => toggleStage(stage)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedStages.includes(stage)
                    ? STAGE_COLORS[stage]
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {stage}
              </button>
            ))}
            {selectedStages.length > 0 && (
              <button
                onClick={() => {
                  setSelectedStages([]);
                  setPage(1); // Reset to first page when clearing filters
                }}
                className="px-3 py-1.5 rounded text-sm font-medium bg-dark-700 text-gray-400 hover:bg-dark-600"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-dark-900">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-2">
                      Deal
                      {sortField === 'title' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('organization')}
                  >
                    <div className="flex items-center gap-2">
                      Organization
                      {sortField === 'organization' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center gap-2">
                      Amount
                      {sortField === 'amount' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('expectedCloseDate')}
                  >
                    <div className="flex items-center gap-2">
                      Expected Close
                      {sortField === 'expectedCloseDate' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('stage')}
                  >
                    <div className="flex items-center gap-2">
                      Stage
                      {sortField === 'stage' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('probability')}
                  >
                    <div className="flex items-center gap-2">
                      Probability
                      {sortField === 'probability' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('owner')}
                  >
                    <div className="flex items-center gap-2">
                      Owner
                      {sortField === 'owner' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="card divide-y divide-gray-700">
                {paginatedDeals.map((deal: any) => (
                  <tr key={deal.id} className="hover:bg-dark-900 transition-colors">
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <Link to={`/deals/${deal.id}`} className="text-white hover:text-gray-200 font-medium text-sm">
                        {deal.title}
                      </Link>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      {deal.organization ? (
                        <Link
                          to={`/organizations/${deal.organization.id}`}
                          className="text-white hover:text-gray-200 text-sm"
                        >
                          {deal.organization.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {editingAmountId === deal.id ? (
                        <input
                          type="number"
                          defaultValue={deal.amount || 0}
                          onBlur={(e) => handleAmountChange(deal.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAmountChange(deal.id, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                              setEditingAmountId(null);
                            }
                          }}
                          autoFocus
                          className="bg-dark-700 border border-primary-500 text-white rounded px-2 py-1 focus:outline-none text-sm w-24"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingAmountId(deal.id)}
                          className="text-white hover:text-gray-300 hover:bg-dark-700 px-2 py-1 rounded transition-colors text-left w-full"
                        >
                          {formatCurrency(deal.amount || 0)}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      <div className="relative">
                        <input
                          type="date"
                          value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleDateChange(deal.id, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-32"
                        />
                        <div className="text-white hover:text-gray-300 hover:bg-dark-700 px-2 py-1 rounded transition-colors cursor-pointer w-32">
                          {deal.expectedCloseDate ? (
                            new Date(deal.expectedCloseDate).toLocaleDateString('sv-SE')
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${STAGE_COLORS[deal.stage] || 'bg-gray-500/20 text-gray-400'}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {deal.probability !== null ? `${deal.probability}%` : '—'}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {deal.owner ? (
                        `${deal.owner.firstName} ${deal.owner.lastName}`
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalFilteredItems > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 hover:bg-dark-900 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-300">
            Page {page} of {totalPages} ({totalFilteredItems} {totalFilteredItems === 1 ? 'deal' : 'deals'})
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 hover:bg-dark-900 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
