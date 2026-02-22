import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import { AuthProvider } from '../../contexts/AuthContext';

const mockAuthAPI = vi.hoisted(() => ({
  authAPI: {
    login: vi.fn(),
    me: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => mockAuthAPI);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthAPI.authAPI.me.mockResolvedValue({ data: null });
  });

  it('should render login form', () => {
    renderLogin();

    expect(screen.getByText('SpecterCRM')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('should show demo credentials in dev mode', () => {
    renderLogin();

    expect(screen.getByText('Demo Credentials:')).toBeInTheDocument();
    expect(screen.getByText(/Admin: admin@demo.com/)).toBeInTheDocument();
    expect(screen.getByText(/Sales: sales@demo.com/)).toBeInTheDocument();
  });

  it('should update input values when typing', async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should show loading state during login', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.login.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should navigate to dashboard on successful login', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER',
      tenantId: 'tenant-1',
    };

    mockAuthAPI.authAPI.login.mockResolvedValue({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      },
    });

    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAuthAPI.authAPI.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should show error message on login failure', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.login.mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    });

    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(emailInput, 'wrong@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    expect(submitButton).not.toBeDisabled();
  });

  it('should show generic error message when no error details', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.login.mockRejectedValue(new Error('Network error'));

    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('should clear error on new submission', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.login.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });

    renderLogin();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(emailInput, 'wrong@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    mockAuthAPI.authAPI.login.mockResolvedValue({
      data: {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: '1', email: 'test@example.com', role: 'USER', tenantId: 'tenant-1' },
      },
    });

    await user.clear(emailInput);
    await user.clear(passwordInput);
    await user.type(emailInput, 'correct@example.com');
    await user.type(passwordInput, 'correctpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });
});
