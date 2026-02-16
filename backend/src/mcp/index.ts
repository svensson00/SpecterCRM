import { Express } from 'express';
import { createMcpRouter } from './transport';

export { closeAllSessions } from './transport';

/**
 * Mount MCP endpoint on Express app
 */
export function mountMcp(app: Express): void {
  app.use('/mcp', createMcpRouter());
}
