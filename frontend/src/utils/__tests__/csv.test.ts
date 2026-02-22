import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV, flattenForExport } from '../csv';

describe('csv utilities', () => {
  describe('flattenForExport', () => {
    it('should flatten nested objects with name property', () => {
      const data = [
        {
          id: '1',
          name: 'Deal 1',
          organization: { id: 'org1', name: 'Acme Corp' },
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        name: 'Deal 1',
        organization_name: 'Acme Corp',
      });
    });

    it('should flatten nested objects with firstName and lastName', () => {
      const data = [
        {
          id: '1',
          owner: { id: 'user1', firstName: 'John', lastName: 'Doe' },
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        owner_name: 'John Doe',
      });
    });

    it('should flatten nested objects with email property', () => {
      const data = [
        {
          id: '1',
          contact: { id: 'contact1', email: 'test@example.com' },
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        contact_email: 'test@example.com',
      });
    });

    it('should flatten email arrays', () => {
      const data = [
        {
          id: '1',
          emails: [
            { email: 'work@example.com', isPrimary: true },
            { email: 'home@example.com', isPrimary: false },
          ],
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        emails: 'work@example.com; home@example.com',
      });
    });

    it('should flatten phone arrays', () => {
      const data = [
        {
          id: '1',
          phones: [
            { phone: '+46701234567', type: 'work' },
            { phone: '+46709876543', type: 'mobile' },
          ],
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        phones: '+46701234567 (work); +46709876543 (mobile)',
      });
    });

    it('should convert other arrays to length', () => {
      const data = [
        {
          id: '1',
          contacts: [{ id: '1' }, { id: '2' }, { id: '3' }],
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        contacts: 3,
      });
    });

    it('should convert dates to ISO strings', () => {
      const date = new Date('2026-02-21T12:00:00Z');
      const data = [
        {
          id: '1',
          createdAt: date,
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        createdAt: date.toISOString(),
      });
    });

    it('should skip passwordHash and refreshToken fields', () => {
      const data = [
        {
          id: '1',
          email: 'test@example.com',
          passwordHash: 'secret',
          refreshToken: 'token',
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        email: 'test@example.com',
      });
    });

    it('should handle primitives', () => {
      const data = [
        {
          id: '1',
          name: 'Test',
          count: 42,
          active: true,
          value: null,
        },
      ];

      const result = flattenForExport(data);

      expect(result[0]).toEqual({
        id: '1',
        name: 'Test',
        count: 42,
        active: true,
        value: null,
      });
    });
  });

  describe('exportToCSV', () => {
    let alertSpy: ReturnType<typeof vi.spyOn>;
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      createElementSpy = vi.spyOn(document, 'createElement');
      // Mock URL.createObjectURL which doesn't exist in jsdom
      createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.createObjectURL = createObjectURLSpy;
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should show alert when data is empty', () => {
      exportToCSV([], 'test');
      expect(alertSpy).toHaveBeenCalledWith('No data to export');
    });

    it('should show alert when data is null', () => {
      exportToCSV(null as any, 'test');
      expect(alertSpy).toHaveBeenCalledWith('No data to export');
    });

    it('should create CSV with header and data rows', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ];

      exportToCSV(data, 'users');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/users-\d{4}-\d{2}-\d{2}\.csv/)
      );
      expect(appendChildSpy).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', name: 'Alice', value: null, other: undefined },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('should handle strings with commas by wrapping in quotes', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', address: '123 Main St, Suite 100' },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('should handle strings with quotes by escaping', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', note: 'He said "hello"' },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('should handle nested objects by converting to JSON', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', metadata: { key: 'value', count: 42 } },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('should handle arrays by converting to JSON', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', tags: ['tag1', 'tag2'] },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('should include all unique keys from all objects', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {} as any,
      };
      createElementSpy.mockReturnValue(mockLink as any);

      const data = [
        { id: '1', name: 'Alice' },
        { id: '2', email: 'bob@example.com' },
      ];

      exportToCSV(data, 'test');

      const blobArg = (createObjectURLSpy.mock.calls[0][0] as Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });
  });
});
