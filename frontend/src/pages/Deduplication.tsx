import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface DuplicateSuggestion {
  id: string;
  entityType: 'ORGANIZATION' | 'CONTACT';
  record1Id: string;
  record2Id: string;
  similarityScore: number;
  record1Data: any;
  record2Data: any;
  status: 'PENDING' | 'MERGED' | 'DISMISSED';
  createdAt: string;
}

export default function Deduplication() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<'ORGANIZATION' | 'CONTACT'>('ORGANIZATION');
  const [detecting, setDetecting] = useState(false);

  const { data: suggestions, isLoading } = useQuery<DuplicateSuggestion[]>({
    queryKey: ['duplicates', entityType],
    queryFn: async () => {
      const res = await api.get(`/duplicates?entityType=${entityType}`);
      return res.data;
    },
  });

  const detectMutation = useMutation({
    mutationFn: async (type: 'ORGANIZATION' | 'CONTACT') => {
      const endpoint = type === 'ORGANIZATION' ? '/duplicates/detect/organizations' : '/duplicates/detect/contacts';
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      alert('Duplicate detection completed!');
      setDetecting(false);
    },
    onError: (error: any) => {
      alert('Error detecting duplicates: ' + (error.response?.data?.message || error.message));
      setDetecting(false);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ suggestionId, primaryId }: { suggestionId: string; primaryId: string }) => {
      const res = await api.post('/duplicates/merge', { suggestionId, primaryId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      alert('Records merged successfully!');
    },
    onError: (error: any) => {
      alert('Error merging records: ' + (error.response?.data?.message || error.message));
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await api.post('/duplicates/dismiss', { suggestionId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
    onError: (error: any) => {
      alert('Error dismissing suggestion: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleDetect = () => {
    if (user?.role !== 'ADMIN') {
      alert('Only admins can run duplicate detection');
      return;
    }
    setDetecting(true);
    detectMutation.mutate(entityType);
  };

  const handleMerge = (suggestion: DuplicateSuggestion, primaryId: string) => {
    if (confirm('Are you sure you want to merge these records? This action cannot be undone.')) {
      mergeMutation.mutate({ suggestionId: suggestion.id, primaryId });
    }
  };

  const handleDismiss = (suggestionId: string) => {
    dismissMutation.mutate(suggestionId);
  };

  const formatScore = (score: number) => {
    return `${(score * 100).toFixed(0)}%`;
  };

  const pendingSuggestions = suggestions?.filter((s) => s.status === 'PENDING') || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Duplicate Management</h1>
        {user?.role === 'ADMIN' && (
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {detecting ? 'Detecting...' : `Detect ${entityType === 'ORGANIZATION' ? 'Organization' : 'Contact'} Duplicates`}
          </button>
        )}
      </div>

      {/* Entity Type Filter */}
      <div className="card shadow rounded-lg p-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setEntityType('ORGANIZATION')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              entityType === 'ORGANIZATION'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            Organizations
          </button>
          <button
            onClick={() => setEntityType('CONTACT')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              entityType === 'CONTACT' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            Contacts
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : pendingSuggestions.length === 0 ? (
        <div className="card shadow rounded-lg p-8 text-center">
          <p className="text-gray-400">
            No pending duplicate suggestions found. {user?.role === 'ADMIN' && 'Click "Detect Duplicates" to scan for potential matches.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="card shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Potential Duplicate Found</h3>
                  <p className="text-sm text-gray-400">
                    Similarity: <span className="font-medium">{formatScore(suggestion.similarityScore)}</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDismiss(suggestion.id)}
                    className="px-3 py-1 text-sm border border-dark-700 rounded-md text-gray-300 hover:bg-dark-900"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Record 1 */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-white">Record A</h4>
                    <button
                      onClick={() => handleMerge(suggestion, suggestion.record1Id)}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Keep This
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {entityType === 'ORGANIZATION' ? (
                      <>
                        <div>
                          <span className="text-gray-400">Name:</span>
                          <span className="ml-2 font-medium">{suggestion.record1Data.name}</span>
                        </div>
                        {suggestion.record1Data.website && (
                          <div>
                            <span className="text-gray-400">Website:</span>
                            <span className="ml-2">{suggestion.record1Data.website}</span>
                          </div>
                        )}
                        {suggestion.record1Data.street && (
                          <div>
                            <span className="text-gray-400">Street:</span>
                            <span className="ml-2">{suggestion.record1Data.street}</span>
                          </div>
                        )}
                        {(suggestion.record1Data.city || suggestion.record1Data.zip || suggestion.record1Data.country) && (
                          <div>
                            <span className="text-gray-400">Location:</span>
                            <span className="ml-2">
                              {suggestion.record1Data.zip && `${suggestion.record1Data.zip} `}
                              {suggestion.record1Data.city}
                              {suggestion.record1Data.country && `, ${suggestion.record1Data.country}`}
                            </span>
                          </div>
                        )}
                        {suggestion.record1Data.owner && (
                          <div>
                            <span className="text-gray-400">Owner:</span>
                            <span className="ml-2">
                              {suggestion.record1Data.owner.firstName} {suggestion.record1Data.owner.lastName}
                            </span>
                          </div>
                        )}
                        {suggestion.record1Data._count && (
                          <div>
                            <span className="text-gray-400">Related Records:</span>
                            <span className="ml-2">
                              {suggestion.record1Data._count.contacts} contacts, {suggestion.record1Data._count.deals} deals, {suggestion.record1Data._count.activities} activities
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-gray-400">Name:</span>
                          <span className="ml-2 font-medium">
                            {suggestion.record1Data.firstName} {suggestion.record1Data.lastName}
                          </span>
                        </div>
                        {suggestion.record1Data.jobTitle && (
                          <div>
                            <span className="text-gray-400">Job Title:</span>
                            <span className="ml-2">{suggestion.record1Data.jobTitle}</span>
                          </div>
                        )}
                        {suggestion.record1Data.contactRole && (
                          <div>
                            <span className="text-gray-400">Role:</span>
                            <span className="ml-2">{suggestion.record1Data.contactRole}</span>
                          </div>
                        )}
                        {suggestion.record1Data.emails && suggestion.record1Data.emails.length > 0 && (
                          <div>
                            <span className="text-gray-400">Email{suggestion.record1Data.emails.length > 1 ? 's' : ''}:</span>
                            <span className="ml-2">{suggestion.record1Data.emails.map((e: any) => e.email).join(', ')}</span>
                          </div>
                        )}
                        {suggestion.record1Data.phones && suggestion.record1Data.phones.length > 0 && (
                          <div>
                            <span className="text-gray-400">Phone{suggestion.record1Data.phones.length > 1 ? 's' : ''}:</span>
                            <span className="ml-2">{suggestion.record1Data.phones.map((p: any) => `${p.phone} (${p.type})`).join(', ')}</span>
                          </div>
                        )}
                        {suggestion.record1Data.primaryOrganization && (
                          <div>
                            <span className="text-gray-400">Organization:</span>
                            <span className="ml-2">{suggestion.record1Data.primaryOrganization.name}</span>
                          </div>
                        )}
                        {suggestion.record1Data.owner && (
                          <div>
                            <span className="text-gray-400">Owner:</span>
                            <span className="ml-2">
                              {suggestion.record1Data.owner.firstName} {suggestion.record1Data.owner.lastName}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="pt-2 border-t text-xs space-y-1">
                      <div>
                        <span className="text-gray-400">Created: </span>
                        <span className="text-gray-300">{new Date(suggestion.record1Data.createdAt).toLocaleDateString('sv-SE')}</span>
                      </div>
                      {suggestion.record1Data.updatedAt && (
                        <div>
                          <span className="text-gray-400">Updated: </span>
                          <span className="text-gray-300">{new Date(suggestion.record1Data.updatedAt).toLocaleDateString('sv-SE')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Record 2 */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-white">Record B</h4>
                    <button
                      onClick={() => handleMerge(suggestion, suggestion.record2Id)}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Keep This
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {entityType === 'ORGANIZATION' ? (
                      <>
                        <div>
                          <span className="text-gray-400">Name:</span>
                          <span className="ml-2 font-medium">{suggestion.record2Data.name}</span>
                        </div>
                        {suggestion.record2Data.website && (
                          <div>
                            <span className="text-gray-400">Website:</span>
                            <span className="ml-2">{suggestion.record2Data.website}</span>
                          </div>
                        )}
                        {suggestion.record2Data.street && (
                          <div>
                            <span className="text-gray-400">Street:</span>
                            <span className="ml-2">{suggestion.record2Data.street}</span>
                          </div>
                        )}
                        {(suggestion.record2Data.city || suggestion.record2Data.zip || suggestion.record2Data.country) && (
                          <div>
                            <span className="text-gray-400">Location:</span>
                            <span className="ml-2">
                              {suggestion.record2Data.zip && `${suggestion.record2Data.zip} `}
                              {suggestion.record2Data.city}
                              {suggestion.record2Data.country && `, ${suggestion.record2Data.country}`}
                            </span>
                          </div>
                        )}
                        {suggestion.record2Data.owner && (
                          <div>
                            <span className="text-gray-400">Owner:</span>
                            <span className="ml-2">
                              {suggestion.record2Data.owner.firstName} {suggestion.record2Data.owner.lastName}
                            </span>
                          </div>
                        )}
                        {suggestion.record2Data._count && (
                          <div>
                            <span className="text-gray-400">Related Records:</span>
                            <span className="ml-2">
                              {suggestion.record2Data._count.contacts} contacts, {suggestion.record2Data._count.deals} deals, {suggestion.record2Data._count.activities} activities
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-gray-400">Name:</span>
                          <span className="ml-2 font-medium">
                            {suggestion.record2Data.firstName} {suggestion.record2Data.lastName}
                          </span>
                        </div>
                        {suggestion.record2Data.jobTitle && (
                          <div>
                            <span className="text-gray-400">Job Title:</span>
                            <span className="ml-2">{suggestion.record2Data.jobTitle}</span>
                          </div>
                        )}
                        {suggestion.record2Data.contactRole && (
                          <div>
                            <span className="text-gray-400">Role:</span>
                            <span className="ml-2">{suggestion.record2Data.contactRole}</span>
                          </div>
                        )}
                        {suggestion.record2Data.emails && suggestion.record2Data.emails.length > 0 && (
                          <div>
                            <span className="text-gray-400">Email{suggestion.record2Data.emails.length > 1 ? 's' : ''}:</span>
                            <span className="ml-2">{suggestion.record2Data.emails.map((e: any) => e.email).join(', ')}</span>
                          </div>
                        )}
                        {suggestion.record2Data.phones && suggestion.record2Data.phones.length > 0 && (
                          <div>
                            <span className="text-gray-400">Phone{suggestion.record2Data.phones.length > 1 ? 's' : ''}:</span>
                            <span className="ml-2">{suggestion.record2Data.phones.map((p: any) => `${p.phone} (${p.type})`).join(', ')}</span>
                          </div>
                        )}
                        {suggestion.record2Data.primaryOrganization && (
                          <div>
                            <span className="text-gray-400">Organization:</span>
                            <span className="ml-2">{suggestion.record2Data.primaryOrganization.name}</span>
                          </div>
                        )}
                        {suggestion.record2Data.owner && (
                          <div>
                            <span className="text-gray-400">Owner:</span>
                            <span className="ml-2">
                              {suggestion.record2Data.owner.firstName} {suggestion.record2Data.owner.lastName}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="pt-2 border-t text-xs space-y-1">
                      <div>
                        <span className="text-gray-400">Created: </span>
                        <span className="text-gray-300">{new Date(suggestion.record2Data.createdAt).toLocaleDateString('sv-SE')}</span>
                      </div>
                      {suggestion.record2Data.updatedAt && (
                        <div>
                          <span className="text-gray-400">Updated: </span>
                          <span className="text-gray-300">{new Date(suggestion.record2Data.updatedAt).toLocaleDateString('sv-SE')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-primary-500/10 rounded-md border border-primary-500/20">
                <p className="text-sm text-gray-300">
                  <strong>Note:</strong> When you merge records, all related data (deals, activities, notes) will be moved to the primary record, and the duplicate will be deleted.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
