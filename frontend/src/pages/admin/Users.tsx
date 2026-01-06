import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userAPI, authAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import UserRoleSelect from '../../components/UserRoleSelect';

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'USER' as 'ADMIN' | 'USER',
  });
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
  });
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => authAPI.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateForm(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'USER' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      setEditFormData({ firstName: '', lastName: '' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userAPI.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => userAPI.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      userAPI.changePassword(id, newPassword),
    onSuccess: () => {
      setChangingPasswordUser(null);
      setPasswordFormData({ newPassword: '', confirmPassword: '' });
      alert('Password changed successfully');
    },
    onError: (error: any) => {
      alert('Error changing password: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditClick = (u: any) => {
    setEditingUser(u);
    setEditFormData({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: editFormData });
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (changingPasswordUser) {
      changePasswordMutation.mutate({
        id: changingPasswordUser.id,
        newPassword: passwordFormData.newPassword,
      });
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
        <h1 className="text-3xl font-bold text-white">User Management</h1>
      </div>

      {/* User List Section */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Users</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          {showCreateForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showCreateForm && (
        <div className="card shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email*</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Password*</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-400">Min 8 chars, 1 uppercase, 1 number, 1 special</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <UserRoleSelect
                value={formData.role}
                onChange={(role) => setFormData({ ...formData, role })}
                label="Role"
                placeholder="Select role..."
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
            {createMutation.isError && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error || 'Failed to create user'}</p>
            )}
          </form>
        </div>
      )}

{editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Edit User</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                <input
                  type="text"
                  value={editingUser.email}
                  disabled
                  className="block w-full px-3 py-2 bg-dark-900 border border-dark-700 text-gray-400 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                <input
                  type="text"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                <input
                  type="text"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 bg-dark-700 text-gray-300 rounded-md hover:bg-dark-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {changingPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Change Password for {changingPasswordUser.email}
            </h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">New Password*</label>
                <input
                  type="password"
                  required
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-400">Min 8 chars, 1 uppercase, 1 number, 1 special</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confirm Password*</label>
                <input
                  type="password"
                  required
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangingPasswordUser(null);
                    setPasswordFormData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-dark-700 text-gray-300 rounded-md hover:bg-dark-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="card shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-dark-700">
            <thead className="bg-dark-900">
              <tr>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="card divide-y divide-dark-700">
              {data?.data?.map((u: any) => (
                <tr key={u.id} className="hover:bg-dark-900 transition-colors">
                  <td className="px-6 py-1.5 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {u.firstName} {u.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-1.5 whitespace-nowrap">
                    <div className="text-sm text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-6 py-1.5 whitespace-nowrap">
                    <select
                      value={u.role}
                      onChange={(e) => updateRoleMutation.mutate({ id: u.id, role: e.target.value })}
                      disabled={u.id === user?.id}
                      className="text-sm bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-1.5 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      u.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-dark-800 text-gray-400 border border-dark-700'
                    }`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-1.5 whitespace-nowrap text-sm">
                    {u.id !== user?.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(u)}
                          className="text-sm text-white hover:text-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setChangingPasswordUser(u)}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Change Password
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                          className={u.isActive ? 'text-sm text-yellow-400 hover:text-yellow-300 transition-colors' : 'text-sm text-green-400 hover:text-green-300 transition-colors'}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete user ${u.email}? This will deactivate the account.`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                          className="text-sm text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Current User</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
