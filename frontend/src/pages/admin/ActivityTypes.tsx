import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import CurrencySelect from '../../components/CurrencySelect';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
];

export default function ActivityTypes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [showCreateRoleForm, setShowCreateRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['activity-types'],
    queryFn: () => adminAPI.getActivityTypes().then(r => r.data),
  });

  const { data: contactRoles, isLoading: contactRolesLoading } = useQuery({
    queryKey: ['contact-roles'],
    queryFn: () => adminAPI.getContactRoles().then(r => r.data),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => adminAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => adminAPI.createActivityType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-types'] });
      setShowCreateForm(false);
      setNewTypeName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminAPI.updateActivityType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-types'] });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => adminAPI.createContactRole(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-roles'] });
      setShowCreateRoleForm(false);
      setNewRoleName('');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminAPI.updateContactRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-roles'] });
    },
  });

  const handleCurrencyChange = (currency: string) => {
    updateSettingsMutation.mutate({ currency });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTypeName.trim()) {
      createMutation.mutate(newTypeName.trim());
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoleName.trim()) {
      createRoleMutation.mutate(newRoleName.trim());
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      {/* General Settings Section */}
      <div className="card shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">General Settings</h2>
        <div className="space-y-4">
          <div>
            <CurrencySelect
              currencies={CURRENCIES}
              value={settings?.currency || 'USD'}
              onChange={handleCurrencyChange}
              label="Default Currency"
              placeholder="Select currency..."
              disabled={settingsLoading || updateSettingsMutation.isPending}
            />
            <p className="mt-2 text-sm text-gray-400">
              This currency will be used for all deals in your CRM
            </p>
          </div>
        </div>
      </div>

      {/* Activity Types Section */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Activity Types</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          {showCreateForm ? 'Cancel' : 'Add Activity Type'}
        </button>
      </div>

      {showCreateForm && (
        <div className="card shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Activity Type</h2>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g., Demo, Presentation"
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="card shadow overflow-hidden sm:rounded-lg mb-6">
          <ul className="divide-y divide-dark-700">
            {data?.map((type: any) => (
              <li key={type.id} className="px-6 py-2 hover:bg-dark-900 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-white">{type.name}</span>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      type.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-dark-800 text-gray-400 border border-dark-700'
                    }`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMutation.mutate({
                        id: type.id,
                        data: { isActive: !type.isActive }
                      })}
                      className="text-sm text-white hover:text-gray-200 transition-colors"
                    >
                      {type.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contact Roles Section */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Contact Roles</h2>
        <button
          onClick={() => setShowCreateRoleForm(!showCreateRoleForm)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          {showCreateRoleForm ? 'Cancel' : 'Add Contact Role'}
        </button>
      </div>

      {showCreateRoleForm && (
        <div className="card shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Contact Role</h2>
          <form onSubmit={handleRoleSubmit} className="flex gap-4">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., Decision Maker, Influencer"
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              disabled={createRoleMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {createRoleMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {contactRolesLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-dark-700">
            {contactRoles?.map((role: any) => (
              <li key={role.id} className="px-6 py-2 hover:bg-dark-900 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-white">{role.name}</span>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      role.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-dark-800 text-gray-400 border border-dark-700'
                    }`}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateRoleMutation.mutate({
                        id: role.id,
                        data: { isActive: !role.isActive }
                      })}
                      className="text-sm text-white hover:text-gray-200 transition-colors"
                    >
                      {role.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
