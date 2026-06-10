import { ipcMain } from 'electron';
import { deviceService } from '../../services/cloud-management/device-service.js';
import type { RegisterDeviceParams } from '../../services/cloud-management/device-service.js';

export function registerDeviceIpc(): void {
  ipcMain.handle('cloud:device:getAll', async () => {
    return deviceService.getDevices();
  });
  
  ipcMain.handle('cloud:device:get', async (_event, deviceId: string) => {
    return deviceService.getDevice(deviceId);
  });
  
  ipcMain.handle('cloud:device:register', async (_event, params: RegisterDeviceParams) => {
    return deviceService.registerDevice(params);
  });
  
  ipcMain.handle('cloud:device:updateName', async (_event, deviceId: string, name: string) => {
    return deviceService.updateDeviceName(deviceId, name);
  });
  
  ipcMain.handle('cloud:device:revoke', async (_event, deviceId: string) => {
    return deviceService.revokeDevice(deviceId);
  });
  
  ipcMain.handle('cloud:device:delete', async (_event, deviceId: string) => {
    return deviceService.deleteDevice(deviceId);
  });
  
  ipcMain.handle('cloud:device:generateAuthCode', async () => {
    return deviceService.generateAuthorizationCode();
  });
  
  ipcMain.handle('cloud:device:authorize', async (_event, code: string) => {
    return deviceService.authorizeDevice(code);
  });
  
  ipcMain.handle('cloud:device:getCurrent', async () => {
    return deviceService.getCurrentDevice();
  });
  
  ipcMain.handle('cloud:device:getOnline', async () => {
    return deviceService.getOnlineDevices();
  });
}
