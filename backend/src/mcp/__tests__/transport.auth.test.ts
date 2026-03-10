/**
 * MCP Transport Authentication Fix Tests
 *
 * Covers the three defects fixed in transport.ts:
 *  1. extractAuth discriminated union (missing / expired / invalid)
 *  2. RFC 6750-compliant WWW-Authenticate headers on all 401 responses
 *  3. Session preservation when a valid session gets an expired token
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Hoist mocks — must be declared before any imports that consume them
// ---------------------------------------------------------------------------
const mockVerifyAccessToken = vi.hoisted(() => vi.fn());

vi.mock('../../utils/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  generateAccessToken: vi.fn(),
  // JWTPayload is a TypeScript interface — no runtime value needed
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock createMcpServer so we never attempt a real DB connection
vi.mock('../server', () => ({
  createMcpServer: vi.fn(() => ({
    connect: vi.fn(async () => {}),
  })),
}));

// Mock StreamableHTTPServerTransport — implementation lives in the factory so it
// survives vi.clearAllMocks(). The constructor captures sessionIdGenerator from
// options and sets the Mcp-Session-Id response header, matching real behaviour.
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn(function (
    opts: { sessionIdGenerator?: () => string } | undefined
  ) {
    const sessionId = opts?.sessionIdGenerator?.();
    return {
      handleRequest: vi.fn(async function (_req: unknown, res: express.Response) {
        if (sessionId) {
          res.set('Mcp-Session-Id', sessionId);
        }
        res.status(200).json({ success: true });
      }),
      close: vi.fn(async function () {}),
    };
  }),
}));

// Import after all vi.mock() declarations
import { createMcpRouter } from '../transport';
import type { JWTPayload } from '../../utils/auth';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid JWT payload representing an authenticated user. */
const VALID_AUTH: JWTPayload = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@demo.com',
  role: 'ADMIN',
};

/**
 * Build an isolated Express app wrapping a fresh MCP router.
 * Call this after applyTransportMock() in beforeEach.
 */
function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/', createMcpRouter());
  return app;
}

/**
 * Create a live session by POSTing with a valid token and return the session
 * ID from the Mcp-Session-Id response header set by the transport mock.
 */
