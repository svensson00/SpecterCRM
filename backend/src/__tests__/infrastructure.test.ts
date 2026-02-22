import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true);
  });

  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.REFRESH_TOKEN_SECRET).toBeDefined();
  });
});
