import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ActivityService } from '../services/activity.service';
import { activitySchema, paginationSchema } from '../utils/validation';

export class ActivityController {
  static async create(req: AuthRequest, res: Response) {
    const data = activitySchema.parse(req.body);
    const activity = await ActivityService.create(data, req.user!.tenantId, req.user!.userId);
    res.status(201).json(activity);
  }

  static async findAll(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await ActivityService.findAll({
      tenantId: req.user!.tenantId,
      type: req.query.type as string,
      ownerUserId: req.query.ownerUserId as string,
      isCompleted: req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      ...pagination,
    });
    res.json(result);
  }

  static async findById(req: AuthRequest, res: Response) {
    const activity = await ActivityService.findById(req.params.id, req.user!.tenantId);
    res.json(activity);
  }

  static async update(req: AuthRequest, res: Response) {
    const data = activitySchema.partial().parse(req.body);
    const activity = await ActivityService.update(
      req.params.id,
      data,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(activity);
  }

  static async toggleComplete(req: AuthRequest, res: Response) {
    const activity = await ActivityService.toggleComplete(
      req.params.id,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(activity);
  }

  static async delete(req: AuthRequest, res: Response) {
    await ActivityService.delete(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }
}
