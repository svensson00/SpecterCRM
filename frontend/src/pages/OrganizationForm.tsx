import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationAPI, userAPI } from '../lib/api';
import UserSelect from '../components/UserSelect';

export default function OrganizationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    website: '',
    street: '',
    city: '',
    zip: '',
    country: '',
    ownerUserId: '',
  });

  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const [exactMatch, setExactMatch] = useState<any>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAll().then((r) => r.data),
  });

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationAPI.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        website: organization.website || '',
        street: organization.street || '',
        city: organization.city || '',
        zip: organization.zip || '',
        country: organization.country || '',
        ownerUserId: organization.owner?.id || organization.ownerUserId || '',
      });
    }
  }, [organization]);

  // Check for exact and similar duplicates when name or website changes (debounced)
  useEffect(() => {
    if (isEdit || !formData.name || formData.name.length < 3) {
      setDuplicates([]);
      setExactMatch(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        // Check for exact match first
        const allOrgsResponse = await organizationAPI.getAll({ limit: 1000 });
        const exactMatchOrg = allOrgsResponse.data.data?.find(
          (org: any) => org.name.toLowerCase() === formData.name.toLowerCase()
        );
        setExactMatch(exactMatchOrg || null);

        // Check for similar matches (API now excludes exact matches)
        const response = await organizationAPI.checkDuplicates(formData.name, formData.website || undefined);
        setDuplicates(response.data || []);
        setProceedAnyway(false);
      } catch (error) {
        console.error('Error checking duplicates:', error);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.name, formData.website, isEdit]);

  const createMutation = useMutation({
    mutationFn: (data: any) => organizationAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      navigate('/organizations');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message;
      if (error.response?.status === 409) {
        alert('This organization name already exists. Please use a different name.');
      } else {
        alert('Error creating organization: ' + message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => organizationAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      navigate(`/organizations/${id}`);
    },
    onError: (error: any) => {
      alert('Error updating organization: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Block if exact match exists
    if (!isEdit && exactMatch) {
      alert('An organization with this exact name already exists. Please use a different name or edit the existing organization.');
      return;
    }

    // Check if there are similar duplicates and user hasn't confirmed to proceed
    if (!isEdit && duplicates.length > 0 && !proceedAnyway) {
      alert('Possible duplicates found. Please review them below and click "Proceed Anyway" if you want to create this organization.');
      return;
    }

    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Organization' : 'New Organization'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
          <input
            type="url"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://example.com"
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="border-t border-dark-700 pt-6">
          <h3 className="text-lg font-medium text-white mb-4">Address</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Street</label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ZIP Code</label>
                <input
                  type="text"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <UserSelect
          users={users?.data || []}
          value={formData.ownerUserId}
          onChange={(userId) => setFormData({ ...formData, ownerUserId: userId })}
        />

        {/* Exact match error */}
        {!isEdit && exactMatch && (
          <div className="border-t border-dark-700 pt-6">
            <div className="bg-red-900/20 border border-red-700/50 rounded-md p-4">
              <h3 className="text-lg font-medium text-red-400 mb-2">
                ❌ Organization Name Already Exists
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                An organization with this exact name already exists. You cannot create duplicate organization names.
              </p>
              <div className="bg-dark-800 border border-dark-700 rounded p-3">
                <Link
                  to={`/organizations/${exactMatch.id}`}
                  className="text-primary-400 hover:text-primary-300 font-medium"
                  target="_blank"
                >
                  {exactMatch.name} →
                </Link>
                <div className="text-sm text-gray-400 mt-2">
                  {exactMatch.website && <div>Website: {exactMatch.website}</div>}
                  {exactMatch.city && <div>City: {exactMatch.city}</div>}
                </div>
              </div>
              <p className="text-sm text-yellow-400 mt-3">
                Please use a different name or edit the existing organization.
              </p>
            </div>
          </div>
        )}

        {/* Similar matches warning */}
        {!isEdit && !exactMatch && duplicates.length > 0 && (
          <div className="border-t border-dark-700 pt-6">
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-md p-4 mb-4">
              <h3 className="text-lg font-medium text-yellow-400 mb-2">
                ⚠️ Possible Duplicates Found ({duplicates.length})
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                The following organizations may be duplicates. Review them carefully before proceeding.
              </p>

              <div className="space-y-3">
                {duplicates.map((dup: any) => (
                  <div key={dup.id} className="bg-dark-800 border border-dark-700 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Link
                          to={`/organizations/${dup.id}`}
                          className="text-primary-400 hover:text-primary-300 font-medium"
                          target="_blank"
                        >
                          {dup.name}
                        </Link>
                        <p className="text-xs text-gray-400 mt-1">
                          Match score: {Math.round(dup.similarityScore * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Your input:</span>
                        <div className="text-white mt-1">
                          <div><strong>Name:</strong> {formData.name}</div>
                          {formData.website && <div><strong>Website:</strong> {formData.website}</div>}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Existing:</span>
                        <div className="text-white mt-1">
                          <div><strong>Name:</strong> {dup.name}</div>
                          {dup.website && <div><strong>Website:</strong> {dup.website}</div>}
                          {dup.city && <div><strong>City:</strong> {dup.city}</div>}
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
            disabled={createMutation.isPending || updateMutation.isPending || (!isEdit && exactMatch !== null)}
            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/organizations/${id}` : '/organizations')}
            className="px-4 py-2 border border-dark-700 rounded-md text-gray-300 card hover:bg-dark-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
