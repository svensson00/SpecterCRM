import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ContactService } from '../services/contact.service';
import { NoteService } from '../services/note.service';
import { contactSchema, paginationSchema, noteSchema } from '../utils/validation';

export class ContactController {
  static async create(req: AuthRequest, res: Response) {
    const data = contactSchema.parse(req.body);
    const contact = await ContactService.create(
      { ...data, emails: data.emails || [] },
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(201).json(contact);
  }

  static async findAll(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);
    const result = await ContactService.findAll({
      tenantId: req.user!.tenantId,
      search: req.query.search as string,
      ownerUserId: req.query.ownerUserId as string,
      organizationId: req.query.organizationId as string,
      ...pagination,
    });
    res.json(result);
  }

  static async findById(req: AuthRequest, res: Response) {
    const contact = await ContactService.findById(req.params.id, req.user!.tenantId);
    res.json(contact);
  }

  static async update(req: AuthRequest, res: Response) {
    const data = contactSchema.partial().parse(req.body);
    const contact = await ContactService.update(
      req.params.id,
      data,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(contact);
  }

  static async delete(req: AuthRequest, res: Response) {
    await ContactService.delete(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }

  static async getActivities(req: AuthRequest, res: Response) {
    const pagination = paginationSchema.parse(req.query);

    // Parse filter parameters
    const isCompleted = req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await ContactService.getActivities(
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
      'CONTACT',
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
      { content, entityType: 'CONTACT', entityId: req.params.id },
      req.user!.tenantId,
      req.user!.userId
    );
    res.status(201).json(note);
  }

  static async checkDuplicates(req: AuthRequest, res: Response) {
    const { firstName, lastName, emails, primaryOrganizationId } = req.query;

    if (!firstName || typeof firstName !== 'string') {
      res.status(400).json({ error: 'firstName is required' });
      return;
    }

    if (!lastName || typeof lastName !== 'string') {
      res.status(400).json({ error: 'lastName is required' });
      return;
    }

    if (!primaryOrganizationId || typeof primaryOrganizationId !== 'string') {
      res.status(400).json({ error: 'primaryOrganizationId is required' });
      return;
    }

    const emailList = emails ? (typeof emails === 'string' ? [emails] : emails as string[]) : [];

    const duplicates = await ContactService.checkDuplicates(
      firstName,
      lastName,
      emailList,
      primaryOrganizationId,
      req.user!.tenantId
    );
    res.json(duplicates);
  }
}
