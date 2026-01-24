import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityAPI, adminAPI, organizationAPI, dealAPI, contactAPI, userAPI } from '../lib/api';

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingOrganization, setIsEditingOrganization] = useState(false);
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    type: '',
    description: '',
    dueAt: '',
    isCompleted: false,
  });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<string[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [organizationSearch, setOrganizationSearch] = useState<string>('');
  const [dealSearch, setDealSearch] = useState<string>('');
  const [contactSearch, setContactSearch] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState<string>('');

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activityAPI.getById(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: activityTypes } = useQuery({
    queryKey: ['activity-types'],
    queryFn: () => adminAPI.getActivityTypes().then(r => r.data),
  });

  const { data: organizations } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then(r => r.data),
  });

  // Fetch deals for all selected organizations
  const { data: deals } = useQuery({
    queryKey: ['deals-for-orgs-detail', selectedOrganizationIds],
    queryFn: async () => {
      if (selectedOrganizationIds.length === 0) return { data: [] };
      const allDeals: any[] = [];
      const seenIds = new Set();
      for (const orgId of selectedOrganizationIds) {
        const response = await dealAPI.getAll({ organizationId: orgId, limit: 1000 });
        for (const deal of response.data.data || []) {
          if (!seenIds.has(deal.id)) {
            seenIds.add(deal.id);
            allDeals.push(deal);
          }
        }
      }
      return { data: allDeals };
    },
    enabled: selectedOrganizationIds.length > 0,
  });

  // Fetch contacts for all selected organizations
  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-orgs-detail', selectedOrganizationIds],
    queryFn: async () => {
      if (selectedOrganizationIds.length === 0) return { data: [] };
      const allContacts: any[] = [];
      const seenIds = new Set();
      for (const orgId of selectedOrganizationIds) {
        const response = await contactAPI.getAll({ organizationId: orgId, limit: 1000 });
        for (const contact of response.data.data || []) {
          if (!seenIds.has(contact.id)) {
            seenIds.add(contact.id);
            allContacts.push(contact);
          }
        }
      }
      return { data: allContacts };
    },
    enabled: selectedOrganizationIds.length > 0,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then(r => r.data),
  });

  useEffect(() => {
    if (activity) {
      let dueAt = '';
      if (activity.dueAt) {
        const date = new Date(activity.dueAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        dueAt = `${year}-${month}-${day}T${hours}:${minutes}`;
      }

      setFormData({
        subject: activity.subject || '',
        type: activity.type || '',
        description: activity.description || '',
        dueAt,
        isCompleted: activity.isCompleted || false,
      });

      setSelectedOrganizationId(activity.relatedOrganizationId || '');
      // Load organization IDs from organizations array or fall back to legacy single org
      if (activity.organizations && activity.organizations.length > 0) {
        setSelectedOrganizationIds(activity.organizations.map((o: any) => o.organizationId));
      } else if (activity.relatedOrganizationId) {
        setSelectedOrganizationIds([activity.relatedOrganizationId]);
      } else {
        setSelectedOrganizationIds([]);
      }
      setSelectedDealId(activity.relatedDealId || '');
      setSelectedContactIds(activity.contacts?.map((c: any) => c.contactId) || []);
      setSelectedOwnerId(activity.ownerUserId || '');
    }
  }, [activity]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      alert('Error updating activity: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsEditingOrganization(false);
    },
    onError: (error: any) => {
      alert('Error updating organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsEditingDeal(false);
    },
    onError: (error: any) => {
      alert('Error updating deal: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateContactsMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsEditingContacts(false);
    },
    onError: (error: any) => {
      alert('Error updating contacts: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsEditingOwner(false);
    },
    onError: (error: any) => {
      alert('Error updating owner: ' + (error.response?.data?.message || error.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => activityAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      navigate('/activities');
    },
    onError: (error: any) => {
      alert('Error deleting activity: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSave = () => {
    const data: any = {
      subject: formData.subject,
      type: formData.type,
      description: formData.description,
      isCompleted: formData.isCompleted,
    };

    if (formData.dueAt) {
      data.dueAt = new Date(formData.dueAt).toISOString();
    }

    updateMutation.mutate(data);
  };

  const handleSaveOrganization = () => {
    updateOrganizationMutation.mutate({ relatedOrganizationId: selectedOrganizationId || null });
  };

  const handleCancelOrganization = () => {
    if (activity) {
      setSelectedOrganizationId(activity.relatedOrganizationId || '');
    }
    setOrganizationSearch('');
    setIsEditingOrganization(false);
  };

  const handleSaveDeal = () => {
    updateDealMutation.mutate({ relatedDealId: selectedDealId || null });
  };

  const handleCancelDeal = () => {
    if (activity) {
      setSelectedDealId(activity.relatedDealId || '');
    }
    setDealSearch('');
    setIsEditingDeal(false);
  };

  const handleSaveContacts = () => {
    updateContactsMutation.mutate({ contactIds: selectedContactIds });
  };

  const handleCancelContacts = () => {
    if (activity) {
      setSelectedContactIds(activity.contacts?.map((c: any) => c.contactId) || []);
    }
    setContactSearch('');
    setIsEditingContacts(false);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSaveOwner = () => {
    updateOwnerMutation.mutate({ ownerUserId: selectedOwnerId || null });
  };

  const handleCancelOwner = () => {
    if (activity) {
      setSelectedOwnerId(activity.ownerUserId || '');
    }
    setOwnerSearch('');
    setIsEditingOwner(false);
  };

  const handleCancel = () => {
    if (activity) {
      let dueAt = '';
      if (activity.dueAt) {
        const date = new Date(activity.dueAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        dueAt = `${year}-${month}-${day}T${hours}:${minutes}`;
      }

      setFormData({
        subject: activity.subject || '',
        type: activity.type || '',
        description: activity.description || '',
        dueAt,
        isCompleted: activity.isCompleted || false,
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${activity?.subject}"?`)) {
      deleteMutation.mutate();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!activity) return <div className="text-center py-12">Activity not found</div>;

  const activeTypes = activityTypes?.filter((t: any) => t.isActive) || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/activities" className="text-white hover:text-gray-200">
          ← Back to Activities
        </Link>
      </div>

      <div className="card shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Subject"
                  className="text-3xl font-bold bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 w-full max-w-2xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ) : (
                <h1 className="text-3xl font-bold text-white">{activity.subject}</h1>
              )}
              <p className="mt-1 text-sm text-gray-400">
                Type: <span className="font-semibold">{activity.type}</span>
                {activity.isCompleted && (
                  <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    Completed
                  </span>
                )}
              </p>
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
              <dt className="text-sm font-medium text-gray-400">Type</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {activeTypes.map((type: any) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  activity.type
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Description</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Description"
                    rows={4}
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : activity.description ? (
                  <span className="whitespace-pre-wrap">{activity.description}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Due Date</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="datetime-local"
                    name="dueAt"
                    value={formData.dueAt}
                    onChange={handleChange}
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : activity.dueAt ? (
                  new Date(activity.dueAt).toLocaleString('sv-SE')
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Status</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isCompleted"
                      checked={formData.isCompleted}
                      onChange={handleChange}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span>Mark as completed</span>
                  </label>
                ) : (
                  activity.isCompleted ? 'Completed' : 'Pending'
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Organization</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingOrganization ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={organizationSearch}
                        onChange={(e) => setOrganizationSearch(e.target.value)}
                        placeholder="Search organizations..."
                        className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto border border-dark-700 bg-dark-800 rounded">
                        <div
                          onClick={() => setSelectedOrganizationId('')}
                          className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                            selectedOrganizationId === '' ? 'bg-primary-600/20 text-primary-400' : ''
                          }`}
                        >
                          No organization
                        </div>
                        {organizations?.data
                          ?.filter((org: any) =>
                            org.name.toLowerCase().includes(organizationSearch.toLowerCase())
                          )
                          .map((org: any) => (
                            <div
                              key={org.id}
                              onClick={() => setSelectedOrganizationId(org.id)}
                              className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                                selectedOrganizationId === org.id ? 'bg-primary-600/20 text-primary-400' : ''
                              }`}
                            >
                              {org.name}
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveOrganization}
                        disabled={updateOrganizationMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateOrganizationMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelOrganization}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {activity.organizations && activity.organizations.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {activity.organizations.map((ao: any) => (
                            <Link
                              key={ao.organizationId}
                              to={`/organizations/${ao.organizationId}`}
                              className="text-white hover:text-gray-200"
                            >
                              {ao.organization?.name}
                            </Link>
                          ))}
                        </div>
                      ) : activity.relatedOrganization ? (
                        <Link to={`/organizations/${activity.relatedOrganization.id}`} className="text-white hover:text-gray-200">
                          {activity.relatedOrganization.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    {isEditing && !isEditingOrganization && (
                      <button
                        onClick={() => setIsEditingOrganization(true)}
                        className="text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Organization
                      </button>
                    )}
                  </div>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Deal</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingDeal ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={dealSearch}
                        onChange={(e) => setDealSearch(e.target.value)}
                        placeholder="Search deals..."
                        className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto border border-dark-700 bg-dark-800 rounded">
                        <div
                          onClick={() => setSelectedDealId('')}
                          className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                            selectedDealId === '' ? 'bg-primary-600/20 text-primary-400' : ''
                          }`}
                        >
                          No deal
                        </div>
                        {(selectedOrganizationIds.length > 0 ? deals?.data : [])
                          ?.filter((deal: any) =>
                            deal.title.toLowerCase().includes(dealSearch.toLowerCase())
                          )
                          .map((deal: any) => (
                            <div
                              key={deal.id}
                              onClick={() => setSelectedDealId(deal.id)}
                              className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                                selectedDealId === deal.id ? 'bg-primary-600/20 text-primary-400' : ''
                              }`}
                            >
                              {deal.title}
                            </div>
                          ))}
                      </div>
                      {selectedOrganizationIds.length === 0 && (
                        <p className="text-xs text-gray-400 mt-2">Select an organization first to see deals</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDeal}
                        disabled={updateDealMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateDealMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelDeal}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {activity.relatedDeal ? (
                        <Link to={`/deals/${activity.relatedDeal.id}`} className="text-white hover:text-gray-200">
                          {activity.relatedDeal.title}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    {isEditing && !isEditingDeal && (
                      <button
                        onClick={() => setIsEditingDeal(true)}
                        className="text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Deal
                      </button>
                    )}
                  </div>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Contacts</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingContacts ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search contacts..."
                        className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto border border-dark-700 bg-dark-800 rounded">
                        {(selectedOrganizationIds.length > 0 ? contacts?.data : [])
                          ?.filter((contact: any) =>
                            `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(contactSearch.toLowerCase())
                          )
                          .map((contact: any) => (
                            <label key={contact.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-900">
                              <input
                                type="checkbox"
                                checked={selectedContactIds.includes(contact.id)}
                                onChange={() => toggleContact(contact.id)}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm">
                                {contact.firstName} {contact.lastName}
                              </span>
                            </label>
                          ))}
                      </div>
                      {selectedOrganizationIds.length === 0 && (
                        <p className="text-xs text-gray-400 mt-2">Select an organization first to see contacts</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveContacts}
                        disabled={updateContactsMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateContactsMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelContacts}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {activity.contacts && activity.contacts.length > 0 ? (
                        activity.contacts.map((ac: any) => (
                          <div key={ac.contactId}>
                            <Link to={`/contacts/${ac.contactId}`} className="text-white hover:text-gray-200">
                              {ac.contact?.firstName} {ac.contact?.lastName}
                            </Link>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    {isEditing && !isEditingContacts && (
                      <button
                        onClick={() => setIsEditingContacts(true)}
                        className="text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Contacts
                      </button>
                    )}
                  </div>
                )}
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
                          className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                            selectedOwnerId === '' ? 'bg-primary-600/20 text-primary-400' : ''
                          }`}
                        >
                          No owner
                        </div>
                        {users?.data
                          ?.filter((user: any) =>
                            `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(ownerSearch.toLowerCase())
                          )
                          .map((user: any) => (
                            <div
                              key={user.id}
                              onClick={() => setSelectedOwnerId(user.id)}
                              className={`px-3 py-2 cursor-pointer hover:bg-dark-900 text-sm ${
                                selectedOwnerId === user.id ? 'bg-primary-600/20 text-primary-400' : ''
                              }`}
                            >
                              {user.firstName} {user.lastName} ({user.email})
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveOwner}
                        disabled={updateOwnerMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateOwnerMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelOwner}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {activity.owner ? (
                        <span>{activity.owner.firstName} {activity.owner.lastName}</span>
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
            {activity.createdAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Created</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(activity.createdAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
            {activity.updatedAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Last Updated</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(activity.updatedAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
