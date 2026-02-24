import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeduplicationService } from '../deduplication.service';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = vi.hoisted(() => ({
  organization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  contact: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  duplicateSuggestion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  deal: {
    updateMany: vi.fn(),
  },
  contactEmail: {
    updateMany: vi.fn(),
  },
  contactPhone: {
    updateMany: vi.fn(),
  },
  activity: {
    updateMany: vi.fn(),
  },
  note: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((operations: any[]) => {
    // Execute all operations in the array
    return Promise.all(operations);
  }),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('DeduplicationService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectOrganizationDuplicates (issue #22)', () => {
    it('should bulk-fetch existing suggestions to avoid O(n²) queries', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'SVT', website: 'https://svt.se' },
        { id: 'org-2', name: 'SVT AB', website: 'https://svt.se' },
        { id: 'org-3', name: 'YLE', website: 'https://yle.fi' },
      ];

      const mockExistingSuggestions = [
        { entityId1: 'org-1', entityId2: 'org-2' },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue(mockExistingSuggestions);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 0 });

      await DeduplicationService.detectOrganizationDuplicates(tenantId);

      // Verify bulk fetch happens ONCE, not N times
      expect(mockPrisma.duplicateSuggestion.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.duplicateSuggestion.findMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: 'ORGANIZATION', status: 'PENDING' },
        select: { entityId1: true, entityId2: true },
      });
    });

    it('should detect exact website domain matches', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'SVT', website: 'https://svt.se' },
        { id: 'org-2', name: 'Sveriges Television', website: 'http://www.svt.se' },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 1 });

      const result = await DeduplicationService.detectOrganizationDuplicates(tenantId);

      expect(result.detected).toBeGreaterThan(0);
      expect(mockPrisma.duplicateSuggestion.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId,
            entityType: 'ORGANIZATION',
            entityId1: 'org-1',
            entityId2: 'org-2',
            similarityScore: 1.0,
          }),
        ]),
      });
    });

    it('should detect similar names with high Levenshtein score', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Sveriges Television', website: null },
        { id: 'org-2', name: 'Sveriges Television AB', website: null },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 1 });

      const result = await DeduplicationService.detectOrganizationDuplicates(tenantId);

      expect(result.detected).toBeGreaterThan(0);
      expect(mockPrisma.duplicateSuggestion.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entityId1: 'org-1',
            entityId2: 'org-2',
            similarityScore: expect.any(Number),
          }),
        ]),
      });
    });

    it('should skip pairs that already exist in pending suggestions', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'SVT', website: 'https://svt.se' },
        { id: 'org-2', name: 'SVT', website: 'https://svt.se' },
      ];

      // Already has a pending suggestion
      const mockExistingSuggestions = [
        { entityId1: 'org-1', entityId2: 'org-2' },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue(mockExistingSuggestions);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 0 });

      const result = await DeduplicationService.detectOrganizationDuplicates(tenantId);

      // Should not create duplicate suggestion
      expect(result.detected).toBe(0);
      expect(mockPrisma.duplicateSuggestion.createMany).not.toHaveBeenCalled();
    });

    it('should handle empty organization list', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);

      const result = await DeduplicationService.detectOrganizationDuplicates(tenantId);

      expect(result.detected).toBe(0);
      expect(mockPrisma.duplicateSuggestion.createMany).not.toHaveBeenCalled();
    });
  });

  describe('detectContactDuplicates (issue #22)', () => {
    it('should bulk-fetch existing suggestions to avoid O(n²) queries', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'Jonas',
          lastName: 'Birme',
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'jonas@eyevinn.se' }],
        },
        {
          id: 'contact-2',
          firstName: 'Jonas',
          lastName: 'Birmé',
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'jonas.birme@eyevinn.se' }],
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 0 });

      await DeduplicationService.detectContactDuplicates(tenantId);

      // Verify bulk fetch happens ONCE, not N times
      expect(mockPrisma.duplicateSuggestion.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.duplicateSuggestion.findMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: 'CONTACT', status: 'PENDING' },
        select: { entityId1: true, entityId2: true },
      });
    });

    it('should detect exact email matches', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'Jonas',
          lastName: 'Birme',
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'jonas@eyevinn.se' }],
        },
        {
          id: 'contact-2',
          firstName: 'J',
          lastName: 'Birme',
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'jonas@eyevinn.se' }],
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 1 });

      const result = await DeduplicationService.detectContactDuplicates(tenantId);

      expect(result.detected).toBeGreaterThan(0);
      expect(mockPrisma.duplicateSuggestion.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId,
            entityType: 'CONTACT',
            entityId1: 'contact-1',
            entityId2: 'contact-2',
            similarityScore: 1.0,
          }),
        ]),
      });
    });

    it('should detect similar names at same organization', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'Jonas',
          lastName: 'Birme',
          primaryOrganizationId: 'org-1',
          emails: [],
        },
        {
          id: 'contact-2',
          firstName: 'Jonas',
          lastName: 'Birmé',
          primaryOrganizationId: 'org-1',
          emails: [],
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 1 });

      const result = await DeduplicationService.detectContactDuplicates(tenantId);

      expect(result.detected).toBeGreaterThan(0);
    });

    it('should skip pairs at different organizations with low name similarity', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'Jonas',
          lastName: 'Birme',
          primaryOrganizationId: 'org-1',
          emails: [],
        },
        {
          id: 'contact-2',
          firstName: 'Anders',
          lastName: 'Svensson',
          primaryOrganizationId: 'org-2',
          emails: [],
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);
      mockPrisma.duplicateSuggestion.createMany.mockResolvedValue({ count: 0 });

      const result = await DeduplicationService.detectContactDuplicates(tenantId);

      expect(result.detected).toBe(0);
    });
  });

  describe('getSuggestions (issue #22)', () => {
    it('should batch-fetch all entities instead of N+1 queries', async () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          entityId1: 'org-1',
          entityId2: 'org-2',
          entityType: 'ORGANIZATION' as const,
          similarityScore: 0.95,
          status: 'PENDING' as const,
          tenantId,
        },
        {
          id: 'sug-2',
          entityId1: 'org-3',
          entityId2: 'org-4',
          entityType: 'ORGANIZATION' as const,
          similarityScore: 0.90,
          status: 'PENDING' as const,
          tenantId,
        },
      ];

      const mockOrgs = [
        {
          id: 'org-1',
          name: 'SVT',
          website: 'https://svt.se',
          street: null,
          city: null,
          zip: null,
          country: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
          _count: { contacts: 5, deals: 3, activities: 10 },
        },
        {
          id: 'org-2',
          name: 'Sveriges Television',
          website: 'https://svt.se',
          street: null,
          city: null,
          zip: null,
          country: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
          _count: { contacts: 3, deals: 2, activities: 5 },
        },
        {
          id: 'org-3',
          name: 'YLE',
          website: 'https://yle.fi',
          street: null,
          city: null,
          zip: null,
          country: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
          _count: { contacts: 2, deals: 1, activities: 3 },
        },
        {
          id: 'org-4',
          name: 'YLE Oy',
          website: 'https://yle.fi',
          street: null,
          city: null,
          zip: null,
          country: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
          _count: { contacts: 1, deals: 1, activities: 2 },
        },
      ];

      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue(mockSuggestions);
      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);

      const result = await DeduplicationService.getSuggestions(tenantId, 'ORGANIZATION');

      // Verify single batch fetch for all entities
      expect(mockPrisma.organization.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['org-1', 'org-2', 'org-3', 'org-4'] } },
        select: expect.any(Object),
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('entity1');
      expect(result[0]).toHaveProperty('entity2');
      expect(result[0].entity1.name).toBe('SVT');
      expect(result[0].entity2.name).toBe('Sveriges Television');
    });

    it('should batch-fetch contact entities with related data', async () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          entityId1: 'contact-1',
          entityId2: 'contact-2',
          entityType: 'CONTACT' as const,
          similarityScore: 0.95,
          status: 'PENDING' as const,
          tenantId,
        },
      ];

      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'Jonas',
          lastName: 'Birme',
          jobTitle: 'CTO',
          emails: [{ email: 'jonas@eyevinn.se', isPrimary: true }],
          phones: [{ phone: '+46701234567', type: 'MOBILE', isPrimary: true }],
          primaryOrganization: { id: 'org-1', name: 'Eyevinn' },
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
        },
        {
          id: 'contact-2',
          firstName: 'J',
          lastName: 'Birme',
          jobTitle: 'CTO',
          emails: [{ email: 'jonas.birme@eyevinn.se', isPrimary: true }],
          phones: [],
          primaryOrganization: { id: 'org-1', name: 'Eyevinn' },
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
        },
      ];

      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue(mockSuggestions);
      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);

      const result = await DeduplicationService.getSuggestions(tenantId, 'CONTACT');

      // Verify single batch fetch
      expect(mockPrisma.contact.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['contact-1', 'contact-2'] } },
        include: expect.any(Object),
      });

      expect(result).toHaveLength(1);
      expect(result[0].entity1.firstName).toBe('Jonas');
      expect(result[0].entity2.firstName).toBe('J');
    });

    it('should return empty array when no suggestions exist', async () => {
      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue([]);

      const result = await DeduplicationService.getSuggestions(tenantId, 'ORGANIZATION');

      expect(result).toEqual([]);
      expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('should handle missing entities gracefully', async () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          entityId1: 'org-1',
          entityId2: 'org-deleted',
          entityType: 'ORGANIZATION' as const,
          similarityScore: 0.95,
          status: 'PENDING' as const,
          tenantId,
        },
      ];

      const mockOrgs = [
        {
          id: 'org-1',
          name: 'SVT',
          website: 'https://svt.se',
          street: null,
          city: null,
          zip: null,
          country: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
          _count: { contacts: 5, deals: 3, activities: 10 },
        },
        // org-deleted is missing
      ];

      mockPrisma.duplicateSuggestion.findMany.mockResolvedValue(mockSuggestions);
      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);

      const result = await DeduplicationService.getSuggestions(tenantId, 'ORGANIZATION');

      expect(result).toHaveLength(1);
      expect(result[0].entity1.name).toBe('SVT');
      expect(result[0].entity2).toBeNull();
    });
  });

  describe('merge', () => {
    it('should merge organization duplicates and update related records', async () => {
      const suggestionId = 'sug-123';
      const primaryId = 'org-1';
      const duplicateId = 'org-2';

      const mockSuggestion = {
        id: suggestionId,
        tenantId,
        entityType: 'ORGANIZATION' as const,
        entityId1: primaryId,
        entityId2: duplicateId,
      };

      mockPrisma.duplicateSuggestion.findFirst.mockResolvedValue(mockSuggestion);
      mockPrisma.duplicateSuggestion.update.mockResolvedValue({ ...mockSuggestion, status: 'MERGED' });
      mockPrisma.contact.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.deal.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 10 });
      mockPrisma.note.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.organization.delete.mockResolvedValue({ id: duplicateId } as any);

      await DeduplicationService.merge(suggestionId, primaryId, tenantId, userId);

      expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith({
        where: { primaryOrganizationId: duplicateId },
        data: { primaryOrganizationId: primaryId },
      });

      expect(mockPrisma.deal.updateMany).toHaveBeenCalledWith({
        where: { organizationId: duplicateId },
        data: { organizationId: primaryId },
      });

      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { relatedOrganizationId: duplicateId },
        data: { relatedOrganizationId: primaryId },
      });

      expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
        where: { entityType: 'ORGANIZATION', entityId: duplicateId },
        data: { entityId: primaryId },
      });

      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
        where: { id: duplicateId },
      });

      expect(mockPrisma.duplicateSuggestion.update).toHaveBeenCalledWith({
        where: { id: suggestionId },
        data: {
          status: 'MERGED',
          reviewedByUserId: userId,
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('should throw 404 when suggestion not found', async () => {
      mockPrisma.duplicateSuggestion.findFirst.mockResolvedValue(null);

      await expect(
        DeduplicationService.merge('nonexistent', 'org-1', tenantId, userId)
      ).rejects.toThrow(new AppError(404, 'Duplicate suggestion not found'));
    });

    it('should throw 400 when primaryId is invalid', async () => {
      const suggestionId = 'sug-123';
      const primaryId = 'org-invalid';

      const mockSuggestion = {
        id: suggestionId,
        tenantId,
        entityType: 'ORGANIZATION' as const,
        entityId1: 'org-1',
        entityId2: 'org-2',
      };

      mockPrisma.duplicateSuggestion.findFirst.mockResolvedValue(mockSuggestion);

      await expect(
        DeduplicationService.merge(suggestionId, primaryId, tenantId, userId)
      ).rejects.toThrow(new AppError(400, 'Invalid primary entity ID'));
    });
  });

  describe('dismiss', () => {
    it('should mark suggestion as dismissed', async () => {
      const suggestionId = 'sug-123';

      const mockSuggestion = {
        id: suggestionId,
        tenantId,
        entityType: 'ORGANIZATION' as const,
        entityId1: 'org-1',
        entityId2: 'org-2',
        status: 'PENDING' as const,
      };

      mockPrisma.duplicateSuggestion.findFirst.mockResolvedValue(mockSuggestion);
      mockPrisma.duplicateSuggestion.update.mockResolvedValue({ ...mockSuggestion, status: 'DISMISSED' });

      await DeduplicationService.dismiss(suggestionId, tenantId, userId);

      expect(mockPrisma.duplicateSuggestion.update).toHaveBeenCalledWith({
        where: { id: suggestionId },
        data: {
          status: 'DISMISSED',
          reviewedByUserId: userId,
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('should throw 404 when suggestion not found', async () => {
      mockPrisma.duplicateSuggestion.findFirst.mockResolvedValue(null);

      await expect(
        DeduplicationService.dismiss('nonexistent', tenantId, userId)
      ).rejects.toThrow(new AppError(404, 'Duplicate suggestion not found'));
    });
  });
});
