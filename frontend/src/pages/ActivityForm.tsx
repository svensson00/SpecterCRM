import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityAPI, organizationAPI, contactAPI, dealAPI, userAPI, adminAPI } from '../lib/api';
import UserSelect from '../components/UserSelect';
import OrganizationSelect from '../components/OrganizationSelect';
import ContactMultiSelect from '../components/ContactMultiSelect';
import DealSelect from '../components/DealSelect';

export default function ActivityForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Generate default date/time (current date and time) for new activities
  const getDefaultDueAt = () => {
    if (isEdit) return '';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    type: 'Call',
    subject: '',
    description: '',
    dueAt: getDefaultDueAt(),
    relatedOrganizationId: '',
    relatedDealId: '',
    ownerUserId: '',
  });

  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const { data: activityTypes } = useQuery({
    queryKey: ['activity-types'],
    queryFn: () => adminAPI.getActivityTypes().then((r) => r.data),
  });

  const { data: organizations, error: orgsError } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => organizationAPI.getAll({ limit: 1000 }).then((r) => {
      console.log('ActivityForm - Organizations loaded:', r.data);
      return r.data;
    }),
  });

  console.log('ActivityForm - organizations data:', organizations);
  console.log('ActivityForm - organizations error:', orgsError);

  const { data: deals } = useQuery({
    queryKey: ['deals-for-org', formData.relatedOrganizationId],
    queryFn: () => dealAPI.getAll({ organizationId: formData.relatedOrganizationId, limit: 1000 }).then((r) => r.data),
    enabled: Boolean(formData.relatedOrganizationId),
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-org-activity', formData.relatedOrganizationId],
    queryFn: () => contactAPI.getAll({ organizationId: formData.relatedOrganizationId, limit: 1000 }).then((r) => r.data),
    enabled: Boolean(formData.relatedOrganizationId),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activityAPI.getById(id!).then((r) => r.data),
    enabled: isEdit,
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
        type: activity.type || 'Call',
        subject: activity.subject || '',
        description: activity.description || '',
        dueAt,
        relatedOrganizationId: activity.relatedOrganizationId || '',
        relatedDealId: activity.relatedDealId || '',
        ownerUserId: activity.ownerUserId || '',
      });
      if (activity.contacts) {
        setSelectedContacts(activity.contacts.map((c: any) => c.contactId));
      }
    }
  }, [activity]);

  const createMutation = useMutation({
    mutationFn: (data: any) => activityAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      navigate('/activities');
    },
    onError: (error: any) => {
      alert('Error creating activity: ' + (error.response?.data?.message || error.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => activityAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      navigate('/activities');
    },
    onError: (error: any) => {
      console.error('Update error:', error.response?.data);
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      alert('Error updating activity: ' + message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      type: formData.type,
      subject: formData.subject,
      description: formData.description || '',
      contactIds: selectedContacts.length > 0 ? selectedContacts : [],
    };

    // Convert datetime-local format to ISO 8601
    if (formData.dueAt) {
      data.dueAt = new Date(formData.dueAt).toISOString();
    }

    if (formData.relatedOrganizationId) {
      data.relatedOrganizationId = formData.relatedOrganizationId;
    }
    if (formData.relatedDealId) {
      data.relatedDealId = formData.relatedDealId;
    }
    if (formData.ownerUserId) {
      data.ownerUserId = formData.ownerUserId;
    }

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  if (isEdit && isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const activeTypes = activityTypes?.filter((t: any) => t.isActive) || [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Activity' : 'New Activity'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {activeTypes.map((type: any) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Due Date and Time</label>
            <input
              type="datetime-local"
              name="dueAt"
              value={formData.dueAt}
              onChange={handleChange}
              className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-white mb-4">Related Records</h3>

          <div className="space-y-4">
            <OrganizationSelect
              organizations={organizations?.data || []}
              value={formData.relatedOrganizationId}
              onChange={(organizationId) => setFormData({ ...formData, relatedOrganizationId: organizationId })}
              label="Organization"
              placeholder="None"
            />

            {formData.relatedOrganizationId && (
              <>
                <DealSelect
                  deals={deals?.data || []}
                  value={formData.relatedDealId}
                  onChange={(dealId) => setFormData({ ...formData, relatedDealId: dealId })}
                  label="Deal"
                  placeholder="None"
                />

                <ContactMultiSelect
                  contacts={contacts?.data || []}
                  selectedContactIds={selectedContacts}
                  onChange={setSelectedContacts}
                  label="Contacts"
                  placeholder="Search contacts..."
                />
              </>
            )}
          </div>
        </div>

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
            onClick={() => navigate(isEdit ? `/activities/${id}` : '/activities')}
            className="px-4 py-2 border border-dark-700 rounded-md text-gray-300 card hover:bg-dark-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
