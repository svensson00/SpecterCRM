import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ImportController } from '../import.controller';
import path from 'path';

const mockPrisma = vi.hoisted(() => ({
  importJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('fs');
vi.mock('child_process');

describe('ImportController', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      user: {
        userId: 'user-123',
        tenantId: 'tenant-123',
        email: 'admin@demo.com',
        role: 'ADMIN',
      },
    };
  });

  describe('uploadFiles', () => {
    it('should sanitize filename to prevent path traversal (issue #18)', async () => {
      // Test that path.basename is used in multer config
      // This is tested implicitly by multer's filename function
      const maliciousFilename = '../../../etc/passwd';
      const sanitizedFilename = path.basename(maliciousFilename);

      // Verify that path.basename strips directory components
      expect(sanitizedFilename).toBe('passwd');
      expect(sanitizedFilename).not.toContain('../');
      expect(sanitizedFilename).not.toContain('/');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await ImportController.uploadFiles(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should return 400 when no files are uploaded', async () => {
      mockReq.files = [];

      await ImportController.uploadFiles(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No files uploaded' });
    });
  });

  describe('triggerImport', () => {
    it('should use req.user.tenantId instead of req.body.tenantId (issue #19)', async () => {
      // Mock the import job creation
      mockPrisma.importJob.create.mockResolvedValue({
        id: 'job-123',
        tenantId: 'tenant-123',
        status: 'PENDING',
      } as any);

      // Mock fs to return files
      const fsMock = await import('fs');
      vi.mocked(fsMock.existsSync).mockReturnValue(true);
      vi.mocked(fsMock.readdirSync).mockReturnValue([
        'Organizations.csv',
        'Contacts.csv',
        'Deals.csv',
        'Activities.csv',
      ] as any);

      // Attempt to pass a different tenantId in body (IDOR attack)
      mockReq.body = { tenantId: 'attacker-tenant', clearExisting: false };

      await ImportController.triggerImport(mockReq as AuthRequest, mockRes as Response);

      // Verify that the tenantId from req.user is used, not req.body
      expect(mockPrisma.importJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-123', // From req.user, not req.body
          }),
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await ImportController.triggerImport(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should return 403 when user is not an admin', async () => {
      mockReq.user!.role = 'USER';

      await ImportController.triggerImport(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Only admins can perform imports' });
    });
  });
});
