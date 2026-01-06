import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { organizationAPI } from '../lib/api';
import { exportToCSV, flattenForExport } from '../utils/csv';

type SortField = 'name' | 'owner';
type SortDirection = 'asc' | 'desc';

export default function Organizations() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch all organizations for proper sorting
  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', search],
    queryFn: () => organizationAPI.getAll({ search, limit: 10000 }).then(r => {
      console.log('Organizations API Response:', r.data);
      return r.data;
    }),
  });

  console.log('Organizations data:', data);
  console.log('Organizations isLoading:', isLoading);
  console.log('Organizations error:', error);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOrganizations = useMemo(() => {
    if (!data?.data) return [];

    const organizations = [...data.data];
    organizations.sort((a: any, b: any) => {
      let aValue: string;
      let bValue: string;

      switch (sortField) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
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

    return organizations;
  }, [data?.data, sortField, sortDirection]);

  // Client-side pagination
  const ITEMS_PER_PAGE = 20;
  const totalItems = sortedOrganizations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrganizations = sortedOrganizations.slice(startIndex, endIndex);

  // Reset page if it exceeds total pages
  if (page > totalPages && totalPages > 0 && !isLoading) {
    setPage(totalPages);
  }

  const handleExport = async () => {
    try {
      // Fetch all organizations for export
      const response = await organizationAPI.getAll({ limit: 10000 });
      const allOrgs = response.data.data;
      const flattened = flattenForExport(allOrgs);
      exportToCSV(flattened, 'organizations');
    } catch (error) {
      alert('Error exporting organizations');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Organizations</h1>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
          >
            Export CSV
          </button>
          <Link
            to="/organizations/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Organization
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full px-4 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error loading organizations: {(error as any)?.message || 'Unknown error'}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-dark-900">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Organization
                      {sortField === 'name' && (
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
                {paginatedOrganizations.map((org: any) => (
                  <tr key={org.id} className="hover:bg-dark-900 transition-colors">
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <Link to={`/organizations/${org.id}`} className="text-white hover:text-gray-200 font-medium text-sm">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {org.owner ? (
                        `${org.owner.firstName} ${org.owner.lastName}`
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
      ) : (
        <div className="text-center py-12 card rounded-lg shadow">
          <p className="text-gray-400">No organizations found.</p>
          <Link
            to="/organizations/new"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Create your first organization
          </Link>
        </div>
      )}

      {totalItems > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 hover:bg-dark-900 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-300">
            Page {page} of {totalPages} ({totalItems} {totalItems === 1 ? 'organization' : 'organizations'})
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
