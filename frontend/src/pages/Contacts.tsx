import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { contactAPI } from '../lib/api';
import { exportToCSV, flattenForExport } from '../utils/csv';

type SortField = 'name' | 'organization' | 'owner';
type SortDirection = 'asc' | 'desc';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const ITEMS_PER_PAGE = 20;

  // Map frontend sort fields to backend sort fields
  const getSortBy = (field: SortField): string => {
    switch (field) {
      case 'name':
        return 'firstName'; // Backend sorts by firstName for name
      case 'organization':
        return 'primaryOrganization'; // Backend relation sort
      case 'owner':
        return 'owner'; // Backend relation sort
      default:
        return 'firstName';
    }
  };

  // Fetch contacts with server-side pagination and sorting
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search, page, sortBy: sortField, sortOrder: sortDirection }],
    queryFn: () =>
      contactAPI
        .getAll({
          search,
          page,
          limit: ITEMS_PER_PAGE,
          sortBy: getSortBy(sortField),
          sortOrder: sortDirection,
        })
        .then((r) => r.data),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1); // Reset to first page when sort changes
  };

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleExport = async () => {
    try {
      const response = await contactAPI.getAll({ limit: 10000 });
      const allContacts = response.data.data;
      const flattened = flattenForExport(allContacts);
      exportToCSV(flattened, 'contacts');
    } catch (error) {
      alert('Error exporting contacts');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Contacts</h1>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
          >
            Export CSV
          </button>
          <Link
            to="/contacts/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Contact
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full px-4 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

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
                      Name
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
                {data.data.map((contact: any) => (
                  <tr key={contact.id} className="hover:bg-dark-900 transition-colors">
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <Link to={`/contacts/${contact.id}`} className="text-white hover:text-gray-200 font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </Link>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      {contact.primaryOrganization ? (
                        <Link
                          to={`/organizations/${contact.primaryOrganization.id}`}
                          className="text-white hover:text-gray-200 text-sm"
                        >
                          {contact.primaryOrganization.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {contact.owner ? (
                        `${contact.owner.firstName} ${contact.owner.lastName}`
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
          <p className="text-gray-400">No contacts found.</p>
          <Link
            to="/contacts/new"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Create your first contact
          </Link>
        </div>
      )}

      {data?.pagination && data.pagination.total > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 hover:bg-dark-900 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-300">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total}{' '}
            {data.pagination.total === 1 ? 'contact' : 'contacts'})
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= data.pagination.totalPages}
            className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 hover:bg-dark-900 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
