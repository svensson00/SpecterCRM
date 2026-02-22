import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DealService } from '../services/deal.service';
import { NoteService } from '../services/note.service';
import { dealSchema, paginationSchema, noteSchema } from '../utils/validation';
import { DealStage } from '@prisma/client';

export class DealController {
  static async create(req: AuthRequest, res: Response) {
    const parsed = dealSchema.parse(req.body);
    const data = { ...parsed, expectedCloseDate: parsed.expectedCloseDate ?? undefined };
    const deal = await DealService.create(data, req.user!.tenantId, req.user!.userId);
    res.status(201).json(deal);
  }

  static async findAll(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await DealService.findAll({
      tenantId: req.user!.tenantId,
      stage: req.query.stage as DealStage,
      ownerUserId: req.query.ownerUserId as string,
      organizationId: req.query.organizationId as string,
      search: req.query.search as string,
      ...pagination,
    });
    res.json(result);
  }

  static async findById(req: AuthRequest, res: Response) {
    const deal = await DealService.findById(req.params.id, req.user!.tenantId);
    res.json(deal);
  }

  static async update(req: AuthRequest, res: Response) {
    const parsed = dealSchema.partial().parse(req.body);
    const data = { ...parsed, expectedCloseDate: parsed.expectedCloseDate ?? undefined };
    const deal = await DealService.update(
      req.params.id,
      data,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(deal);
  }

  static async updateStage(req: AuthRequest, res: Response) {
    const { stage, reasonLost } = req.body;
    const deal = await DealService.updateStage(
      req.params.id,
      stage as DealStage,
      reasonLost,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(deal);
  }

  static async delete(req: AuthRequest, res: Response) {
    await DealService.delete(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }

  static async getNotes(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await NoteService.findByEntityPaginated(
      'DEAL',
      req.params.id,
      req.user!.tenantId,
      pagination.page,
      pagination.limit
    );
    res.json(result);
  }

  static async createNote(req: AuthRequest, res: Response) {
    const { content } = noteSchema.pick({ content: true }).parse(req.body);
    const note = await NoteService.create(
      { content, entityType: 'DEAL', entityId: req.params.id },
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(201).json(note);
  }

  static async getPipeline(req: AuthRequest, res: Response) {
    const ownerUserId = req.query.ownerUserId as string | undefined;
    const pipeline = await DealService.getPipeline(req.user!.tenantId, ownerUserId);
    res.json(pipeline);
  }

  static async getActivities(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);

    // Parse filter parameters
    const isCompleted = req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await DealService.getActivities(
      req.params.id,
      req.user!.tenantId,
      pagination.page,
      pagination.limit,
      isCompleted,
      startDate,
      endDate
    );
    res.json(result);
  }
}
