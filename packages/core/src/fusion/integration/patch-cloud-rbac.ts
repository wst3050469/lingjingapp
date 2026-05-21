/**
 * Cloud Server RBAC Patch — Batch D (P1)
 *
 * Provides role-based access control for cloud-server JWT middleware.
 * Roles: admin → all, developer → read+write+execute,
 *        viewer → read-only, guest → limited.
 */

export type RBACRole = 'admin' | 'developer' | 'viewer' | 'guest';
export type RBACAction = 'read' | 'write' | 'execute' | 'delete' | 'admin';
export type RBACResource = string;

export interface RBACRoleDefinition {
  role: RBACRole;
  label: string;
  allowedActions: RBACAction[];
}

export const RBAC_ROLES: Record<RBACRole, RBACRoleDefinition> = {
  admin: {
    role: 'admin',
    label: 'Administrator',
    allowedActions: ['read', 'write', 'execute', 'delete', 'admin'],
  },
  developer: {
    role: 'developer',
    label: 'Developer',
    allowedActions: ['read', 'write', 'execute'],
  },
  viewer: {
    role: 'viewer',
    label: 'Viewer',
    allowedActions: ['read'],
  },
  guest: {
    role: 'guest',
    label: 'Guest',
    allowedActions: ['read'],
  },
};

const GUEST_ALLOWED_RESOURCES: RBACResource[] = [
  'status',
  'health',
  'version',
  'docs',
];

export const RBAC_PERMISSIONS: Record<RBACRole, (resource: RBACResource, action: RBACAction) => boolean> = {
  admin: (_resource, _action) => true,
  developer: (_resource, action) => ['read', 'write', 'execute'].includes(action),
  viewer: (_resource, action) => action === 'read',
  guest: (resource, action) => action === 'read' && GUEST_ALLOWED_RESOURCES.includes(resource),
};

export function checkPermission(role: RBACRole, resource: RBACResource, action: RBACAction): boolean {
  const checker = RBAC_PERMISSIONS[role];
  if (!checker) return false;
  return checker(resource, action);
}

export interface JWTTokenPayload {
  sub: string;
  role: RBACRole;
  iat: number;
  exp: number;
}

export function extractRoleFromToken(payload: JWTTokenPayload): RBACRole {
  if (RBAC_ROLES[payload.role]) return payload.role;
  return 'guest';
}

export function createRBACMiddleware() {
  return (req: { user?: JWTTokenPayload; path: string; method: string }, res: { status: (code: number) => { json: (body: object) => void } }, next: () => void): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: no token' });
      return;
    }
    const role = extractRoleFromToken(req.user);
    const resource = req.path.replace(/^\//, '').split('/')[0] || 'unknown';
    const actionMap: Record<string, RBACAction> = {
      GET: 'read',
      POST: 'write',
      PUT: 'write',
      PATCH: 'write',
      DELETE: 'delete',
    };
    const action = actionMap[req.method] ?? 'read';
    if (!checkPermission(role, resource, action)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions', role, resource, action });
      return;
    }
    next();
  };
}
