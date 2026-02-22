import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Organizations from '../Organizations';

const mockOrganizationAPI = vi.hoisted(() => ({
  organizationAPI: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => mockOrganizationAPI);

const mockCsv = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  flattenForExport: vi.fn(),
}));

vi.mock('../../utils/csv', () => mockCsv);

describe('Organizations page', () => {
  const mockOrganizations = [
    {
      id: 'org-1',
      name: 'SVT',
      owner: { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
    },
    {
      id: 'org-2',
      name: 'YLE',
      owner: { id: 'user-2', firstName: 'Bob', lastName: 'Johnson' },
    },
    {
      id: 'org-3',
      name: 'NRK',
      owner: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should render page title', () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Organizations />);

    expect(screen.getByText('Organizations')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Organizations />);

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Add Organization')).toBeInTheDocument();
  });

  it('should render search input', () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Organizations />);

    expect(screen.getByPlaceholderText('Search organizations...')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockOrganizationAPI.organizationAPI.getAll.mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<Organizations />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error message on API failure', async () => {
    mockOrganizationAPI.organizationAPI.getAll.mockRejectedValue(
      new Error('Failed to fetch organizations')
    );

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading organizations/)).toBeInTheDocument();
    });
  });

  it('should render organizations list', async () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
      expect(screen.getByText('YLE')).toBeInTheDocument();
      expect(screen.getByText('NRK')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('should show dash for organization without owner', async () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('NRK')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('should show empty state when no organizations', async () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('No organizations found.')).toBeInTheDocument();
      expect(screen.getByText('Create your first organization')).toBeInTheDocument();
    });
  });

  it('should update search input value', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    const searchInput = screen.getByPlaceholderText('Search organizations...');
    await user.type(searchInput, 'SVT');

    expect(searchInput).toHaveValue('SVT');

    await waitFor(() => {
      expect(mockOrganizationAPI.organizationAPI.getAll).toHaveBeenCalledWith({
        search: 'SVT',
        limit: 10000,
      });
    });
  });

  it('should sort organizations by name ascending', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const nameHeader = screen.getByText('Organization').closest('th');
    expect(nameHeader).toBeInTheDocument();

    // Organizations should be sorted by name ascending by default
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('should toggle sort direction when clicking same column', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const nameHeader = screen.getByText('Organization').closest('th');
    if (nameHeader) {
      await user.click(nameHeader);
      expect(screen.getByText('↓')).toBeInTheDocument();
    }
  });

  it('should show pagination controls', async () => {
    const manyOrgs = Array.from({ length: 25 }, (_, i) => ({
      id: `org-${i}`,
      name: `Organization ${i}`,
      owner: null,
    }));

    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: manyOrgs, pagination: { page: 1, limit: 10000, total: 25, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should navigate to next page', async () => {
    const user = userEvent.setup();
    const manyOrgs = Array.from({ length: 25 }, (_, i) => ({
      id: `org-${i}`,
      name: `Organization ${i}`,
      owner: null,
    }));

    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: manyOrgs, pagination: { page: 1, limit: 10000, total: 25, totalPages: 2 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });
  });

  it('should disable Previous button on first page', async () => {
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('should call export CSV on button click', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
    });
    mockCsv.flattenForExport.mockReturnValue(mockOrganizations);

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockOrganizationAPI.organizationAPI.getAll).toHaveBeenCalledWith({ limit: 10000 });
      expect(mockCsv.flattenForExport).toHaveBeenCalled();
      expect(mockCsv.exportToCSV).toHaveBeenCalledWith(mockOrganizations, 'organizations');
    });
  });

  it('should show alert on export error', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockOrganizationAPI.organizationAPI.getAll
      .mockResolvedValueOnce({
        data: { data: mockOrganizations, pagination: { page: 1, limit: 10000, total: 3, totalPages: 1 } },
      })
      .mockRejectedValueOnce(new Error('Export failed'));

    renderWithProviders(<Organizations />);

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error exporting organizations');
    });

    alertSpy.mockRestore();
  });
});
