import prisma from '../config/database';
import Levenshtein from 'levenshtein';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';

const SIMILARITY_THRESHOLD = 0.85;

export class DeduplicationService {
  static async detectOrganizationDuplicates(tenantId: string) {
    const organizations = await prisma.organization.findMany({
      where: { tenantId },
      select: { id: true, name: true, website: true },
    });

    // Fetch all existing pending suggestions upfront to avoid per-pair queries
    const existingSuggestions = await prisma.duplicateSuggestion.findMany({
      where: { tenantId, entityType: 'ORGANIZATION', status: 'PENDING' },
      select: { entityId1: true, entityId2: true },
    });
    const existingPairKeys = new Set(
      existingSuggestions.flatMap(s => [
        `${s.entityId1}:${s.entityId2}`,
        `${s.entityId2}:${s.entityId1}`,
      ])
    );

    const suggestions = [];

    for (let i = 0; i < organizations.length; i++) {
      for (let j = i + 1; j < organizations.length; j++) {
        const org1 = organizations[i];
        const org2 = organizations[j];

        let score = 0;

        if (org1.website && org2.website) {
          const domain1 = this.extractDomain(org1.website);
          const domain2 = this.extractDomain(org2.website);
          if (domain1 === domain2) {
            score = 1.0;
          }
        }

        if (score < SIMILARITY_THRESHOLD) {
          const nameSimilarity = this.calculateSimilarity(org1.name, org2.name);
          score = Math.max(score, nameSimilarity);
        }

        if (score >= SIMILARITY_THRESHOLD) {
          const pairKey = `${org1.id}:${org2.id}`;
          if (!existingPairKeys.has(pairKey)) {
            suggestions.push({
              tenantId,
              entityType: 'ORGANIZATION' as const,
              entityId1: org1.id,
              entityId2: org2.id,
              similarityScore: score,
            });
            // Add to set so we don't create duplicates within this run
            existingPairKeys.add(pairKey);
            existingPairKeys.add(`${org2.id}:${org1.id}`);
          }
        }
      }
    }

    if (suggestions.length > 0) {
      await prisma.duplicateSuggestion.createMany({ data: suggestions });
    }

    return { detected: suggestions.length };
  }

