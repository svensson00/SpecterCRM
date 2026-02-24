import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { NoteService } from '../../services/note.service';
import { NoteEntityType } from '@prisma/client';
import { WrapToolHandler } from '../server';

export function registerNoteTools(server: McpServer, auth: JWTPayload, wrapToolHandler: WrapToolHandler) {
  server.tool(
    'create_note',
    'Create a note attached to an organization, contact, or deal',
    {
      content: z.string().describe('Note content (required)'),
      entityType: z.enum(['ORGANIZATION', 'CONTACT', 'DEAL']).describe('Entity type (required)'),
      entityId: z.string().describe('Entity ID (required)'),
    },
    wrapToolHandler(async (params: any) => {
      return NoteService.create(
        {
          content: params.content,
          entityType: params.entityType as NoteEntityType,
          entityId: params.entityId,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'list_notes',
    'List all notes for a specific entity',
    {
      entityType: z.enum(['ORGANIZATION', 'CONTACT', 'DEAL']).describe('Entity type (required)'),
      entityId: z.string().describe('Entity ID (required)'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
    },
    wrapToolHandler(async (params: any) => {
      return NoteService.findByEntityPaginated(
        params.entityType as NoteEntityType,
        params.entityId,
        auth.tenantId,
        params.page,
        params.limit
      );
    })
  );

  server.tool(
    'get_note',
    'Get a specific note by ID',
    {
      id: z.string().describe('Note ID'),
    },
    wrapToolHandler(async (params: any) => {
      return NoteService.findById(params.id, auth.tenantId);
    })
  );

  server.tool(
    'update_note',
    'Update a note',
    {
      id: z.string().describe('Note ID'),
      content: z.string().describe('New note content'),
    },
    wrapToolHandler(async (params: any) => {
      return NoteService.update(params.id, params.content, auth.tenantId, auth.userId);
    })
  );

  server.tool(
    'delete_note',
    'Delete a note',
    {
      id: z.string().describe('Note ID'),
    },
    wrapToolHandler(async (params: any) => {
      await NoteService.delete(params.id, auth.tenantId, auth.userId);
      return { success: true, message: 'Note deleted successfully' };
    })
  );
}
