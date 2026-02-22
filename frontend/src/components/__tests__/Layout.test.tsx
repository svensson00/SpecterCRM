import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';

const mockAuthAPI = vi.hoisted(() => ({
  authAPI: {
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

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
  authAPI: mockAuthAPI.authAPI,
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

function renderLayout(user: any = null, role: string = 'USER') {
  const mockUser = user || {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role,
    tenantId: 'tenant-1',
  };

  localStorage.setItem('accessToken', 'mock-token');
  mockAuthAPI.authAPI.me.mockResolvedValue({ data: mockUser });
  mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({
    data: { data: [] },
  });
  mockContactAPI.contactAPI.getAll.mockResolvedValue({
    data: { data: [] },
  });
  mockDealAPI.dealAPI.getAll.mockResolvedValue({
    data: { data: [] },
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<div>Dashboard Content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Layout component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render SpecterCRM logo', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('SpecterCRM')).toBeInTheDocument();
    });
  });

  it('should render main navigation links', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('should show Admin dropdown for admin users', async () => {
    renderLayout(null, 'ADMIN');

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('should not show Admin dropdown for non-admin users', async () => {
    renderLayout(null, 'USER');

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('should display user name when available', async () => {
    const user = {
      id: 'user-1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      tenantId: 'tenant-1',
    };

    renderLayout(user);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });

  it('should display email when firstName is not available', async () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER',
      tenantId: 'tenant-1',
    };

    renderLayout(user);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should render logout button', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  it('should call logout and navigate on logout button click', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.logout.mockResolvedValue({});

    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('should render GlobalSearch component', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search organizations, contacts, deals...')).toBeInTheDocument();
    });
  });

  it('should render profile link', async () => {
    renderLayout();

    await waitFor(() => {
      const profileLink = screen.getByText('Test');
      expect(profileLink).toBeInTheDocument();
      expect(profileLink.closest('a')).toHaveAttribute('href', '/profile');
    });
  });

  it('should render page content in outlet', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });

  it('should have correct navigation link hrefs', async () => {
    renderLayout();

    await waitFor(() => {
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    const orgsLink = screen.getByText('Organizations').closest('a');
    expect(orgsLink).toHaveAttribute('href', '/organizations');

    const contactsLink = screen.getByText('Contacts').closest('a');
    expect(contactsLink).toHaveAttribute('href', '/contacts');

    const dealsLink = screen.getByText('Deals').closest('a');
    expect(dealsLink).toHaveAttribute('href', '/deals');

    const pipelineLink = screen.getByText('Pipeline').closest('a');
    expect(pipelineLink).toHaveAttribute('href', '/pipeline');

    const activitiesLink = screen.getByText('Activities').closest('a');
    expect(activitiesLink).toHaveAttribute('href', '/activities');

    const reportsLink = screen.getByText('Reports').closest('a');
    expect(reportsLink).toHaveAttribute('href', '/reports');
  });
});
