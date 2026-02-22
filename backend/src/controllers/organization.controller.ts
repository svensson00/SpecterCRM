import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OrganizationService } from '../services/organization.service';
import { NoteService } from '../services/note.service';
import { organizationSchema, paginationSchema, noteSchema } from '../utils/validation';

export class OrganizationController {
  static async create(req: AuthRequest, res: Response) {
    const data = organizationSchema.parse(req.body);
    const organization = await OrganizationService.create(
      data,
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(201).json(organization);
  }

  static async findAll(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await OrganizationService.findAll({
      tenantId: req.user!.tenantId,
      search: req.query.search as string,
      ownerUserId: req.query.ownerUserId as string,
      ...pagination,
    });
    res.json(result);
  }

  static async findById(req: AuthRequest, res: Response) {
    const organization = await OrganizationService.findById(
      req.params.id,
      req.user!.tenantId
    );
    res.json(organization);
  }

  static async update(req: AuthRequest, res: Response) {
    const data = organizationSchema.partial().parse(req.body);
    const organization = await OrganizationService.update(
      req.params.id,
      data,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(organization);
  }

  static async delete(req: AuthRequest, res: Response) {
    await OrganizationService.delete(
      req.params.id,
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(204).send();
  }

  static async getContacts(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await OrganizationService.getContacts(
      req.params.id,
      req.user!.tenantId,
      pagination.page,
      pagination.limit
    );
    res.json(result);
  }

  static async getDeals(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await OrganizationService.getDeals(
      req.params.id,
      req.user!.tenantId,
      pagination.page,
      pagination.limit
    );
    res.json(result);
  }

  static async getActivities(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);

    // Parse filter parameters
    const isCompleted = req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await OrganizationService.getActivities(
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

  static async getNotes(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await NoteService.findByEntityPaginated(
      'ORGANIZATION',
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
      {
        content,
        entityType: 'ORGANIZATION',
        entityId: req.params.id,
      },
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(201).json(note);
  }

  static async checkDuplicates(req: AuthRequest, res: Response) {
    const { name, website } = req.query;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const duplicates = await OrganizationService.checkDuplicates(
      name,
      website as string | undefined,
      req.user!.tenantId
    );
    res.json(duplicates);
  }
}
