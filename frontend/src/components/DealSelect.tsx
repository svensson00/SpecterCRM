import { useState, useEffect, useRef } from 'react';

interface Deal {
  id: string;
  title: string;
  amount?: number;
  currency?: string;
  stage?: string;
}

interface DealSelectProps {
  deals: Deal[];
  value: string;
  onChange: (dealId: string) => void;
  placeholder?: string;
  label?: string;
}

export default function DealSelect({
  deals,
  value,
  onChange,
  placeholder = 'Select deal...',
  label = 'Deal'
}: DealSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedDeal = deals?.find(d => d.id === value);

  const filteredDeals = deals?.filter(deal => {
    const searchLower = search.toLowerCase();
    return deal.title.toLowerCase().includes(searchLower) ||
           deal.stage?.toLowerCase().includes(searchLower);
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

  const handleSelect = (dealId: string) => {
    onChange(dealId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  const displayValue = selectedDeal ? selectedDeal.title : '';

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return null;
    return `${currency || 'USD'} ${amount.toLocaleString()}`;
  };

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

      {isOpen && filteredDeals.length > 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredDeals.map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => handleSelect(deal.id)}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === deal.id ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">{deal.title}</p>
              {(deal.amount || deal.stage) && (
                <p className="text-sm text-gray-400">
                  {formatAmount(deal.amount, deal.currency) && <span>{formatAmount(deal.amount, deal.currency)}</span>}
                  {formatAmount(deal.amount, deal.currency) && deal.stage && <span> • </span>}
                  {deal.stage && <span>{deal.stage}</span>}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && filteredDeals.length === 0 && (
        <div className="absolute z-50 mt-1 w-full card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No deals found</p>
        </div>
      )}
    </div>
  );
}
