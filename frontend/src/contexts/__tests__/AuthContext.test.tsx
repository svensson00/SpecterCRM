import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

const mockAuthAPI = vi.hoisted(() => ({
  authAPI: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => mockAuthAPI);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within AuthProvider');
    });
  });

  describe('AuthProvider', () => {
    it('should initialize with no user when no token in localStorage', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should load user from token on mount', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId: 'tenant-1',
      };

      localStorage.setItem('accessToken', 'mock-access-token');
      mockAuthAPI.authAPI.me.mockResolvedValue({ data: mockUser });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAuthAPI.authAPI.me).toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear tokens when me() fails', async () => {
      localStorage.setItem('accessToken', 'invalid-token');
      localStorage.setItem('refreshToken', 'invalid-refresh');
      mockAuthAPI.authAPI.me.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('should login and store tokens', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        tenantId: 'tenant-1',
      };

      const mockLoginResponse = {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          user: mockUser,
        },
      };

      mockAuthAPI.authAPI.login.mockResolvedValue(mockLoginResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.login('test@example.com', 'password123');

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockAuthAPI.authAPI.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(localStorage.getItem('accessToken')).toBe('new-access-token');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should logout and clear tokens', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        tenantId: 'tenant-1',
      };

      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');
      mockAuthAPI.authAPI.me.mockResolvedValue({ data: mockUser });
      mockAuthAPI.authAPI.logout.mockResolvedValue({});

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);

      await result.current.logout();

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(mockAuthAPI.authAPI.logout).toHaveBeenCalledWith('refresh-token');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear tokens even when logout API fails', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        tenantId: 'tenant-1',
      };

      localStorage.setItem('accessToken', 'access-token');
      localStorage.setItem('refreshToken', 'refresh-token');
      mockAuthAPI.authAPI.me.mockResolvedValue({ data: mockUser });
      mockAuthAPI.authAPI.logout.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should not call logout API when no refresh token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        tenantId: 'tenant-1',
      };

      localStorage.setItem('accessToken', 'access-token');
      mockAuthAPI.authAPI.me.mockResolvedValue({ data: mockUser });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(mockAuthAPI.authAPI.logout).not.toHaveBeenCalled();
    });
  });
});
