import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { verifyPassword, generateAccessToken, hashToken, JWTPayload } from '../utils/auth';
import { AppError } from '../middleware/errorHandler';

interface ClientRegistrationData {
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
}

interface AuthCodeParams {
  clientId: string;
  userId: string;
  tenantId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
  state?: string;
}

interface AuthSessionPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export class OAuthService {
  /**
   * Register a new OAuth client
   */
  static async registerClient(data: ClientRegistrationData) {
    const clientId = crypto.randomUUID();

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: null, // Public client (no secret)
        clientName: data.client_name,
        redirectUris: data.redirect_uris,
        grantTypes: data.grant_types,
        scope: null,
      },
    });

    return client;
  }

  /**
   * Validate client and redirect URI
   */
  static async validateClient(clientId: string, redirectUri: string) {
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client) {
      throw new AppError(400, 'Invalid client_id');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new AppError(400, 'Invalid redirect_uri');
    }

    return client;
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new AppError(401, 'Account is inactive');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials');
    }

    return user;
  }

  /**
   * Generate short-lived auth session token
   */
  static generateAuthSessionToken(payload: AuthSessionPayload): string {
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '2m',
    });
    return token;
  }

  /**
   * Verify auth session token
   */
  static verifyAuthSessionToken(token: string): AuthSessionPayload {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthSessionPayload;
      return payload;
    } catch (error) {
      throw new AppError(401, 'Invalid or expired auth session');
    }
  }

  /**
   * Create authorization code
   */
  static async createAuthorizationCode(params: AuthCodeParams) {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        clientId: params.clientId,
        userId: params.userId,
        tenantId: params.tenantId,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        scope: params.scope || null,
        state: params.state || null,
        expiresAt,
      },
    });

    return code;
  }

  /**
   * Verify PKCE challenge
   */
  private static verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const computed = hash.toString('base64url');
    return computed === codeChallenge;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCode(
    code: string,
    codeVerifier: string,
    clientId: string,
    redirectUri: string
  ) {
    // Look up authorization code
    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
      where: { code },
    });

    if (!authCode) {
      throw new AppError(400, 'Invalid authorization code');
    }

    // Check if already used
    if (authCode.usedAt) {
      throw new AppError(400, 'Authorization code already used');
    }

    // Check expiration
    if (authCode.expiresAt < new Date()) {
      throw new AppError(400, 'Authorization code expired');
    }

    // Verify client ID
    if (authCode.clientId !== clientId) {
      throw new AppError(400, 'Client ID mismatch');
    }

    // Verify redirect URI
    if (authCode.redirectUri !== redirectUri) {
      throw new AppError(400, 'Redirect URI mismatch');
    }

    // Verify PKCE
    if (!this.verifyPKCE(codeVerifier, authCode.codeChallenge)) {
      throw new AppError(400, 'Invalid code verifier');
    }

    // Mark code as used
    await prisma.oAuthAuthorizationCode.update({
      where: { code },
      data: { usedAt: new Date() },
    });

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: authCode.userId },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'User not found or inactive');
    }

    // Generate access token
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    // Generate OAuth refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        clientId,
        userId: user.id,
        tenantId: user.tenantId,
        scope: authCode.scope,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 900, // 15 minutes
      refresh_token: refreshToken,
      scope: authCode.scope || 'crm:read crm:write',
    };
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string, clientId: string) {
    const tokenHash = hashToken(refreshToken);

    // Look up refresh token
    const storedToken = await prisma.oAuthRefreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new AppError(400, 'Invalid refresh token');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new AppError(400, 'Refresh token expired');
    }

    // Verify client ID
    if (storedToken.clientId !== clientId) {
      throw new AppError(400, 'Client ID mismatch');
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'User not found or inactive');
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    // Rotate refresh token (delete old, create new)
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.oAuthRefreshToken.delete({
        where: { tokenHash },
      }),
      prisma.oAuthRefreshToken.create({
        data: {
          tokenHash: newTokenHash,
          clientId,
          userId: user.id,
          tenantId: user.tenantId,
          scope: storedToken.scope,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 900,
      refresh_token: newRefreshToken,
      scope: storedToken.scope || 'crm:read crm:write',
    };
  }
}
