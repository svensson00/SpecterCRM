import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';

export class ActivityService {
  static async create(
    data: {
      type: string;
      subject: string;
      description?: string;
      dueAt?: string;
      relatedOrganizationId?: string;
      relatedDealId?: string;
      contactIds?: string[];
      ownerUserId?: string;
    },
    tenantId: string,
    createdByUserId: string
  ) {
    const activity = await prisma.activity.create({
      data: {
        type: data.type,
        subject: data.subject,
        description: data.description,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        relatedOrganizationId: data.relatedOrganizationId,
        relatedDealId: data.relatedDealId,
        tenantId,
        createdByUserId,
        ownerUserId: data.ownerUserId || createdByUserId,
        contacts: data.contactIds
          ? {
              create: data.contactIds.map((contactId) => ({
                contact: { connect: { id: contactId } },
              })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        relatedOrganization: { select: { id: true, name: true } },
        relatedDeal: { select: { id: true, title: true } },
        contacts: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, emails: true } },
          },
        },
      },
    });

    await AuditService.log({
      tenantId,
      userId: createdByUserId,
      entityType: 'ACTIVITY',
      entityId: activity.id,
      action: 'CREATE',
      afterData: { type: activity.type, subject: activity.subject },
    });

    return activity;
  }

  static async findAll(params: {
    tenantId: string;
    type?: string;
    ownerUserId?: string;
    isCompleted?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      tenantId,
      type,
      ownerUserId,
      isCompleted,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'dueAt',
      sortOrder = 'asc',
    } = params;

    const where: any = { tenantId };

    if (type) where.type = type;
    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (isCompleted !== undefined) where.isCompleted = isCompleted;
    if (startDate || endDate) {
      where.dueAt = {};
      if (startDate) where.dueAt.gte = new Date(startDate);
      if (endDate) where.dueAt.lte = new Date(endDate);
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          relatedOrganization: { select: { id: true, name: true } },
          relatedDeal: { select: { id: true, title: true } },
          contacts: {
            include: {
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async findById(id: string, tenantId: string) {
    const activity = await prisma.activity.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        relatedOrganization: true,
        relatedDeal: true,
        contacts: {
          include: {
            contact: { include: { emails: true, phones: true } },
          },
        },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!activity) {
      throw new AppError(404, 'Activity not found');
    }

    return activity;
  }

  static async update(
    id: string,
    data: {
      type?: string;
      subject?: string;
      description?: string;
      dueAt?: string;
      relatedOrganizationId?: string;
      relatedDealId?: string;
      contactIds?: string[];
      ownerUserId?: string;
    },
    tenantId: string,
    updatedByUserId: string
  ) {
    await this.findById(id, tenantId);

    // Handle contact updates - if contactIds is provided (even as empty array), update them
    if (data.contactIds !== undefined) {
      await prisma.activityContact.deleteMany({ where: { activityId: id } });
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        type: data.type,
        subject: data.subject,
        description: data.description,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        relatedOrganizationId: data.relatedOrganizationId,
        relatedDealId: data.relatedDealId,
        ownerUserId: data.ownerUserId,
        updatedByUserId,
        contacts: data.contactIds !== undefined && data.contactIds.length > 0
          ? {
              create: data.contactIds.map((contactId) => ({
                contact: { connect: { id: contactId } },
              })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        relatedOrganization: { select: { id: true, name: true } },
        relatedDeal: { select: { id: true, title: true } },
        contacts: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return activity;
  }

  static async toggleComplete(id: string, tenantId: string, updatedByUserId: string) {
    const existing = await this.findById(id, tenantId);

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        isCompleted: !existing.isCompleted,
        completedAt: !existing.isCompleted ? new Date() : null,
        updatedByUserId,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await AuditService.log({
      tenantId,
      userId: updatedByUserId,
      entityType: 'ACTIVITY',
      entityId: id,
      action: 'STATUS_CHANGE',
      beforeData: { isCompleted: existing.isCompleted },
      afterData: { isCompleted: activity.isCompleted },
    });

    return activity;
  }

  static async delete(id: string, tenantId: string, deletedByUserId: string) {
    await this.findById(id, tenantId);
    await prisma.activity.delete({ where: { id } });

    await AuditService.log({
      tenantId,
      userId: deletedByUserId,
      entityType: 'ACTIVITY',
      entityId: id,
      action: 'DELETE',
    });
  }
}
