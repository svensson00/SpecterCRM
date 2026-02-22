import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { OrganizationController } from '../organization.controller';

const mockOrganizationService = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getContacts: vi.fn(),
  getDeals: vi.fn(),
  getActivities: vi.fn(),
  checkDuplicates: vi.fn(),
}));

const mockNoteService = vi.hoisted(() => ({
  findByEntity: vi.fn(),
  findByEntityPaginated: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../services/organization.service', () => ({
  OrganizationService: mockOrganizationService,
}));

vi.mock('../../services/note.service', () => ({
  NoteService: mockNoteService,
}));

describe('OrganizationController', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'USER' },
    };
  });

  describe('create', () => {
    it('should create organization and return 201', async () => {
      const orgData = { name: 'Acme Corp', website: 'https://acme.com' };
      const createdOrg = {
        id: 'org-123',
        ...orgData,
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = orgData;
      mockOrganizationService.create.mockResolvedValue(createdOrg);

      await OrganizationController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.create).toHaveBeenCalledWith(orgData, 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdOrg);
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      const paginatedResult = {
        data: [
          { id: 'org-1', name: 'Org 1', tenantId: 'tenant-123' },
          { id: 'org-2', name: 'Org 2', tenantId: 'tenant-123' },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };

      mockReq.query = { page: '1', limit: '20' };
      mockOrganizationService.findAll.mockResolvedValue(paginatedResult);

      await OrganizationController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: undefined,
        ownerUserId: undefined,
        sortBy: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should apply search and ownerUserId filters', async () => {
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.query = { page: '1', limit: '20', search: 'acme', ownerUserId: 'owner-456' };
      mockOrganizationService.findAll.mockResolvedValue(paginatedResult);

      await OrganizationController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: 'acme',
        ownerUserId: 'owner-456',
        sortBy: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findById', () => {
    it('should return organization by id', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId: 'tenant-123' };

      mockReq.params = { id: 'org-123' };
      mockOrganizationService.findById.mockResolvedValue(organization);

      await OrganizationController.findById(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.findById).toHaveBeenCalledWith('org-123', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(organization);
    });
  });

  describe('update', () => {
    it('should update organization and return updated data', async () => {
      const updateData = { name: 'Updated Corp' };
      const updatedOrg = {
        id: 'org-123',
        name: 'Updated Corp',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'org-123' };
      mockReq.body = updateData;
      mockOrganizationService.update.mockResolvedValue(updatedOrg);

      await OrganizationController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.update).toHaveBeenCalledWith('org-123', updateData, 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedOrg);
    });
  });

  describe('delete', () => {
    it('should delete organization and return 204', async () => {
      mockReq.params = { id: 'org-123' };

      await OrganizationController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.delete).toHaveBeenCalledWith('org-123', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('getContacts', () => {
    it('should return paginated contacts for organization', async () => {
      const contactsResult = {
        data: [
          { id: 'contact-1', firstName: 'John', lastName: 'Doe' },
        ],
        pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockOrganizationService.getContacts.mockResolvedValue(contactsResult);

      await OrganizationController.getContacts(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.getContacts).toHaveBeenCalledWith('org-123', 'tenant-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(contactsResult);
    });
  });

  describe('getDeals', () => {
    it('should return paginated deals for organization', async () => {
      const dealsResult = {
        data: [
          { id: 'deal-1', title: 'Deal 1', organizationId: 'org-123' },
        ],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockOrganizationService.getDeals.mockResolvedValue(dealsResult);

      await OrganizationController.getDeals(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.getDeals).toHaveBeenCalledWith('org-123', 'tenant-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(dealsResult);
    });
  });

  describe('getActivities', () => {
    it('should return paginated activities for organization', async () => {
      const activitiesResult = {
        data: [
          { id: 'activity-1', subject: 'Follow-up call', relatedOrganizationId: 'org-123' },
        ],
        pagination: { page: 1, limit: 20, total: 10, totalPages: 1 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockOrganizationService.getActivities.mockResolvedValue(activitiesResult);

      await OrganizationController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.getActivities).toHaveBeenCalledWith(
        'org-123',
        'tenant-123',
        1,
        20,
        undefined,
        undefined,
        undefined
      );
      expect(mockRes.json).toHaveBeenCalledWith(activitiesResult);
    });

    it('should apply isCompleted filter', async () => {
      const activitiesResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20', isCompleted: 'true' };
      mockOrganizationService.getActivities.mockResolvedValue(activitiesResult);

      await OrganizationController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.getActivities).toHaveBeenCalledWith(
        'org-123',
        'tenant-123',
        1,
        20,
        true,
        undefined,
        undefined
      );
    });

    it('should apply date range filters', async () => {
      const activitiesResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20', startDate: '2026-02-01', endDate: '2026-02-28' };
      mockOrganizationService.getActivities.mockResolvedValue(activitiesResult);

      await OrganizationController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.getActivities).toHaveBeenCalledWith(
        'org-123',
        'tenant-123',
        1,
        20,
        undefined,
        '2026-02-01',
        '2026-02-28'
      );
    });
  });

  describe('getNotes', () => {
    it('should return notes for organization', async () => {
      const paginatedResult = {
        data: [
          { id: 'note-1', content: 'Test note', entityType: 'ORGANIZATION', entityId: 'org-123' },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      mockReq.params = { id: 'org-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockNoteService.findByEntityPaginated.mockResolvedValue(paginatedResult);

      await OrganizationController.getNotes(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.findByEntityPaginated).toHaveBeenCalledWith('ORGANIZATION', 'org-123', 'tenant-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });
  });

  describe('createNote', () => {
    it('should create note and return 201', async () => {
      const noteData = {
        content: 'New note',
        entityType: 'ORGANIZATION',
        entityId: 'org-123'
      };
      const createdNote = {
        id: 'note-123',
        content: 'New note',
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        tenantId: 'tenant-123',
        createdAt: new Date(),
      };

      mockReq.params = { id: 'org-123' };
      mockReq.body = noteData;
      mockNoteService.create.mockResolvedValue(createdNote);

      await OrganizationController.createNote(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.create).toHaveBeenCalledWith(
        { content: 'New note', entityType: 'ORGANIZATION', entityId: 'org-123' },
        'tenant-123',
        'user-123'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdNote);
    });
  });

  describe('checkDuplicates', () => {
    it('should return 400 when name is missing', async () => {
      mockReq.query = {};

      await OrganizationController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'name is required' });
      expect(mockOrganizationService.checkDuplicates).not.toHaveBeenCalled();
    });

    it('should check duplicates by name only', async () => {
      const duplicates = [
        { id: 'org-456', name: 'Acme Corp', similarity: 0.95 },
      ];

      mockReq.query = { name: 'Acme Corp' };
      mockOrganizationService.checkDuplicates.mockResolvedValue(duplicates);

      await OrganizationController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.checkDuplicates).toHaveBeenCalledWith('Acme Corp', undefined, 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(duplicates);
    });

    it('should check duplicates by name and website', async () => {
      const duplicates = [
        { id: 'org-456', name: 'Acme Corp', website: 'https://acme.com', similarity: 1.0 },
      ];

      mockReq.query = { name: 'Acme Corp', website: 'https://acme.com' };
      mockOrganizationService.checkDuplicates.mockResolvedValue(duplicates);

      await OrganizationController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(mockOrganizationService.checkDuplicates).toHaveBeenCalledWith('Acme Corp', 'https://acme.com', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(duplicates);
    });
  });
});
