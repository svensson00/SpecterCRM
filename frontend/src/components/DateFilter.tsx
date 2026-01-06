import { useState, useEffect } from 'react';

export type DateFilterOption =
  | 'none'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'last-30-days'
  | 'last-90-days'
  | 'next-7-days'
  | 'next-30-days'
  | 'custom'
  | 'from-date'
  | 'until-date';

interface DateFilterProps {
  onChange: (startDate: string | null, endDate: string | null) => void;
  storageKey?: string;
}

export default function DateFilter({ onChange, storageKey = 'dateFilter' }: DateFilterProps) {
  const [selectedOption, setSelectedOption] = useState<DateFilterOption>(() => {
    if (storageKey) {
      return (sessionStorage.getItem(`${storageKey}_option`) as DateFilterOption) || 'none';
    }
    return 'none';
  });
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustom, setShowCustom] = useState(() => {
    const option = sessionStorage.getItem(`${storageKey}_option`) as DateFilterOption;
    return option === 'custom' || option === 'from-date' || option === 'until-date';
  });

  const getDateRange = (option: DateFilterOption): { start: string | null; end: string | null } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date | null = null;
    let end: Date | null = null;

    switch (option) {
      case 'none':
        return { start: null, end: null };

      case 'today':
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'yesterday':
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;

      case 'this-week':
        start = new Date(today);
        const dayOfWeek = start.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
        start.setDate(start.getDate() + diff);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-week':
        start = new Date(today);
        const lastWeekDay = start.getDay();
        const lastWeekDiff = lastWeekDay === 0 ? -6 : 1 - lastWeekDay;
        start.setDate(start.getDate() + lastWeekDiff - 7);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-30-days':
        start = new Date(today);
        start.setDate(start.getDate() - 30);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last-90-days':
        start = new Date(today);
        start.setDate(start.getDate() - 90);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'next-7-days':
        start = new Date(today);
        end = new Date(today);
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        break;

      case 'next-30-days':
        start = new Date(today);
        end = new Date(today);
        end.setDate(end.getDate() + 30);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return {
      start: start ? start.toISOString() : null,
      end: end ? end.toISOString() : null,
    };
  };

  const handleOptionChange = (option: DateFilterOption) => {
    setSelectedOption(option);

    // Save to sessionStorage
    if (storageKey) {
      sessionStorage.setItem(`${storageKey}_option`, option);
    }

    if (option === 'custom' || option === 'from-date' || option === 'until-date') {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    const { start, end } = getDateRange(option);
    onChange(start, end);
  };

  // Restore filter on mount
  useEffect(() => {
    if (storageKey && selectedOption !== 'none') {
      const { start, end } = getDateRange(selectedOption);
      onChange(start, end);
    }
  }, []); // Only run on mount

  const handleCustomDateChange = () => {
    if (selectedOption === 'custom') {
      const start = customStartDate ? new Date(customStartDate).toISOString() : null;
      const end = customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : null;
      onChange(start, end);
    } else if (selectedOption === 'from-date') {
      const start = customStartDate ? new Date(customStartDate).toISOString() : null;
      onChange(start, null);
    } else if (selectedOption === 'until-date') {
      const end = customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : null;
      onChange(null, end);
    }
  };

  return (
    <div className="card shadow sm:rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Date Filter</label>
          <select
            value={selectedOption}
            onChange={(e) => handleOptionChange(e.target.value as DateFilterOption)}
            className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="none">No Filter</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this-week">This Week</option>
            <option value="last-week">Last Week</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="last-90-days">Last 90 Days</option>
            <option value="next-7-days">Next 7 Days</option>
            <option value="next-30-days">Next 30 Days</option>
            <option value="custom">Custom Range (From → To)</option>
            <option value="from-date">From Date (Open-ended)</option>
            <option value="until-date">Until Date (Open-ended)</option>
          </select>
        </div>

        {showCustom && (
          <>
            {(selectedOption === 'custom' || selectedOption === 'from-date') && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}

            {(selectedOption === 'custom' || selectedOption === 'until-date') && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="block w-full px-3 py-2 bg-dark-800 border border-dark-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}

            {(selectedOption === 'custom' || selectedOption === 'from-date' || selectedOption === 'until-date') && (
              <div className="flex items-end">
                <button
                  onClick={handleCustomDateChange}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
