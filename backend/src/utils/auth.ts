import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export function generateAccessToken(payload: JWTPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });
}

export function generateRefreshToken(payload: JWTPayload): string {
  const expiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, { expiresIn });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as JWTPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Parse a duration string (e.g., "8h", "15m", "1d", "3600") into seconds.
 * Supports suffixes: s (seconds), m (minutes), h (hours), d (days).
 * Bare numbers are treated as seconds (jsonwebtoken convention).
 * Falls back to 900 (15 minutes) if the input is unparseable.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)\s*([smhd]?)$/i);
  if (!match) return 900;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case '':  return value;
    default:  return 900;
  }
}

/**
 * Return the configured JWT access token TTL in seconds.
 * Reads JWT_EXPIRES_IN from environment, defaulting to '15m'.
 */
export function getAccessTokenTtlSeconds(): number {
  return parseDurationToSeconds(process.env.JWT_EXPIRES_IN || '15m');
}
