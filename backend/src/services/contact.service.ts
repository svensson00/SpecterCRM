import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import Levenshtein from 'levenshtein';

export class ContactService {
  static async create(
    data: {
      firstName: string;
      lastName: string;
      jobTitle?: string;
      contactRole?: string;
      primaryOrganizationId: string;
      ownerUserId?: string;
      emails: Array<{ email: string; isPrimary: boolean }>;
      phones?: Array<{ phone: string; type?: string; isPrimary: boolean }>;
    },
    tenantId: string,
    createdByUserId: string
  ) {
    const org = await prisma.organization.findFirst({
      where: { id: data.primaryOrganizationId, tenantId },
    });

    if (!org) {
      throw new AppError(404, 'Organization not found');
    }

    // Note: Duplicate checking is now handled via the checkDuplicates endpoint
    // to allow user-friendly warnings instead of hard errors

    const contact = await prisma.contact.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        jobTitle: data.jobTitle,
        contactRole: data.contactRole,
        primaryOrganizationId: data.primaryOrganizationId,
        tenantId,
        createdByUserId,
        ownerUserId: data.ownerUserId || createdByUserId,
        emails: {
          create: data.emails,
        },
        phones: data.phones ? { create: data.phones } : undefined,
      },
      include: {
        emails: true,
        phones: true,
        primaryOrganization: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await AuditService.log({
      tenantId,
      userId: createdByUserId,
      entityType: 'CONTACT',
      entityId: contact.id,
      action: 'CREATE',
      afterData: { name: `${contact.firstName} ${contact.lastName}` },
    });

    return contact;
  }

  static async findAll(params: {
    tenantId: string;
    search?: string;
    ownerUserId?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      tenantId,
      search,
      ownerUserId,
      organizationId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = { tenantId };

    if (search) {
      const orConditions: any[] = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { emails: { some: { email: { contains: search, mode: 'insensitive' } } } },
      ];

      // If search contains space, also search for "firstName lastName" combination
      const searchParts = search.trim().split(/\s+/);
      if (searchParts.length >= 2) {
        const firstName = searchParts[0];
        const lastName = searchParts.slice(1).join(' ');

        // Add condition to match firstName AND lastName
        orConditions.push({
          AND: [
            { firstName: { contains: firstName, mode: 'insensitive' } },
            { lastName: { contains: lastName, mode: 'insensitive' } },
          ],
        });

        // Also try reverse (in case user typed "lastName firstName")
        orConditions.push({
          AND: [
            { firstName: { contains: lastName, mode: 'insensitive' } },
            { lastName: { contains: firstName, mode: 'insensitive' } },
          ],
        });
      }

      where.OR = orConditions;
    }

    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (organizationId) where.primaryOrganizationId = organizationId;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          emails: true,
          phones: true,
          primaryOrganization: { select: { id: true, name: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { deals: true, activities: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async findById(id: string, tenantId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        emails: true,
        phones: true,
        primaryOrganization: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { deals: true, activities: true } },
      },
    });

    if (!contact) {
      throw new AppError(404, 'Contact not found');
    }

    return contact;
  }

  static async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      jobTitle?: string;
      contactRole?: string;
      primaryOrganizationId?: string;
      ownerUserId?: string;
      emails?: Array<{ email: string; isPrimary: boolean }>;
      phones?: Array<{ phone: string; type?: string; isPrimary: boolean }>;
    },
    tenantId: string,
    updatedByUserId: string
  ) {
    const existing = await this.findById(id, tenantId);

    if (data.emails) {
      await prisma.contactEmail.deleteMany({ where: { contactId: id } });
    }

    if (data.phones !== undefined) {
      await prisma.contactPhone.deleteMany({ where: { contactId: id } });
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        jobTitle: data.jobTitle,
        contactRole: data.contactRole,
        primaryOrganizationId: data.primaryOrganizationId,
        ownerUserId: data.ownerUserId,
        updatedByUserId,
        emails: data.emails ? { create: data.emails } : undefined,
        phones: data.phones ? { create: data.phones } : undefined,
      },
      include: {
        emails: true,
        phones: true,
        primaryOrganization: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (data.ownerUserId && data.ownerUserId !== existing.ownerUserId) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'CONTACT',
        entityId: id,
        action: 'OWNER_CHANGE',
        beforeData: { ownerUserId: existing.ownerUserId },
        afterData: { ownerUserId: data.ownerUserId },
      });
    }

    return contact;
  }

  static async delete(id: string, tenantId: string, deletedByUserId: string) {
    await this.findById(id, tenantId);
    await prisma.contact.delete({ where: { id } });

    await AuditService.log({
      tenantId,
      userId: deletedByUserId,
      entityType: 'CONTACT',
      entityId: id,
      action: 'DELETE',
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
      contacts: {
        some: { contactId: id },
      },
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
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async checkDuplicates(
    firstName: string,
    lastName: string,
    emails: string[],
    primaryOrganizationId: string,
    tenantId: string
  ) {
    const SIMILARITY_THRESHOLD = 0.85;
    const potentialDuplicates = [];

    // Check for exact email matches across all contacts
    if (emails.length > 0) {
      const emailMatches = await prisma.contact.findMany({
        where: {
          tenantId,
          emails: {
            some: {
              email: { in: emails.map(e => e.toLowerCase()), mode: 'insensitive' },
            },
          },
        },
        include: {
          emails: { select: { email: true, isPrimary: true } },
          primaryOrganization: { select: { id: true, name: true } },
        },
      });

      for (const match of emailMatches) {
        potentialDuplicates.push({
          ...match,
          similarityScore: 1.0,
          matchReason: 'email',
        });
      }
    }

    // Check for similar names within the same organization
    const contactsInOrg = await prisma.contact.findMany({
      where: {
        tenantId,
        primaryOrganizationId,
      },
      include: {
        emails: { select: { email: true, isPrimary: true } },
        primaryOrganization: { select: { id: true, name: true } },
      },
    });

    const fullName = `${firstName} ${lastName}`.toLowerCase();

    for (const contact of contactsInOrg) {
      // Skip if already added as email match
      if (potentialDuplicates.some(d => d.id === contact.id)) {
        continue;
      }

      const contactFullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      const similarity = this.calculateSimilarity(fullName, contactFullName);

      if (similarity >= SIMILARITY_THRESHOLD) {
        potentialDuplicates.push({
          ...contact,
          similarityScore: similarity,
          matchReason: 'name',
        });
      }
    }

    return potentialDuplicates.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const lev = new Levenshtein(longer.toLowerCase(), shorter.toLowerCase());
    const editDistance = lev.distance;
    return (longer.length - editDistance) / longer.length;
  }
}
