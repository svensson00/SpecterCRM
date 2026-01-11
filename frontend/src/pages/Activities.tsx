import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { activityAPI } from '../lib/api';
import { exportToCSV, flattenForExport } from '../utils/csv';
import DateFilter from '../components/DateFilter';

type SortField = 'subject' | 'organization' | 'date' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';

export default function Activities() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>(() => {
    return (sessionStorage.getItem('activities_filter') as 'all' | 'pending' | 'completed') || 'all';
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    return (sessionStorage.getItem('activities_sortField') as SortField) || 'date';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (sessionStorage.getItem('activities_sortDirection') as SortDirection) || 'asc';
  });
  const [startDate, setStartDate] = useState<string | null>(() => {
    return sessionStorage.getItem('activities_startDate') || null;
  });
  const [endDate, setEndDate] = useState<string | null>(() => {
    return sessionStorage.getItem('activities_endDate') || null;
  });
  const queryClient = useQueryClient();

  // Save filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('activities_filter', filter);
  }, [filter]);

  useEffect(() => {
    sessionStorage.setItem('activities_sortField', sortField);
  }, [sortField]);

  useEffect(() => {
    sessionStorage.setItem('activities_sortDirection', sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    if (startDate) {
      sessionStorage.setItem('activities_startDate', startDate);
    } else {
      sessionStorage.removeItem('activities_startDate');
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      sessionStorage.setItem('activities_endDate', endDate);
    } else {
      sessionStorage.removeItem('activities_endDate');
    }
  }, [endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['activities', filter, startDate, endDate],
    queryFn: () => {
      const params: any = {
        isCompleted: filter === 'all' ? undefined : filter === 'completed',
        limit: 1000,
      };

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      return activityAPI.getAll(params).then(r => r.data.data);
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (id: string) => activityAPI.toggleComplete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedActivities = useMemo(() => {
    if (!data) return [];

    const activities = [...data];
    activities.sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'subject':
          aValue = (a.subject || '').toLowerCase();
          bValue = (b.subject || '').toLowerCase();
          break;
        case 'organization':
          aValue = (a.relatedOrganization?.name || '').toLowerCase();
          bValue = (b.relatedOrganization?.name || '').toLowerCase();
          break;
        case 'date':
          aValue = a.dueAt ? new Date(a.dueAt).getTime() : 0;
          bValue = b.dueAt ? new Date(b.dueAt).getTime() : 0;
          break;
        case 'status':
          aValue = a.isCompleted ? 1 : 0;
          bValue = b.isCompleted ? 1 : 0;
          break;
        case 'type':
          aValue = (a.type || '').toLowerCase();
          bValue = (b.type || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return activities;
  }, [data, sortField, sortDirection]);

  const handleExport = async () => {
    try {
      // Build params with current filters
      const params: any = { limit: 10000 };
      if (filter !== 'all') {
        params.isCompleted = filter === 'completed';
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await activityAPI.getAll(params);
      const activities = response.data.data;

      if (!activities || activities.length === 0) {
        alert('No activities to export');
        return;
      }

      // Format activities with specific fields only
      const formattedActivities = activities.map((activity: any) => ({
        Type: activity.type || '',
        Date: activity.dueAt ? new Date(activity.dueAt).toLocaleDateString('sv-SE') : '',
        Description: activity.subject || '',
        Organization: activity.relatedOrganization?.name || '',
        Deal: activity.relatedDeal?.title || '',
        Contacts: activity.contacts?.map((c: any) => `${c.contact?.firstName || ''} ${c.contact?.lastName || ''}`).join('; ') || '',
      }));

      exportToCSV(formattedActivities, 'activities');
    } catch (error) {
      alert('Error exporting activities');
    }
  };

  const handleDateFilterChange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Activities</h1>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
          >
            Export CSV
          </button>
          <Link
            to="/activities/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Activity
          </Link>
        </div>
      </div>

      <DateFilter onChange={handleDateFilterChange} storageKey="activities" />

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-primary-600 text-white' : 'bg-dark-700'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-primary-600 text-white' : 'bg-dark-700'}`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded ${filter === 'completed' ? 'bg-primary-600 text-white' : 'bg-dark-700'}`}
        >
          Completed
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : sortedActivities.length === 0 ? (
        <div className="card shadow overflow-hidden sm:rounded-lg p-12 text-center">
          <p className="text-gray-400">No activities found{startDate || endDate ? ' for the selected date range' : ''}.</p>
        </div>
      ) : (
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-dark-900">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-2">
                      Type
                      {sortField === 'type' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('subject')}
                  >
                    <div className="flex items-center gap-2">
                      Subject
                      {sortField === 'subject' && (
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
                      Company
                      {sortField === 'organization' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contacts
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortField === 'date' && (
                        <span className="text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="card divide-y divide-gray-700">
                {sortedActivities.map((activity: any) => (
                  <tr key={activity.id} className="hover:bg-dark-900 transition-colors">
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={activity.isCompleted}
                        onChange={() => toggleCompleteMutation.mutate(activity.id)}
                        className="h-4 w-4 rounded border-dark-700 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-sm text-gray-300">
                      {activity.type || '—'}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      <Link to={`/activities/${activity.id}`} className={`font-medium text-sm ${activity.isCompleted ? 'line-through text-gray-400 hover:text-gray-300' : 'text-white hover:text-gray-200'}`}>
                        {activity.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap">
                      {activity.relatedOrganization ? (
                        <Link to={`/organizations/${activity.relatedOrganization.id}`} className="text-white hover:text-gray-200 text-sm">
                          {activity.relatedOrganization.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-sm">
                      {activity.contacts && activity.contacts.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {activity.contacts.map((ac: any) => (
                            <Link
                              key={ac.contactId}
                              to={`/contacts/${ac.contactId}`}
                              className="text-white hover:text-gray-200"
                            >
                              {ac.contact?.firstName} {ac.contact?.lastName}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-1.5 whitespace-nowrap text-white text-sm">
                      {activity.dueAt ? new Date(activity.dueAt).toLocaleDateString('sv-SE') : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
