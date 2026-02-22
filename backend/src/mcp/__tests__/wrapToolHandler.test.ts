import { describe, it, expect, vi } from 'vitest';
import { wrapToolHandler } from '../server';
import { AppError } from '../../middleware/errorHandler';

describe('wrapToolHandler', () => {
  it('should wrap successful results in MCP format', async () => {
    const handler = vi.fn().mockResolvedValue({ id: '1', name: 'Test Organization' });
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({ name: 'Test Organization' });

    expect(result).toHaveProperty('content');
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ id: '1', name: 'Test Organization' });
  });

  it('should format result as pretty JSON', async () => {
    const handler = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    expect(result.content[0].text).toContain('\n');
    expect(result.content[0].text).toContain('  ');
  });

  it('should return isError true for AppError', async () => {
    const handler = vi.fn().mockRejectedValue(new AppError(404, 'Organization not found'));
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({ id: 'nonexistent' });

    expect(result).toHaveProperty('isError', true);
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0].text).toContain('Error: Organization not found');
  });

  it('should return isError true for generic Error', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Database connection failed'));
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('Error: Database connection failed');
  });

  it('should handle unknown error types', async () => {
    const handler = vi.fn().mockRejectedValue('String error');
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('Error: Unknown error');
  });

  it('should call the handler with provided params', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const wrapped = wrapToolHandler(handler);

    const params = { id: 'org-1', name: 'SVT' };
    await wrapped(params);

    expect(handler).toHaveBeenCalledWith(params);
  });

  it('should handle null return value', async () => {
    const handler = vi.fn().mockResolvedValue(null);
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    expect(result.content[0].text).toBe('null');
  });

  it('should handle array return value', async () => {
    const handler = vi.fn().mockResolvedValue([
      { id: '1', name: 'Org 1' },
      { id: '2', name: 'Org 2' },
    ]);
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed).toHaveLength(2);
  });

  it('should handle complex nested objects', async () => {
    const handler = vi.fn().mockResolvedValue({
      organization: {
        id: 'org-1',
        name: 'SVT',
        contacts: [
          { id: 'contact-1', firstName: 'John', lastName: 'Doe' },
        ],
      },
    });
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.organization.contacts).toHaveLength(1);
    expect(parsed.organization.contacts[0].firstName).toBe('John');
  });

  it('should preserve AppError status code in message', async () => {
    const handler = vi.fn().mockRejectedValue(new AppError(403, 'Forbidden'));
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: Forbidden');
  });
});
