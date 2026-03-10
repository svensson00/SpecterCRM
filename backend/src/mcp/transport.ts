import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { TokenExpiredError } from 'jsonwebtoken';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { verifyAccessToken, JWTPayload } from '../utils/auth';
import { logger } from '../utils/logger';
import { createMcpServer } from './server';

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  auth: JWTPayload;
  lastActivity: number;
}

const sessions = new Map<string, McpSession>();

// Session timeout: 30 minutes.
// NOTE: This intentionally exceeds the default access token TTL (JWT_EXPIRES_IN = 15m)
// so that sessions survive long enough for a client to refresh its token and continue
// the same MCP conversation. In production, set JWT_EXPIRES_IN >= SESSION_TIMEOUT_MS
// (e.g. JWT_EXPIRES_IN=35m) to prevent token expiry mid-session. See ADR-001.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Discriminated union result from JWT extraction / verification.
 * - ok: true  — token was valid; payload carries the decoded claims
 * - ok: false — reason distinguishes the failure class so callers can return
 *               RFC 6750-compliant WWW-Authenticate challenges
 */
type AuthResult =
  | { ok: true; payload: JWTPayload }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' };

/**
 * Extract and verify JWT from the Authorization header.
 * Returns an AuthResult discriminated union instead of collapsing all failure
 * cases into null, so callers can distinguish missing / expired / invalid tokens
 * and return the appropriate RFC 6750 WWW-Authenticate challenge.
 */
function extractAuth(req: Request): AuthResult {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing' };
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyAccessToken(token);
    return { ok: true, payload };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      logger.warn('MCP JWT expired:', error.message);
      return { ok: false, reason: 'expired' };
    }
    logger.error('MCP JWT verification failed:', error);
    return { ok: false, reason: 'invalid' };
  }
}

/**
 * Build a RFC 6750-compliant WWW-Authenticate header value for a given
 * auth failure reason. The 'missing' case uses a plain Bearer challenge;
 * 'expired' and 'invalid' use the error="invalid_token" code required by
 * RFC 6750 §3.1 so that OAuth clients (e.g. Claude) can detect token expiry
 * and invoke their refresh-token flow automatically.
 */
function wwwAuthenticateHeader(reason: 'missing' | 'expired' | 'invalid', resourceMetadataUrl?: string): string {
  if (reason === 'missing') {
    return resourceMetadataUrl
      ? `Bearer resource_metadata="${resourceMetadataUrl}"`
      : 'Bearer';
  }
  const description = reason === 'expired'
    ? 'The access token expired'
    : 'The access token is invalid';
  const base = `Bearer error="invalid_token", error_description="${description}"`;
  return resourceMetadataUrl ? `${base}, resource_metadata="${resourceMetadataUrl}"` : base;
}

/**
 * Create Express router with MCP transport handlers
 */
