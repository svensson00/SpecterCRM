import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';
import { UserController } from '../controllers/user.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { ContactController } from '../controllers/contact.controller';
import { DealController } from '../controllers/deal.controller';
import { ActivityController } from '../controllers/activity.controller';
import { NoteController } from '../controllers/note.controller';
import { ReportController } from '../controllers/report.controller';
import { DeduplicationController } from '../controllers/deduplication.controller';
import { AdminController } from '../controllers/admin.controller';
import { ImportController, upload } from '../controllers/import.controller';

const router = Router();

router.post('/auth/login', (req, res, next) => AuthController.login(req, res).catch(next));
router.post('/auth/register', authenticate, (req, res, next) => AuthController.register(req, res).catch(next));
router.post('/auth/refresh', (req, res, next) => AuthController.refresh(req, res).catch(next));
router.post('/auth/logout', (req, res, next) => AuthController.logout(req, res).catch(next));
router.get('/auth/me', authenticate, (req, res, next) => AuthController.me(req, res).catch(next));
router.post('/auth/forgot-password', (req, res, next) => AuthController.requestPasswordReset(req, res).catch(next));
router.post('/auth/reset-password', (req, res, next) => AuthController.resetPassword(req, res).catch(next));

router.get('/organizations', authenticate, (req, res, next) => OrganizationController.findAll(req, res).catch(next));
router.get('/organizations/check-duplicates', authenticate, (req, res, next) => OrganizationController.checkDuplicates(req, res).catch(next));
router.post('/organizations', authenticate, (req, res, next) => OrganizationController.create(req, res).catch(next));
router.get('/organizations/:id', authenticate, (req, res, next) => OrganizationController.findById(req, res).catch(next));
router.patch('/organizations/:id', authenticate, (req, res, next) => OrganizationController.update(req, res).catch(next));
router.delete('/organizations/:id', authenticate, (req, res, next) => OrganizationController.delete(req, res).catch(next));
router.get('/organizations/:id/contacts', authenticate, (req, res, next) => OrganizationController.getContacts(req, res).catch(next));
router.get('/organizations/:id/deals', authenticate, (req, res, next) => OrganizationController.getDeals(req, res).catch(next));
router.get('/organizations/:id/activities', authenticate, (req, res, next) => OrganizationController.getActivities(req, res).catch(next));
router.get('/organizations/:id/notes', authenticate, (req, res, next) => OrganizationController.getNotes(req, res).catch(next));
router.post('/organizations/:id/notes', authenticate, (req, res, next) => OrganizationController.createNote(req, res).catch(next));

router.get('/contacts', authenticate, (req, res, next) => ContactController.findAll(req, res).catch(next));
router.get('/contacts/check-duplicates', authenticate, (req, res, next) => ContactController.checkDuplicates(req, res).catch(next));
router.post('/contacts', authenticate, (req, res, next) => ContactController.create(req, res).catch(next));
router.get('/contacts/:id', authenticate, (req, res, next) => ContactController.findById(req, res).catch(next));
router.patch('/contacts/:id', authenticate, (req, res, next) => ContactController.update(req, res).catch(next));
router.delete('/contacts/:id', authenticate, (req, res, next) => ContactController.delete(req, res).catch(next));
router.get('/contacts/:id/activities', authenticate, (req, res, next) => ContactController.getActivities(req, res).catch(next));
router.get('/contacts/:id/notes', authenticate, (req, res, next) => ContactController.getNotes(req, res).catch(next));
router.post('/contacts/:id/notes', authenticate, (req, res, next) => ContactController.createNote(req, res).catch(next));

router.get('/deals', authenticate, (req, res, next) => DealController.findAll(req, res).catch(next));
router.post('/deals', authenticate, (req, res, next) => DealController.create(req, res).catch(next));
router.get('/deals/:id', authenticate, (req, res, next) => DealController.findById(req, res).catch(next));
router.patch('/deals/:id', authenticate, (req, res, next) => DealController.update(req, res).catch(next));
router.patch('/deals/:id/stage', authenticate, (req, res, next) => DealController.updateStage(req, res).catch(next));
router.delete('/deals/:id', authenticate, (req, res, next) => DealController.delete(req, res).catch(next));
router.get('/deals/:id/notes', authenticate, (req, res, next) => DealController.getNotes(req, res).catch(next));
router.post('/deals/:id/notes', authenticate, (req, res, next) => DealController.createNote(req, res).catch(next));
router.get('/deals/pipeline/summary', authenticate, (req, res, next) => DealController.getPipeline(req, res).catch(next));

router.get('/activities', authenticate, (req, res, next) => ActivityController.findAll(req, res).catch(next));
router.post('/activities', authenticate, (req, res, next) => ActivityController.create(req, res).catch(next));
router.get('/activities/:id', authenticate, (req, res, next) => ActivityController.findById(req, res).catch(next));
router.patch('/activities/:id', authenticate, (req, res, next) => ActivityController.update(req, res).catch(next));
router.patch('/activities/:id/complete', authenticate, (req, res, next) => ActivityController.toggleComplete(req, res).catch(next));
router.delete('/activities/:id', authenticate, (req, res, next) => ActivityController.delete(req, res).catch(next));

