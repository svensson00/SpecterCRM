import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import ForgotPassword from '../ForgotPassword';

const mockAuthAPI = vi.hoisted(() => ({
  authAPI: {
    forgotPassword: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => mockAuthAPI);

describe('ForgotPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    renderWithProviders(<ForgotPassword />);

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
  });

  it('should render email input and submit button', () => {
    renderWithProviders(<ForgotPassword />);

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('should render back-to-login link', () => {
    renderWithProviders(<ForgotPassword />);

    const backLink = screen.getByText('Back to login');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/login');
  });

  it('should show loading state when submitting', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.forgotPassword.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Send reset link' });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });
  });

  it('should show success confirmation after submit', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.forgotPassword.mockResolvedValue({});

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Send reset link' });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    expect(screen.getByText(/We've sent a password reset link to/)).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should show error on API failure', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.forgotPassword.mockRejectedValue({
      response: {
        data: {
          message: 'User not found',
        },
      },
    });

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Send reset link' });

    await user.type(emailInput, 'notfound@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('should show generic error when no error message', async () => {
    const user = userEvent.setup();
    mockAuthAPI.authAPI.forgotPassword.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Send reset link' });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeInTheDocument();
    });
  });

  it('should update email input value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByPlaceholderText('Email address') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');

    expect(emailInput.value).toBe('test@example.com');
  });
});
