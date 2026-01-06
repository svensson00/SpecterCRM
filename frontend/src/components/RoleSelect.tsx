import { useState, useEffect, useRef } from 'react';

interface Role {
  id: string;
  name: string;
  isActive: boolean;
}

interface RoleSelectProps {
  roles: Role[];
  value: string;
  onChange: (roleName: string) => void;
  placeholder?: string;
  label?: string;
}

export default function RoleSelect({
  roles,
  value,
  onChange,
  placeholder = 'Select role...',
  label = 'Contact Role'
}: RoleSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeRoles = roles?.filter(r => r.isActive) || [];
  const selectedRole = activeRoles.find(r => r.name === value);

  const filteredRoles = activeRoles.filter(role => {
    const searchLower = search.toLowerCase();
    return role.name.toLowerCase().includes(searchLower);
  });

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

  const handleSelect = (roleName: string) => {
    onChange(roleName);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  const displayValue = selectedRole ? selectedRole.name : '';

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
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

      {isOpen && filteredRoles.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => handleSelect(role.name)}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === role.name ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">{role.name}</p>
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && filteredRoles.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No roles found</p>
        </div>
      )}
    </div>
  );
}
