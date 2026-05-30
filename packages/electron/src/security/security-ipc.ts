import { ipcMain } from 'electron';
import { SecurityService } from './security-service.js';

const services = new Map<string, SecurityService>();

function getService(projectPath: string): SecurityService {
  if (!services.has(projectPath)) services.set(projectPath, new SecurityService(projectPath));
  return services.get(projectPath)!;
}

export function registerSecurityIPC(): void {
  ipcMain.handle('security:scan', async (_e, projectPath: string, scope?: string, files?: string[]) => {
    return getService(projectPath).scan((scope as any) || 'full', files);
  });
  ipcMain.handle('security:cancel', async (_e, projectPath: string) => {
    return getService(projectPath).cancelScan();
  });
  ipcMain.handle('security:getResult', async (_e, projectPath: string, scanId: string) => {
    return getService(projectPath).getResult(scanId);
  });
  ipcMain.handle('security:listResults', async (_e, projectPath: string, limit?: number) => {
    return getService(projectPath).listResults(limit);
  });
  ipcMain.handle('security:applyFix', async (_e, projectPath: string, vulnerability: any) => {
    return getService(projectPath).applyFix(vulnerability);
  });
  ipcMain.handle('security:saveRule', async (_e, projectPath: string, rule: any) => {
    return getService(projectPath).saveRule(rule);
  });
  ipcMain.handle('security:listRules', async (_e, projectPath: string) => {
    return getService(projectPath).listRules();
  });
  ipcMain.handle('security:deleteRule', async (_e, projectPath: string, ruleId: string) => {
    return getService(projectPath).deleteRule(ruleId);
  });
  ipcMain.handle('security:compareResults', async (_e, projectPath: string, scanId1: string, scanId2: string) => {
    return getService(projectPath).compareResults(scanId1, scanId2);
  });
}
