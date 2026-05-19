import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { Device, AuthorizationCode, CloudManagementError } from '@codepilot/core';

export interface RegisterDeviceParams {
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
}

export class DeviceService extends CloudManagementBaseService {
  async getDevices(): Promise<Device[]> {
    return this.request(() => this.client.get<Device[]>('/devices'));
  }
  
  async getDevice(deviceId: string): Promise<Device> {
    return this.request(() => this.client.get<Device>(`/devices/${deviceId}`));
  }
  
  async registerDevice(params: RegisterDeviceParams): Promise<Device> {
    return this.request(() => this.client.post<Device>('/devices/register', params));
  }
  
  async updateDeviceName(deviceId: string, name: string): Promise<Device> {
    return this.request(() => this.client.put<Device>(`/devices/${deviceId}`, { name }));
  }
  
  async revokeDevice(deviceId: string): Promise<void> {
    return this.request(() => this.client.post<void>(`/devices/${deviceId}/revoke`));
  }
  
  async deleteDevice(deviceId: string): Promise<void> {
    return this.request(() => this.client.delete<void>(`/devices/${deviceId}`));
  }
  
  async generateAuthorizationCode(): Promise<AuthorizationCode> {
    return this.request(() => this.client.post<AuthorizationCode>('/devices/auth-code'));
  }
  
  async authorizeDevice(code: string): Promise<Device> {
    return this.request(() => this.client.post<Device>('/devices/authorize', { code }));
  }
  
  async getCurrentDevice(): Promise<Device> {
    return this.request(() => this.client.get<Device>('/devices/current'));
  }
  
  async getOnlineDevices(): Promise<Device[]> {
    return this.request(() => this.client.get<Device[]>('/devices/online'));
  }
}

export const deviceService = new DeviceService({
  baseUrl: 'https://ide.zhejiangjinmo.com/api'
});
