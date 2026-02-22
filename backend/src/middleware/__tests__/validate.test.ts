import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { validate } from '../validate';

// Helper to create mock request
const createMockReq = (overrides = {}): Request => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  ...overrides,
} as Request);

// Helper to create mock response
const createMockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

// Helper to create mock next function
const createMockNext = () => vi.fn() as NextFunction;

describe('validate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() for valid request body', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // Called with no arguments
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid request body', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: {
        name: '',
        email: 'invalid-email',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation error',
      details: expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          message: expect.any(String),
        }),
        expect.objectContaining({
          field: 'email',
          message: expect.any(String),
        }),
      ]),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should validate query parameters', async () => {
    const schema = z.object({
      query: z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      query: {
        page: '1',
        limit: '20',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid query parameters', async () => {
    const schema = z.object({
      query: z.object({
        page: z.string().regex(/^\d+$/),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      query: {
        page: 'not-a-number',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation error',
      details: expect.arrayContaining([
        expect.objectContaining({
          field: 'page',
          message: expect.any(String),
        }),
      ]),
    });
  });

  it('should validate route parameters', async () => {
    const schema = z.object({
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      params: {
        id: '123e4567-e89b-12d3-a456-426614174000',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid route parameters', async () => {
    const schema = z.object({
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      params: {
        id: 'not-a-uuid',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation error',
      details: expect.arrayContaining([
        expect.objectContaining({
          field: 'id',
          message: expect.any(String),
        }),
      ]),
    });
  });

  it('should validate combined body, query, and params', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(1),
      }),
      query: z.object({
        page: z.string().regex(/^\d+$/),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: { name: 'Test' },
      query: { page: '1' },
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should format field paths correctly for nested fields', async () => {
    const schema = z.object({
      body: z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: {
        user: {
          profile: {
            name: '',
          },
        },
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation error',
      details: expect.arrayContaining([
        expect.objectContaining({
          field: 'user.profile.name',
          message: expect.any(String),
        }),
      ]),
    });
  });

  it('should handle optional fields correctly', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: {
        name: 'Test',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with error for non-ZodError exceptions', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string(),
      }),
    });

    // Mock parseAsync to throw a non-ZodError
    const mockError = new Error('Unexpected error');
    const mockSchema = {
      parseAsync: vi.fn().mockRejectedValue(mockError),
    };

    const middleware = validate(mockSchema as any);
    const req = createMockReq({
      body: { name: 'Test' },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(mockError);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should handle multiple validation errors', async () => {
    const schema = z.object({
      body: z.object({
        email: z.string().email(),
        age: z.number().min(18),
        password: z.string().min(8),
      }),
    });

    const middleware = validate(schema);
    const req = createMockReq({
      body: {
        email: 'invalid-email',
        age: 15,
        password: 'short',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.error).toBe('Validation error');
    expect(jsonCall.details.length).toBeGreaterThanOrEqual(3);
  });
});
