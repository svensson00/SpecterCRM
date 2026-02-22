import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { authenticate, requireAdmin, requireRole, AuthRequest } from '../auth';
import { generateAccessToken, JWTPayload } from '../../utils/auth';

// Mock logger to suppress error logs during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Helper to create mock request
const createMockReq = (overrides = {}): AuthRequest => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  ...overrides,
} as AuthRequest);

// Helper to create mock response
const createMockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

// Helper to create mock next function
const createMockNext = () => vi.fn() as NextFunction;

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set JWT_SECRET for token generation/verification
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '15m';
  });

  it('should return 401 when no Authorization header is provided', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with "Bearer "', () => {
    const req = createMockReq({
      headers: { authorization: 'InvalidFormat token123' },
    });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer invalid-token' },
    });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', () => {
    // Create an expired token by setting expiry to past
    const payload: JWTPayload = {
      userId: 'user123',
      tenantId: 'tenant123',
      email: 'test@example.com',
      role: 'USER',
    };

    // Override JWT_EXPIRES_IN to create an expired token
    process.env.JWT_EXPIRES_IN = '-1s'; // Expired 1 second ago
    const expiredToken = generateAccessToken(payload);

    // Reset to normal expiry
    process.env.JWT_EXPIRES_IN = '15m';

    const req = createMockReq({
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next() for valid token', () => {
    const payload: JWTPayload = {
      userId: 'user123',
      tenantId: 'tenant123',
      email: 'test@example.com',
      role: 'USER',
    };
    const validToken = generateAccessToken(payload);

    const req = createMockReq({
      headers: { authorization: `Bearer ${validToken}` },
    });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('user123');
    expect(req.user?.tenantId).toBe('tenant123');
    expect(req.user?.email).toBe('test@example.com');
    expect(req.user?.role).toBe('USER');
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should set req.user with ADMIN role and call next() for valid admin token', () => {
    const payload: JWTPayload = {
      userId: 'admin123',
      tenantId: 'tenant123',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
    const validToken = generateAccessToken(payload);

    const req = createMockReq({
      headers: { authorization: `Bearer ${validToken}` },
    });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('admin123');
    expect(req.user?.role).toBe('ADMIN');
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireAdmin middleware', () => {
  it('should return 403 when req.user.role is "USER"', () => {
    const req = createMockReq({
      user: {
        userId: 'user123',
        tenantId: 'tenant123',
        email: 'user@example.com',
        role: 'USER',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when req.user.role is "ADMIN"', () => {
    const req = createMockReq({
      user: {
        userId: 'admin123',
        tenantId: 'tenant123',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole middleware', () => {
  it('should return 403 for unlisted role', () => {
    const middleware = requireRole('ADMIN', 'MANAGER');
    const req = createMockReq({
      user: {
        userId: 'user123',
        tenantId: 'tenant123',
        email: 'user@example.com',
        role: 'USER',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() for listed role (ADMIN)', () => {
    const middleware = requireRole('ADMIN', 'MANAGER');
    const req = createMockReq({
      user: {
        userId: 'admin123',
        tenantId: 'tenant123',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should call next() for listed role (MANAGER)', () => {
    const middleware = requireRole('ADMIN', 'MANAGER');
    const req = createMockReq({
      user: {
        userId: 'manager123',
        tenantId: 'tenant123',
        email: 'manager@example.com',
        role: 'MANAGER',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should call next() for single listed role', () => {
    const middleware = requireRole('USER');
    const req = createMockReq({
      user: {
        userId: 'user123',
        tenantId: 'tenant123',
        email: 'user@example.com',
        role: 'USER',
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should return 401 when req.user is not set', () => {
    const middleware = requireRole('ADMIN');
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});
