import prisma from '../config/database';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generatePasswordResetToken,
} from '../utils/auth';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';

export class AuthService {
  static async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'ADMIN' | 'USER';
    tenantId: string;
    createdByUserId: string;
  }) {
    const emailLower = data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: data.tenantId,
          email: emailLower,
        },
      },
    });

    if (existingUser) {
      throw new AppError(409, 'User with this email already exists');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'USER',
        tenantId: data.tenantId,
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

    await AuditService.log({
      tenantId: data.tenantId,
      userId: data.createdByUserId,
      entityType: 'USER',
      entityId: user.id,
      action: 'CREATE',
      afterData: { email: user.email, role: user.role },
    });

    return user;
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError(401, 'Invalid email or password');
    }

    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      entityType: 'USER',
      entityId: user.id,
      action: 'LOGIN',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  static async refresh(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const tokenHash = hashToken(refreshToken);

      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new AppError(401, 'Invalid or expired refresh token');
      }

      if (!storedToken.user.isActive) {
        throw new AppError(401, 'User account is disabled');
      }

      await prisma.refreshToken.delete({
        where: { tokenHash },
      });

      const newPayload = {
        userId: storedToken.user.id,
        tenantId: storedToken.user.tenantId,
        email: storedToken.user.email,
        role: storedToken.user.role,
      };

      const newAccessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          tokenHash: hashToken(newRefreshToken),
          expiresAt,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }
  }

  static async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  static async requestPasswordReset(email: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true,
      },
    });

    if (!user) {
      return;
    }

    const resetToken = generatePasswordResetToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiresAt,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      entityType: 'USER',
      entityId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
    });

    return { resetToken, email: user.email };
  }

  static async resetPassword(token: string, newPassword: string) {
    const hashedToken = hashToken(token);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gt: new Date() },
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      entityType: 'USER',
      entityId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
    });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }
}
