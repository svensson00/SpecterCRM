import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = vi.hoisted(() => ({
  note: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  organization: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  deal: { findFirst: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));

import { NoteService } from '../note.service';

describe('NoteService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';
  const entityId = 'entity-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create note with entityType ORGANIZATION when entity exists', async () => {
      const noteData = {
        content: 'Test organization note',
        entityType: 'ORGANIZATION' as const,
        entityId,
      };

      const mockOrganization = { id: entityId, name: 'Test Org' };
      const mockNote = {
        id: 'note-123',
        ...noteData,
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrganization);
      mockPrisma.note.create.mockResolvedValue(mockNote);

      const result = await NoteService.create(noteData, tenantId, userId);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: entityId, tenantId },
      });
      expect(mockPrisma.note.create).toHaveBeenCalledWith({
        data: {
          content: noteData.content,
          entityType: noteData.entityType,
          entityId: noteData.entityId,
          tenantId,
          createdByUserId: userId,
        },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      expect(result).toEqual(mockNote);
    });

    it('should create note with entityType CONTACT when contact exists', async () => {
      const noteData = {
        content: 'Test contact note',
        entityType: 'CONTACT' as const,
        entityId,
      };

      const mockContact = { id: entityId, firstName: 'John', lastName: 'Doe' };
      const mockNote = {
        id: 'note-124',
        ...noteData,
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.note.create.mockResolvedValue(mockNote);

      const result = await NoteService.create(noteData, tenantId, userId);

      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith({
        where: { id: entityId, tenantId },
      });
      expect(result).toEqual(mockNote);
    });

    it('should create note with entityType DEAL when deal exists', async () => {
      const noteData = {
        content: 'Test deal note',
        entityType: 'DEAL' as const,
        entityId,
      };

      const mockDeal = { id: entityId, title: 'Test Deal' };
      const mockNote = {
        id: 'note-125',
        ...noteData,
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.note.create.mockResolvedValue(mockNote);

      const result = await NoteService.create(noteData, tenantId, userId);

      expect(mockPrisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: entityId, tenantId },
      });
      expect(result).toEqual(mockNote);
    });

    it('should throw 404 when entity does not exist', async () => {
      const noteData = {
        content: 'Test note',
        entityType: 'ORGANIZATION' as const,
        entityId: 'non-existent-id',
      };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        NoteService.create(noteData, tenantId, userId)
      ).rejects.toThrow(new AppError(404, 'ORGANIZATION not found'));
    });
  });

  describe('findByEntity', () => {
    it('should return notes ordered by createdAt desc', async () => {
      const mockNotes = [
        {
          id: 'note-2',
          content: 'Second note',
          entityType: 'ORGANIZATION',
          entityId,
          tenantId,
          createdAt: new Date('2025-01-02'),
          createdBy: {
            id: userId,
            email: 'user@test.com',
            firstName: 'Test',
            lastName: 'User',
          },
          updatedBy: null,
        },
        {
          id: 'note-1',
          content: 'First note',
          entityType: 'ORGANIZATION',
          entityId,
          tenantId,
          createdAt: new Date('2025-01-01'),
          createdBy: {
            id: userId,
            email: 'user@test.com',
            firstName: 'Test',
            lastName: 'User',
          },
          updatedBy: null,
        },
      ];

      mockPrisma.note.findMany.mockResolvedValue(mockNotes);

      const result = await NoteService.findByEntity('ORGANIZATION', entityId, tenantId);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: 'ORGANIZATION', entityId },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockNotes);
    });
  });

  describe('findById', () => {
    it('should return note when found', async () => {
      const mockNote = {
        id: 'note-123',
        content: 'Test note',
        entityType: 'ORGANIZATION',
        entityId,
        tenantId,
        createdAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
        updatedBy: null,
      };

      mockPrisma.note.findFirst.mockResolvedValue(mockNote);

      const result = await NoteService.findById('note-123', tenantId);

      expect(mockPrisma.note.findFirst).toHaveBeenCalledWith({
        where: { id: 'note-123', tenantId },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      expect(result).toEqual(mockNote);
    });

    it('should throw 404 when note not found', async () => {
      mockPrisma.note.findFirst.mockResolvedValue(null);

      await expect(
        NoteService.findById('non-existent-id', tenantId)
      ).rejects.toThrow(new AppError(404, 'Note not found'));
    });
  });

  describe('update', () => {
    it('should call findById then update note', async () => {
      const noteId = 'note-123';
      const newContent = 'Updated content';
      const updatedByUserId = 'updater-123';

      const mockExistingNote = {
        id: noteId,
        content: 'Original content',
        entityType: 'ORGANIZATION',
        entityId,
        tenantId,
        createdAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
        updatedBy: null,
      };

      const mockUpdatedNote = {
        ...mockExistingNote,
        content: newContent,
        updatedBy: {
          id: updatedByUserId,
          email: 'updater@test.com',
          firstName: 'Updater',
          lastName: 'User',
        },
      };

      mockPrisma.note.findFirst.mockResolvedValue(mockExistingNote);
      mockPrisma.note.update.mockResolvedValue(mockUpdatedNote);

      const result = await NoteService.update(noteId, newContent, tenantId, updatedByUserId);

      expect(mockPrisma.note.findFirst).toHaveBeenCalledWith({
        where: { id: noteId, tenantId },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      expect(mockPrisma.note.update).toHaveBeenCalledWith({
        where: { id: noteId },
        data: { content: newContent, updatedByUserId },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      expect(result).toEqual(mockUpdatedNote);
    });
  });

  describe('delete', () => {
    it('should call findById then delete note', async () => {
      const noteId = 'note-123';

      const mockNote = {
        id: noteId,
        content: 'Test note',
        entityType: 'ORGANIZATION',
        entityId,
        tenantId,
        createdAt: new Date(),
        createdBy: {
          id: userId,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
        },
        updatedBy: null,
      };

      mockPrisma.note.findFirst.mockResolvedValue(mockNote);
      mockPrisma.note.delete.mockResolvedValue(mockNote);

      await NoteService.delete(noteId, tenantId);

      expect(mockPrisma.note.findFirst).toHaveBeenCalledWith({
        where: { id: noteId, tenantId },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      expect(mockPrisma.note.delete).toHaveBeenCalledWith({
        where: { id: noteId },
      });
    });
  });
});