export function createMcpRouter(): Router {
  const router = Router();

  // POST handler - handles MCP requests
  router.post('/', async (req: Request, res: Response) => {
    try {
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const proto = process.env.NODE_ENV === 'production' ? 'https' : (req.headers['x-forwarded-proto'] || req.protocol);
      const baseUrl = process.env.BASE_URL || `${proto}://${host}`;
      const resourceMetadataUrl = `${baseUrl}/oauth/oauth-protected-resource`;

      const authResult = extractAuth(req);
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!authResult.ok) {
        // If an existing session received an expired token, preserve the session so
        // the client can refresh its token and continue the same MCP conversation
        // without losing state. Return session_preserved: true to signal this.
        if (authResult.reason === 'expired' && sessionId && sessions.has(sessionId)) {
          logger.info(`MCP session ${sessionId}: token expired, session preserved for refresh`);
          res.status(401)
            .set('WWW-Authenticate', wwwAuthenticateHeader('expired', resourceMetadataUrl))
            .json({ error: 'token_expired', session_preserved: true });
          return;
        }

        res.status(401)
          .set('WWW-Authenticate', wwwAuthenticateHeader(authResult.reason, resourceMetadataUrl))
          .json({ error: 'Unauthorized' });
        return;
      }

      const auth = authResult.payload;
      let session: McpSession;

      if (!sessionId) {
        // Create new session
        const newSessionId = randomUUID();
        const server = createMcpServer(auth);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });
        await server.connect(transport);

        session = {
          transport,
          server,
          auth,
          lastActivity: Date.now(),
        };

        sessions.set(newSessionId, session);
        logger.info(`Created MCP session ${newSessionId} for user ${auth.email}`);
      } else {
        // Look up existing session
        session = sessions.get(sessionId)!;
        if (!session) {
          res.status(400).json({ error: 'Session not found' });
          return;
        }

        // Verify session belongs to same user
        if (session.auth.userId !== auth.userId || session.auth.tenantId !== auth.tenantId) {
          res.status(403).json({ error: 'Session does not belong to this user' });
          return;
        }

        // Update last activity
        session.lastActivity = Date.now();
      }

      // Delegate to transport
      await session.transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP POST handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // GET handler - handles SSE stream for server-initiated messages
  router.get('/', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }

      const authResult = extractAuth(req);
      if (!authResult.ok) {
        // Preserve the session on token expiry so the client can refresh and reconnect
        // the SSE stream without losing conversation state.
        if (authResult.reason === 'expired' && sessions.has(sessionId)) {
          logger.info(`MCP session ${sessionId}: token expired on GET, session preserved for refresh`);
          res.status(401)
            .set('WWW-Authenticate', wwwAuthenticateHeader('expired'))
            .json({ error: 'token_expired', session_preserved: true });
          return;
        }

        res.status(401)
          .set('WWW-Authenticate', wwwAuthenticateHeader(authResult.reason))
          .json({ error: 'Unauthorized' });
        return;
      }

      const auth = authResult.payload;
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (session.auth.userId !== auth.userId || session.auth.tenantId !== auth.tenantId) {
        res.status(403).json({ error: 'Session does not belong to this user' });
        return;
      }

      session.lastActivity = Date.now();
      await session.transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP GET handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // DELETE handler - terminates session
  router.delete('/', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }

      const authResult = extractAuth(req);
      if (!authResult.ok) {
        // Even on DELETE we preserve the session on token expiry — the client may
        // attempt to terminate with a stale token and then retry after refreshing.
        if (authResult.reason === 'expired' && sessions.has(sessionId)) {
          logger.info(`MCP session ${sessionId}: token expired on DELETE, session preserved for refresh`);
          res.status(401)
            .set('WWW-Authenticate', wwwAuthenticateHeader('expired'))
            .json({ error: 'token_expired', session_preserved: true });
          return;
        }

        res.status(401)
          .set('WWW-Authenticate', wwwAuthenticateHeader(authResult.reason))
          .json({ error: 'Unauthorized' });
        return;
      }

      const auth = authResult.payload;
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (session.auth.userId !== auth.userId || session.auth.tenantId !== auth.tenantId) {
        res.status(403).json({ error: 'Session does not belong to this user' });
        return;
      }

      await session.transport.handleRequest(req, res, req.body);
      try {
        await session.transport.close();
      } catch (closeError) {
        logger.error(`Error closing MCP session ${sessionId}:`, closeError);
      }
      sessions.delete(sessionId);
      logger.info(`Terminated MCP session ${sessionId}`);
    } catch (error) {
      logger.error('MCP DELETE handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return router;
}

/**
 * Close all active MCP sessions (for graceful shutdown)
 */
export async function closeAllSessions(): Promise<void> {
  logger.info(`Closing ${sessions.size} active MCP sessions...`);
  const closePromises: Promise<void>[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    closePromises.push(
      session.transport.close().catch((error) => {
        logger.error(`Error closing session ${sessionId}:`, error);
      })
    );
  }

  await Promise.allSettled(closePromises);
  sessions.clear();
  logger.info('All MCP sessions closed');
}

/**
 * Cleanup interval - remove stale sessions
 */
setInterval(() => {
  const now = Date.now();
  const staleSessionIds: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      staleSessionIds.push(sessionId);
    }
  }

  if (staleSessionIds.length > 0) {
    logger.info(`Cleaning up ${staleSessionIds.length} stale MCP sessions`);
    for (const sessionId of staleSessionIds) {
      const session = sessions.get(sessionId);
      if (session) {
        session.transport.close().catch((error) => {
          logger.error(`Error closing stale session ${sessionId}:`, error);
        });
        sessions.delete(sessionId);
      }
    }
  }
}, CLEANUP_INTERVAL_MS);
