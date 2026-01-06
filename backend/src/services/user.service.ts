import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import bcrypt from 'bcrypt';

export class UserService {
  static async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
  }) {
    const { tenantId, page = 1, limit = 20 } = params;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findById(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }

  static async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
    },
    tenantId: string,
    updatedByUserId: string
  ) {
    const existing = await this.findById(id, tenantId);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'USER',
        entityId: id,
        action: data.isActive ? 'ACTIVATED' : 'DEACTIVATED',
        beforeData: { isActive: existing.isActive },
        afterData: { isActive: data.isActive },
      });
    }

    return user;
  }

  static async updateRole(
    id: string,
    role: string,
    tenantId: string,
    updatedByUserId: string
  ) {
    const existing = await this.findById(id, tenantId);

    const user = await prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await AuditService.log({
      tenantId,
      userId: updatedByUserId,
      entityType: 'USER',
      entityId: id,
      action: 'ROLE_CHANGE',
      beforeData: { role: existing.role },
      afterData: { role },
    });

    return user;
  }

  static async deactivate(id: string, tenantId: string, deletedByUserId: string) {
    await this.update(id, { isActive: false }, tenantId, deletedByUserId);
  }

  static async delete(id: string, tenantId: string, deletedByUserId: string) {
    await this.findById(id, tenantId);

    // Delete the user - this will fail if there are foreign key constraints
    // The user must not have created any records or own any records
    await prisma.user.delete({ where: { id } });

    await AuditService.log({
      tenantId,
      userId: deletedByUserId,
      entityType: 'USER',
      entityId: id,
      action: 'DELETE_PERMANENT',
    });
  }

  static async changeOwnPassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await AuditService.log({
      tenantId,
      userId,
      entityType: 'USER',
      entityId: userId,
      action: 'PASSWORD_CHANGE',
    });
  }

  static async changeUserPassword(
    targetUserId: string,
    tenantId: string,
    newPassword: string,
    adminUserId: string
  ) {
    await this.findById(targetUserId, tenantId);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    await AuditService.log({
      tenantId,
      userId: adminUserId,
      entityType: 'USER',
      entityId: targetUserId,
      action: 'ADMIN_PASSWORD_RESET',
    });
  }
}
