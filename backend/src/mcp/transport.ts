import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
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

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Extract and verify JWT from Authorization header
 */
function extractAuth(req: Request): JWTPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    return verifyAccessToken(token);
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Create Express router with MCP transport handlers
 */
export function createMcpRouter(): Router {
  const router = Router();

  // POST handler - handles MCP requests
  router.post('/', async (req: Request, res: Response) => {
    try {
      const auth = extractAuth(req);
      if (!auth) {
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const proto = process.env.NODE_ENV === 'production' ? 'https' : (req.headers['x-forwarded-proto'] || req.protocol);
        const baseUrl = process.env.BASE_URL || `${proto}://${host}`;
        res.status(401)
          .set('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/oauth/oauth-protected-resource"`)
          .json({ error: 'Unauthorized' });
        return;
      }

      const sessionId = req.headers['mcp-session-id'] as string | undefined;

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
      res.status(500).json({ error: 'Internal server error' });
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

      const auth = extractAuth(req);
      if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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
      res.status(500).json({ error: 'Internal server error' });
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

      const auth = extractAuth(req);
      if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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
      await session.transport.close();
      sessions.delete(sessionId);
      logger.info(`Terminated MCP session ${sessionId}`);
    } catch (error) {
      logger.error('MCP DELETE handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
