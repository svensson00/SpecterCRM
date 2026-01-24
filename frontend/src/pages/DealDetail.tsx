import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealAPI, adminAPI, contactAPI, organizationAPI, userAPI, activityAPI } from '../lib/api';

const STAGES = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingOrganization, setIsEditingOrganization] = useState(false);
  const [isEditingLostReason, setIsEditingLostReason] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    expectedCloseDate: '',
    stage: 'LEAD',
    probability: '50',
    reasonLost: '',
  });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');

  // Activities filtering state
  const [activitiesFilter, setActivitiesFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [activitiesStartDate, setActivitiesStartDate] = useState<string | null>(null);
  const [activitiesEndDate, setActivitiesEndDate] = useState<string | null>(null);
  const [activitiesDateOption, setActivitiesDateOption] = useState<string>('none');
  const [showActivitiesDateInputs, setShowActivitiesDateInputs] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => dealAPI.getById(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: organizations } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then((r) => r.data),
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-org', deal?.organization?.id],
    queryFn: () => contactAPI.getAll({ organizationId: deal!.organization!.id, limit: 1000 }).then((r) => r.data),
    enabled: Boolean(deal?.organization?.id),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['deal-activities', id, activitiesFilter, activitiesStartDate, activitiesEndDate],
    queryFn: () => {
      const params: any = { limit: 1000 };
      if (activitiesFilter !== 'all') {
        params.isCompleted = activitiesFilter === 'completed';
      }
      if (activitiesStartDate) params.startDate = activitiesStartDate;
      if (activitiesEndDate) params.endDate = activitiesEndDate;
      return dealAPI.getActivities(id!, params).then(r => r.data);
    },
    enabled: !!id,
  });

  const toggleActivityCompleteMutation = useMutation({
    mutationFn: (activityId: string) => activityAPI.toggleComplete(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        amount: deal.amount?.toString() || '',
        expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
        stage: deal.stage || 'LEAD',
        probability: deal.probability?.toString() || '50',
        reasonLost: deal.reasonLost || '',
      });
      if (deal.organization) {
        setSelectedOrganizationId(deal.organization.id);
      }
      if (deal.contacts) {
        setSelectedContactIds(deal.contacts.map((dc: any) => dc.contact.id));
      }
      if (deal.owner) {
        setSelectedOwnerId(deal.owner.id);
      }
    }
  }, [deal]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => dealAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      alert('Error updating deal: ' + (error.response?.data?.message || error.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => dealAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      navigate('/deals');
    },
    onError: (error: any) => {
      alert('Error deleting deal: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: (organizationId: string) => dealAPI.update(id!, { organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      setIsEditingOrganization(false);
    },
    onError: (error: any) => {
      alert('Error updating organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateLostReasonMutation = useMutation({
    mutationFn: (reasonLost: string) => dealAPI.update(id!, { reasonLost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      setIsEditingLostReason(false);
    },
    onError: (error: any) => {
      alert('Error updating lost reason: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateContactsMutation = useMutation({
    mutationFn: (contactIds: string[]) => dealAPI.update(id!, { contactIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      setIsEditingContacts(false);
    },
    onError: (error: any) => {
      alert('Error updating contacts: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: (ownerUserId: string | null) => dealAPI.update(id!, { ownerUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsEditingOwner(false);
    },
    onError: (error: any) => {
      alert('Error updating owner: ' + (error.response?.data?.message || error.message));
    },
  });

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency || 'USD';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSave = () => {
    const data: any = {
      title: formData.title,
      amount: parseFloat(formData.amount) || 0,
      expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate).toISOString() : null,
      stage: formData.stage,
      probability: parseInt(formData.probability) || 0,
    };
    if (formData.stage === 'LOST' && formData.reasonLost) {
      data.reasonLost = formData.reasonLost;
    }
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        amount: deal.amount?.toString() || '',
        expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
        stage: deal.stage || 'LEAD',
        probability: deal.probability?.toString() || '50',
        reasonLost: deal.reasonLost || '',
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${deal?.title}"?`)) {
      deleteMutation.mutate();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveOrganization = () => {
    if (selectedOrganizationId) {
      updateOrganizationMutation.mutate(selectedOrganizationId);
    }
  };

  const handleCancelOrganization = () => {
    if (deal?.organization) {
      setSelectedOrganizationId(deal.organization.id);
    }
    setIsEditingOrganization(false);
    setOrganizationSearch('');
  };

  const handleSaveLostReason = () => {
    updateLostReasonMutation.mutate(formData.reasonLost);
  };

  const handleCancelLostReason = () => {
    setFormData({
      ...formData,
      reasonLost: deal?.reasonLost || '',
    });
    setIsEditingLostReason(false);
  };

  const handleSaveContacts = () => {
    updateContactsMutation.mutate(selectedContactIds);
  };

  const handleCancelContacts = () => {
    if (deal?.contacts) {
      setSelectedContactIds(deal.contacts.map((dc: any) => dc.contact.id));
    }
    setIsEditingContacts(false);
    setContactSearch('');
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSaveOwner = () => {
    updateOwnerMutation.mutate(selectedOwnerId || null);
  };

  const handleCancelOwner = () => {
    if (deal?.owner) {
      setSelectedOwnerId(deal.owner.id);
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

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!deal) return <div className="text-center py-12">Deal not found</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/deals" className="text-white hover:text-gray-200">
          ← Back to Deals
        </Link>
      </div>

      <div className="card shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="text-3xl font-bold bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 w-full max-w-2xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ) : (
                <h1 className="text-3xl font-bold text-white">{deal.title}</h1>
              )}
              <p className="mt-1 text-sm text-gray-400">
                Stage: <span className="font-semibold">{deal.stage}</span>
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
                        {organizations?.data
                          ?.filter((org: any) =>
                            org.name.toLowerCase().includes(organizationSearch.toLowerCase())
                          )
                          .map((org: any) => (
                            <div
                              key={org.id}
                              onClick={() => setSelectedOrganizationId(org.id)}
                              className={`px-3 py-2 cursor-pointer hover:bg-dark-900 ${
                                selectedOrganizationId === org.id ? 'bg-dark-900' : ''
                              }`}
                            >
                              <span className="text-sm text-white">{org.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveOrganization}
                        disabled={updateOrganizationMutation.isPending}
                        className="text-xs px-3 py-1 border border-transparent rounded text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateOrganizationMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelOrganization}
                        className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 card hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {deal.organization ? (
                        <Link to={`/organizations/${deal.organization.id}`} className="text-white hover:text-gray-200">
                          {deal.organization.name}
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
              <dt className="text-sm font-medium text-gray-400">Amount</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  formatCurrency(deal.amount || 0)
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Expected Close Date</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="date"
                    name="expectedCloseDate"
                    value={formData.expectedCloseDate}
                    onChange={handleChange}
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : deal.expectedCloseDate ? (
                  new Date(deal.expectedCloseDate).toLocaleDateString('sv-SE')
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Stage</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <select
                    name="stage"
                    value={formData.stage}
                    onChange={handleChange}
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                ) : (
                  deal.stage
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Probability</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="number"
                    name="probability"
                    value={formData.probability}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    placeholder="0-100"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : deal.probability !== null && deal.probability !== undefined ? (
                  `${deal.probability}%`
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            {deal.stage === 'LOST' && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Reason Lost</dt>
                <dd className="text-sm text-white col-span-2">
                  {isEditingLostReason ? (
                    <div className="space-y-3">
                      <textarea
                        name="reasonLost"
                        value={formData.reasonLost}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Why was this deal lost?"
                        className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveLostReason}
                          disabled={updateLostReasonMutation.isPending}
                          className="text-xs px-3 py-1 border border-transparent rounded text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {updateLostReasonMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelLostReason}
                          className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 card hover:bg-dark-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3">
                        {deal.reasonLost || <span className="text-gray-400">—</span>}
                      </div>
                      {isEditing && !isEditingLostReason && (
                        <button
                          onClick={() => setIsEditingLostReason(true)}
                          className="text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                        >
                          Edit Lost Reason
                        </button>
                      )}
                    </div>
                  )}
                </dd>
              </div>
            )}
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Contacts</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingContacts ? (
                  <div className="space-y-3">
                    {deal.organization ? (
                      <div>
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts..."
                          className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                        />
                        <div className="max-h-48 overflow-y-auto border border-dark-700 bg-dark-800 rounded">
                          {contacts?.data
                            ?.filter((contact: any) =>
                              `${contact.firstName} ${contact.lastName}`
                                .toLowerCase()
                                .includes(contactSearch.toLowerCase())
                            )
                            .map((contact: any) => (
                              <label
                                key={contact.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-dark-900 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedContactIds.includes(contact.id)}
                                  onChange={() => toggleContact(contact.id)}
                                  className="rounded text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-white">
                                  {contact.firstName} {contact.lastName}
                                  {contact.jobTitle && (
                                    <span className="text-gray-400"> - {contact.jobTitle}</span>
                                  )}
                                </span>
                              </label>
                            ))}
                          {contacts?.data?.length === 0 && (
                            <p className="text-sm text-gray-400 px-3 py-2">
                              No contacts found for this organization
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No organization selected</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveContacts}
                        disabled={updateContactsMutation.isPending}
                        className="text-xs px-3 py-1 border border-transparent rounded text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateContactsMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelContacts}
                        className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 card hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {deal.contacts && deal.contacts.length > 0 ? (
                        deal.contacts.map((dc: any) => (
                          <div key={dc.contact.id}>
                            <Link to={`/contacts/${dc.contact.id}`} className="text-white hover:text-gray-200">
                              {dc.contact.firstName} {dc.contact.lastName}
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
                      {deal.owner ? (
                        <span>
                          {deal.owner.firstName} {deal.owner.lastName}
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
            {deal.createdAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Created</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(deal.createdAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
            {deal.updatedAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Last Updated</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(deal.updatedAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Activities Panel */}
      <div className="card shadow overflow-hidden sm:rounded-lg mt-6">
        <div className="px-4 py-5 sm:px-6 border-b border-dark-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Activities</h2>
            <Link
              to={`/activities/new?dealId=${id}`}
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
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Contacts
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
                      {activity.organizations && activity.organizations.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
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
                        <Link
                          to={`/organizations/${activity.relatedOrganization.id}`}
                          className="text-white hover:text-gray-200"
                        >
                          {activity.relatedOrganization.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
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
