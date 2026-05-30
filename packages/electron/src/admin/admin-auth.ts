import { createLogger } from '../monitoring/logger';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { sign, verify } from 'jsonwebtoken';

const logger = createLogger('admin-auth');

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: number;
  lastLoginAt?: number;
  passwordHash?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer';

export type Permission =
  | 'system:read'
  | 'system:write'
  | 'version:read'
  | 'version:write'
  | 'mcp:read'
  | 'mcp:write'
  | 'quest:read'
  | 'quest:write'
  | 'config:read'
  | 'config:write'
  | 'log:read';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  iat: number;
  exp: number;
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'system:read', 'system:write',
    'version:read', 'version:write',
    'mcp:read', 'mcp:write',
    'quest:read', 'quest:write',
    'config:read', 'config:write',
    'log:read'
  ],
  admin: [
    'system:read',
    'version:read', 'version:write',
    'mcp:read', 'mcp:write',
    'quest:read', 'quest:write',
    'config:read',
    'log:read'
  ],
  operator: [
    'version:read',
    'mcp:read', 'mcp:write',
    'quest:read',
    'log:read'
  ],
  viewer: [
    'system:read',
    'version:read',
    'mcp:read',
    'quest:read',
    'log:read'
  ]
};

export class AdminAuthManager {
  private jwtSecret: string;
  private refreshSecret: string;
  private tokenExpiry: string;
  private refreshExpiry: string;
  private users: Map<string, AdminUser>;
  private refreshTokens: Map<string, { userId: string; expiresAt: number }>;
  private failedAttempts: Map<string, { count: number; lockedUntil: number }>;

  constructor(
    jwtSecret?: string,
    refreshSecret?: string
  ) {
    this.jwtSecret = jwtSecret || randomBytes(32).toString('hex');
    this.refreshSecret = refreshSecret || randomBytes(32).toString('hex');
    this.tokenExpiry = '1h';
    this.refreshExpiry = '7d';
    this.users = new Map();
    this.refreshTokens = new Map();
    this.failedAttempts = new Map();

    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    const defaultAdmin: AdminUser & { passwordHash?: string } = {
      id: 'admin-001',
      username: 'admin',
      role: 'super_admin',
      permissions: ROLE_PERMISSIONS['super_admin'],
      createdAt: Date.now(),
      passwordHash: this.hashPassword('admin', 'admin-001'),
    };
    this.users.set(defaultAdmin.id, defaultAdmin as AdminUser);

    logger.info('Default admin user initialized (default password: admin)');
  }

  async authenticate(
    username: string,
    password: string
  ): Promise<{ user: AdminUser; tokens: AuthTokens } | null> {
    logger.info('Authentication attempt', { username });

    const lockInfo = this.failedAttempts.get(username);
    if (lockInfo && lockInfo.lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockInfo.lockedUntil - Date.now()) / 1000);
      throw new Error(`Account locked. Try again in ${remaining} seconds`);
    }

    const user = Array.from(this.users.values()).find(u => u.username === username);
    if (!user) {
      this.recordFailedAttempt(username);
      return null;
    }

    if (!user.passwordHash || !await this.verifyPassword(password, user)) {
      this.recordFailedAttempt(username);
      return null;
    }

    this.failedAttempts.delete(username);

    user.lastLoginAt = Date.now();

    const tokens = this.generateTokens(user);

    logger.info('Authentication successful', { userId: user.id, username });

    return { user, tokens };
  }

  private generateTokens(user: AdminUser): AuthTokens {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry
    });

    const refreshToken = sign(
      { userId: user.id, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: this.refreshExpiry }
    );

    const decoded = verify(accessToken, this.jwtSecret) as JWTPayload;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: Date.now() + this.parseExpiry(this.refreshExpiry)
    });

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
    const stored = this.refreshTokens.get(refreshToken);
    if (!stored || stored.expiresAt < Date.now()) {
      this.refreshTokens.delete(refreshToken);
      return null;
    }

    try {
      const decoded = verify(refreshToken, this.refreshSecret) as any;
      const user = this.users.get(decoded.userId);

      if (!user) {
        return null;
      }

      this.refreshTokens.delete(refreshToken);

      return this.generateTokens(user);
    } catch (error) {
      logger.error('Token refresh failed', error as Error);
      return null;
    }
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  hasPermission(payload: JWTPayload, permission: Permission): boolean {
    return payload.permissions.includes(permission);
  }

  hasAnyPermission(payload: JWTPayload, permissions: Permission[]): boolean {
    return permissions.some(p => this.hasPermission(payload, p));
  }

  hasAllPermissions(payload: JWTPayload, permissions: Permission[]): boolean {
    return permissions.every(p => this.hasPermission(payload, p));
  }

  async createUser(
    username: string,
    password: string,
    role: UserRole
  ): Promise<AdminUser> {
    const existingUser = Array.from(this.users.values()).find(u => u.username === username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const user: AdminUser = {
      id: `user-${Date.now()}`,
      username,
      role,
      permissions: ROLE_PERMISSIONS[role],
      createdAt: Date.now(),
      passwordHash: this.hashPassword(password, `user-${Date.now()}`),
    };

    this.users.set(user.id, user);

    logger.info('User created', { userId: user.id, username, role });

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    if (userId === 'admin-001') {
      throw new Error('Cannot delete default admin user');
    }

    this.users.delete(userId);

    for (const [token, info] of this.refreshTokens) {
      if (info.userId === userId) {
        this.refreshTokens.delete(token);
      }
    }

    logger.info('User deleted', { userId });
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.passwordHash = this.hashPassword(newPassword, userId);
    logger.info('Password changed', { userId });
  }

  async changeRole(userId: string, newRole: UserRole): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (userId === 'admin-001' && newRole !== 'super_admin') {
      throw new Error('Cannot change role of default admin');
    }

    user.role = newRole;
    user.permissions = ROLE_PERMISSIONS[newRole];

    logger.info('Role changed', { userId, newRole });
  }

  async listUsers(): Promise<AdminUser[]> {
    return Array.from(this.users.values());
  }

  logout(refreshToken: string): void {
    this.refreshTokens.delete(refreshToken);
    logger.info('User logged out');
  }

  logoutAll(userId: string): void {
    for (const [token, info] of this.refreshTokens) {
      if (info.userId === userId) {
        this.refreshTokens.delete(token);
      }
    }
    logger.info('All sessions invalidated', { userId });
  }

  private hashPassword(password: string, userId: string): string {
    return createHash('sha256')
      .update(password)
      .update(userId)
      .update('lingjing-salt')
      .digest('hex');
  }

  private async verifyPassword(password: string, user: AdminUser): Promise<boolean> {
    if (!user.passwordHash) return false;
    const hash = this.hashPassword(password, user.id);
    // Use timingSafeEqual to prevent timing attacks
    try {
      return timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(user.passwordHash)
      );
    } catch {
      return false;
    }
  }

  private recordFailedAttempt(username: string): void {
    const info = this.failedAttempts.get(username) || { count: 0, lockedUntil: 0 };
    info.count++;

    if (info.count >= 5) {
      info.lockedUntil = Date.now() + 15 * 60 * 1000;
      logger.warn('Account locked due to failed attempts', { username });
    }

    this.failedAttempts.set(username, info);
  }

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }
}

export const adminAuthManager = new AdminAuthManager();
