import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generatePasswordResetToken,
  type JWTPayload,
} from '../auth';
import jwt from 'jsonwebtoken';

describe('auth utils', () => {
  describe('password hashing', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT access tokens', () => {
    const payload: JWTPayload = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@eyevinn.se',
      role: 'USER',
    };

    it('should generate an access token', () => {
      const token = generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should verify a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tenantId).toBe(payload.tenantId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid access token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyAccessToken(invalidToken)).toThrow();
    });

    it('should throw error for tampered access token', () => {
      const token = generateAccessToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });

    it('should throw error for expired access token', () => {
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '0s', // Immediately expired
      });

      // Wait a tiny bit to ensure expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => verifyAccessToken(expiredToken)).toThrow();
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('JWT refresh tokens', () => {
    const payload: JWTPayload = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@eyevinn.se',
      role: 'USER',
    };

    it('should generate a refresh token', () => {
      const token = generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tenantId).toBe(payload.tenantId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid refresh token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyRefreshToken(invalidToken)).toThrow();
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = generateAccessToken(payload);

      // Access token uses different secret, should fail with refresh secret
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });

  describe('token hashing', () => {
    it('should hash a token to sha256', () => {
      const token = 'test-token-12345';
      const hash = hashToken(token);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should produce consistent hashes for same input', () => {
      const token = 'test-token-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const token1 = 'test-token-12345';
      const token2 = 'test-token-67890';
      const hash1 = hashToken(token1);
      const hash2 = hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('password reset token generation', () => {
    it('should generate a reset token', () => {
      const token = generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex = 64 characters
    });

    it('should generate unique tokens', () => {
      const token1 = generatePasswordResetToken();
      const token2 = generatePasswordResetToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate hex-encoded tokens', () => {
      const token = generatePasswordResetToken();

      // Hex only contains 0-9 and a-f
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
