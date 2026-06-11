import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { UserInfo, SecuritySettings, LoginRecord, CloudManagementError } from '@codepilot/core';

export interface UpdateUserParams {
  username?: string;
  email?: string;
  avatar?: string;
}

export interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

export interface EnableTwoFactorParams {
  method: 'authenticator' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
}

export class UserService extends CloudManagementBaseService {
  async getUserInfo(): Promise<UserInfo> {
    return this.request(() => this.client.get<UserInfo>('/user/info'));
  }
  
  async updateUser(params: UpdateUserParams): Promise<UserInfo> {
    return this.request(() => this.client.put<UserInfo>('/user/info', params));
  }
  
  async changePassword(params: ChangePasswordParams): Promise<void> {
    return this.request(() => this.client.post<void>('/user/password/change', params));
  }
  
  async getSecuritySettings(): Promise<SecuritySettings> {
    return this.request(() => this.client.get<SecuritySettings>('/user/security'));
  }
  
  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    return this.request(() => this.client.put<SecuritySettings>('/user/security', settings));
  }
  
  async enableTwoFactor(params: EnableTwoFactorParams): Promise<{ qrCode?: string; secret: string }> {
    return this.request(() => this.client.post<{ qrCode?: string; secret: string }>('/user/security/2fa/enable', params));
  }
  
  async disableTwoFactor(code: string): Promise<void> {
    return this.request(() => this.client.post<void>('/user/security/2fa/disable', { code }));
  }
  
  async verifyTwoFactor(code: string): Promise<boolean> {
    return this.request(() => this.client.post<boolean>('/user/security/2fa/verify', { code }));
  }
  
  async getLoginHistory(limit: number = 20, offset: number = 0): Promise<LoginRecord[]> {
    return this.request(() => this.client.get<LoginRecord[]>('/user/login-history', {
      params: { limit, offset }
    }));
  }
  
  async logoutAllDevices(): Promise<void> {
    return this.request(() => this.client.post<void>('/user/logout-all'));
  }
  
  async deleteAccount(password: string): Promise<void> {
    return this.request(() => this.client.post<void>('/user/delete', { password }));
  }
  
  async updateAvatar(avatarData: string): Promise<UserInfo> {
    return this.request(() => this.client.put<UserInfo>('/user/avatar', { avatar: avatarData }));
  }
}

export const userService = new UserService({
  baseUrl: 'https://ide.zhejiangjinmo.com/api'
});
