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
export declare const RBAC_ROLES: Record<RBACRole, RBACRoleDefinition>;
export declare const RBAC_PERMISSIONS: Record<RBACRole, (resource: RBACResource, action: RBACAction) => boolean>;
export declare function checkPermission(role: RBACRole, resource: RBACResource, action: RBACAction): boolean;
export interface JWTTokenPayload {
    sub: string;
    role: RBACRole;
    iat: number;
    exp: number;
}
export declare function extractRoleFromToken(payload: JWTTokenPayload): RBACRole;
export declare function createRBACMiddleware(): (req: {
    user?: JWTTokenPayload;
    path: string;
    method: string;
}, res: {
    status: (code: number) => {
        json: (body: object) => void;
    };
}, next: () => void) => void;
//# sourceMappingURL=patch-cloud-rbac.d.ts.map