import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Contacts from '../Contacts';

const mockContactAPI = vi.hoisted(() => ({
  contactAPI: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => mockContactAPI);

const mockCsv = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  flattenForExport: vi.fn(),
}));

vi.mock('../../utils/csv', () => mockCsv);

describe('Contacts page', () => {
  const mockContacts = [
    {
      id: 'contact-1',
      firstName: 'Alice',
      lastName: 'Johnson',
      primaryOrganization: { id: 'org-1', name: 'SVT' },
      owner: { id: 'user-1', firstName: 'Bob', lastName: 'Smith' },
      emails: [{ email: 'alice@svt.se', isPrimary: true }],
    },
    {
      id: 'contact-2',
      firstName: 'Charlie',
      lastName: 'Brown',
      primaryOrganization: { id: 'org-2', name: 'YLE' },
      owner: null,
      emails: [{ email: 'charlie@yle.fi', isPrimary: true }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Contacts />);

    expect(screen.getByText('Contacts')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Contacts />);

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Add Contact')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockContactAPI.contactAPI.getAll.mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<Contacts />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render contacts list', async () => {
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: mockContacts, pagination: { page: 1, limit: 10000, total: 2, totalPages: 1 } },
    });

    renderWithProviders(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
      expect(screen.getByText(/Charlie Brown/)).toBeInTheDocument();
    });

    expect(screen.getByText('SVT')).toBeInTheDocument();
    expect(screen.getByText('YLE')).toBeInTheDocument();
  });

  it('should show empty state when no contacts', async () => {
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10000, total: 0, totalPages: 0 } },
    });

    renderWithProviders(<Contacts />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No contacts found.')).toBeInTheDocument();
    expect(screen.getByText('Create your first contact')).toBeInTheDocument();
  });

  it('should update search input value', async () => {
    const user = userEvent.setup();
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: mockContacts, pagination: { page: 1, limit: 10000, total: 2, totalPages: 1 } },
    });

    renderWithProviders(<Contacts />);

    const searchInput = screen.getByPlaceholderText('Search contacts...');
    await user.type(searchInput, 'Alice');

    expect(searchInput).toHaveValue('Alice');

    await waitFor(() => {
      expect(mockContactAPI.contactAPI.getAll).toHaveBeenCalledWith({
        search: 'Alice',
        limit: 10000,
      });
    });
  });

  it('should sort contacts by name', async () => {
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: mockContacts, pagination: { page: 1, limit: 10000, total: 2, totalPages: 1 } },
    });

    renderWithProviders(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toBeInTheDocument();
  });

  it('should call export CSV on button click', async () => {
    const user = userEvent.setup();
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: mockContacts, pagination: { page: 1, limit: 10000, total: 2, totalPages: 1 } },
    });
    mockCsv.flattenForExport.mockReturnValue(mockContacts);

    renderWithProviders(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockContactAPI.contactAPI.getAll).toHaveBeenCalledWith({ limit: 10000 });
      expect(mockCsv.flattenForExport).toHaveBeenCalled();
      expect(mockCsv.exportToCSV).toHaveBeenCalledWith(mockContacts, 'contacts');
    });
  });

  it('should show pagination controls', async () => {
    const manyContacts = Array.from({ length: 25 }, (_, i) => ({
      id: `contact-${i}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      primaryOrganization: null,
      owner: null,
      emails: [],
    }));

    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: manyContacts, pagination: { page: 1, limit: 10000, total: 25, totalPages: 1 } },
    });

    renderWithProviders(<Contacts />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
