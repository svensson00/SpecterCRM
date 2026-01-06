import { useState, useEffect, useRef } from 'react';

interface UserRoleSelectProps {
  value: 'USER' | 'ADMIN';
  onChange: (role: 'USER' | 'ADMIN') => void;
  label?: string;
  placeholder?: string;
}

const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function UserRoleSelect({
  value,
  onChange,
  label = 'Role',
  placeholder = 'Select role...',
}: UserRoleSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedRole = ROLES.find((r) => r.value === value);

  const filteredRoles = ROLES.filter((role) =>
    role.label.toLowerCase().includes(search.toLowerCase())
  );

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

  const handleSelect = (roleValue: 'USER' | 'ADMIN') => {
    onChange(roleValue);
    setIsOpen(false);
    setSearch('');
  };

  const displayValue = selectedRole ? selectedRole.label : '';

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-400 mb-2">
        {label}
        <span className="text-red-500">*</span>
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
      </div>

      {isOpen && filteredRoles.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredRoles.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => handleSelect(role.value as 'USER' | 'ADMIN')}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === role.value ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">{role.label}</p>
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
