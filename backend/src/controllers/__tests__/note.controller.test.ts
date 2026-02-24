import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { NoteController } from '../note.controller';

const mockNoteService = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../services/note.service', () => ({
  NoteService: mockNoteService,
}));

describe('NoteController', () => {
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

  describe('findById', () => {
    it('should return note by id', async () => {
      const note = {
        id: 'note-123',
        content: 'Test note',
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        tenantId: 'tenant-123',
        createdAt: new Date(),
      };

      mockReq.params = { id: 'note-123' };
      mockNoteService.findById.mockResolvedValue(note);

      await NoteController.findById(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.findById).toHaveBeenCalledWith('note-123', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(note);
    });
  });

  describe('update', () => {
    it('should update note content and return updated note', async () => {
      const updatedNote = {
        id: 'note-123',
        content: 'Updated content',
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'note-123' };
      mockReq.body = { content: 'Updated content' };
      mockNoteService.update.mockResolvedValue(updatedNote);

      await NoteController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.update).toHaveBeenCalledWith('note-123', 'Updated content', 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedNote);
    });
  });

  describe('delete', () => {
    it('should delete note and return 204', async () => {
      mockReq.params = { id: 'note-123' };

      await NoteController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.delete).toHaveBeenCalledWith('note-123', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });
});
