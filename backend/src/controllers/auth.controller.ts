import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../utils/validation';

export class AuthController {
  static async register(req: AuthRequest, res: Response) {
    const data = registerSchema.parse(req.body);

    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can register new users' });
      return;
    }

    const user = await AuthService.register({
      ...data,
      tenantId: req.user.tenantId,
      createdByUserId: req.user.userId,
    });

    res.status(201).json(user);
  }

  static async login(req: AuthRequest, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const result = await AuthService.login(email, password);
    res.json(result);
  }

  static async refresh(req: AuthRequest, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const result = await AuthService.refresh(refreshToken);
    res.json(result);
  }

  static async logout(req: AuthRequest, res: Response) {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  }

  static async me(req: AuthRequest, res: Response) {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await AuthService.getMe(req.user.userId);
    res.json(user);
  }

  static async requestPasswordReset(req: AuthRequest, res: Response) {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    await AuthService.requestPasswordReset(email);
    res.json({ message: 'Password reset email sent if account exists' });
  }

  static async resetPassword(req: AuthRequest, res: Response) {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    await AuthService.resetPassword(token, newPassword);
    res.json({ message: 'Password reset successfully' });
  }
}
