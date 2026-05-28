"use strict";
/**
 * Cloud Server RBAC Patch — Batch D (P1)
 *
 * Provides role-based access control for cloud-server JWT middleware.
 * Roles: admin → all, developer → read+write+execute,
 *        viewer → read-only, guest → limited.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBAC_PERMISSIONS = exports.RBAC_ROLES = void 0;
exports.checkPermission = checkPermission;
exports.extractRoleFromToken = extractRoleFromToken;
exports.createRBACMiddleware = createRBACMiddleware;
exports.RBAC_ROLES = {
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
const GUEST_ALLOWED_RESOURCES = [
    'status',
    'health',
    'version',
    'docs',
];
exports.RBAC_PERMISSIONS = {
    admin: (_resource, _action) => true,
    developer: (_resource, action) => ['read', 'write', 'execute'].includes(action),
    viewer: (_resource, action) => action === 'read',
    guest: (resource, action) => action === 'read' && GUEST_ALLOWED_RESOURCES.includes(resource),
};
function checkPermission(role, resource, action) {
    const checker = exports.RBAC_PERMISSIONS[role];
    if (!checker)
        return false;
    return checker(resource, action);
}
function extractRoleFromToken(payload) {
    if (exports.RBAC_ROLES[payload.role])
        return payload.role;
    return 'guest';
}
function createRBACMiddleware() {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized: no token' });
            return;
        }
        const role = extractRoleFromToken(req.user);
        const resource = req.path.replace(/^\//, '').split('/')[0] || 'unknown';
        const actionMap = {
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
//# sourceMappingURL=patch-cloud-rbac.js.map