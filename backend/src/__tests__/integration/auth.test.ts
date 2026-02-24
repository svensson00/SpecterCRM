import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, createAuthenticatedAgent } from '../helpers/supertest-setup';
import bcrypt from 'bcrypt';
import { generateRefreshToken, hashToken } from '../../utils/auth';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('Auth Endpoints', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with tokens when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const mockUser = {
        id: userId,
        email: 'admin@demo.com',
        passwordHash: hashedPassword,
        tenantId,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'refresh-token',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request.post('/api/auth/login').send({
        email: 'admin@demo.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', 'admin@demo.com');
      expect(res.body.user).toHaveProperty('role', 'ADMIN');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request.post('/api/auth/login').send({
        password: 'Password123!',
      });

      expect(res.status).toBe(400);
    });

    it('should return 401 when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request.post('/api/auth/login').send({
        email: 'nonexistent@demo.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      const mockUser = {
        id: userId,
        email: 'admin@demo.com',
        passwordHash: hashedPassword,
        tenantId,
        role: 'ADMIN',
        isActive: true,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await request.post('/api/auth/login').send({
        email: 'admin@demo.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 when user is inactive', async () => {
      // findFirst filters by isActive: true, so inactive user returns null
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request.post('/api/auth/login').send({
        email: 'admin@demo.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const mockUser = {
        id: userId,
        email: 'admin@demo.com',
        tenantId,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      };

      // Generate a real JWT token
      const validRefreshToken = generateRefreshToken({
        userId,
        tenantId,
        email: 'admin@demo.com',
        role: 'ADMIN',
      });
      const tokenHash = hashToken(validRefreshToken);

      const mockRefreshToken = {
        id: 'token-1',
        tokenHash,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      mockPrisma.refreshToken.delete.mockResolvedValue(mockRefreshToken);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        tokenHash: 'new-hash',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request.post('/api/auth/refresh').send({
        refreshToken: validRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 400 when refresh token is missing', async () => {
      const res = await request.post('/api/auth/refresh').send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when refresh token is invalid', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const res = await request.post('/api/auth/refresh').send({
        refreshToken: 'invalid-refresh-token',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 when refresh token is expired', async () => {
      const mockRefreshToken = {
        id: 'token-1',
        token: 'expired-refresh-token',
        userId,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);

      const res = await request.post('/api/auth/refresh').send({
        refreshToken: 'expired-refresh-token',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 when logout is successful', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request.post('/api/auth/logout').send({
        refreshToken: 'refresh-token',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');
    });

    it('should return 400 when refresh token is missing', async () => {
      const res = await request.post('/api/auth/logout').send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 200 with user details when authenticated', async () => {
      const agent = createAuthenticatedAgent({
        userId,
        tenantId,
        email: 'admin@demo.com',
        role: 'ADMIN',
      });

      const mockUser = {
        id: userId,
        email: 'admin@demo.com',
        tenantId,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'admin@demo.com');
      expect(res.body).toHaveProperty('role', 'ADMIN');
      expect(res.body).toHaveProperty('tenantId', tenantId);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 when email is valid', async () => {
      const mockUser = {
        id: userId,
        email: 'admin@demo.com',
        tenantId,
        isActive: true,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await request.post('/api/auth/forgot-password').send({
        email: 'admin@demo.com',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset email sent if account exists');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request.post('/api/auth/forgot-password').send({});

      expect(res.status).toBe(400);
    });

    it('should return 200 even when user not found (security)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request.post('/api/auth/forgot-password').send({
        email: 'nonexistent@demo.com',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset email sent if account exists');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should return 200 when reset is successful', async () => {
      // Mock user with valid reset token (hashed)
      const resetToken = 'valid-reset-token';
      const hashedToken = hashToken(resetToken);
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      mockPrisma.user.findFirst.mockResolvedValue({
        id: userId,
        email: 'user@demo.com',
        passwordHash: 'old-hash',
        tenantId,
        isActive: true,
        passwordResetToken: hashedToken,
        passwordResetExpiry: futureDate,
      } as any);

      mockPrisma.user.update.mockResolvedValue({} as any);

      const res = await request.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset successfully');
    });

    it('should return 400 when token or password is missing', async () => {
      const res = await request.post('/api/auth/reset-password').send({
        token: 'valid-reset-token',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 when reset token is invalid or expired', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request.post('/api/auth/reset-password').send({
        token: 'invalid-reset-token',
        password: 'NewPassword123!',
      });

      expect(res.status).toBe(400);
    });
  });
});
