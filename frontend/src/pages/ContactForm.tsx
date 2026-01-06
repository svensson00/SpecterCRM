import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactAPI, organizationAPI, userAPI, adminAPI } from '../lib/api';
import UserSelect from '../components/UserSelect';
import OrganizationSelect from '../components/OrganizationSelect';
import RoleSelect from '../components/RoleSelect';

interface Email {
  email: string;
  isPrimary: boolean;
}

interface Phone {
  phone: string;
  type: string;
  isPrimary: boolean;
}

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const preselectedOrgId = searchParams.get('organizationId');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    contactRole: '',
    primaryOrganizationId: '',
    ownerUserId: '',
  });

  const [emails, setEmails] = useState<Email[]>([{ email: '', isPrimary: true }]);
  const [phones, setPhones] = useState<Phone[]>([{ phone: '', type: 'Mobile', isPrimary: true }]);

  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [proceedAnyway, setProceedAnyway] = useState(false);

  const { data: organizations, error: orgsError } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then((r) => {
      console.log('ContactForm - Organizations loaded:', r.data);
      return r.data;
    }),
  });

  console.log('ContactForm - organizations data:', organizations);
  console.log('ContactForm - organizations error:', orgsError);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: contactRoles } = useQuery({
    queryKey: ['contact-roles'],
    queryFn: () => adminAPI.getContactRoles().then((r) => r.data),
  });

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactAPI.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        jobTitle: contact.jobTitle || '',
        contactRole: contact.contactRole || '',
        primaryOrganizationId: contact.primaryOrganization?.id || contact.primaryOrganizationId || '',
        ownerUserId: contact.owner?.id || contact.ownerUserId || '',
      });
      if (contact.emails && contact.emails.length > 0) {
        setEmails(contact.emails);
      }
      if (contact.phones && contact.phones.length > 0) {
        setPhones(contact.phones);
      }
    }
  }, [contact]);

  // Set preselected organization from URL parameter
  useEffect(() => {
    if (preselectedOrgId && !isEdit) {
      setFormData(prev => ({
        ...prev,
        primaryOrganizationId: preselectedOrgId,
      }));
    }
  }, [preselectedOrgId, isEdit]);

  // Check for duplicates when name, email, or organization changes (debounced)
  useEffect(() => {
    if (isEdit || !formData.firstName || !formData.lastName || !formData.primaryOrganizationId) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const emailList = emails.filter(e => e.email.trim()).map(e => e.email);
        const response = await contactAPI.checkDuplicates(
          formData.firstName,
          formData.lastName,
          emailList,
          formData.primaryOrganizationId
        );
        setDuplicates(response.data || []);
        setProceedAnyway(false);
      } catch (error) {
        console.error('Error checking duplicates:', error);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.firstName, formData.lastName, formData.primaryOrganizationId, emails, isEdit]);

  const createMutation = useMutation({
    mutationFn: (data: any) => contactAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['organization-contacts', preselectedOrgId] });
      // If created from organization page, redirect back to organization
      if (preselectedOrgId) {
        navigate(`/organizations/${preselectedOrgId}`);
      } else {
        navigate('/contacts');
      }
    },
    onError: (error: any) => {
      alert('Error creating contact: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contactAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      navigate(`/contacts/${id}`);
    },
    onError: (error: any) => {
      alert('Error updating contact: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if there are duplicates and user hasn't confirmed to proceed
    if (!isEdit && duplicates.length > 0 && !proceedAnyway) {
      alert('Possible duplicates found. Please review them below and click "Proceed Anyway" if you want to create this contact.');
      return;
    }

    const data = {
      ...formData,
      emails: emails.filter((e) => e.email.trim()),
      phones: phones.filter((p) => p.phone.trim()),
    };
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addEmail = () => {
    setEmails([...emails, { email: '', isPrimary: false }]);
  };

  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, field: keyof Email, value: any) => {
    const updated = [...emails];
    if (field === 'isPrimary' && value) {
      updated.forEach((e, i) => (e.isPrimary = i === index));
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setEmails(updated);
  };

  const addPhone = () => {
    setPhones([...phones, { phone: '', type: 'Mobile', isPrimary: false }]);
  };

  const removePhone = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const updatePhone = (index: number, field: keyof Phone, value: any) => {
    const updated = [...phones];
    if (field === 'isPrimary' && value) {
      updated.forEach((p, i) => (p.isPrimary = i === index));
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPhones(updated);
  };

  if (isEdit && isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Contact' : 'New Contact'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Job Title</label>
          <input
            type="text"
            name="jobTitle"
            value={formData.jobTitle}
            onChange={handleChange}
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <RoleSelect
          roles={contactRoles || []}
          value={formData.contactRole}
          onChange={(roleName) => setFormData({ ...formData, contactRole: roleName })}
          label="Contact Role"
          placeholder="Select role..."
        />

        <OrganizationSelect
          organizations={organizations?.data || []}
          value={formData.primaryOrganizationId}
          onChange={(organizationId) => setFormData({ ...formData, primaryOrganizationId: organizationId })}
          label="Primary Organization"
          required
        />

        <div className="border-t border-dark-700 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">Email Addresses</h3>
            <button type="button" onClick={addEmail} className="text-sm text-white hover:text-gray-200 transition-colors">
              + Add Email
            </button>
          </div>
          <div className="space-y-3">
            {emails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="email"
                  value={email.email}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <label className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-md cursor-pointer">
                  <input
                    type="radio"
                    checked={email.isPrimary}
                    onChange={(e) => updateEmail(index, 'isPrimary', e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-300">Primary</span>
                </label>
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmail(index)}
                    className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-dark-700 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">Phone Numbers</h3>
            <button type="button" onClick={addPhone} className="text-sm text-white hover:text-gray-200 transition-colors">
              + Add Phone
            </button>
          </div>
          <div className="space-y-3">
            {phones.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="tel"
                  value={phone.phone}
                  onChange={(e) => updatePhone(index, 'phone', e.target.value)}
                  placeholder="+1-555-0123"
                  className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={phone.type}
                  onChange={(e) => updatePhone(index, 'type', e.target.value)}
                  className="px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="Mobile">Mobile</option>
                  <option value="Office">Office</option>
                  <option value="Home">Home</option>
                </select>
                <label className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-md cursor-pointer">
                  <input
                    type="radio"
                    checked={phone.isPrimary}
                    onChange={(e) => updatePhone(index, 'isPrimary', e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-300">Primary</span>
                </label>
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhone(index)}
                    className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <UserSelect
          users={users?.data || []}
          value={formData.ownerUserId}
          onChange={(userId) => setFormData({ ...formData, ownerUserId: userId })}
        />

        {/* Duplicate warning */}
        {!isEdit && duplicates.length > 0 && (
          <div className="border-t border-dark-700 pt-6">
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-md p-4 mb-4">
              <h3 className="text-lg font-medium text-yellow-400 mb-2">
                ⚠️ Possible Duplicates Found ({duplicates.length})
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                The following contacts may be duplicates. Review them carefully before proceeding.
              </p>

              <div className="space-y-3">
                {duplicates.map((dup: any) => (
                  <div key={dup.id} className="bg-dark-800 border border-dark-700 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Link
                          to={`/contacts/${dup.id}`}
                          className="text-primary-400 hover:text-primary-300 font-medium"
                          target="_blank"
                        >
                          {dup.firstName} {dup.lastName}
                        </Link>
                        <p className="text-xs text-gray-400 mt-1">
                          Match score: {Math.round(dup.similarityScore * 100)}% • Reason: {dup.matchReason === 'email' ? 'Email match' : 'Name similarity'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Your input:</span>
                        <div className="text-white mt-1">
                          <div><strong>Name:</strong> {formData.firstName} {formData.lastName}</div>
                          {emails.filter(e => e.email.trim()).length > 0 && (
                            <div><strong>Emails:</strong> {emails.filter(e => e.email.trim()).map(e => e.email).join(', ')}</div>
                          )}
                          {organizations?.data?.find((o: any) => o.id === formData.primaryOrganizationId) && (
                            <div><strong>Organization:</strong> {organizations.data.find((o: any) => o.id === formData.primaryOrganizationId)?.name}</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Existing:</span>
                        <div className="text-white mt-1">
                          <div><strong>Name:</strong> {dup.firstName} {dup.lastName}</div>
                          {dup.emails && dup.emails.length > 0 && (
                            <div><strong>Emails:</strong> {dup.emails.map((e: any) => e.email).join(', ')}</div>
                          )}
                          {dup.primaryOrganization && (
                            <div><strong>Organization:</strong> {dup.primaryOrganization.name}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                {!proceedAnyway ? (
                  <button
                    type="button"
                    onClick={() => setProceedAnyway(true)}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Proceed Anyway
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Ready to proceed - click Create below</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isEdit) {
                navigate(`/contacts/${id}`);
              } else if (preselectedOrgId) {
                navigate(`/organizations/${preselectedOrgId}`);
              } else {
                navigate('/contacts');
              }
            }}
            className="px-4 py-2 border border-dark-700 rounded-md text-gray-300 card hover:bg-dark-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
