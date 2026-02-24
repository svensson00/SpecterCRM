import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NoteService } from '../services/note.service';

export class NoteController {
  static async findById(req: AuthRequest, res: Response) {
    const note = await NoteService.findById(req.params.id, req.user!.tenantId);
    res.json(note);
  }

  static async update(req: AuthRequest, res: Response) {
    const { content } = req.body;
    const note = await NoteService.update(
      req.params.id,
      content,
      req.user!.tenantId,
      req.user!.userId
    );
    res.json(note);
  }

  static async delete(req: AuthRequest, res: Response) {
    await NoteService.delete(req.params.id, req.user!.tenantId, req.user!.userId);
    res.status(204).send();
  }
}
