import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import DateFilter from '../DateFilter';

describe('DateFilter component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should render dropdown', () => {
    renderWithProviders(<DateFilter onChange={mockOnChange} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render preset options', () => {
    renderWithProviders(<DateFilter onChange={mockOnChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;

    expect(select).toBeInTheDocument();
    // The select should have the default value 'none' which corresponds to 'All Time'
    expect(select.value).toBe('none');
  });

  it('should call onChange with dates when preset is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DateFilter onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'today');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should show custom date inputs when custom range is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DateFilter onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'custom');

    await waitFor(() => {
      // Custom date inputs should appear
      expect(screen.getByText('From Date')).toBeInTheDocument();
      expect(screen.getByText('To Date')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
  });

  it('should persist selection in sessionStorage', async () => {
    const user = userEvent.setup();
    const storageKey = 'test-filter';
    renderWithProviders(<DateFilter onChange={mockOnChange} storageKey={storageKey} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'this-week');

    await waitFor(() => {
      expect(sessionStorage.getItem(`${storageKey}_option`)).toBe('this-week');
    });
  });

  it('should load saved filter from sessionStorage', () => {
    const storageKey = 'test-filter';
    sessionStorage.setItem(`${storageKey}_option`, 'last-month');

    renderWithProviders(<DateFilter onChange={mockOnChange} storageKey={storageKey} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('last-month');
  });
});
