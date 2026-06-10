import { ipcMain } from 'electron';
import { skillMarketplaceClient } from '../services/skill-marketplace-client.js';
import { skillInstaller } from '../services/skill-installer.js';
import { skillSecurityGateway } from '../services/skill-security-gateway.js';

export function registerMarketplaceIpc(): void {
  ipcMain.handle('marketplace:search', async (_event, { keyword }: { keyword: string }) => {
    try {
      return await skillMarketplaceClient.search(keyword);
    } catch (err) {
      console.error('marketplace:search error:', err);
      return [];
    }
  });

  ipcMain.handle('marketplace:install', async (_event, { skillId, version }: { skillId: string; version?: string }) => {
    try {
      const detail = await skillMarketplaceClient.getDetail(skillId);
      if (!detail) return { success: false, error: 'Skill not found' };

      const installResult = await skillMarketplaceClient.install(skillId, version);
      if (!installResult.success) return { success: false, error: 'Download failed' };

      if (installResult.installPath) {
        const scan = skillSecurityGateway.preInstallScan('', installResult.installPath);
        if (skillSecurityGateway.blockOnCritical(scan)) {
          return { success: false, error: 'Security scan blocked installation', report: skillSecurityGateway.generateReport(scan) };
        }
      }

      return { success: true };
    } catch (err) {
      console.error('marketplace:install error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('marketplace:uninstall', async (_event, { skillId }: { skillId: string }) => {
    try {
      return await skillMarketplaceClient.uninstall(skillId);
    } catch (err) {
      console.error('marketplace:uninstall error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('marketplace:rate', async (_event, { skillId, rating }: { skillId: string; rating: number }) => {
    try {
      return await skillMarketplaceClient.rate(skillId, rating);
    } catch (err) {
      console.error('marketplace:rate error:', err);
      return { success: false, error: String(err) };
    }
  });
}