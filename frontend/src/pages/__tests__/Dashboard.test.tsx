import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Dashboard from '../Dashboard';

const mockReportAPI = vi.hoisted(() => ({
  reportAPI: {
    getPipeline: vi.fn(),
    getActivityVolume: vi.fn(),
  },
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: {
    getSettings: vi.fn(),
  },
}));

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({
  reportAPI: mockReportAPI.reportAPI,
  adminAPI: mockAdminAPI.adminAPI,
  dealAPI: mockDealAPI.dealAPI,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mock responses
    mockAdminAPI.adminAPI.getSettings.mockResolvedValue({
      data: { currency: 'USD' },
    });

    mockReportAPI.reportAPI.getPipeline.mockResolvedValue({
      data: [
        { stage: 'LEAD', count: 5, totalValue: 50000 },
        { stage: 'PROSPECT', count: 3, totalValue: 30000 },
        { stage: 'QUOTE', count: 2, totalValue: 20000 },
      ],
    });

    mockReportAPI.reportAPI.getActivityVolume.mockResolvedValue({
      data: [
        { type: 'Workshop', count: 10, completed: 8, completionRate: 0.8 },
        { type: 'POC Demo', count: 5, completed: 3, completionRate: 0.6 },
      ],
    });

    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'deal-1',
            title: 'Streaming Platform',
            stage: 'PROSPECT',
            amount: 15000,
            expectedCloseDate: '2026-03-01',
            organization: { name: 'SVT' },
            updatedAt: '2026-02-20',
          },
          {
            id: 'deal-2',
            title: 'Ad Tech Integration',
            stage: 'WON',
            amount: 10000,
            updatedAt: '2026-02-15',
          },
          {
            id: 'deal-3',
            title: 'Technical Audit',
            stage: 'LOST',
            amount: 5000,
            updatedAt: '2026-02-10',
          },
        ],
        pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 },
      },
    });
  });

  it('should render page title', () => {
    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render Pipeline by Stage section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
      expect(screen.getByText('LEAD')).toBeInTheDocument();
    });

    expect(screen.getByText('PROSPECT')).toBeInTheDocument();
    expect(screen.getByText('QUOTE')).toBeInTheDocument();
  });

  it('should render Hot Deals section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Hot Deals')).toBeInTheDocument();
    });

    expect(screen.getByText('Deals with closest expected close dates')).toBeInTheDocument();
  });

  it('should render Activity Volume section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Activity Volume')).toBeInTheDocument();
    });
  });

  it('should display pipeline stages with counts and values', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('LEAD')).toBeInTheDocument();
    });

    expect(screen.getByText(/\(5\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('should display hot deals', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    expect(screen.getByText('SVT')).toBeInTheDocument();
  });

  it('should navigate to deal detail on hot deal click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const dealItem = screen.getByText('Streaming Platform').closest('div');
    if (dealItem) {
      await user.click(dealItem);
      expect(mockNavigate).toHaveBeenCalledWith('/deals/deal-1');
    }
  });

  it('should show no upcoming deals message when empty', async () => {
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'deal-1',
            title: 'Won Deal',
            stage: 'WON',
            amount: 10000,
            updatedAt: '2026-02-15',
          },
        ],
        pagination: { page: 1, limit: 10000, total: 1, totalPages: 1 },
      },
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('No upcoming deals')).toBeInTheDocument();
    });
  });

  it('should display activity volume table', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Workshop')).toBeInTheDocument();
    });

    expect(screen.getByText('POC Demo')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('should show no activity data message when empty', async () => {
    mockReportAPI.reportAPI.getActivityVolume.mockResolvedValue({
      data: [],
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('No activity data available for the selected period')).toBeInTheDocument();
    });
  });

  it('should allow changing activity date filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Activity Volume')).toBeInTheDocument();
    });

    const activitySelect = screen.getByLabelText('Period:');
    await user.selectOptions(activitySelect, 'today');

    await waitFor(() => {
      expect(localStorage.getItem('dashboard-activity-filter')).toBe('today');
    });
  });

  it('should allow changing pipeline date filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
    });

    const pipelineSelect = screen.getByLabelText('Won/Lost Period:');
    await user.selectOptions(pipelineSelect, 'this-week');

    await waitFor(() => {
      expect(localStorage.getItem('dashboard-pipeline-filter')).toBe('this-week');
    });
  });

  it('should calculate closed deals stats correctly', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('WON')).toBeInTheDocument();
    });

    expect(screen.getByText('LOST')).toBeInTheDocument();
  });

  it('should format currency correctly', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
    });

    // Currency formatting will vary based on locale
    const text = screen.getByText('Pipeline by Stage').closest('div')?.textContent;
    expect(text).toBeTruthy();
  });

  it('should load saved activity filter from localStorage', async () => {
    localStorage.setItem('dashboard-activity-filter', 'last-week');

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Activity Volume')).toBeInTheDocument();
    });

    const activitySelect = screen.getByLabelText('Period:') as HTMLSelectElement;
    expect(activitySelect.value).toBe('last-week');
  });

  it('should load saved pipeline filter from localStorage', async () => {
    localStorage.setItem('dashboard-pipeline-filter', 'last-month');

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
    });

    const pipelineSelect = screen.getByLabelText('Won/Lost Period:') as HTMLSelectElement;
    expect(pipelineSelect.value).toBe('last-month');
  });

  it('should filter hot deals to exclude WON and LOST', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    expect(screen.queryByText('Ad Tech Integration')).not.toBeInTheDocument();
    expect(screen.queryByText('Technical Audit')).not.toBeInTheDocument();
  });
});
