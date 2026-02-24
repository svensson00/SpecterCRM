import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JWTPayload } from '../utils/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { registerOrganizationTools } from './tools/organizations';
import { registerContactTools } from './tools/contacts';
import { registerDealTools } from './tools/deals';
import { registerActivityTools } from './tools/activities';
import { registerNoteTools } from './tools/notes';
import { registerReportTools } from './tools/reports';

/**
 * Wrapper that handles errors and formats MCP responses
 */
export function wrapToolHandler(handler: (params: Record<string, unknown>) => Promise<unknown>) {
  return async (params: Record<string, unknown>) => {
    try {
      const result = await handler(params);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('MCP tool error:', error);

      if (error instanceof AppError) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export type WrapToolHandler = typeof wrapToolHandler;

/**
 * Creates an MCP server instance with all tools registered for the authenticated user
 */
export function createMcpServer(auth: JWTPayload): McpServer {
  const server = new McpServer({
    name: 'SpecterCRM',
    version: '1.0.0',
  });

  // Register all tool categories
  registerOrganizationTools(server, auth, wrapToolHandler);
  registerContactTools(server, auth, wrapToolHandler);
  registerDealTools(server, auth, wrapToolHandler);
  registerActivityTools(server, auth, wrapToolHandler);
  registerNoteTools(server, auth, wrapToolHandler);
  registerReportTools(server, auth, wrapToolHandler);

  logger.info(`MCP server created for user ${auth.email} (tenant: ${auth.tenantId})`);

  return server;
}
