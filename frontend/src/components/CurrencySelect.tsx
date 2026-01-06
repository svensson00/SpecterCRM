import { useState, useEffect, useRef } from 'react';

interface Currency {
  code: string;
  name: string;
}

interface CurrencySelectProps {
  currencies: Currency[];
  value: string;
  onChange: (currencyCode: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function CurrencySelect({
  currencies,
  value,
  onChange,
  label = 'Default Currency',
  placeholder = 'Select currency...',
  disabled = false,
}: CurrencySelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedCurrency = currencies.find((c) => c.code === value);

  const filteredCurrencies = currencies.filter((currency) => {
    const searchLower = search.toLowerCase();
    return (
      currency.code.toLowerCase().includes(searchLower) ||
      currency.name.toLowerCase().includes(searchLower)
    );
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

  const handleSelect = (currencyCode: string) => {
    onChange(currencyCode);
    setIsOpen(false);
    setSearch('');
  };

  const displayValue = selectedCurrency
    ? `${selectedCurrency.code} - ${selectedCurrency.name}`
    : '';

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className="block w-full md:w-64 px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      {isOpen && filteredCurrencies.length > 0 && (
        <div className="absolute z-50 mt-1 w-full md:w-64 card border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredCurrencies.map((currency) => (
            <button
              key={currency.code}
              type="button"
              onClick={() => handleSelect(currency.code)}
              className={`w-full text-left px-4 py-2 hover:bg-dark-700 border-b border-dark-700 last:border-b-0 focus:outline-none focus:bg-dark-700 transition-colors ${
                value === currency.code ? 'bg-dark-700' : ''
              }`}
            >
              <p className="font-medium text-white">
                {currency.code} - {currency.name}
              </p>
            </button>
          ))}
        </div>
      )}

      {isOpen && search.length > 0 && filteredCurrencies.length === 0 && (
        <div className="absolute z-50 mt-1 w-full md:w-64 card border border-dark-700 rounded-md shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">No currencies found</p>
        </div>
      )}
    </div>
  );
}
