import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface UploadedFile {
  filename: string;
  size: number;
  uploadedAt: string;
}

interface ImportJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  clearExisting: boolean;
  currentFile: string | null;
  filesProcessed: number;
  totalFiles: number;
  recordsImported: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function Import() {
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const [clearExisting, setClearExisting] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [logs, setLogs] = useState<string>('');

  // Fetch uploaded files
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['import-files'],
    queryFn: () => api.get('/import/files').then(r => r.data),
  });

  // Poll for current job status
  const { data: currentJob } = useQuery({
    queryKey: ['import-job', currentJobId],
    queryFn: () => api.get(`/import/jobs/${currentJobId}`).then(r => r.data.job),
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const job = query.state.data as ImportJob | undefined;
      // Poll every 2 seconds while running, stop when completed or failed
      return job?.status === 'RUNNING' || job?.status === 'PENDING' ? 2000 : false;
    },
  });

  // Fetch import history
  const { data: historyData } = useQuery({
    queryKey: ['import-history'],
    queryFn: () => api.get('/import/jobs').then(r => r.data),
  });

  // Clear job ID when job completes or fails
  useEffect(() => {
    if (currentJob && (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED')) {
      // Refresh data after completion
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['deals'] });
        queryClient.invalidateQueries({ queryKey: ['import-history'] });
      }, 1000);
    }
  }, [currentJob, queryClient]);

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      setUploadProgress('Uploading files...');
      const response = await api.post('/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      setUploadProgress('Files uploaded successfully!');
      setSelectedFiles(null);
      queryClient.invalidateQueries({ queryKey: ['import-files'] });
      // Clear the file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: (error: any) => {
      setUploadProgress(`Upload failed: ${error.response?.data?.error || error.message}`);
    },
  });

  // Trigger import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      setImportStatus('Starting import...');
      // Get current tenant ID from user data
      const userResponse = await api.get('/auth/me');
      const tenantId = userResponse.data.tenantId;

      const response = await api.post('/import/trigger', { tenantId, clearExisting });
      return response.data;
    },
    onSuccess: (data) => {
      setImportStatus('');
      setCurrentJobId(data.importJobId); // Start polling this job
    },
    onError: (error: any) => {
      setImportStatus(`Import failed: ${error.response?.data?.error || error.message}`);
    },
  });

  // Clear files mutation
  const clearMutation = useMutation({
    mutationFn: () => api.delete('/import/files'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-files'] });
      setUploadProgress('Files cleared');
    },
    onError: (error: any) => {
      alert('Error clearing files: ' + (error.response?.data?.error || error.message));
    },
  });

  const validateFilenames = (files: FileList): { valid: boolean; message: string } => {
    const validNames = ['Organizations.csv', 'Contacts.csv', 'Deals.csv', 'Activities.csv'];
    const uploadedNames = Array.from(files).map(f => f.name);
    const invalidFiles = uploadedNames.filter(name => !validNames.includes(name));

    if (invalidFiles.length > 0) {
      return {
        valid: false,
        message: `Invalid filename(s): ${invalidFiles.join(', ')}. Files must be named exactly: ${validNames.join(', ')}`
      };
    }

    return { valid: true, message: '' };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validation = validateFilenames(e.target.files);

      if (!validation.valid) {
        setUploadProgress(validation.message);
        setSelectedFiles(null);
        e.target.value = ''; // Clear the input
        return;
      }

      setSelectedFiles(e.target.files);
      setUploadProgress('');
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleImport = () => {
    let confirmMessage = 'Are you sure you want to start the import? This will import all uploaded CSV files into your CRM.';

    if (clearExisting) {
      confirmMessage = '⚠️ WARNING: You have selected to CLEAR ALL EXISTING DATA before import.\n\n' +
        'This will PERMANENTLY DELETE:\n' +
        '- All organizations\n' +
        '- All contacts\n' +
        '- All deals\n' +
        '- All activities\n' +
        '- All notes\n' +
        '- All audit logs\n\n' +
        'This action CANNOT be undone!\n\n' +
        'Are you absolutely sure you want to proceed?';
    }

    if (confirm(confirmMessage)) {
      importMutation.mutate();
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all uploaded files?')) {
      clearMutation.mutate();
    }
  };

  const handleViewLogs = async (jobId: string) => {
    try {
      const response = await api.get(`/import/jobs/${jobId}/logs`);
      setLogs(response.data.logs);
      setShowLogs(true);
    } catch (error: any) {
      alert('Failed to fetch logs: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const files = filesData?.files || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Data Import</h1>
          <p className="mt-2 text-sm text-gray-400">
            Upload CSV files from SuiteCRM and import them into your CRM
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Export your data from SuiteCRM as CSV files (UTF-8 encoding)</li>
          <li>
            <strong className="text-white">Rename files to match these exact names:</strong>
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-xs font-mono">
              <li className="text-green-400">Organizations.csv</li>
              <li className="text-green-400">Contacts.csv</li>
              <li className="text-green-400">Deals.csv</li>
              <li className="text-green-400">Activities.csv</li>
            </ul>
          </li>
          <li>Upload the CSV files using the form below</li>
          <li>Review the uploaded files list (ensure all required files are present)</li>
          <li>Click "Start Import" to begin the import process</li>
          <li>Wait for the import to complete (may take several minutes)</li>
          <li>Verify your data in the Organizations, Contacts, and Deals pages</li>
        </ol>
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <p className="text-sm text-yellow-400">
            <strong>Important:</strong> File names are case-sensitive and must match exactly. The import will fail if files are named incorrectly.
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Upload CSV Files</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select CSV Files
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-300
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary-600 file:text-white
                hover:file:bg-primary-700
                file:cursor-pointer
                cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-400">
              Files must be named: <span className="font-mono text-green-400">Organizations.csv</span>, <span className="font-mono text-green-400">Contacts.csv</span>, <span className="font-mono text-green-400">Deals.csv</span>, <span className="font-mono text-green-400">Activities.csv</span>
            </p>
          </div>

          {selectedFiles && (
            <div className="text-sm text-gray-300">
              <p className="font-medium mb-1">Selected files:</p>
              <ul className="list-disc list-inside">
                {Array.from(selectedFiles).map((file, index) => (
                  <li key={index}>{file.name} ({formatFileSize(file.size)})</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={!selectedFiles || uploadMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>

          {uploadProgress && (
            <div className={`p-3 rounded-md ${uploadProgress.includes('failed') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {uploadProgress}
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files List */}
      <div className="card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Uploaded Files</h2>
          {files.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearMutation.isPending}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Clear All
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <>
            {/* Required files checklist */}
            <div className="mb-4 p-3 bg-dark-800 rounded-md">
              <p className="text-xs font-medium text-gray-400 mb-2">Required files:</p>
              <div className="grid grid-cols-2 gap-2">
                {['Organizations.csv', 'Contacts.csv', 'Deals.csv', 'Activities.csv'].map(requiredFile => {
                  const isUploaded = files.some((f: UploadedFile) => f.filename === requiredFile);
                  return (
                    <div key={requiredFile} className="flex items-center gap-2 text-xs">
                      {isUploaded ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-500">○</span>
                      )}
                      <span className={`font-mono ${isUploaded ? 'text-green-400' : 'text-gray-500'}`}>
                        {requiredFile}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {files.length > 0 ? (
              <div className="space-y-2">
                {files.map((file: UploadedFile, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-dark-800 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-white">{file.filename}</p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No files uploaded yet</p>
            )}
          </>
        )}
      </div>

      {/* Import Section */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Start Import</h2>

        {files.length > 0 ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-400">
                <strong>Warning:</strong> The import process will run in the background and may take several minutes.
                Make sure all required CSV files are uploaded before starting.
              </p>
            </div>

            {/* Clear existing data option */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-600 bg-dark-700 text-red-600 focus:ring-red-500 focus:ring-offset-dark-800"
                />
                <div>
                  <span className="text-sm font-medium text-red-400">
                    Clear all existing data before import (DESTRUCTIVE!)
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    This will permanently delete all organizations, contacts, deals, activities, and notes before importing new data.
                  </p>
                </div>
              </label>

              {clearExisting && (
                <div className="p-4 bg-red-500/20 border-2 border-red-500 rounded-md">
                  <p className="text-sm font-bold text-red-400 mb-2">
                    ⚠️ DANGER: ALL EXISTING DATA WILL BE DELETED
                  </p>
                  <p className="text-xs text-red-300">
                    You have enabled the "clear existing data" option. When you start the import, ALL of your current data will be permanently deleted before the new data is imported. This includes:
                  </p>
                  <ul className="text-xs text-red-300 list-disc list-inside mt-2 space-y-1">
                    <li>All organizations and their data</li>
                    <li>All contacts and their emails/phones</li>
                    <li>All deals and their history</li>
                    <li>All activities and notes</li>
                    <li>All audit logs</li>
                  </ul>
                  <p className="text-xs text-red-300 font-bold mt-2">
                    This action CANNOT be undone. Make sure you have a backup!
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={importMutation.isPending || (currentJob?.status === 'RUNNING' || currentJob?.status === 'PENDING')}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? 'Starting Import...' : 'Start Import'}
            </button>

            {/* Import progress indicator */}
            {currentJob && (currentJob.status === 'RUNNING' || currentJob.status === 'PENDING') && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-blue-400">
                    Import in progress...
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span className="text-xs text-blue-400">
                      {currentJob.filesProcessed} / {currentJob.totalFiles} files
                    </span>
                  </div>
                </div>
                {currentJob.currentFile && (
                  <p className="text-xs text-gray-400 mb-2">
                    Processing: <span className="font-mono text-blue-300">{currentJob.currentFile}</span>
                  </p>
                )}
                <div className="w-full bg-dark-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentJob.filesProcessed / currentJob.totalFiles) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Records imported: <span className="font-semibold text-blue-300">{currentJob.recordsImported}</span>
                </p>
                <button
                  onClick={() => handleViewLogs(currentJob.id)}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  View Debug Logs
                </button>
              </div>
            )}

            {/* Completion/Error messages */}
            {currentJob?.status === 'COMPLETED' && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm font-medium text-green-400 mb-1">
                  ✓ Import completed successfully!
                </p>
                <p className="text-xs text-gray-400">
                  Total records imported: <span className="font-semibold text-green-300">{currentJob.recordsImported}</span>
                </p>
                <button
                  onClick={() => setCurrentJobId(null)}
                  className="mt-2 text-xs text-green-400 hover:text-green-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {currentJob?.status === 'FAILED' && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md">
                <p className="text-sm font-medium text-red-400 mb-1">
                  ✗ Import failed
                </p>
                <p className="text-xs text-red-300">
                  {currentJob.errorMessage || 'An unknown error occurred'}
                </p>
                <button
                  onClick={() => setCurrentJobId(null)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {importStatus && (
              <div className={`p-4 rounded-md ${importStatus.includes('failed') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                {importStatus}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Upload CSV files first before starting the import</p>
        )}
      </div>

      {/* Log Viewer Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">Import Logs</h2>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                {logs || 'No logs available'}
              </pre>
            </div>
            <div className="p-4 border-t border-dark-700 flex justify-end">
              <button
                onClick={() => setShowLogs(false)}
                className="px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import History */}
      {historyData?.jobs && historyData.jobs.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Import History</h2>
          <div className="space-y-3">
            {historyData.jobs.map((job: ImportJob) => (
              <div key={job.id} className="p-4 bg-dark-800 rounded-md border border-dark-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {job.status === 'COMPLETED' && (
                      <span className="text-green-400 text-lg">✓</span>
                    )}
                    {job.status === 'FAILED' && (
                      <span className="text-red-400 text-lg">✗</span>
                    )}
                    {job.status === 'RUNNING' && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {job.status === 'COMPLETED' && 'Import Completed'}
                        {job.status === 'FAILED' && 'Import Failed'}
                        {job.status === 'RUNNING' && 'Import Running'}
                        {job.status === 'PENDING' && 'Import Pending'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {job.filesProcessed} / {job.totalFiles} files
                    </p>
                    <p className="text-xs text-gray-400">
                      {job.recordsImported} records
                    </p>
                  </div>
                </div>
                {job.clearExisting && (
                  <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Cleared existing data before import</span>
                  </div>
                )}
                {job.errorMessage && (
                  <p className="mt-2 text-xs text-red-300">
                    Error: {job.errorMessage}
                  </p>
                )}
                {job.status === 'RUNNING' && job.currentFile && (
                  <p className="mt-2 text-xs text-blue-300">
                    Processing: <span className="font-mono">{job.currentFile}</span>
                  </p>
                )}
                <button
                  onClick={() => handleViewLogs(job.id)}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-300 underline"
                >
                  View Logs
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
