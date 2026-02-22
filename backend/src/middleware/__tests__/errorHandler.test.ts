import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, errorHandler, notFound } from '../errorHandler';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';

describe('AppError', () => {
  it('should create AppError with statusCode and message', () => {
    const error = new AppError(404, 'Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Resource not found');
    expect(error.isOperational).toBe(true);
  });

  it('should create AppError with custom isOperational flag', () => {
    const error = new AppError(500, 'Internal error', false);
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('Internal error');
    expect(error.isOperational).toBe(false);
  });

  it('should be instance of Error', () => {
    const error = new AppError(400, 'Bad request');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('should have correct prototype', () => {
    const error = new AppError(403, 'Forbidden');
    expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
  });
});

describe('errorHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { path: '/test-path' };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('AppError handling', () => {
    it('should handle AppError with correct status code and message', () => {
      const error = new AppError(404, 'Organization not found');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization not found' });
    });

    it('should handle AppError with 400 status', () => {
      const error = new AppError(400, 'Invalid request data');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid request data' });
    });

    it('should handle AppError with 403 status', () => {
      const error = new AppError(403, 'Access denied');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });
  });

  describe('ZodError handling', () => {
    it('should handle ZodError with 400 status and field details', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      try {
        schema.parse({ email: 'invalid-email', age: 15 });
      } catch (error) {
        errorHandler(error as Error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Validation error',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        });
      }
    });

    it('should format ZodError field paths correctly', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1),
        }),
      });

      try {
        schema.parse({ user: { name: '' } });
      } catch (error) {
        errorHandler(error as Error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Validation error',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'user.name',
            }),
          ]),
        });
      }
    });
  });

  describe('Prisma error handling', () => {
    it('should handle P2002 (unique constraint) with 409 status', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Duplicate entry',
        field: 'email',
      });
    });

    it('should handle P2002 with multiple fields', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['tenantId', 'email'] },
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Duplicate entry',
        field: 'tenantId, email',
      });
    });

    it('should handle P2025 (record not found) with 404 status', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Record not found' });
    });

    it('should handle P2003 (foreign key constraint) with 400 status', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Related record not found' });
    });

    it('should handle unknown Prisma error codes as generic errors', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Some other error', {
        code: 'P9999',
        clientVersion: '5.0.0',
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Generic Error handling', () => {
    it('should handle generic Error with 500 status in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Something went wrong');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Something went wrong',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error message in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive error details');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic Error with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:5';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('Error handling precedence', () => {
    it('should handle ZodError before generic Error', () => {
      const schema = z.object({ name: z.string() });
      try {
        schema.parse({ name: 123 });
      } catch (error) {
        errorHandler(error as Error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Validation error' })
        );
      }
    });

    it('should handle Prisma errors before generic Error', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Record not found' });
    });

    it('should handle AppError before generic Error', () => {
      const error = new AppError(401, 'Unauthorized');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });
});

describe('notFound', () => {
  it('should return 404 with "Route not found" message', () => {
    const mockReq = { path: '/non-existent-route' } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    notFound(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Route not found' });
  });

  it('should handle any request path', () => {
    const mockReq = { path: '/api/v1/invalid' } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    notFound(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Route not found' });
  });
});
