import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { AuditService } from '../services/audit.service';

export class AdminController {
  static async getTenantSettings(req: AuthRequest, res: Response) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { id: true, name: true, currency: true },
    });
    res.json(tenant);
  }

  static async updateTenantSettings(req: AuthRequest, res: Response) {
    const { currency } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { currency },
      select: { id: true, name: true, currency: true },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'TENANT',
      entityId: tenant.id,
      action: 'UPDATE_SETTINGS',
      afterData: { currency },
    });

    res.json(tenant);
  }

  static async getActivityTypes(req: AuthRequest, res: Response) {
    const activityTypes = await prisma.activityType.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(activityTypes);
  }

  static async createActivityType(req: AuthRequest, res: Response) {
    const { name } = req.body;

    const activityType = await prisma.activityType.create({
      data: {
        tenantId: req.user!.tenantId,
        name,
      },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'ACTIVITY_TYPE',
      entityId: activityType.id,
      action: 'CREATE',
      afterData: { name },
    });

    res.status(201).json(activityType);
  }

  static async updateActivityType(req: AuthRequest, res: Response) {
    const { name, isActive } = req.body;

    const existing = await prisma.activityType.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Activity type not found' });
      return;
    }

    const activityType = await prisma.activityType.update({
      where: { id: req.params.id },
      data: { name, isActive },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'ACTIVITY_TYPE',
      entityId: activityType.id,
      action: 'UPDATE',
      afterData: { name, isActive },
    });

    res.json(activityType);
  }

  static async deleteActivityType(req: AuthRequest, res: Response) {
    const existing = await prisma.activityType.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Activity type not found' });
      return;
    }

    await prisma.activityType.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'ACTIVITY_TYPE',
      entityId: req.params.id,
      action: 'DEACTIVATE',
    });

    res.status(204).send();
  }

  static async getContactRoles(req: AuthRequest, res: Response) {
    const contactRoles = await prisma.contactRole.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(contactRoles);
  }

  static async createContactRole(req: AuthRequest, res: Response) {
    const { name } = req.body;

    const contactRole = await prisma.contactRole.create({
      data: {
        tenantId: req.user!.tenantId,
        name,
      },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'CONTACT_ROLE',
      entityId: contactRole.id,
      action: 'CREATE',
      afterData: { name },
    });

    res.status(201).json(contactRole);
  }

  static async updateContactRole(req: AuthRequest, res: Response) {
    const { name, isActive } = req.body;

    const existing = await prisma.contactRole.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Contact role not found' });
      return;
    }

    const contactRole = await prisma.contactRole.update({
      where: { id: req.params.id },
      data: { name, isActive },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'CONTACT_ROLE',
      entityId: contactRole.id,
      action: 'UPDATE',
      afterData: { name, isActive },
    });

    res.json(contactRole);
  }

  static async deleteContactRole(req: AuthRequest, res: Response) {
    const existing = await prisma.contactRole.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Contact role not found' });
      return;
    }

    await prisma.contactRole.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await AuditService.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      entityType: 'CONTACT_ROLE',
      entityId: req.params.id,
      action: 'DEACTIVATE',
    });

    res.status(204).send();
  }

  static async getAuditLogs(req: AuthRequest, res: Response) {
    const {
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const result = await AuditService.getLogs({
      tenantId: req.user!.tenantId,
      entityType: entityType as string,
      entityId: entityId as string,
      userId: userId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json(result);
  }
}
