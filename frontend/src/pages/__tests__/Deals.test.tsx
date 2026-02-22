import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Deals from '../Deals';

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: {
    getSettings: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({
  dealAPI: mockDealAPI.dealAPI,
  adminAPI: mockAdminAPI.adminAPI,
}));

const mockCsv = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  flattenForExport: vi.fn(),
}));

vi.mock('../../utils/csv', () => mockCsv);

describe('Deals page', () => {
  const mockDeals = [
    {
      id: 'deal-1',
      title: 'Streaming Platform',
      organization: { id: 'org-1', name: 'SVT' },
      amount: 50000,
      stage: 'PROSPECT',
      probability: 50,
      expectedCloseDate: '2026-03-15',
      owner: { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
    },
    {
      id: 'deal-2',
      title: 'Ad Tech Integration',
      organization: { id: 'org-2', name: 'YLE' },
      amount: 30000,
      stage: 'LEAD',
      probability: 25,
      expectedCloseDate: '2026-04-01',
      owner: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    mockAdminAPI.adminAPI.getSettings.mockResolvedValue({
      data: { currency: 'USD' },
    });

    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: { data: mockDeals, pagination: { page: 1, limit: 10000, total: 2, totalPages: 1 } },
    });
  });

  it('should render page title', () => {
    renderWithProviders(<Deals />);

    expect(screen.getByText('Deals')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    renderWithProviders(<Deals />);

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Add Deal')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockDealAPI.dealAPI.getAll.mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<Deals />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render deals list', async () => {
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
      expect(screen.getByText('Ad Tech Integration')).toBeInTheDocument();
    });

    expect(screen.getByText('SVT')).toBeInTheDocument();
    expect(screen.getByText('YLE')).toBeInTheDocument();
  });

  it('should show empty state when no deals', async () => {
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No deals found.')).toBeInTheDocument();
    expect(screen.getByText('Create your first deal')).toBeInTheDocument();
  });

  it('should update search input value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search deals...');
    await user.type(searchInput, 'Streaming');

    expect(searchInput).toHaveValue('Streaming');

    await waitFor(() => {
      expect(mockDealAPI.dealAPI.getAll).toHaveBeenCalledWith({
        search: 'Streaming',
        limit: 10000,
      });
    });
  });

  it('should display stage badges', async () => {
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('PROSPECT')).toBeInTheDocument();
      expect(screen.getByText('LEAD')).toBeInTheDocument();
    });
  });

  it('should filter by stage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    // Stage filters are buttons, not checkboxes
    const leadButton = screen.getByRole('button', { name: 'LEAD' });
    await user.click(leadButton);

    // After filtering, only LEAD deals should be visible
    await waitFor(() => {
      expect(screen.getByText('Ad Tech Integration')).toBeInTheDocument();
      expect(screen.queryByText('Streaming Platform')).not.toBeInTheDocument();
    });
  });

  it('should persist filter state in sessionStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search deals...');
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(sessionStorage.getItem('deals_search')).toBe('Test');
    });
  });

  it('should call export CSV on button click', async () => {
    const user = userEvent.setup();
    mockCsv.flattenForExport.mockReturnValue(mockDeals);

    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockDealAPI.dealAPI.getAll).toHaveBeenCalledWith({ limit: 10000 });
      expect(mockCsv.flattenForExport).toHaveBeenCalled();
      expect(mockCsv.exportToCSV).toHaveBeenCalledWith(mockDeals, 'deals');
    });
  });

  it('should show pagination controls', async () => {
    const manyDeals = Array.from({ length: 25 }, (_, i) => ({
      id: `deal-${i}`,
      title: `Deal ${i}`,
      organization: null,
      amount: 1000,
      stage: 'LEAD',
      probability: 25,
      expectedCloseDate: '2026-03-01',
      owner: null,
    }));

    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: { data: manyDeals, pagination: { page: 1, limit: 10000, total: 25, totalPages: 1 } },
    });

    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should navigate to next page', async () => {
    const user = userEvent.setup();
    const manyDeals = Array.from({ length: 25 }, (_, i) => ({
      id: `deal-${i}`,
      title: `Deal ${i}`,
      organization: null,
      amount: 1000,
      stage: 'LEAD',
      probability: 25,
      expectedCloseDate: '2026-03-01',
      owner: null,
    }));

    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: { data: manyDeals, pagination: { page: 1, limit: 10000, total: 25, totalPages: 2 } },
    });

    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });
  });

  it('should toggle sort direction when clicking same column', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Deals />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const titleHeader = screen.getByText('Deal').closest('th');
    if (titleHeader) {
      await user.click(titleHeader);
      expect(screen.getByText('↓')).toBeInTheDocument();
    }
  });
});