router.get('/notes/:id', authenticate, (req, res, next) => NoteController.findById(req, res).catch(next));
router.patch('/notes/:id', authenticate, (req, res, next) => NoteController.update(req, res).catch(next));
router.delete('/notes/:id', authenticate, (req, res, next) => NoteController.delete(req, res).catch(next));

router.get('/reports/pipeline', authenticate, (req, res, next) => ReportController.getPipeline(req, res).catch(next));
router.get('/reports/win-rate', authenticate, (req, res, next) => ReportController.getWinRate(req, res).catch(next));
router.get('/reports/cycle-time', authenticate, (req, res, next) => ReportController.getCycleTime(req, res).catch(next));
router.get('/reports/activity-volume', authenticate, (req, res, next) => ReportController.getActivityVolume(req, res).catch(next));
router.get('/reports/top-accounts', authenticate, (req, res, next) => ReportController.getTopAccounts(req, res).catch(next));
router.get('/reports/forecast', authenticate, (req, res, next) => ReportController.getForecast(req, res).catch(next));

router.post('/duplicates/detect/organizations', authenticate, requireAdmin, (req, res, next) => DeduplicationController.detectOrganizations(req, res).catch(next));
router.post('/duplicates/detect/contacts', authenticate, requireAdmin, (req, res, next) => DeduplicationController.detectContacts(req, res).catch(next));
router.get('/duplicates', authenticate, (req, res, next) => DeduplicationController.getSuggestions(req, res).catch(next));
router.post('/duplicates/merge', authenticate, (req, res, next) => DeduplicationController.merge(req, res).catch(next));
router.post('/duplicates/dismiss', authenticate, (req, res, next) => DeduplicationController.dismiss(req, res).catch(next));

router.get('/users', authenticate, requireAdmin, (req, res, next) => UserController.getAll(req, res).catch(next));
router.get('/users/:id', authenticate, requireAdmin, (req, res, next) => UserController.getById(req, res).catch(next));
router.patch('/users/:id', authenticate, requireAdmin, (req, res, next) => UserController.update(req, res).catch(next));
router.patch('/users/:id/role', authenticate, requireAdmin, (req, res, next) => UserController.updateRole(req, res).catch(next));
router.patch('/users/:id/password', authenticate, requireAdmin, (req, res, next) => UserController.changeUserPassword(req, res).catch(next));
router.patch('/users/:id/deactivate', authenticate, requireAdmin, (req, res, next) => UserController.deactivate(req, res).catch(next));
router.delete('/users/:id', authenticate, requireAdmin, (req, res, next) => UserController.delete(req, res).catch(next));
router.patch('/auth/change-password', authenticate, (req, res, next) => UserController.changeOwnPassword(req, res).catch(next));

router.get('/admin/settings', authenticate, (req, res, next) => AdminController.getTenantSettings(req, res).catch(next));
router.patch('/admin/settings', authenticate, requireAdmin, (req, res, next) => AdminController.updateTenantSettings(req, res).catch(next));
router.get('/admin/activity-types', authenticate, (req, res, next) => AdminController.getActivityTypes(req, res).catch(next));
router.post('/admin/activity-types', authenticate, requireAdmin, (req, res, next) => AdminController.createActivityType(req, res).catch(next));
router.patch('/admin/activity-types/:id', authenticate, requireAdmin, (req, res, next) => AdminController.updateActivityType(req, res).catch(next));
router.delete('/admin/activity-types/:id', authenticate, requireAdmin, (req, res, next) => AdminController.deleteActivityType(req, res).catch(next));
router.get('/admin/contact-roles', authenticate, (req, res, next) => AdminController.getContactRoles(req, res).catch(next));
router.post('/admin/contact-roles', authenticate, requireAdmin, (req, res, next) => AdminController.createContactRole(req, res).catch(next));
router.patch('/admin/contact-roles/:id', authenticate, requireAdmin, (req, res, next) => AdminController.updateContactRole(req, res).catch(next));
router.delete('/admin/contact-roles/:id', authenticate, requireAdmin, (req, res, next) => AdminController.deleteContactRole(req, res).catch(next));
router.get('/admin/audit-logs', authenticate, requireAdmin, (req, res, next) => AdminController.getAuditLogs(req, res).catch(next));

// Import routes (Admin only)
router.get('/import/files', authenticate, requireAdmin, (req, res, next) => ImportController.listFiles(req, res).catch(next));
router.post('/import/upload', authenticate, requireAdmin, upload.array('files', 10), (req, res, next) => ImportController.uploadFiles(req, res).catch(next));
router.post('/import/trigger', authenticate, requireAdmin, (req, res, next) => ImportController.triggerImport(req, res).catch(next));
router.delete('/import/files', authenticate, requireAdmin, (req, res, next) => ImportController.clearFiles(req, res).catch(next));
router.get('/import/jobs/:jobId', authenticate, requireAdmin, (req, res, next) => ImportController.getJobStatus(req, res).catch(next));
router.get('/import/jobs/:jobId/logs', authenticate, requireAdmin, (req, res, next) => ImportController.getJobLogs(req, res).catch(next));
router.get('/import/jobs', authenticate, requireAdmin, (req, res, next) => ImportController.getJobHistory(req, res).catch(next));

export default router;
