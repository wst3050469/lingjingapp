import { Role, Permission, UserInfo } from './types.js';
export declare class RBACManager {
    private customPermissions;
    hasPermission(user: UserInfo, permission: Permission): boolean;
    hasAnyPermission(user: UserInfo, permissions: Permission[]): boolean;
    hasAllPermissions(user: UserInfo, permissions: Permission[]): boolean;
    getPermissions(user: UserInfo): Permission[];
    grantPermission(userId: string, permission: Permission): void;
    revokePermission(userId: string, permission: Permission): void;
    getRoleHierarchy(): Role[];
    getRolesAbove(role: Role): Role[];
    getRolesBelow(role: Role): Role[];
    canAssignRole(assigner: UserInfo, targetRole: Role): boolean;
    createPermissionChecker(user: UserInfo): {
        can: (permission: Permission) => boolean;
        canAny: (permissions: Permission[]) => boolean;
        canAll: (permissions: Permission[]) => boolean;
    };
}
//# sourceMappingURL=RBACManager.d.ts.map