import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/user.service';
import { paginationSchema, changeOwnPasswordSchema, changeUserPasswordSchema } from '../utils/validation';

export class UserController {
  static async getAll(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await UserService.findAll({
      tenantId: req.user!.tenantId,
      ...pagination,
    });
    res.json(result);
  }

  static async getById(req: AuthRequest, res: Response) {
    const user = await UserService.findById(req.params.id, req.user!.tenantId);
    res.json(user);
  }

  static async update(req: AuthRequest, res: Response) {
    const { firstName, lastName, isActive } = req.body;
    const user = await UserService.update(
      req.params.id,
      { firstName, lastName, isActive },
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(user);
  }

  static async updateRole(req: AuthRequest, res: Response) {
    const { role } = req.body;
    const user = await UserService.updateRole(
      req.params.id,
      role,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(user);
  }

  static async deactivate(req: AuthRequest, res: Response) {
    await UserService.deactivate(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }

  static async delete(req: AuthRequest, res: Response) {
    await UserService.delete(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }

  static async changeOwnPassword(req: AuthRequest, res: Response) {
    const { currentPassword, newPassword } = changeOwnPasswordSchema.parse(req.body);
    await UserService.changeOwnPassword(
      req.user!.userId,
      req.user!.tenantId,
      currentPassword,
      newPassword
    );
    res.json({ message: 'Password changed successfully' });
  }

  static async changeUserPassword(req: AuthRequest, res: Response) {
    const { newPassword } = changeUserPasswordSchema.parse(req.body);
    await UserService.changeUserPassword(
      req.params.id,
      req.user!.tenantId,
      newPassword,
      req.user!.userId
    );
    res.json({ message: 'Password changed successfully' });
  }
}
