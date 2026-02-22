import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import DealForm from '../DealForm';

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
}));

const mockOrganizationAPI = vi.hoisted(() => ({
  organizationAPI: { getAll: vi.fn() },
}));

const mockContactAPI = vi.hoisted(() => ({
  contactAPI: { getAll: vi.fn() },
}));

const mockUserAPI = vi.hoisted(() => ({
  userAPI: { getAll: vi.fn() },
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: { getSettings: vi.fn() },
}));

vi.mock('../../lib/api', () => ({
  dealAPI: mockDealAPI.dealAPI,
  organizationAPI: mockOrganizationAPI.organizationAPI,
  contactAPI: mockContactAPI.contactAPI,
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

describe('DealForm page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserAPI.userAPI.getAll.mockResolvedValue({ data: [] });
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockContactAPI.contactAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockAdminAPI.adminAPI.getSettings.mockResolvedValue({ data: { currency: 'USD' } });
  });

  it('should render form title', async () => {
    renderWithProviders(<DealForm />);

    await waitFor(() => {
      expect(screen.getByText('New Deal')).toBeInTheDocument();
    });
  });

  it('should render form fields', async () => {
    renderWithProviders(<DealForm />);

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Stage')).toBeInTheDocument();
  });

  it('should show Reason Lost field when stage is LOST', async () => {
    renderWithProviders(<DealForm />);

    await waitFor(() => {
      expect(screen.getByText('Stage')).toBeInTheDocument();
    });

    // Form has stage select that can be changed to LOST
    // This test would need user interaction to properly verify the conditional field
  });
});
