import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealAPI, organizationAPI, contactAPI, userAPI, adminAPI } from '../lib/api';
import UserSelect from '../components/UserSelect';
import OrganizationSelect from '../components/OrganizationSelect';
import ContactMultiSelect from '../components/ContactMultiSelect';

const STAGES = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];
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

export default function DealForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const preselectedOrgId = searchParams.get('organizationId');

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  });

  const [formData, setFormData] = useState({
    title: '',
    organizationId: '',
    amount: '',
    currency: settings?.currency || 'USD',
    expectedCloseDate: '',
    stage: 'LEAD',
    probability: '50',
    ownerUserId: '',
    reasonLost: '',
  });

  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const { data: organizations } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then((r) => r.data),
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-org', formData.organizationId],
    queryFn: () => contactAPI.getAll({ organizationId: formData.organizationId, limit: 1000 }).then((r) => r.data),
    enabled: Boolean(formData.organizationId),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => dealAPI.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  // Update currency when settings load (only for new deals, not edits)
  useEffect(() => {
    if (settings?.currency && !isEdit && !deal) {
      setFormData(prev => ({
        ...prev,
        currency: settings.currency,
      }));
    }
  }, [settings, isEdit, deal]);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        organizationId: deal.organization?.id || deal.organizationId || '',
        amount: deal.amount?.toString() || '',
        currency: deal.currency || settings?.currency || 'USD',
        expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
        stage: deal.stage || 'LEAD',
        probability: deal.probability?.toString() || '50',
        ownerUserId: deal.owner?.id || deal.ownerUserId || '',
        reasonLost: deal.reasonLost || '',
      });
      if (deal.contacts) {
        setSelectedContacts(deal.contacts.map((c: any) => c.contactId));
      }
    }
  }, [deal, settings]);

  // Set preselected organization from URL parameter
  useEffect(() => {
    if (preselectedOrgId && !isEdit) {
      setFormData(prev => ({
        ...prev,
        organizationId: preselectedOrgId,
      }));
    }
  }, [preselectedOrgId, isEdit]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('DealForm - Creating deal with data:', data);
      return dealAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['organization-deals', preselectedOrgId] });
      // If created from organization page, redirect back to organization
      if (preselectedOrgId) {
        navigate(`/organizations/${preselectedOrgId}`);
      } else {
        navigate('/deals');
      }
    },
    onError: (error: any) => {
      console.error('DealForm - Create error:', error);
      console.error('DealForm - Error response:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      const validationErrors = error.response?.data?.errors;
      if (validationErrors) {
        alert('Validation errors:\n' + JSON.stringify(validationErrors, null, 2));
      } else {
        alert('Error creating deal: ' + errorMsg);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('DealForm - Updating deal with data:', data);
      return dealAPI.update(id!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      navigate(`/deals/${id}`);
    },
    onError: (error: any) => {
      console.error('DealForm - Update error:', error);
      console.error('DealForm - Error response:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      const validationErrors = error.response?.data?.errors;
      if (validationErrors) {
        alert('Validation errors:\n' + JSON.stringify(validationErrors, null, 2));
      } else {
        alert('Error updating deal: ' + errorMsg);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate reasonLost if stage is LOST
    if (formData.stage === 'LOST' && !formData.reasonLost.trim()) {
      alert('Please provide a reason for marking this deal as lost.');
      return;
    }

    const data = {
      title: formData.title,
      organizationId: formData.organizationId,
      amount: parseFloat(formData.amount) || 0,
      currency: formData.currency,
      expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate).toISOString() : undefined,
      stage: formData.stage,
      probability: parseInt(formData.probability) || 0,
      ownerUserId: formData.ownerUserId || undefined,
      reasonLost: formData.stage === 'LOST' ? formData.reasonLost.trim() : undefined,
      contactIds: selectedContacts,
    };
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isEdit && isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Deal' : 'New Deal'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <OrganizationSelect
          organizations={organizations?.data || []}
          value={formData.organizationId}
          onChange={(organizationId) => setFormData({ ...formData, organizationId })}
          label="Organization"
          required
        />

        {formData.organizationId && (
          <ContactMultiSelect
            contacts={contacts?.data || []}
            selectedContactIds={selectedContacts}
            onChange={setSelectedContacts}
            label="Associated Contacts"
            placeholder="Search contacts..."
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} - {curr.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Expected Close Date</label>
          <input
            type="date"
            name="expectedCloseDate"
            value={formData.expectedCloseDate}
            onChange={handleChange}
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Stage</label>
            <select
              name="stage"
              value={formData.stage}
              onChange={handleChange}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Probability (%)</label>
            <input
              type="number"
              name="probability"
              value={formData.probability}
              onChange={handleChange}
              min="0"
              max="100"
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {formData.stage === 'LOST' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason Lost <span className="text-red-500">*</span>
            </label>
            <textarea
              name="reasonLost"
              value={formData.reasonLost}
              onChange={handleChange}
              required={formData.stage === 'LOST'}
              rows={3}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}

        <UserSelect
          users={users?.data || []}
          value={formData.ownerUserId}
          onChange={(userId) => setFormData({ ...formData, ownerUserId: userId })}
        />

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
                navigate(`/deals/${id}`);
              } else if (preselectedOrgId) {
                navigate(`/organizations/${preselectedOrgId}`);
              } else {
                navigate('/deals');
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
