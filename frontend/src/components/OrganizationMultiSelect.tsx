import { useState, useEffect, useRef } from 'react';

interface Organization {
  id: string;
  name: string;
  website?: string;
}

interface OrganizationMultiSelectProps {
  organizations: Organization[];
  selectedOrganizationIds: string[];
  onChange: (organizationIds: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function OrganizationMultiSelect({
  organizations,
  selectedOrganizationIds,
  onChange,
  placeholder = 'Search organizations...',
  label = 'Organizations'
}: OrganizationMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOrganizations = organizations?.filter(o => selectedOrganizationIds.includes(o.id)) || [];

  const filteredOrganizations = organizations?.filter(org => {
    const searchLower = search.toLowerCase();
    const name = org.name.toLowerCase();
    const website = org.website?.toLowerCase() || '';
    return name.includes(searchLower) || website.includes(searchLower);
  }) || [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (organizationId: string) => {
    if (selectedOrganizationIds.includes(organizationId)) {
      onChange(selectedOrganizationIds.filter(id => id !== organizationId));
    } else {
      onChange([...selectedOrganizationIds, organizationId]);
    }
  };

  const handleRemove = (organizationId: string) => {
    onChange(selectedOrganizationIds.filter(id => id !== organizationId));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>

      {/* Selected organizations chips */}
      {selectedOrganizations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedOrganizations.map((org) => (
            <div
              key={org.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-600/20 border border-primary-600/50 rounded-md text-sm text-white"
            >
              <span>{org.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(org.id)}
                className="hover:text-red-400 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {isOpen && filteredOrganizations.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOrganizations.map((org) => {
            const isSelected = selectedOrganizationIds.includes(org.id);
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => handleToggle(org.id)}
                className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                  isSelected ? 'bg-dark-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by button onClick
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">{org.name}</p>
                    {org.website && (
                      <p className="text-sm text-gray-400">{org.website}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && search.length > 0 && filteredOrganizations.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No organizations found</p>
        </div>
      )}

      {selectedOrganizations.length > 0 && (
        <p className="text-sm text-gray-400 mt-1">{selectedOrganizations.length} organization(s) selected</p>
      )}
    </div>
  );
}
