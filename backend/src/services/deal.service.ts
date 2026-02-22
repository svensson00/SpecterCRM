import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import { DealStage } from '@prisma/client';

export class DealService {
  static async create(
    data: {
      title: string;
      organizationId: string;
      contactIds?: string[];
      amount?: number;
      expectedCloseDate?: string;
      stage?: DealStage;
      probability?: number;
      ownerUserId?: string;
    },
    tenantId: string,
    createdByUserId: string
  ) {
    const org = await prisma.organization.findFirst({
      where: { id: data.organizationId, tenantId },
    });

    if (!org) {
      throw new AppError(404, 'Organization not found');
    }

    // Get tenant's currency setting
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });

    const deal = await prisma.deal.create({
      data: {
        title: data.title,
        organizationId: data.organizationId,
        amount: data.amount,
        currency: tenant?.currency || 'USD',
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        stage: data.stage || 'LEAD',
        probability: data.probability,
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
        organization: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        contacts: {
          include: {
            contact: {
              select: { id: true, firstName: true, lastName: true, emails: true },
            },
          },
        },
      },
    });

    await AuditService.log({
      tenantId,
      userId: createdByUserId,
      entityType: 'DEAL',
      entityId: deal.id,
      action: 'CREATE',
      afterData: { title: deal.title, stage: deal.stage, amount: deal.amount },
    });

    return deal;
  }

  static async findAll(params: {
    tenantId: string;
    stage?: DealStage;
    ownerUserId?: string;
    organizationId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      tenantId,
      stage,
      ownerUserId,
      organizationId,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = { tenantId };

    if (stage) where.stage = stage;
    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (organizationId) where.organizationId = organizationId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          contacts: {
            include: {
              contact: {
                select: { id: true, firstName: true, lastName: true, emails: true },
              },
            },
          },
          _count: { select: { activities: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return {
      data: deals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async findById(id: string, tenantId: string) {
    const deal = await prisma.deal.findFirst({
      where: { id, tenantId },
      include: {
        organization: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        contacts: {
          include: {
            contact: {
              include: { emails: true, phones: true },
            },
          },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!deal) {
      throw new AppError(404, 'Deal not found');
    }

    return deal;
  }

  static async update(
    id: string,
    data: {
      title?: string;
      organizationId?: string;
      contactIds?: string[];
      amount?: number;
      currency?: string;
      expectedCloseDate?: string;
      stage?: DealStage;
      probability?: number;
      reasonLost?: string;
      ownerUserId?: string;
    },
    tenantId: string,
    updatedByUserId: string
  ) {
    const existing = await this.findById(id, tenantId);

    if (data.stage === 'LOST' && !data.reasonLost) {
      throw new AppError(400, 'Reason for loss is required when marking deal as lost');
    }

    if (data.contactIds) {
      await prisma.dealContact.deleteMany({ where: { dealId: id } });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        title: data.title,
        organizationId: data.organizationId,
        amount: data.amount,
        currency: data.currency,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        stage: data.stage,
        probability: data.probability,
        reasonLost: data.reasonLost,
        ownerUserId: data.ownerUserId,
        updatedByUserId,
        contacts: data.contactIds
          ? {
              create: data.contactIds.map((contactId) => ({
                contact: { connect: { id: contactId } },
              })),
            }
          : undefined,
      },
      include: {
        organization: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        contacts: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, emails: true } },
          },
        },
      },
    });

    if (data.stage && data.stage !== existing.stage) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'DEAL',
        entityId: id,
        action: 'STAGE_CHANGE',
        beforeData: { stage: existing.stage },
        afterData: { stage: data.stage },
      });
    }

    if (data.amount !== undefined && data.amount !== existing.amount) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'DEAL',
        entityId: id,
        action: 'AMOUNT_CHANGE',
        beforeData: { amount: existing.amount },
        afterData: { amount: data.amount },
      });
    }

    if (data.ownerUserId && data.ownerUserId !== existing.ownerUserId) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'DEAL',
        entityId: id,
        action: 'OWNER_CHANGE',
        beforeData: { ownerUserId: existing.ownerUserId },
        afterData: { ownerUserId: data.ownerUserId },
      });
    }

    return deal;
  }

  static async updateStage(
    id: string,
    stage: DealStage,
    reasonLost: string | undefined,
    tenantId: string,
    updatedByUserId: string
  ) {
    return this.update(id, { stage, reasonLost }, tenantId, updatedByUserId);
  }

  static async delete(id: string, tenantId: string, deletedByUserId: string) {
    await this.findById(id, tenantId);
    await prisma.deal.delete({ where: { id } });

    await AuditService.log({
      tenantId,
      userId: deletedByUserId,
      entityType: 'DEAL',
      entityId: id,
      action: 'DELETE',
    });
  }

  static async getPipeline(tenantId: string, ownerUserId?: string) {
    const where: any = { tenantId };
    if (ownerUserId) {
      where.ownerUserId = ownerUserId;
    }

    const deals = await prisma.deal.groupBy({
      by: ['stage'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    });

    const stages: DealStage[] = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];

    return stages.map((stage) => {
      const data = deals.find((d) => d.stage === stage);
      return {
        stage,
        count: data?._count._all || 0,
        totalAmount: data?._sum.amount || 0,
      };
    });
  }

  static async getActivities(
    id: string,
    tenantId: string,
    page = 1,
    limit = 20,
    isCompleted?: boolean,
    startDate?: string,
    endDate?: string
  ) {
    await this.findById(id, tenantId);

    const where: any = {
      tenantId,
      relatedDealId: id,
    };

    // Add completion status filter
    if (isCompleted !== undefined) {
      where.isCompleted = isCompleted;
    }

    // Add date range filter
    if (startDate || endDate) {
      where.dueAt = {};
      if (startDate) {
        where.dueAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.dueAt.lte = new Date(endDate);
      }
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
          organizations: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueAt: 'asc' },
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
