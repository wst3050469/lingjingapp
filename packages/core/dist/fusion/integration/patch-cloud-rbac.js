export const RBAC_ROLES = {
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
export const RBAC_PERMISSIONS = {
    admin: (_resource, _action) => true,
    developer: (_resource, action) => ['read', 'write', 'execute'].includes(action),
    viewer: (_resource, action) => action === 'read',
    guest: (resource, action) => action === 'read' && GUEST_ALLOWED_RESOURCES.includes(resource),
};
export function checkPermission(role, resource, action) {
    const checker = RBAC_PERMISSIONS[role];
    if (!checker)
        return false;
    return checker(resource, action);
}
export function extractRoleFromToken(payload) {
    if (RBAC_ROLES[payload.role])
        return payload.role;
    return 'guest';
}
export function createRBACMiddleware() {
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
