import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ContactController } from '../contact.controller';

const mockContactService = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getActivities: vi.fn(),
  checkDuplicates: vi.fn(),
}));

const mockNoteService = vi.hoisted(() => ({
  findByEntity: vi.fn(),
  findByEntityPaginated: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../services/contact.service', () => ({
  ContactService: mockContactService,
}));

vi.mock('../../services/note.service', () => ({
  NoteService: mockNoteService,
}));

describe('ContactController', () => {
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
    it('should create contact and return 201', async () => {
      const contactData = {
        firstName: 'John',
        lastName: 'Doe',
        primaryOrganizationId: 'org-123',
        emails: [{ email: 'john@example.com', isPrimary: false }],
      };
      const createdContact = {
        id: 'contact-123',
        ...contactData,
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = contactData;
      mockContactService.create.mockResolvedValue(createdContact);

      await ContactController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.create).toHaveBeenCalledWith(contactData, 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdContact);
    });

    it('should default emails to empty array when not provided', async () => {
      const contactData = {
        firstName: 'John',
        lastName: 'Doe',
        primaryOrganizationId: 'org-123',
      };
      const createdContact = {
        id: 'contact-123',
        ...contactData,
        emails: [],
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = contactData;
      mockContactService.create.mockResolvedValue(createdContact);

      await ContactController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.create).toHaveBeenCalledWith(
        { ...contactData, emails: [] },
        'tenant-123',
        'user-123'
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const paginatedResult = {
        data: [
          { id: 'contact-1', firstName: 'John', lastName: 'Doe', tenantId: 'tenant-123' },
          { id: 'contact-2', firstName: 'Jane', lastName: 'Smith', tenantId: 'tenant-123' },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };

      mockReq.query = { page: '1', limit: '20' };
      mockContactService.findAll.mockResolvedValue(paginatedResult);

      await ContactController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: undefined,
        ownerUserId: undefined,
        organizationId: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should apply search, ownerUserId, and organizationId filters', async () => {
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.query = {
        page: '1',
        limit: '20',
        search: 'john',
        ownerUserId: 'owner-456',
        organizationId: 'org-789',
      };
      mockContactService.findAll.mockResolvedValue(paginatedResult);

      await ContactController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: 'john',
        ownerUserId: 'owner-456',
        organizationId: 'org-789',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findById', () => {
    it('should return contact by id', async () => {
      const contact = {
        id: 'contact-123',
        firstName: 'John',
        lastName: 'Doe',
        tenantId: 'tenant-123',
      };

      mockReq.params = { id: 'contact-123' };
      mockContactService.findById.mockResolvedValue(contact);

      await ContactController.findById(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.findById).toHaveBeenCalledWith('contact-123', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(contact);
    });
  });

  describe('update', () => {
    it('should update contact and return updated data', async () => {
      const updateData = { firstName: 'Jonathan' };
      const updatedContact = {
        id: 'contact-123',
        firstName: 'Jonathan',
        lastName: 'Doe',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.body = updateData;
      mockContactService.update.mockResolvedValue(updatedContact);

      await ContactController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.update).toHaveBeenCalledWith('contact-123', updateData, 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedContact);
    });
  });

  describe('delete', () => {
    it('should delete contact and return 204', async () => {
      mockReq.params = { id: 'contact-123' };

      await ContactController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.delete).toHaveBeenCalledWith('contact-123', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('getActivities', () => {
    it('should return paginated activities for contact', async () => {
      const activitiesResult = {
        data: [
          { id: 'activity-1', subject: 'Follow-up call' },
        ],
        pagination: { page: 1, limit: 20, total: 10, totalPages: 1 },
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockContactService.getActivities.mockResolvedValue(activitiesResult);

      await ContactController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.getActivities).toHaveBeenCalledWith(
        'contact-123',
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

      mockReq.params = { id: 'contact-123' };
      mockReq.query = { page: '1', limit: '20', isCompleted: 'false' };
      mockContactService.getActivities.mockResolvedValue(activitiesResult);

      await ContactController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.getActivities).toHaveBeenCalledWith(
        'contact-123',
        'tenant-123',
        1,
        20,
        false,
        undefined,
        undefined
      );
    });

    it('should apply date range filters', async () => {
      const activitiesResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.query = { page: '1', limit: '20', startDate: '2026-02-01', endDate: '2026-02-28' };
      mockContactService.getActivities.mockResolvedValue(activitiesResult);

      await ContactController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.getActivities).toHaveBeenCalledWith(
        'contact-123',
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
    it('should return notes for contact', async () => {
      const paginatedResult = {
        data: [
          { id: 'note-1', content: 'Test note', entityType: 'CONTACT', entityId: 'contact-123' },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockNoteService.findByEntityPaginated.mockResolvedValue(paginatedResult);

      await ContactController.getNotes(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.findByEntityPaginated).toHaveBeenCalledWith('CONTACT', 'contact-123', 'tenant-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });
  });

  describe('createNote', () => {
    it('should create note and return 201', async () => {
      const noteData = {
        content: 'New note',
        entityType: 'CONTACT',
        entityId: 'contact-123'
      };
      const createdNote = {
        id: 'note-123',
        content: 'New note',
        entityType: 'CONTACT',
        entityId: 'contact-123',
        tenantId: 'tenant-123',
        createdAt: new Date(),
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.body = noteData;
      mockNoteService.create.mockResolvedValue(createdNote);

      await ContactController.createNote(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.create).toHaveBeenCalledWith(
        { content: 'New note', entityType: 'CONTACT', entityId: 'contact-123' },
        'tenant-123',
        'user-123'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdNote);
    });
  });

  describe('checkDuplicates', () => {
    it('should return 400 when firstName is missing', async () => {
      mockReq.query = { lastName: 'Doe', primaryOrganizationId: 'org-123' };

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'firstName is required' });
      expect(mockContactService.checkDuplicates).not.toHaveBeenCalled();
    });

    it('should return 400 when lastName is missing', async () => {
      mockReq.query = { firstName: 'John', primaryOrganizationId: 'org-123' };

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'lastName is required' });
      expect(mockContactService.checkDuplicates).not.toHaveBeenCalled();
    });

    it('should return 400 when primaryOrganizationId is missing', async () => {
      mockReq.query = { firstName: 'John', lastName: 'Doe' };

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'primaryOrganizationId is required' });
      expect(mockContactService.checkDuplicates).not.toHaveBeenCalled();
    });

    it('should check duplicates without emails', async () => {
      const duplicates = [
        { id: 'contact-456', firstName: 'John', lastName: 'Doe', similarity: 1.0 },
      ];

      mockReq.query = { firstName: 'John', lastName: 'Doe', primaryOrganizationId: 'org-123' };
      mockContactService.checkDuplicates.mockResolvedValue(duplicates);

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.checkDuplicates).toHaveBeenCalledWith(
        'John',
        'Doe',
        [],
        'org-123',
        'tenant-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(duplicates);
    });

    it('should check duplicates with single email', async () => {
      const duplicates = [
        { id: 'contact-456', firstName: 'John', lastName: 'Doe', similarity: 1.0 },
      ];

      mockReq.query = {
        firstName: 'John',
        lastName: 'Doe',
        emails: 'john@example.com',
        primaryOrganizationId: 'org-123',
      };
      mockContactService.checkDuplicates.mockResolvedValue(duplicates);

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.checkDuplicates).toHaveBeenCalledWith(
        'John',
        'Doe',
        ['john@example.com'],
        'org-123',
        'tenant-123'
      );
    });

    it('should check duplicates with multiple emails', async () => {
      const duplicates = [];

      mockReq.query = {
        firstName: 'John',
        lastName: 'Doe',
        emails: ['john@example.com', 'jdoe@example.com'],
        primaryOrganizationId: 'org-123',
      };
      mockContactService.checkDuplicates.mockResolvedValue(duplicates);

      await ContactController.checkDuplicates(mockReq as AuthRequest, mockRes as Response);

      expect(mockContactService.checkDuplicates).toHaveBeenCalledWith(
        'John',
        'Doe',
        ['john@example.com', 'jdoe@example.com'],
        'org-123',
        'tenant-123'
      );
    });
  });
});
