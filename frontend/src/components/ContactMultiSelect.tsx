import { useState, useEffect, useRef } from 'react';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  jobTitle?: string;
}

interface ContactMultiSelectProps {
  contacts: Contact[];
  selectedContactIds: string[];
  onChange: (contactIds: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function ContactMultiSelect({
  contacts,
  selectedContactIds,
  onChange,
  placeholder = 'Search contacts...',
  label = 'Contacts'
}: ContactMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedContacts = contacts?.filter(c => selectedContactIds.includes(c.id)) || [];

  const filteredContacts = contacts?.filter(contact => {
    const searchLower = search.toLowerCase();
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const email = contact.email?.toLowerCase() || '';
    const jobTitle = contact.jobTitle?.toLowerCase() || '';
    return fullName.includes(searchLower) || email.includes(searchLower) || jobTitle.includes(searchLower);
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

  const handleToggle = (contactId: string) => {
    if (selectedContactIds.includes(contactId)) {
      onChange(selectedContactIds.filter(id => id !== contactId));
    } else {
      onChange([...selectedContactIds, contactId]);
    }
  };

  const handleRemove = (contactId: string) => {
    onChange(selectedContactIds.filter(id => id !== contactId));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>

      {/* Selected contacts chips */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedContacts.map((contact) => (
            <div
              key={contact.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-600/20 border border-primary-600/50 rounded-md text-sm text-white"
            >
              <span>{contact.firstName} {contact.lastName}</span>
              <button
                type="button"
                onClick={() => handleRemove(contact.id)}
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

      {isOpen && filteredContacts.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredContacts.map((contact) => {
            const isSelected = selectedContactIds.includes(contact.id);
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleToggle(contact.id)}
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
                    <p className="font-medium text-white">
                      {contact.firstName} {contact.lastName}
                    </p>
                    {(contact.jobTitle || contact.email) && (
                      <p className="text-sm text-gray-400">
                        {contact.jobTitle && <span>{contact.jobTitle}</span>}
                        {contact.jobTitle && contact.email && <span> • </span>}
                        {contact.email && <span>{contact.email}</span>}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && search.length > 0 && filteredContacts.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No contacts found</p>
        </div>
      )}

      {selectedContacts.length > 0 && (
        <p className="text-sm text-gray-400 mt-1">{selectedContacts.length} contact(s) selected</p>
      )}
    </div>
  );
}