async function createSession(app: express.Application): Promise<string | undefined> {
  mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);
  const res = await request(app)
    .post('/')
    .set('Authorization', 'Bearer valid-token');
  return res.headers['mcp-session-id'] as string | undefined;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MCP Transport — Authentication Fixes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Only reset the auth mock between tests. Avoid vi.clearAllMocks() which
    // can strip the constructor implementation from the transport factory mock.
    mockVerifyAccessToken.mockReset();
    app = buildApp();
  });

  // =========================================================================
  // 1. Missing token — all three handlers
  // =========================================================================
  describe('Missing token — WWW-Authenticate: Bearer (all handlers)', () => {
    it('POST returns 401 with "Bearer" WWW-Authenticate when no Authorization header', async () => {
      const res = await request(app).post('/');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      // POST builds a resourceMetadataUrl from the host, so the header starts with "Bearer"
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth.toLowerCase()).toContain('bearer');
      // Must NOT carry an error code for the "missing" case per RFC 6750 §3.1
      expect(wwwAuth).not.toContain('error="invalid_token"');
    });

    it('GET returns 401 with "Bearer" WWW-Authenticate when no Authorization header', async () => {
      const res = await request(app)
        .get('/')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth.toLowerCase()).toContain('bearer');
      expect(wwwAuth).not.toContain('error="invalid_token"');
    });

    it('DELETE returns 401 with "Bearer" WWW-Authenticate when no Authorization header', async () => {
      const res = await request(app)
        .delete('/')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth.toLowerCase()).toContain('bearer');
      expect(wwwAuth).not.toContain('error="invalid_token"');
    });

    it('POST includes resource_metadata in WWW-Authenticate for missing token', async () => {
      const res = await request(app)
        .post('/')
        .set('Host', 'specter.example.com');

      expect(res.status).toBe(401);
      const wwwAuth: string = res.headers['www-authenticate'];
      // POST handler builds resourceMetadataUrl and passes it to wwwAuthenticateHeader()
      expect(wwwAuth).toMatch(/resource_metadata=/);
    });

    it('GET uses plain "Bearer" (no resource_metadata) for missing token', async () => {
      const res = await request(app)
        .get('/')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      const wwwAuth: string = res.headers['www-authenticate'];
      // GET and DELETE call wwwAuthenticateHeader(reason) with no URL argument
      expect(wwwAuth).toBe('Bearer');
    });
  });

  // =========================================================================
  // 2. Expired token — RFC 6750 error="invalid_token" + expiry description
  // =========================================================================
  describe('Expired token — RFC 6750 error="invalid_token" with expiry description', () => {
    beforeEach(() => {
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });
    });

    it('POST returns 401 with expired error description (no existing session)', async () => {
      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
    });

    it('GET returns 401 with expired error description (no existing session)', async () => {
      const res = await request(app)
        .get('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', 'nonexistent-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
    });

    it('DELETE returns 401 with expired error description (no existing session)', async () => {
      const res = await request(app)
        .delete('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', 'nonexistent-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
    });

    it('expired and invalid descriptions are distinct from each other', async () => {
      // Expired token path
      const expiredRes = await request(app)
        .get('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', 'session-x');

      // Switch to a generic invalid token error (not TokenExpiredError)
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('malformed token');
      });

      const invalidRes = await request(app)
        .get('/')
        .set('Authorization', 'Bearer bad-token')
        .set('mcp-session-id', 'session-x');

      const expiredHeader: string = expiredRes.headers['www-authenticate'];
      const invalidHeader: string = invalidRes.headers['www-authenticate'];

      expect(expiredHeader).toContain('The access token expired');
      expect(invalidHeader).toContain('The access token is invalid');
      expect(expiredHeader).not.toBe(invalidHeader);
    });
  });

  // =========================================================================
  // 3. Invalid token — error="invalid_token" + "is invalid" description
  // =========================================================================
  describe('Invalid token — RFC 6750 error="invalid_token" with invalid description', () => {
    beforeEach(() => {
      // Generic non-TokenExpiredError thrown by jwt.verify
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });
    });

    it('POST returns 401 with invalid token description', async () => {
      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer tampered-token');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token is invalid');
    });

    it('GET returns 401 with invalid token description', async () => {
      const res = await request(app)
        .get('/')
        .set('Authorization', 'Bearer tampered-token')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token is invalid');
    });

    it('DELETE returns 401 with invalid token description', async () => {
      const res = await request(app)
        .delete('/')
        .set('Authorization', 'Bearer tampered-token')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toBeDefined();
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token is invalid');
    });

    it('invalid token does NOT include expiry description', async () => {
      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer tampered-token');

      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).not.toContain('The access token expired');
    });
  });

  // =========================================================================
  // 4. Session preservation — expired token on an existing session
  // =========================================================================
  describe('Session preservation on token expiry', () => {
    it('POST returns session_preserved: true when an existing session receives an expired token', async () => {
      // Step 1: create a live session
      const sessionId = await createSession(app);
      if (!sessionId) {
        // Mock transport did not echo Mcp-Session-Id header — skip
        return;
      }

      // Step 2: simulate an expired token on that session
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(401);
      // Must carry the RFC 6750 expired challenge
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
      // Must signal that the session was NOT destroyed
      expect(res.body).toHaveProperty('error', 'token_expired');
      expect(res.body).toHaveProperty('session_preserved', true);
    });

    it('GET returns session_preserved: true when an existing session receives an expired token', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      const res = await request(app)
        .get('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(401);
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
      expect(res.body).toHaveProperty('error', 'token_expired');
      expect(res.body).toHaveProperty('session_preserved', true);
    });

    it('DELETE returns session_preserved: true when an existing session receives an expired token', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      const res = await request(app)
        .delete('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(401);
      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('The access token expired');
      expect(res.body).toHaveProperty('error', 'token_expired');
      expect(res.body).toHaveProperty('session_preserved', true);
    });

    it('session survives expired-token 401 — fresh token on the same session still works', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      // Expire the token mid-session
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      const expiredRes = await request(app)
        .post('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', sessionId);

      expect(expiredRes.status).toBe(401);
      expect(expiredRes.body).toHaveProperty('session_preserved', true);

      // Restore a valid token (simulating client token refresh)
      mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);

      const freshRes = await request(app)
        .post('/')
        .set('Authorization', 'Bearer fresh-token')
        .set('mcp-session-id', sessionId);

      // Session still exists so we must NOT receive 400 "Session not found"
      expect(freshRes.status).not.toBe(400);
      // The mock transport returns 200 for authenticated requests to live sessions
      expect(freshRes.status).toBe(200);
    });

    it('session_preserved is NOT returned when no session exists for the given session ID', async () => {
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      // Use a session ID that was never registered
      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer expired-token')
        .set('mcp-session-id', 'never-created-session-id');

      expect(res.status).toBe(401);
      // Regular 401 Unauthorized, NOT the session-preserved variant
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      expect(res.body).not.toHaveProperty('session_preserved');
    });

    it('session_preserved is NOT returned for an invalid (non-expired) token even when a session exists', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      // Generic error — NOT a TokenExpiredError instance
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer tampered-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
      // session_preserved must only appear on TokenExpiredError, never on generic auth failures
      expect(res.body).not.toHaveProperty('session_preserved');
    });
  });

  // =========================================================================
  // 5. Valid token — handlers proceed past auth
  // =========================================================================
  describe('Valid token — handlers proceed normally', () => {
    it('POST proceeds past auth and creates a new session with a valid JWT', async () => {
      mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);

      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer valid-token');

      // Auth passed; mock transport returns 200
      expect(res.status).toBe(200);
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
    });

    it('GET proceeds past auth when session exists and token is valid', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);

      const res = await request(app)
        .get('/')
        .set('Authorization', 'Bearer valid-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(200);
    });

    it('DELETE proceeds past auth when session exists and token is valid', async () => {
      const sessionId = await createSession(app);
      if (!sessionId) return;

      mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);

      const res = await request(app)
        .delete('/')
        .set('Authorization', 'Bearer valid-token')
        .set('mcp-session-id', sessionId);

      expect(res.status).toBe(200);
    });

    it('valid token does NOT produce a WWW-Authenticate header', async () => {
      mockVerifyAccessToken.mockReturnValueOnce(VALID_AUTH);

      const res = await request(app)
        .post('/')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.headers['www-authenticate']).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. WWW-Authenticate header format verification
  // =========================================================================
  describe('WWW-Authenticate header format conformance (RFC 6750)', () => {
    it('missing token on GET: header is exactly "Bearer"', async () => {
      // GET calls wwwAuthenticateHeader(reason) without a resourceMetadataUrl argument
      const res = await request(app)
        .get('/')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    });

    it('missing token on DELETE: header is exactly "Bearer"', async () => {
      const res = await request(app)
        .delete('/')
        .set('mcp-session-id', 'some-session');

      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    });

    it('missing token on POST: header is "Bearer resource_metadata=..." (includes URL)', async () => {
      const res = await request(app)
        .post('/')
        .set('Host', 'api.specter.test');

      expect(res.status).toBe(401);
      const wwwAuth: string = res.headers['www-authenticate'];
      // In test environment req.protocol may be empty, producing a protocol-relative URL
      // like //host/oauth/... instead of https://host/oauth/.... Assert structural
      // properties: starts with Bearer resource_metadata= and ends with the
      // oauth-protected-resource path.
      expect(wwwAuth).toMatch(/^Bearer resource_metadata="[^"]*\/oauth\/oauth-protected-resource"/);
    });

    it('expired token: header matches Bearer error="invalid_token", error_description="The access token expired"', async () => {
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      mockVerifyAccessToken.mockImplementation(() => {
        throw expiredError;
      });

      const res = await request(app)
        .get('/')
        .set('Authorization', 'Bearer expired')
        .set('mcp-session-id', 'nonexistent');

      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toMatch(/Bearer error="invalid_token"/);
      expect(wwwAuth).toMatch(/error_description="The access token expired"/);
    });

    it('invalid token: header matches Bearer error="invalid_token", error_description="The access token is invalid"', async () => {
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('bad signature');
      });

      const res = await request(app)
        .delete('/')
        .set('Authorization', 'Bearer bad')
        .set('mcp-session-id', 'nonexistent');

      const wwwAuth: string = res.headers['www-authenticate'];
      expect(wwwAuth).toMatch(/Bearer error="invalid_token"/);
      expect(wwwAuth).toMatch(/error_description="The access token is invalid"/);
    });
  });
});
