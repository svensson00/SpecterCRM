import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DeduplicationService } from '../services/deduplication.service';

export class DeduplicationController {
  static async detectOrganizations(req: AuthRequest, res: Response) {
    const result = await DeduplicationService.detectOrganizationDuplicates(req.user!.tenantId);
    res.json(result);
  }

  static async detectContacts(req: AuthRequest, res: Response) {
    const result = await DeduplicationService.detectContactDuplicates(req.user!.tenantId);
    res.json(result);
  }

  static async getSuggestions(req: AuthRequest, res: Response) {
    const entityType = req.query.entityType as 'ORGANIZATION' | 'CONTACT';

    if (!entityType || !['ORGANIZATION', 'CONTACT'].includes(entityType)) {
      res.status(400).json({ error: 'Invalid entityType' });
      return;
    }

    const suggestions = await DeduplicationService.getSuggestions(req.user!.tenantId, entityType);
    res.json(suggestions);
  }

  static async merge(req: AuthRequest, res: Response) {
    const { suggestionId, primaryId } = req.body;

    if (!suggestionId || !primaryId) {
      res.status(400).json({ error: 'suggestionId and primaryId are required' });
      return;
    }

    await DeduplicationService.merge(
      suggestionId,
      primaryId,
      req.user!.tenantId,
      req.user!.userId
    );

    res.json({ message: 'Records merged successfully' });
  }

  static async dismiss(req: AuthRequest, res: Response) {
    const { suggestionId } = req.body;

    if (!suggestionId) {
      res.status(400).json({ error: 'suggestionId is required' });
      return;
    }

    await DeduplicationService.dismiss(suggestionId, req.user!.tenantId, req.user!.userId);
    res.json({ message: 'Suggestion dismissed' });
  }
}
