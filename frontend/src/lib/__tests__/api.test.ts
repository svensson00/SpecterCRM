import { describe, it, expect } from 'vitest';

describe('API client', () => {
  describe('API module exports', () => {
    it('should export authAPI', async () => {
      const { authAPI } = await import('../api');
      expect(authAPI).toBeDefined();
      expect(authAPI.login).toBeDefined();
      expect(authAPI.register).toBeDefined();
      expect(authAPI.logout).toBeDefined();
      expect(authAPI.me).toBeDefined();
    });

    it('should export organizationAPI', async () => {
      const { organizationAPI } = await import('../api');
      expect(organizationAPI).toBeDefined();
      expect(organizationAPI.getAll).toBeDefined();
      expect(organizationAPI.getById).toBeDefined();
      expect(organizationAPI.create).toBeDefined();
      expect(organizationAPI.update).toBeDefined();
      expect(organizationAPI.delete).toBeDefined();
    });

    it('should export contactAPI', async () => {
      const { contactAPI } = await import('../api');
      expect(contactAPI).toBeDefined();
      expect(contactAPI.getAll).toBeDefined();
      expect(contactAPI.getById).toBeDefined();
    });

    it('should export dealAPI', async () => {
      const { dealAPI } = await import('../api');
      expect(dealAPI).toBeDefined();
      expect(dealAPI.getAll).toBeDefined();
      expect(dealAPI.updateStage).toBeDefined();
      expect(dealAPI.getPipeline).toBeDefined();
    });

    it('should export activityAPI', async () => {
      const { activityAPI } = await import('../api');
      expect(activityAPI).toBeDefined();
      expect(activityAPI.getAll).toBeDefined();
      expect(activityAPI.toggleComplete).toBeDefined();
    });

    it('should export reportAPI', async () => {
      const { reportAPI } = await import('../api');
      expect(reportAPI).toBeDefined();
      expect(reportAPI.getPipeline).toBeDefined();
      expect(reportAPI.getWinRate).toBeDefined();
      expect(reportAPI.getActivityVolume).toBeDefined();
    });

    it('should export deduplicationAPI', async () => {
      const { deduplicationAPI } = await import('../api');
      expect(deduplicationAPI).toBeDefined();
      expect(deduplicationAPI.getSuggestions).toBeDefined();
      expect(deduplicationAPI.merge).toBeDefined();
      expect(deduplicationAPI.detectOrganizations).toBeDefined();
    });

    it('should export userAPI', async () => {
      const { userAPI } = await import('../api');
      expect(userAPI).toBeDefined();
      expect(userAPI.getAll).toBeDefined();
      expect(userAPI.updateRole).toBeDefined();
      expect(userAPI.changePassword).toBeDefined();
    });

    it('should export adminAPI', async () => {
      const { adminAPI } = await import('../api');
      expect(adminAPI).toBeDefined();
      expect(adminAPI.getSettings).toBeDefined();
      expect(adminAPI.createActivityType).toBeDefined();
      expect(adminAPI.getAuditLogs).toBeDefined();
    });
  });
});
