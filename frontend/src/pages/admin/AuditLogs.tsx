import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeData: any;
  afterData: any;
  createdAt: string;
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const limit = 50;

  const { data: logsResponse, isLoading } = useQuery<{
    data: AuditLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['audit-logs', page, entityType, action],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (entityType) params.append('entityType', entityType);
      if (action) params.append('action', action);

      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      return res.data;
    },
  });

  const entityTypes = ['ORGANIZATION', 'CONTACT', 'DEAL', 'ACTIVITY', 'NOTE', 'USER'];
  const actions = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'MERGE',
    'STAGE_CHANGE',
    'OWNER_CHANGE',
    'COMPLETE',
    'UNCOMPLETE',
    'PASSWORD_CHANGE',
    'ADMIN_PASSWORD_RESET',
  ];

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatChanges = (log: AuditLog) => {
    const hasChanges = log.beforeData || log.afterData;
    if (!hasChanges) return <span className="text-xs text-gray-400">—</span>;

    try {
      return (
        <div className="text-xs text-gray-400">
          <details className="cursor-pointer">
            <summary className="text-primary-400 hover:text-primary-300">View changes</summary>
            <div className="mt-2 p-2 bg-dark-900 rounded overflow-x-auto space-y-2">
              {log.beforeData && (
                <div>
                  <div className="text-red-400 font-semibold mb-1">Before:</div>
                  <pre className="text-xs text-gray-300">
                    {JSON.stringify(log.beforeData, null, 2)}
                  </pre>
                </div>
              )}
              {log.afterData && (
                <div>
                  <div className="text-green-400 font-semibold mb-1">After:</div>
                  <pre className="text-xs text-gray-300">
                    {JSON.stringify(log.afterData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      );
    } catch {
      return <span className="text-xs text-gray-400">Invalid data</span>;
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-500/20 text-green-400';
      case 'UPDATE':
      case 'STAGE_CHANGE':
      case 'OWNER_CHANGE':
        return 'bg-blue-500/20 text-blue-400';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400';
      case 'MERGE':
        return 'bg-purple-500/20 text-purple-400';
      case 'COMPLETE':
        return 'bg-teal-500/20 text-teal-400';
      case 'UNCOMPLETE':
        return 'bg-gray-500/20 text-gray-400';
      case 'PASSWORD_CHANGE':
      case 'ADMIN_PASSWORD_RESET':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const logs = logsResponse?.data || [];
  const total = logsResponse?.pagination.total || 0;
  const totalPages = logsResponse ? logsResponse.pagination.totalPages : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
      </div>

      {/* Filters */}
      <div className="card shadow-sm rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">All Types</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">All Actions</option>
              {actions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setEntityType('');
                setAction('');
                setPage(1);
              }}
              className="px-4 py-2 border border-dark-700 rounded-md text-sm font-medium text-gray-300 card hover:bg-dark-900 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="text-center py-4">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="card shadow-sm rounded-lg p-6 text-center">
          <p className="text-gray-400">No audit logs found</p>
        </div>
      ) : (
        <>
          <div className="card shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-dark-700">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Entity ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Changes
                    </th>
                  </tr>
                </thead>
                <tbody className="card divide-y divide-dark-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-dark-900">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.user ? (
                          <>
                            <div className="text-sm text-white">
                              {log.user.firstName} {log.user.lastName}
                            </div>
                            <div className="text-xs text-gray-400">{log.user.email}</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400 italic">User deleted</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white">{log.entityType}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-400">
                        {log.entityId.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{formatChanges(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="card px-4 py-2 flex items-center justify-between rounded-lg shadow-sm">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-3 py-1.5 border border-dark-700 text-sm font-medium rounded-md text-gray-300 card hover:bg-dark-900 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-3 py-1.5 border border-dark-700 text-sm font-medium rounded-md text-gray-300 card hover:bg-dark-900 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                    <span className="font-medium">{total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md -space-x-px">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-1 rounded-l-md border border-dark-700 card text-sm font-medium text-gray-400 hover:bg-dark-900 disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      if (pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-3 py-1 border text-sm font-medium transition-colors ${
                              page === pageNum
                                ? 'z-10 bg-primary-600 border-primary-600 text-white'
                                : 'card border-dark-700 text-gray-400 hover:bg-dark-900'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (pageNum === page - 2 || pageNum === page + 2) {
                        return (
                          <span key={pageNum} className="relative inline-flex items-center px-3 py-1 border border-dark-700 card text-sm font-medium text-gray-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-1 rounded-r-md border border-dark-700 card text-sm font-medium text-gray-400 hover:bg-dark-900 disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
