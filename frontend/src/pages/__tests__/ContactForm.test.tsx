import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import ContactForm from '../ContactForm';

const mockContactAPI = vi.hoisted(() => ({
  contactAPI: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
}));

const mockOrganizationAPI = vi.hoisted(() => ({
  organizationAPI: { getAll: vi.fn() },
}));

const mockUserAPI = vi.hoisted(() => ({
  userAPI: { getAll: vi.fn() },
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: { getContactRoles: vi.fn() },
}));

vi.mock('../../lib/api', () => ({
  contactAPI: mockContactAPI.contactAPI,
  organizationAPI: mockOrganizationAPI.organizationAPI,
  userAPI: mockUserAPI.userAPI,
  adminAPI: mockAdminAPI.adminAPI,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: undefined }),
  };
});

describe('ContactForm page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserAPI.userAPI.getAll.mockResolvedValue({ data: [] });
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockAdminAPI.adminAPI.getContactRoles.mockResolvedValue({ data: [] });
  });

  it('should render form title', async () => {
    renderWithProviders(<ContactForm />);

    await waitFor(() => {
      expect(screen.getByText('New Contact')).toBeInTheDocument();
    });
  });

  it('should render form fields', async () => {
    renderWithProviders(<ContactForm />);

    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Job Title')).toBeInTheDocument();
  });

  it('should render email section', async () => {
    renderWithProviders(<ContactForm />);

    await waitFor(() => {
      expect(screen.getByText('Email Addresses')).toBeInTheDocument();
    });
  });
});
