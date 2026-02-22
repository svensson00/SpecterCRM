import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import ActivityForm from '../ActivityForm';

const mockActivityAPI = vi.hoisted(() => ({
  activityAPI: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
}));

const mockOrganizationAPI = vi.hoisted(() => ({
  organizationAPI: { getAll: vi.fn() },
}));

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: { getAll: vi.fn() },
}));

const mockContactAPI = vi.hoisted(() => ({
  contactAPI: { getAll: vi.fn() },
}));

const mockUserAPI = vi.hoisted(() => ({
  userAPI: { getAll: vi.fn() },
}));

const mockAdminAPI = vi.hoisted(() => ({
  adminAPI: { getActivityTypes: vi.fn() },
}));

vi.mock('../../lib/api', () => ({
  activityAPI: mockActivityAPI.activityAPI,
  organizationAPI: mockOrganizationAPI.organizationAPI,
  dealAPI: mockDealAPI.dealAPI,
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

describe('ActivityForm page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserAPI.userAPI.getAll.mockResolvedValue({ data: [] });
    mockOrganizationAPI.organizationAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockDealAPI.dealAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockContactAPI.contactAPI.getAll.mockResolvedValue({ data: { data: [] } });
    mockAdminAPI.adminAPI.getActivityTypes.mockResolvedValue({ data: [] });
  });

  it('should render form title', async () => {
    renderWithProviders(<ActivityForm />);

    await waitFor(() => {
      expect(screen.getByText('New Activity')).toBeInTheDocument();
    });
  });

  it('should render form fields', async () => {
    renderWithProviders(<ActivityForm />);

    await waitFor(() => {
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
