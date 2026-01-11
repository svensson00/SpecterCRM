import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactAPI, organizationAPI, userAPI, activityAPI } from '../lib/api';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingEmails, setIsEditingEmails] = useState(false);
  const [isEditingPhones, setIsEditingPhones] = useState(false);
  const [isEditingOrganization, setIsEditingOrganization] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    contactRole: '',
  });
  const [emails, setEmails] = useState<Array<{email: string; isPrimary: boolean}>>([]);
  const [phones, setPhones] = useState<Array<{phone: string; type: string; isPrimary: boolean}>>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [organizationSearch, setOrganizationSearch] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState<string>('');

  // Activities filtering state
  const [activitiesFilter, setActivitiesFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [activitiesStartDate, setActivitiesStartDate] = useState<string | null>(null);
  const [activitiesEndDate, setActivitiesEndDate] = useState<string | null>(null);
  const [activitiesDateOption, setActivitiesDateOption] = useState<string>('none');
  const [showActivitiesDateInputs, setShowActivitiesDateInputs] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactAPI.getById(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: organizations } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then(r => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['contact-activities', id, activitiesFilter, activitiesStartDate, activitiesEndDate],
    queryFn: () => {
      const params: any = { limit: 1000 };
      if (activitiesFilter !== 'all') {
        params.isCompleted = activitiesFilter === 'completed';
      }
      if (activitiesStartDate) params.startDate = activitiesStartDate;
      if (activitiesEndDate) params.endDate = activitiesEndDate;
      return contactAPI.getActivities(id!, params).then(r => r.data);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        jobTitle: contact.jobTitle || '',
        contactRole: contact.contactRole || '',
      });
      setEmails(contact.emails?.map((e: any) => ({ email: e.email, isPrimary: e.isPrimary })) || []);
      setPhones(contact.phones?.map((p: any) => ({ phone: p.phone, type: p.type || 'Mobile', isPrimary: p.isPrimary })) || []);
      setSelectedOrganizationId(contact.primaryOrganization?.id || '');
      setSelectedOwnerId(contact.owner?.id || '');
    }
  }, [contact]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => contactAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      alert('Error updating contact: ' + (error.response?.data?.message || error.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/contacts');
    },
    onError: (error: any) => {
      alert('Error deleting contact: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateEmailsMutation = useMutation({
    mutationFn: (data: any) => contactAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditingEmails(false);
    },
    onError: (error: any) => {
      alert('Error updating emails: ' + (error.response?.data?.message || error.message));
    },
  });

  const updatePhonesMutation = useMutation({
    mutationFn: (data: any) => contactAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditingPhones(false);
    },
    onError: (error: any) => {
      alert('Error updating phones: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: (data: any) => contactAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditingOrganization(false);
    },
    onError: (error: any) => {
      alert('Error updating organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: (ownerUserId: string | null) => contactAPI.update(id!, { ownerUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditingOwner(false);
    },
    onError: (error: any) => {
      alert('Error updating owner: ' + (error.response?.data?.message || error.message));
    },
  });

  const toggleActivityCompleteMutation = useMutation({
    mutationFn: (activityId: string) => activityAPI.toggleComplete(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleSaveEmails = () => {
    updateEmailsMutation.mutate({ emails: emails.filter(e => e.email.trim()) });
  };

  const handleCancelEmails = () => {
    if (contact) {
      setEmails(contact.emails?.map((e: any) => ({ email: e.email, isPrimary: e.isPrimary })) || []);
    }
    setIsEditingEmails(false);
  };

  const handleAddEmail = () => {
    setEmails([...emails, { email: '', isPrimary: false }]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index].email = value;
    setEmails(newEmails);
  };

  const handleSetPrimaryEmail = (index: number) => {
    const newEmails = emails.map((e, i) => ({
      ...e,
      isPrimary: i === index,
    }));
    setEmails(newEmails);
  };

  const handleSavePhones = () => {
    updatePhonesMutation.mutate({ phones: phones.filter(p => p.phone.trim()) });
  };

  const handleCancelPhones = () => {
    if (contact) {
      setPhones(contact.phones?.map((p: any) => ({ phone: p.phone, type: p.type || 'Mobile', isPrimary: p.isPrimary })) || []);
    }
    setIsEditingPhones(false);
  };

  const handleAddPhone = () => {
    setPhones([...phones, { phone: '', type: 'Mobile', isPrimary: false }]);
  };

  const handleRemovePhone = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const handlePhoneChange = (index: number, value: string) => {
    const newPhones = [...phones];
    newPhones[index].phone = value;
    setPhones(newPhones);
  };

  const handlePhoneTypeChange = (index: number, value: string) => {
    const newPhones = [...phones];
    newPhones[index].type = value;
    setPhones(newPhones);
  };

  const handleSetPrimaryPhone = (index: number) => {
    const newPhones = phones.map((p, i) => ({
      ...p,
      isPrimary: i === index,
    }));
    setPhones(newPhones);
  };

  const handleSaveOrganization = () => {
    updateOrganizationMutation.mutate({ primaryOrganizationId: selectedOrganizationId || null });
  };

  const handleCancelOrganization = () => {
    if (contact) {
      setSelectedOrganizationId(contact.primaryOrganization?.id || '');
    }
    setOrganizationSearch('');
    setIsEditingOrganization(false);
  };

  const handleSaveOwner = () => {
    updateOwnerMutation.mutate(selectedOwnerId || null);
  };

  const handleCancelOwner = () => {
    if (contact?.owner) {
      setSelectedOwnerId(contact.owner.id);
    } else {
      setSelectedOwnerId('');
    }
    setOwnerSearch('');
    setIsEditingOwner(false);
  };

  const handleCancel = () => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        jobTitle: contact.jobTitle || '',
        contactRole: contact.contactRole || '',
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${contact?.firstName} ${contact?.lastName}"?`)) {
      deleteMutation.mutate();
    }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!contact) return <div className="text-center py-12">Contact not found</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/contacts" className="text-white hover:text-gray-200">
          ← Back to Contacts
        </Link>
      </div>

      <div className="card shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2 max-w-2xl">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First Name"
                    className="text-3xl font-bold bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className="text-3xl font-bold bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <h1 className="text-3xl font-bold text-white">
                  {contact.firstName} {contact.lastName}
                </h1>
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
              <dt className="text-sm font-medium text-gray-400">Job Title</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    placeholder="Job Title"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : contact.jobTitle || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Contact Role</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="contactRole"
                    value={formData.contactRole}
                    onChange={handleChange}
                    placeholder="Contact Role"
                    className="block w-full bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : contact.contactRole || <span className="text-gray-400">—</span>}
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
                      {contact.primaryOrganization ? (
                        <Link to={`/organizations/${contact.primaryOrganization.id}`} className="text-white hover:text-gray-200">
                          {contact.primaryOrganization.name}
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
              <dt className="text-sm font-medium text-gray-400">Email</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingEmails ? (
                  <div className="space-y-3">
                    {emails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="email"
                          value={email.email}
                          onChange={(e) => handleEmailChange(index, e.target.value)}
                          placeholder="email@example.com"
                          className="flex-1 bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input
                            type="radio"
                            name="primaryEmail"
                            checked={email.isPrimary}
                            onChange={() => handleSetPrimaryEmail(index)}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          Primary
                        </label>
                        <button
                          onClick={() => handleRemoveEmail(index)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddEmail}
                        className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        + Add Email
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveEmails}
                        disabled={updateEmailsMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updateEmailsMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEmails}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {contact.emails && contact.emails.length > 0 ? (
                      contact.emails.map((e: any) => (
                        <div key={e.id}>
                          <a href={`mailto:${e.email}`} className="text-white hover:text-gray-200">
                            {e.email}
                          </a>
                          {e.isPrimary && ' (Primary)'}
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {isEditing && !isEditingEmails && (
                      <button
                        onClick={() => {
                          if (emails.length === 0) {
                            setEmails([{ email: '', isPrimary: true }]);
                          }
                          setIsEditingEmails(true);
                        }}
                        className="mt-2 text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Emails
                      </button>
                    )}
                  </div>
                )}
              </dd>
            </div>
            <div className="py-2 px-6 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-400">Phone</dt>
              <dd className="text-sm text-white col-span-2">
                {isEditingPhones ? (
                  <div className="space-y-3">
                    {phones.map((phone, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={phone.phone}
                          onChange={(e) => handlePhoneChange(index, e.target.value)}
                          placeholder="+1234567890"
                          className="flex-1 bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <select
                          value={phone.type}
                          onChange={(e) => handlePhoneTypeChange(index, e.target.value)}
                          className="bg-dark-800 border border-dark-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="Mobile">Mobile</option>
                          <option value="Work">Work</option>
                          <option value="Home">Home</option>
                          <option value="Other">Other</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input
                            type="radio"
                            name="primaryPhone"
                            checked={phone.isPrimary}
                            onChange={() => handleSetPrimaryPhone(index)}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          Primary
                        </label>
                        <button
                          onClick={() => handleRemovePhone(index)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddPhone}
                        className="text-xs px-3 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        + Add Phone
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSavePhones}
                        disabled={updatePhonesMutation.isPending}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updatePhonesMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelPhones}
                        className="px-3 py-1 text-xs border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {contact.phones && contact.phones.length > 0 ? (
                      contact.phones.map((p: any) => (
                        <div key={p.id}>
                          <a href={`tel:${p.phone}`} className="text-white hover:text-gray-200">
                            {p.phone}
                          </a>
                          {p.type && ` (${p.type})`}
                          {p.isPrimary && ' (Primary)'}
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {isEditing && !isEditingPhones && (
                      <button
                        onClick={() => {
                          if (phones.length === 0) {
                            setPhones([{ phone: '', type: 'Mobile', isPrimary: true }]);
                          }
                          setIsEditingPhones(true);
                        }}
                        className="mt-2 text-xs px-2 py-1 border border-dark-700 rounded text-gray-300 hover:bg-dark-900"
                      >
                        Edit Phones
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
                      {contact.owner ? (
                        <span>
                          {contact.owner.firstName} {contact.owner.lastName}
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
            {contact.createdAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Created</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(contact.createdAt).toLocaleString('sv-SE')}
                </dd>
              </div>
            )}
            {contact.updatedAt && (
              <div className="py-2 px-6 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-400">Last Updated</dt>
                <dd className="text-sm text-white col-span-2">
                  {new Date(contact.updatedAt).toLocaleString('sv-SE')}
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
              to={`/activities/new?contactId=${id}`}
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
                      {activity.relatedOrganization ? (
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