  static async detectContactDuplicates(tenantId: string) {
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        primaryOrganizationId: true,
        emails: { select: { email: true } }
      },
    });

    // Fetch all existing pending suggestions upfront
    const existingSuggestions = await prisma.duplicateSuggestion.findMany({
      where: { tenantId, entityType: 'CONTACT', status: 'PENDING' },
      select: { entityId1: true, entityId2: true },
    });
    const existingPairKeys = new Set(
      existingSuggestions.flatMap(s => [
        `${s.entityId1}:${s.entityId2}`,
        `${s.entityId2}:${s.entityId1}`,
      ])
    );

    const suggestions = [];

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const contact1 = contacts[i];
        const contact2 = contacts[j];

        if (contact1.primaryOrganizationId !== contact2.primaryOrganizationId) {
          continue;
        }

        let score = 0;

        const emails1 = contact1.emails.map((e) => e.email.toLowerCase());
        const emails2 = contact2.emails.map((e) => e.email.toLowerCase());
        const hasCommonEmail = emails1.some((e) => emails2.includes(e));

        if (hasCommonEmail) {
          score = 1.0;
        } else {
          const name1 = `${contact1.firstName} ${contact1.lastName}`.toLowerCase();
          const name2 = `${contact2.firstName} ${contact2.lastName}`.toLowerCase();
          score = this.calculateSimilarity(name1, name2);
        }

        if (score >= SIMILARITY_THRESHOLD) {
          const pairKey = `${contact1.id}:${contact2.id}`;
          if (!existingPairKeys.has(pairKey)) {
            suggestions.push({
              tenantId,
              entityType: 'CONTACT' as const,
              entityId1: contact1.id,
              entityId2: contact2.id,
              similarityScore: score,
            });
            // Add to set so we don't create duplicates within this run
            existingPairKeys.add(pairKey);
            existingPairKeys.add(`${contact2.id}:${contact1.id}`);
          }
        }
      }
    }

    if (suggestions.length > 0) {
      await prisma.duplicateSuggestion.createMany({ data: suggestions });
    }

    return { detected: suggestions.length };
  }

  static async getSuggestions(tenantId: string, entityType: 'ORGANIZATION' | 'CONTACT') {
    const suggestions = await prisma.duplicateSuggestion.findMany({
      where: { tenantId, entityType, status: 'PENDING' },
      orderBy: { similarityScore: 'desc' },
    });

    if (suggestions.length === 0) return [];

    // Collect all unique entity IDs
    const entityIds = [...new Set(suggestions.flatMap(s => [s.entityId1, s.entityId2]))];

    // Batch fetch all entities at once
    let entityMap: Map<string, any>;

    if (entityType === 'ORGANIZATION') {
      const entities = await prisma.organization.findMany({
        where: { id: { in: entityIds } },
        select: {
          id: true,
          name: true,
          website: true,
          street: true,
          city: true,
          zip: true,
          country: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { firstName: true, lastName: true, email: true } },
          _count: { select: { contacts: true, deals: true, activities: true } },
        },
      });
      entityMap = new Map(entities.map(e => [e.id, e]));
    } else {
      const entities = await prisma.contact.findMany({
        where: { id: { in: entityIds } },
        include: {
          emails: { select: { email: true, isPrimary: true } },
          phones: { select: { phone: true, type: true, isPrimary: true } },
          primaryOrganization: { select: { id: true, name: true } },
          owner: { select: { firstName: true, lastName: true, email: true } },
        },
      });
      entityMap = new Map(entities.map(e => [e.id, e]));
    }

    return suggestions.map(s => {
      const entity1 = entityMap.get(s.entityId1) || null;
      const entity2 = entityMap.get(s.entityId2) || null;
      return {
        ...s,
        entity1,
        entity2,
        // Add aliases for frontend compatibility
        record1Id: s.entityId1,
        record2Id: s.entityId2,
        record1Data: entity1,
        record2Data: entity2,
      };
    });
  }

  static async merge(
    suggestionId: string,
    primaryId: string,
    tenantId: string,
    userId: string
  ) {
    const suggestion = await prisma.duplicateSuggestion.findFirst({
      where: { id: suggestionId, tenantId },
    });

    if (!suggestion) {
      throw new AppError(404, 'Duplicate suggestion not found');
    }

    if (primaryId !== suggestion.entityId1 && primaryId !== suggestion.entityId2) {
      throw new AppError(400, 'Invalid primary entity ID');
    }

    const duplicateId = primaryId === suggestion.entityId1 ? suggestion.entityId2 : suggestion.entityId1;

    if (suggestion.entityType === 'ORGANIZATION') {
      await this.mergeOrganizations(primaryId, duplicateId, tenantId, userId);
    } else {
      await this.mergeContacts(primaryId, duplicateId, tenantId, userId);
    }

    await prisma.duplicateSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'MERGED', reviewedByUserId: userId, reviewedAt: new Date() },
    });

    await AuditService.log({
      tenantId,
      userId,
      entityType: suggestion.entityType,
      entityId: primaryId,
      action: 'MERGE',
      beforeData: { duplicateId },
      afterData: { primaryId },
    });
  }

  static async dismiss(suggestionId: string, tenantId: string, userId: string) {
    const suggestion = await prisma.duplicateSuggestion.findFirst({
      where: { id: suggestionId, tenantId },
    });

    if (!suggestion) {
      throw new AppError(404, 'Duplicate suggestion not found');
    }

    await prisma.duplicateSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'DISMISSED', reviewedByUserId: userId, reviewedAt: new Date() },
    });
  }

  private static async mergeOrganizations(
    primaryId: string,
    duplicateId: string,
    tenantId: string,
    userId: string
  ) {
    await prisma.$transaction([
      prisma.contact.updateMany({
        where: { primaryOrganizationId: duplicateId },
        data: { primaryOrganizationId: primaryId },
      }),
      prisma.deal.updateMany({
        where: { organizationId: duplicateId },
        data: { organizationId: primaryId },
      }),
      prisma.activity.updateMany({
        where: { relatedOrganizationId: duplicateId },
        data: { relatedOrganizationId: primaryId },
      }),
      prisma.note.updateMany({
        where: { entityType: 'ORGANIZATION', entityId: duplicateId },
        data: { entityId: primaryId },
      }),
      prisma.organization.delete({ where: { id: duplicateId } }),
    ]);
  }

  private static async mergeContacts(
    primaryId: string,
    duplicateId: string,
    tenantId: string,
    userId: string
  ) {
    await prisma.$transaction([
      prisma.dealContact.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      prisma.activityContact.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      prisma.note.updateMany({
        where: { entityType: 'CONTACT', entityId: duplicateId },
        data: { entityId: primaryId },
      }),
      prisma.contact.delete({ where: { id: duplicateId } }),
    ]);
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const lev = new Levenshtein(longer.toLowerCase(), shorter.toLowerCase());
    const editDistance = lev.distance;
    return (longer.length - editDistance) / longer.length;
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
