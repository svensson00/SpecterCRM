import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { organizationAPI, contactAPI, dealAPI } from '../lib/api';

type SearchResult = {
  type: 'organization' | 'contact' | 'deal';
  id: string;
  title: string;
  subtitle?: string;
};

export default function GlobalSearch() {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: orgs } = useQuery({
    queryKey: ['search-orgs', search],
    queryFn: () => organizationAPI.getAll({ search, limit: 5 }).then(r => r.data.data),
    enabled: search.length >= 2,
  });

  const { data: contacts } = useQuery({
    queryKey: ['search-contacts', search],
    queryFn: () => contactAPI.getAll({ search, limit: 5 }).then(r => r.data.data),
    enabled: search.length >= 2,
  });

  const { data: deals } = useQuery({
    queryKey: ['search-deals', search],
    queryFn: () => dealAPI.getAll({ search, limit: 5 }).then(r => r.data.data),
    enabled: search.length >= 2,
  });

  const results: SearchResult[] = [
    ...(orgs || []).map((org: any) => ({
      type: 'organization' as const,
      id: org.id,
      title: org.name,
      subtitle: org.website || `${org.city || ''}${org.city && org.country ? ', ' : ''}${org.country || ''}`,
    })),
    ...(contacts || []).map((contact: any) => ({
      type: 'contact' as const,
      id: contact.id,
      title: `${contact.firstName} ${contact.lastName}`,
      subtitle: contact.emails?.[0]?.email || contact.jobTitle,
    })),
    ...(deals || []).map((deal: any) => ({
      type: 'deal' as const,
      id: deal.id,
      title: deal.title,
      subtitle: deal.organization?.name || `$${deal.amount?.toLocaleString() || 0}`,
    })),
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    const paths = {
      organization: '/organizations',
      contact: '/contacts',
      deal: '/deals',
    };
    navigate(`${paths[result.type]}/${result.id}`);
    setSearch('');
    setIsOpen(false);
  };

  const getTypeColor = (type: string) => {
    const colors = {
      organization: 'bg-blue-500/20 text-blue-400',
      contact: 'bg-green-500/20 text-green-400',
      deal: 'bg-purple-500/20 text-purple-400',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          placeholder="Search organizations, contacts, deals..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-2 pl-10 bg-dark-800 border border-dark-700 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {isOpen && search.length >= 2 && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.type}-${result.id}-${idx}`}
              onClick={() => handleResultClick(result)}
              className="w-full text-left px-4 py-3 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${getTypeColor(result.type)}`}
                >
                  {result.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{result.title}</p>
                  {result.subtitle && (
                    <p className="text-sm text-gray-400 truncate">{result.subtitle}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No results found</p>
        </div>
      )}
    </div>
  );
}
