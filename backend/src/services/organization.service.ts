import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import Levenshtein from 'levenshtein';

export class OrganizationService {
  static async create(
    data: {
      name: string;
      website?: string;
      street?: string;
      city?: string;
      zip?: string;
      country?: string;
      ownerUserId?: string;
    },
    tenantId: string,
    createdByUserId: string
  ) {
    // Check for exact name match (case-insensitive)
    const existingOrg = await prisma.organization.findFirst({
      where: {
        tenantId,
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existingOrg) {
      throw new AppError(409, 'An organization with this name already exists');
    }

    const organization = await prisma.organization.create({
      data: {
        ...data,
        tenantId,
        createdByUserId,
        ownerUserId: data.ownerUserId || createdByUserId,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await AuditService.log({
      tenantId,
      userId: createdByUserId,
      entityType: 'ORGANIZATION',
      entityId: organization.id,
      action: 'CREATE',
      afterData: { name: organization.name },
    });

    return organization;
  }

  static async findAll(params: {
    tenantId: string;
    search?: string;
    ownerUserId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { tenantId, search, ownerUserId, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (ownerUserId) {
      where.ownerUserId = ownerUserId;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: {
            select: { contacts: true, deals: true, activities: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findById(id: string, tenantId: string) {
    const organization = await prisma.organization.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: {
          select: { contacts: true, deals: true, activities: true },
        },
      },
    });

    if (!organization) {
      throw new AppError(404, 'Organization not found');
    }

    return organization;
  }

  static async update(
    id: string,
    data: {
      name?: string;
      website?: string;
      street?: string;
      city?: string;
      zip?: string;
      country?: string;
      ownerUserId?: string;
    },
    tenantId: string,
    updatedByUserId: string
  ) {
    const existing = await this.findById(id, tenantId);

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...data,
        updatedByUserId,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (data.ownerUserId && data.ownerUserId !== existing.ownerUserId) {
      await AuditService.log({
        tenantId,
        userId: updatedByUserId,
        entityType: 'ORGANIZATION',
        entityId: id,
        action: 'OWNER_CHANGE',
        beforeData: { ownerUserId: existing.ownerUserId },
        afterData: { ownerUserId: data.ownerUserId },
      });
    }

    await AuditService.log({
      tenantId,
      userId: updatedByUserId,
      entityType: 'ORGANIZATION',
      entityId: id,
      action: 'UPDATE',
      beforeData: existing,
      afterData: organization,
    });

    return organization;
  }

  static async delete(id: string, tenantId: string, deletedByUserId: string) {
    await this.findById(id, tenantId);

    await prisma.organization.delete({ where: { id } });

    await AuditService.log({
      tenantId,
      userId: deletedByUserId,
      entityType: 'ORGANIZATION',
      entityId: id,
      action: 'DELETE',
    });
  }

  static async getContacts(id: string, tenantId: string, page = 1, limit = 20) {
    await this.findById(id, tenantId);

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: { tenantId, primaryOrganizationId: id },
        include: {
          emails: true,
          phones: true,
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where: { tenantId, primaryOrganizationId: id } }),
    ]);

    return {
      data: contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getDeals(id: string, tenantId: string, page = 1, limit = 20) {
    await this.findById(id, tenantId);

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where: { tenantId, organizationId: id },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where: { tenantId, organizationId: id } }),
    ]);

    return {
      data: deals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getActivities(id: string, tenantId: string, page = 1, limit = 20) {
    await this.findById(id, tenantId);

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: { tenantId, relatedOrganizationId: id },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where: { tenantId, relatedOrganizationId: id } }),
    ]);

    return {
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async checkDuplicates(name: string, website: string | undefined, tenantId: string) {
    const SIMILARITY_THRESHOLD = 0.85;

    const organizations = await prisma.organization.findMany({
      where: { tenantId },
      select: { id: true, name: true, website: true, city: true, createdAt: true },
    });

    const potentialDuplicates = [];

    for (const org of organizations) {
      // Skip exact name matches (case-insensitive) - these will be blocked by create()
      if (org.name.toLowerCase() === name.toLowerCase()) {
        continue;
      }

      let score = 0;

      // Check website domain match
      if (website && org.website) {
        const domain1 = this.extractDomain(website);
        const domain2 = this.extractDomain(org.website);
        if (domain1 === domain2) {
          score = 1.0;
        }
      }

      // Check name similarity
      if (score < SIMILARITY_THRESHOLD) {
        const nameSimilarity = this.calculateSimilarity(name, org.name);
        score = Math.max(score, nameSimilarity);
      }

      if (score >= SIMILARITY_THRESHOLD) {
        potentialDuplicates.push({ ...org, similarityScore: score });
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
    const basicSimilarity = (longer.length - editDistance) / longer.length;

    // Also check normalized versions (without common business suffixes)
    const normalized1 = this.normalizeOrgName(str1);
    const normalized2 = this.normalizeOrgName(str2);

    if (normalized1 !== str1.toLowerCase() || normalized2 !== str2.toLowerCase()) {
      const longerNorm = normalized1.length > normalized2.length ? normalized1 : normalized2;
      const shorterNorm = normalized1.length > normalized2.length ? normalized2 : normalized1;

      if (longerNorm.length > 0) {
        const levNorm = new Levenshtein(longerNorm, shorterNorm);
        const editDistanceNorm = levNorm.distance;
        const normalizedSimilarity = (longerNorm.length - editDistanceNorm) / longerNorm.length;

        // Return the higher similarity score
        return Math.max(basicSimilarity, normalizedSimilarity);
      }
    }

    return basicSimilarity;
  }

  private static normalizeOrgName(name: string): string {
    let normalized = name.toLowerCase().trim();

    // Common business entity suffixes and their variations
    const suffixes = [
      'corporation',
      'corp',
      'incorporated',
      'inc',
      'limited',
      'ltd',
      'company',
      'co',
      'llc',
      'llp',
      'lp',
      'plc',
      'gmbh',
      'ag',
      'sa',
      'ab',
      'nv',
      'bv',
      'pty',
      'group',
      'holdings',
      'international',
      'intl',
      'enterprises',
      'industries',
      'solutions',
      'services',
      'technologies',
      'tech',
      'systems',
    ];

    // Remove trailing punctuation first
    normalized = normalized.replace(/[.,;!?]+$/g, '');

    // Remove suffixes (whole word matches at the end)
    for (const suffix of suffixes) {
      const pattern = new RegExp(`\\b${suffix}\\b\\.?$`, 'i');
      normalized = normalized.replace(pattern, '');
    }

    // Clean up extra whitespace
    normalized = normalized.trim();

    return normalized;
  }

  private static extractDomain(url: string): string {
    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url.toLowerCase();
    }
  }
}
