import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationAPI, userAPI, activityAPI } from '../lib/api';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    street: '',
    city: '',
    zip: '',
    country: '',
  });
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [dealSearch, setDealSearch] = useState('');
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showAllDeals, setShowAllDeals] = useState(false);

  // Activities filtering state
  const [activitiesFilter, setActivitiesFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [activitiesStartDate, setActivitiesStartDate] = useState<string | null>(null);
  const [activitiesEndDate, setActivitiesEndDate] = useState<string | null>(null);
  const [activitiesDateOption, setActivitiesDateOption] = useState<string>('none');
  const [showActivitiesDateInputs, setShowActivitiesDateInputs] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationAPI.getById(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        website: org.website || '',
        street: org.street || '',
        city: org.city || '',
        zip: org.zip || '',
        country: org.country || '',
      });
      if (org.owner) {
        setSelectedOwnerId(org.owner.id);
      }
    }
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => organizationAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      alert('Error updating organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => organizationAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      navigate('/organizations');
    },
    onError: (error: any) => {
      alert('Error deleting organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: (ownerUserId: string | null) => organizationAPI.update(id!, { ownerUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setIsEditingOwner(false);
    },
    onError: (error: any) => {
      alert('Error updating owner: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (org) {
      setFormData({
        name: org.name || '',
        website: org.website || '',
        street: org.street || '',
        city: org.city || '',
        zip: org.zip || '',
        country: org.country || '',
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${org?.name}"? This will also delete all related contacts, deals, and activities.`)) {
      deleteMutation.mutate();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveOwner = () => {
    updateOwnerMutation.mutate(selectedOwnerId || null);
  };

  const handleCancelOwner = () => {
    if (org?.owner) {
      setSelectedOwnerId(org.owner.id);
    } else {
      setSelectedOwnerId('');
    }
    setIsEditingOwner(false);
    setOwnerSearch('');
  };

  const handleActivitiesDateOption = (option: string) => {
    setActivitiesDateOption(option);

    if (option === 'none') {
      setActivitiesStartDate(null);
      setActivitiesEndDate(null);
      setShowActivitiesDateInputs(false);
    } else if (option === 'custom') {
      setShowActivitiesDateInputs(true);
    } else {
      setShowActivitiesDateInputs(false);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let start: Date | null = null;
      let end: Date | null = null;

      switch (option) {
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
        case 'this-month':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last-30-days':
          start = new Date(today);
          start.setDate(start.getDate() - 30);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
      }

      setActivitiesStartDate(start ? start.toISOString() : null);
      setActivitiesEndDate(end ? end.toISOString() : null);
    }
  };

  const { data: contacts } = useQuery({
    queryKey: ['organization-contacts', id],
    queryFn: () => organizationAPI.getContacts(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: deals } = useQuery({
    queryKey: ['organization-deals', id],
    queryFn: () => organizationAPI.getDeals(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['organization-activities', id, activitiesFilter, activitiesStartDate, activitiesEndDate],
    queryFn: () => {
      const params: any = { limit: 1000 };
      if (activitiesFilter !== 'all') {
        params.isCompleted = activitiesFilter === 'completed';
      }
      if (activitiesStartDate) params.startDate = activitiesStartDate;
      if (activitiesEndDate) params.endDate = activitiesEndDate;
      return organizationAPI.getActivities(id!, params).then(r => r.data);
    },
    enabled: !!id,
  });

  const toggleActivityCompleteMutation = useMutation({
    mutationFn: (activityId: string) => activityAPI.toggleComplete(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-activities', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const INITIAL_DISPLAY_COUNT = 5;

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    if (!contactSearch) return contacts;
    const search = contactSearch.toLowerCase();
    return contacts.filter((contact: any) =>
      `${contact.firstName} ${contact.lastName} ${contact.emails?.[0]?.email || ''}`
        .toLowerCase()
        .includes(search)
    );
  }, [contacts, contactSearch]);

  const displayedContacts = showAllContacts
    ? filteredContacts
    : filteredContacts.slice(0, INITIAL_DISPLAY_COUNT);

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    if (!dealSearch) return deals;
    const search = dealSearch.toLowerCase();
    return deals.filter((deal: any) =>
      deal.title.toLowerCase().includes(search) ||
      deal.stage.toLowerCase().includes(search)
    );
  }, [deals, dealSearch]);

  const displayedDeals = showAllDeals
    ? filteredDeals
    : filteredDeals.slice(0, INITIAL_DISPLAY_COUNT);

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!org) return <div className="text-center py-12">Organization not found</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/organizations" className="text-white hover:text-gray-200">
          ← Back to Organizations
        </Link>
      </div>

      <div className="card shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="text-3xl font-bold bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 w-full max-w-2xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ) : (
                <h1 className="text-3xl font-bold text-white">{org.name}</h1>
              )}
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-4 py-2 border border-dark-700 rounded-md shadow-sm text-sm font-medium text-gray-300 card hover:bg-dark-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-dark-700">
          <dl className="divide-y divide-gray-700">
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Website</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : org.website ? (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-200">
                    {org.website}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Street</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="Street address"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : org.street || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">City</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : org.city || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Zip Code</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    placeholder="Zip code"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : org.zip || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Country</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : org.country || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Owner</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingOwner ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        placeholder="Search users..."
                        className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto border border-dark-700 bg-dark-800 rounded">
                        <div
                          onClick={() => setSelectedOwnerId('')}
                          className={`px-3 py-2 cursor-pointer hover:bg-dark-900 ${
                            selectedOwnerId === '' ? 'bg-dark-900' : ''
                          }`}
                        >
                          <span className="text-sm text-gray-400">No owner</span>
                        </div>
                        {users?.data
                          ?.filter((user: any) =>
                            `${user.firstName} ${user.lastName} ${user.email}`
                              .toLowerCase()
                              .includes(ownerSearch.toLowerCase())
                          )
                          .map((user: any) => (
                            <div
                              key={user.id}
                              onClick={() => setSelectedOwnerId(user.id)}
                              className={`px-3 py-2 cursor-pointer hover:bg-dark-900 ${
                                selectedOwnerId === user.id ? 'bg-dark-900' : ''
                              }`}
                            >
                              <span className="text-sm text-white">
                                {user.firstName} {user.lastName}
                                <span className="text-gray-400"> ({user.email})</span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveOwner}
                        disabled={updateOwnerMutation.isPending}
                        className="text-xs px-3 py-1 border border-transparent rounded text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateOwnerMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelOwner}
                        className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 card hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {org.owner ? (
                        <span>
                          {org.owner.firstName} {org.owner.lastName}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    {isEditing && !isEditingOwner && (
                      <button
                        onClick={() => setIsEditingOwner(true)}
                        className="text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Owner
                      </button>
                    )}
                  </div>
                )}
              </dd>
            </div>
            {org.createdAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Created</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(org.createdAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
            {org.updatedAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Last Updated</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(org.updatedAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow sm:rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Contacts ({filteredContacts.length})</h2>
            <Link
              to={`/contacts/new?organizationId=${id}`}
              className="inline-flex items-center px-3 py-1 text-xs border border-dark-700 rounded-md shadow-sm font-medium text-gray-300 card hover:bg-dark-900"
            >
              + Add Contact
            </Link>
          </div>

          {contacts && contacts.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="block w-full mb-3 px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <div className={`space-y-2 ${!showAllContacts && filteredContacts.length > INITIAL_DISPLAY_COUNT ? 'max-h-[300px] overflow-y-auto' : ''}`}>
                {displayedContacts.length > 0 ? (
                  displayedContacts.map((contact: any) => (
                    <div key={contact.id} className="flex items-start justify-between py-2 border-b border-dark-700 last:border-0">
                      <div className="flex-1 min-w-0">
                        <Link to={`/contacts/${contact.id}`} className="text-white hover:text-gray-200 font-medium text-sm block truncate">
                          {contact.firstName} {contact.lastName}
                        </Link>
                        <span className="text-xs text-gray-400 block truncate">{contact.emails?.[0]?.email || '—'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">No contacts found</p>
                )}
              </div>

              {filteredContacts.length > INITIAL_DISPLAY_COUNT && (
                <button
                  onClick={() => setShowAllContacts(!showAllContacts)}
                  className="mt-3 w-full text-sm text-primary-400 hover:text-primary-300 py-2"
                >
                  {showAllContacts ? '− Show Less' : `+ Show All (${filteredContacts.length})`}
                </button>
              )}
            </>
          )}

          {(!contacts || contacts.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-8">No contacts yet</p>
          )}
        </div>

        <div className="card shadow sm:rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Deals ({filteredDeals.length})</h2>
            <Link
              to={`/deals/new?organizationId=${id}`}
              className="inline-flex items-center px-3 py-1 text-xs border border-dark-700 rounded-md shadow-sm font-medium text-gray-300 card hover:bg-dark-900"
            >
              + Add Deal
            </Link>
          </div>

          {deals && deals.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Search deals..."
                value={dealSearch}
                onChange={(e) => setDealSearch(e.target.value)}
                className="block w-full mb-3 px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <div className={`space-y-2 ${!showAllDeals && filteredDeals.length > INITIAL_DISPLAY_COUNT ? 'max-h-[300px] overflow-y-auto' : ''}`}>
                {displayedDeals.length > 0 ? (
                  displayedDeals.map((deal: any) => (
                    <div key={deal.id} className="py-2 border-b border-dark-700 last:border-0">
                      <Link to={`/deals/${deal.id}`} className="text-white hover:text-gray-200 font-medium text-sm block truncate">
                        {deal.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          deal.stage === 'WON' ? 'bg-green-500/10 text-green-400' :
                          deal.stage === 'LOST' ? 'bg-red-500/10 text-red-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {deal.stage}
                        </span>
                        <span className="text-xs text-gray-400">
                          ${deal.amount?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">No deals found</p>
                )}
              </div>

              {filteredDeals.length > INITIAL_DISPLAY_COUNT && (
                <button
                  onClick={() => setShowAllDeals(!showAllDeals)}
                  className="mt-3 w-full text-sm text-primary-400 hover:text-primary-300 py-2"
                >
                  {showAllDeals ? '− Show Less' : `+ Show All (${filteredDeals.length})`}
                </button>
              )}
            </>
          )}

          {(!deals || deals.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-8">No deals yet</p>
          )}
        </div>
      </div>

      {/* Activities Panel */}
      <div className="card shadow overflow-hidden sm:rounded-lg mt-6">
        <div className="px-4 py-5 sm:px-6 border-b border-dark-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Activities</h2>
            <Link
              to={`/activities/new?organizationId=${id}`}
              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              + New Activity
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setActivitiesFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activitiesFilter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActivitiesFilter('pending')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activitiesFilter === 'pending'
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setActivitiesFilter('completed')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  activitiesFilter === 'completed'
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                }`}
              >
                Completed
              </button>
            </div>

            <select
              value={activitiesDateOption}
              onChange={(e) => handleActivitiesDateOption(e.target.value)}
              className="px-3 py-1.5 text-sm bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="none">All Dates</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {showActivitiesDateInputs && (
              <>
                <input
                  type="date"
                  value={activitiesStartDate ? activitiesStartDate.split('T')[0] : ''}
                  onChange={(e) => setActivitiesStartDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="px-3 py-1.5 text-sm bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="date"
                  value={activitiesEndDate ? activitiesEndDate.split('T')[0] : ''}
                  onChange={(e) => setActivitiesEndDate(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null)}
                  className="px-3 py-1.5 text-sm bg-dark-800 border border-dark-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-dark-700">
            <thead className="bg-dark-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Contacts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Deal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Owner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {activitiesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-400">
                    No activities found
                  </td>
                </tr>
              ) : (
                activitiesData?.data?.map((activity: any) => (
                  <tr key={activity.id} className="hover:bg-dark-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={activity.isCompleted}
                        onChange={() => toggleActivityCompleteMutation.mutate(activity.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-600 rounded bg-dark-800"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/activities/${activity.id}`} className="text-sm text-white hover:text-gray-200">
                        {activity.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {activity.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {activity.dueAt ? new Date(activity.dueAt).toLocaleDateString('sv-SE') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {activity.relatedDeal ? (
                        <Link
                          to={`/deals/${activity.relatedDeal.id}`}
                          className="text-white hover:text-gray-200"
                        >
                          {activity.relatedDeal.title}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {activity.owner ? `${activity.owner.firstName} ${activity.owner.lastName}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
