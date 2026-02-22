import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import GlobalSearch from '../GlobalSearch';

const mockOrganizationAPI = vi.hoisted(() => ({
  organizationAPI: {
    getAll: vi.fn(),
  },
}));

const mockContactAPI = vi.hoisted(() => ({
  contactAPI: {
    getAll: vi.fn(),
  },
}));

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({
  organizationAPI: mockOrganizationAPI.organizationAPI,
  contactAPI: mockContactAPI.contactAPI,
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

describe('GlobalSearch component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: { data: [] },
    });
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: { data: [] },
    });
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: { data: [] },
    });
  });

  it('should render search input', () => {
    renderWithProviders(<GlobalSearch />);

    expect(screen.getByPlaceholderText('Search organizations, contacts, deals...')).toBeInTheDocument();
  });

  it('should not trigger search for queries shorter than 2 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'a');

    expect(mockOrganizationAPI.organizationAPI.getAll).not.toHaveBeenCalled();
    expect(mockContactAPI.contactAPI.getAll).not.toHaveBeenCalled();
    expect(mockDealAPI.dealAPI.getAll).not.toHaveBeenCalled();
  });

  it('should trigger search when typing 2 or more characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'SVT');

    await waitFor(() => {
      expect(mockOrganizationAPI.organizationAPI.getAll).toHaveBeenCalledWith({
        search: 'SVT',
        limit: 5,
      });
      expect(mockContactAPI.contactAPI.getAll).toHaveBeenCalledWith({
        search: 'SVT',
        limit: 5,
      });
      expect(mockDealAPI.dealAPI.getAll).toHaveBeenCalledWith({
        search: 'SVT',
        limit: 5,
      });
    });
  });

  it('should display organization results', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'org-1', name: 'SVT', website: 'svt.se' },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'SVT');

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
      expect(screen.getByText('organization')).toBeInTheDocument();
    });
  });

  it('should display contact results', async () => {
    const user = userEvent.setup();
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'contact-1',
            firstName: 'Alice',
            lastName: 'Johnson',
            emails: [{ email: 'alice@svt.se' }],
          },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'Alice');

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('contact')).toBeInTheDocument();
      expect(screen.getByText('alice@svt.se')).toBeInTheDocument();
    });
  });

  it('should display deal results', async () => {
    const user = userEvent.setup();
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'deal-1',
            title: 'Streaming Platform',
            organization: { name: 'SVT' },
            amount: 50000,
          },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'Streaming');

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
      expect(screen.getByText('deal')).toBeInTheDocument();
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });
  });

  it('should navigate to organization detail on result click', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'org-1', name: 'SVT', website: 'svt.se' },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'SVT');

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    const result = screen.getByText('SVT').closest('button');
    if (result) {
      await user.click(result);

      expect(mockNavigate).toHaveBeenCalledWith('/organizations/org-1');
      expect(input).toHaveValue('');
    }
  });

  it('should navigate to contact detail on result click', async () => {
    const user = userEvent.setup();
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'contact-1',
            firstName: 'Alice',
            lastName: 'Johnson',
            emails: [{ email: 'alice@svt.se' }],
          },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'Alice');

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const result = screen.getByText('Alice Johnson').closest('button');
    if (result) {
      await user.click(result);

      expect(mockNavigate).toHaveBeenCalledWith('/contacts/contact-1');
    }
  });

  it('should navigate to deal detail on result click', async () => {
    const user = userEvent.setup();
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: {
        data: [
          {
            id: 'deal-1',
            title: 'Streaming Platform',
            organization: { name: 'SVT' },
          },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'Streaming');

    await waitFor(() => {
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });

    const result = screen.getByText('Streaming Platform').closest('button');
    if (result) {
      await user.click(result);

      expect(mockNavigate).toHaveBeenCalledWith('/deals/deal-1');
    }
  });

  it('should show no results message when no matches found', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'NonexistentQuery');

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'org-1', name: 'SVT', website: 'svt.se' },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'SVT');

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
    });

    // Click outside
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByText('organization')).not.toBeInTheDocument();
    });
  });

  it('should display mixed results from multiple sources', async () => {
    const user = userEvent.setup();
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'org-1', name: 'SVT', website: 'svt.se' },
        ],
      },
    });
    mockContactAPI.contactAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'contact-1', firstName: 'Alice', lastName: 'Johnson', emails: [] },
        ],
      },
    });
    mockDealAPI.dealAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { id: 'deal-1', title: 'Streaming Platform', organization: null },
        ],
      },
    });

    renderWithProviders(<GlobalSearch />);

    const input = screen.getByPlaceholderText('Search organizations, contacts, deals...');
    await user.type(input, 'test');

    await waitFor(() => {
      expect(screen.getByText('SVT')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Streaming Platform')).toBeInTheDocument();
    });
  });
});
