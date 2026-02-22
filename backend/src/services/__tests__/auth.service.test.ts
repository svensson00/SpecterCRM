import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
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
  tenant: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

const mockAuthUtils = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  hashToken: vi.fn(),
}));

vi.mock('../../utils/auth', () => mockAuthUtils);

import { AuthService } from '../auth.service';
import { AuditService } from '../audit.service';

describe('AuthService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';
  const email = 'test@example.com';
  const password = 'Password123!';
  const passwordHash = '$2b$12$hashedpassword';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should find user, verify password, generate tokens, and audit', async () => {
      const mockUser = {
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId,
        isActive: true,
      };

      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      const mockTokenHash = 'mock-token-hash';

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockAuthUtils.verifyPassword.mockResolvedValue(true);
      mockAuthUtils.generateAccessToken.mockReturnValue(mockAccessToken);
      mockAuthUtils.generateRefreshToken.mockReturnValue(mockRefreshToken);
      mockAuthUtils.hashToken.mockReturnValue(mockTokenHash);

      const result = await AuthService.login(email, password);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: email.toLowerCase(),
          isActive: true,
        },
      });
      expect(mockAuthUtils.verifyPassword).toHaveBeenCalledWith(password, passwordHash);
      expect(mockAuthUtils.generateAccessToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(mockAuthUtils.generateRefreshToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          tokenHash: mockTokenHash,
          expiresAt: expect.any(Date),
        },
      });
      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: mockUser.tenantId,
        userId: mockUser.id,
        entityType: 'USER',
        entityId: mockUser.id,
        action: 'LOGIN',
      });
      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
          tenantId: mockUser.tenantId,
        },
      });
    });

    it('should throw 401 for wrong email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        AuthService.login('wrong@example.com', password)
      ).rejects.toThrow(new AppError(401, 'Invalid email or password'));
    });

    it('should throw 401 for wrong password', async () => {
      const mockUser = {
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId,
        isActive: true,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockAuthUtils.verifyPassword.mockResolvedValue(false);

      await expect(
        AuthService.login(email, 'WrongPassword123!')
      ).rejects.toThrow(new AppError(401, 'Invalid email or password'));
    });

    it('should throw 401 for inactive user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        AuthService.login(email, password)
      ).rejects.toThrow(new AppError(401, 'Invalid email or password'));

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: email.toLowerCase(),
          isActive: true,
        },
      });
    });
  });

  describe('register', () => {
    it('should lowercase email, hash password, and create user', async () => {
      const upperCaseEmail = 'TEST@EXAMPLE.COM';
      const registerData = {
        email: upperCaseEmail,
        password,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER' as const,
        tenantId,
        createdByUserId: 'admin-123',
      };

      const mockUser = {
        id: userId,
        email: upperCaseEmail.toLowerCase(),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockAuthUtils.hashPassword.mockResolvedValue(passwordHash);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await AuthService.register(registerData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_email: {
            tenantId,
            email: upperCaseEmail.toLowerCase(),
          },
        },
      });
      expect(mockAuthUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: upperCaseEmail.toLowerCase(),
          passwordHash,
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          tenantId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId: registerData.createdByUserId,
        entityType: 'USER',
        entityId: mockUser.id,
        action: 'CREATE',
        afterData: { email: mockUser.email, role: mockUser.role },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw 409 for duplicate email', async () => {
      const registerData = {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        tenantId,
        createdByUserId: 'admin-123',
      };

      const existingUser = {
        id: 'existing-user-123',
        email: email.toLowerCase(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        AuthService.register(registerData)
      ).rejects.toThrow(new AppError(409, 'User with this email already exists'));
    });
  });

  describe('getMe', () => {
    it('should return user data', async () => {
      const mockUser = {
        id: userId,
        email,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await AuthService.getMe(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw 404 for unknown userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        AuthService.getMe('non-existent-id')
      ).rejects.toThrow(new AppError(404, 'User not found'));
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      const refreshToken = 'mock-refresh-token';
      const tokenHash = 'mock-token-hash';

      mockAuthUtils.hashToken.mockReturnValue(tokenHash);

      await AuthService.logout(refreshToken);

      expect(mockAuthUtils.hashToken).toHaveBeenCalledWith(refreshToken);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash },
      });
    });
  });
});
