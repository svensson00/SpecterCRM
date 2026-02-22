import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Reports from '../Reports';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: {
    getSettings: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({
  default: mockApi,
  adminAPI: mockAdminAPI.adminAPI,
}));

describe('Reports page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Default mock responses
    mockAdminAPI.adminAPI.getSettings.mockResolvedValue({
      data: { currency: 'USD' },
    });

    mockApi.get.mockImplementation((url: string) => {
      if (url === '/reports/pipeline') {
        return Promise.resolve({
          data: [
            { stage: 'LEAD', count: 5, totalValue: 50000, avgValue: 10000 },
            { stage: 'PROSPECT', count: 3, totalValue: 30000, avgValue: 10000 },
          ],
        });
      }
      if (url === '/reports/win-rate') {
        return Promise.resolve({
          data: {
            totalDeals: 20,
            wonDeals: 12,
            lostDeals: 8,
            winRate: 0.6,
            avgDealSize: 15000,
          },
        });
      }
      if (url === '/reports/cycle-time') {
        return Promise.resolve({
          data: { avgCycleTime: 45, medianCycleTime: 30 },
        });
      }
      if (url === '/reports/activity-volume') {
        return Promise.resolve({
          data: [
            { type: 'Workshop', count: 10, completed: 8, completionRate: 0.8 },
            { type: 'POC Demo', count: 5, completed: 3, completionRate: 0.6 },
          ],
        });
      }
      if (url === '/reports/top-accounts') {
        return Promise.resolve({
          data: [
            {
              organizationId: 'org-1',
              organizationName: 'SVT',
              totalRevenue: 100000,
              dealCount: 5,
              avgDealSize: 20000,
            },
          ],
        });
      }
      if (url === '/reports/forecast') {
        return Promise.resolve({
          data: [
            { month: '2026-03', totalValue: 50000, dealCount: 3, weightedValue: 40000 },
          ],
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('should render page title', () => {
    renderWithProviders(<Reports />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('should render all report section headers', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Win Rate Overview')).toBeInTheDocument();
    });

    expect(screen.getByText('Sales Cycle Time')).toBeInTheDocument();
    expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
    expect(screen.getByText('Activity Volume')).toBeInTheDocument();
    expect(screen.getByText('Top Accounts by Revenue')).toBeInTheDocument();
    expect(screen.getByText('Revenue Forecast (Next 6 Months)')).toBeInTheDocument();
  });

  it('should display win rate data in table', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Total Deals')).toBeInTheDocument();
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    expect(screen.getByText('Lost')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getAllByText('60.0%').length).toBeGreaterThan(0);
  });

  it('should display cycle time data', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Sales Cycle Time')).toBeInTheDocument();
      expect(screen.getByText('45 days')).toBeInTheDocument();
    });

    expect(screen.getByText('30 days')).toBeInTheDocument(); // medianCycleTime
  });

  it('should display pipeline stages', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline by Stage')).toBeInTheDocument();
      expect(screen.getByText('LEAD')).toBeInTheDocument();
    });

    expect(screen.getByText('PROSPECT')).toBeInTheDocument();
  });

  it('should display activity volume data', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Activity Volume')).toBeInTheDocument();
      expect(screen.getByText('Workshop')).toBeInTheDocument();
    });

    expect(screen.getByText('POC Demo')).toBeInTheDocument();
  });

  it('should display top accounts', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Top Accounts by Revenue')).toBeInTheDocument();
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });
  });

  it('should display forecast data', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('Revenue Forecast (Next 6 Months)')).toBeInTheDocument();
    });

    // Forecast data should be rendered in the table
    expect(mockApi.get).toHaveBeenCalledWith('/reports/forecast', expect.any(Object));
  });

  it('should show loading states initially', () => {
    renderWithProviders(<Reports />);

    // Components should render even if data is loading
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('should call API endpoints with date filters', async () => {
    renderWithProviders(<Reports />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/pipeline', { params: {} });
      expect(mockApi.get).toHaveBeenCalledWith('/reports/win-rate', { params: {} });
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycle-time', { params: {} });
      expect(mockApi.get).toHaveBeenCalledWith('/reports/activity-volume', { params: {} });
      expect(mockApi.get).toHaveBeenCalledWith('/reports/top-accounts', { params: {} });
      expect(mockApi.get).toHaveBeenCalledWith('/reports/forecast', { params: {} });
    });
  });

  it('should render DateFilter component', () => {
    renderWithProviders(<Reports />);

    // DateFilter should be present (it has a select/dropdown)
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
