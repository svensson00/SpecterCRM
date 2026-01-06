import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealAPI, adminAPI, contactAPI, organizationAPI, userAPI } from '../lib/api';

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
    </div>
  );
}
