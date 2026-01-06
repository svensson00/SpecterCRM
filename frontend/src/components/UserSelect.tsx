import { useState, useEffect, useRef } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface UserSelectProps {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function UserSelect({
  users,
  value,
  onChange,
  placeholder = 'Select owner...',
  label = 'Owner',
  required = false
}: UserSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedUser = users?.find(u => u.id === value);

  const filteredUsers = users?.filter(user => {
    const searchLower = search.toLowerCase();
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return fullName.includes(searchLower) || user.email.toLowerCase().includes(searchLower);
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

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  const displayValue = selectedUser
    ? `${selectedUser.firstName} ${selectedUser.lastName}`
    : '';

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

      {isOpen && filteredUsers.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user.id)}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === user.id ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && filteredUsers.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No users found</p>
        </div>
      )}
    </div>
  );
}
