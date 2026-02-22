import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AuthController } from '../auth.controller';

const mockAuthService = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../services/auth.service', () => ({
  AuthService: mockAuthService,
}));

describe('AuthController', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe('register', () => {
    it('should return 403 when user is not authenticated', async () => {
      mockReq = {
        body: { email: 'test@example.com', password: 'Password123!', firstName: 'Test', lastName: 'User' },
        user: undefined,
      };

      await AuthController.register(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Only admins can register new users' });
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not an admin', async () => {
      mockReq = {
        body: { email: 'test@example.com', password: 'Password123!', firstName: 'Test', lastName: 'User' },
        user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'USER' },
      };

      await AuthController.register(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Only admins can register new users' });
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should register user and return 201 when user is admin', async () => {
      const newUser = {
        id: 'user-456',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
      };

      mockReq = {
        body: { email: 'test@example.com', password: 'Password123!', firstName: 'Test', lastName: 'User' },
        user: { userId: 'admin-123', tenantId: 'tenant-123', email: 'admin@example.com', role: 'ADMIN' },
      };

      mockAuthService.register.mockResolvedValue(newUser);

      await AuthController.register(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId: 'tenant-123',
        createdByUserId: 'admin-123',
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(newUser);
    });
  });

  describe('login', () => {
    it('should call AuthService.login and return result', async () => {
      const loginResult = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          tenantId: 'tenant-123',
        },
      };

      mockReq = {
        body: { email: 'test@example.com', password: 'Password123!' },
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      await AuthController.login(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(mockRes.json).toHaveBeenCalledWith(loginResult);
    });
  });

  describe('refresh', () => {
    it('should return 400 when refreshToken is missing', async () => {
      mockReq = {
        body: {},
      };

      await AuthController.refresh(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Refresh token is required' });
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('should call AuthService.refresh and return new tokens', async () => {
      const refreshResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockReq = {
        body: { refreshToken: 'old-refresh-token' },
      };

      mockAuthService.refresh.mockResolvedValue(refreshResult);

      await AuthController.refresh(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(mockRes.json).toHaveBeenCalledWith(refreshResult);
    });
  });

  describe('logout', () => {
    it('should call AuthService.logout when refreshToken is provided', async () => {
      mockReq = {
        body: { refreshToken: 'mock-refresh-token' },
      };

      await AuthController.logout(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith('mock-refresh-token');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });

    it('should return success without calling service when refreshToken is missing', async () => {
      mockReq = {
        body: {},
      };

      await AuthController.logout(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  describe('me', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq = {
        user: undefined,
      };

      await AuthController.me(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Not authenticated' });
      expect(mockAuthService.getMe).not.toHaveBeenCalled();
    });

    it('should return user data when authenticated', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq = {
        user: { userId: 'user-123', tenantId: 'tenant-123', email: 'test@example.com', role: 'USER' },
      };

      mockAuthService.getMe.mockResolvedValue(userData);

      await AuthController.me(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.getMe).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith(userData);
    });
  });

  describe('requestPasswordReset', () => {
    it('should return 400 when email is missing', async () => {
      mockReq = {
        body: {},
      };

      await AuthController.requestPasswordReset(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Email is required' });
      expect(mockAuthService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('should call AuthService.requestPasswordReset and return success message', async () => {
      mockReq = {
        body: { email: 'test@example.com' },
      };

      await AuthController.requestPasswordReset(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Password reset email sent if account exists' });
    });
  });

  describe('resetPassword', () => {
    it('should return 400 when token is missing', async () => {
      mockReq = {
        body: { newPassword: 'NewPassword123!' },
      };

      await AuthController.resetPassword(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Token and new password are required' });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return 400 when newPassword is missing', async () => {
      mockReq = {
        body: { token: 'reset-token' },
      };

      await AuthController.resetPassword(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Token and new password are required' });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should call AuthService.resetPassword and return success message', async () => {
      mockReq = {
        body: { token: 'reset-token', newPassword: 'NewPassword123!' },
      };

      await AuthController.resetPassword(mockReq as AuthRequest, mockRes as Response);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('reset-token', 'NewPassword123!');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Password reset successfully' });
    });
  });
});
