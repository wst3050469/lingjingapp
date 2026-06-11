import { ipcMain } from 'electron';
import { userService } from '../../services/cloud-management/user-service.js';
import type { UpdateUserParams, ChangePasswordParams, EnableTwoFactorParams } from '../../services/cloud-management/user-service.js';

export function registerUserIpc(): void {
  ipcMain.handle('cloud:user:getInfo', async () => {
    return userService.getUserInfo();
  });
  
  ipcMain.handle('cloud:user:update', async (_event, params: UpdateUserParams) => {
    return userService.updateUser(params);
  });
  
  ipcMain.handle('cloud:user:changePassword', async (_event, params: ChangePasswordParams) => {
    return userService.changePassword(params);
  });
  
  ipcMain.handle('cloud:user:getSecuritySettings', async () => {
    return userService.getSecuritySettings();
  });
  
  ipcMain.handle('cloud:user:updateSecuritySettings', async (_event, settings) => {
    return userService.updateSecuritySettings(settings);
  });
  
  ipcMain.handle('cloud:user:enableTwoFactor', async (_event, params: EnableTwoFactorParams) => {
    return userService.enableTwoFactor(params);
  });
  
  ipcMain.handle('cloud:user:disableTwoFactor', async (_event, code: string) => {
    return userService.disableTwoFactor(code);
  });
  
  ipcMain.handle('cloud:user:verifyTwoFactor', async (_event, code: string) => {
    return userService.verifyTwoFactor(code);
  });
  
  ipcMain.handle('cloud:user:getLoginHistory', async (_event, limit?: number, offset?: number) => {
    return userService.getLoginHistory(limit, offset);
  });
  
  ipcMain.handle('cloud:user:logoutAllDevices', async () => {
    return userService.logoutAllDevices();
  });
  
  ipcMain.handle('cloud:user:deleteAccount', async (_event, password: string) => {
    return userService.deleteAccount(password);
  });
  
  ipcMain.handle('cloud:user:updateAvatar', async (_event, avatarData: string) => {
    return userService.updateAvatar(avatarData);
  });
}
