import { useState, useEffect, useRef } from 'react';

interface Organization {
  id: string;
  name: string;
  website?: string;
  city?: string;
}

interface OrganizationSelectProps {
  organizations: Organization[];
  value: string;
  onChange: (organizationId: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function OrganizationSelect({
  organizations,
  value,
  onChange,
  placeholder = 'Select organization...',
  label = 'Organization',
  required = false
}: OrganizationSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOrg = organizations?.find(o => o.id === value);

  const filteredOrganizations = organizations?.filter(org => {
    const searchLower = search.toLowerCase();
    return (
      org.name.toLowerCase().includes(searchLower) ||
      org.website?.toLowerCase().includes(searchLower) ||
      org.city?.toLowerCase().includes(searchLower)
    );
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

  const handleSelect = (organizationId: string) => {
    onChange(organizationId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  const displayValue = selectedOrg ? selectedOrg.name : '';

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && filteredOrganizations.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOrganizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => handleSelect(org.id)}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === org.id ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">{org.name}</p>
              {(org.website || org.city) && (
                <p className="text-sm text-gray-400">
                  {org.website && <span>{org.website}</span>}
                  {org.website && org.city && <span> • </span>}
                  {org.city && <span>{org.city}</span>}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && filteredOrganizations.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No organizations found</p>
        </div>
      )}
    </div>
  );
}
