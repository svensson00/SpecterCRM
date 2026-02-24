import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));

describe('Health Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('environment');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when database is connected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const res = await request.get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ready');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('database', 'connected');
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return 503 when database is disconnected', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const res = await request.get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('status', 'not_ready');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('database', 'disconnected');
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /health/startup', () => {
    it('should return 200 with startup status', async () => {
      const res = await request.get('/health/startup');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'started');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Security Headers (issue #21)', () => {
    it('should set Content-Security-Policy header', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('content-security-policy');

      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });

    it('should set X-Content-Type-Options header', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('x-frame-options');
    });

    it('should set X-XSS-Protection header', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('x-xss-protection');
    });
  });
});
