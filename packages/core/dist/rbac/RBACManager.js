import { Role, Permission, ROLE_PERMISSIONS, } from './types.js';
export class RBACManager {
    customPermissions = new Map();
    hasPermission(user, permission) {
        const rolePermissions = ROLE_PERMISSIONS[user.role];
        if (rolePermissions?.includes(permission)) {
            return true;
        }
        const customPerms = this.customPermissions.get(user.id);
        if (customPerms?.has(permission)) {
            return true;
        }
        return false;
    }
    hasAnyPermission(user, permissions) {
        return permissions.some(p => this.hasPermission(user, p));
    }
    hasAllPermissions(user, permissions) {
        return permissions.every(p => this.hasPermission(user, p));
    }
    getPermissions(user) {
        const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
        const customPerms = this.customPermissions.get(user.id);
        if (!customPerms) {
            return [...rolePermissions];
        }
        const all = new Set([...rolePermissions, ...customPerms]);
        return Array.from(all);
    }
    grantPermission(userId, permission) {
        if (!this.customPermissions.has(userId)) {
            this.customPermissions.set(userId, new Set());
        }
        this.customPermissions.get(userId).add(permission);
    }
    revokePermission(userId, permission) {
        this.customPermissions.get(userId)?.delete(permission);
    }
    getRoleHierarchy() {
        return [
            Role.SUPER_ADMIN,
            Role.ADMIN,
            Role.MANAGER,
            Role.MEMBER,
            Role.VIEWER,
            Role.GUEST,
        ];
    }
    getRolesAbove(role) {
        const hierarchy = this.getRoleHierarchy();
        const index = hierarchy.indexOf(role);
        return hierarchy.slice(0, index);
    }
    getRolesBelow(role) {
        const hierarchy = this.getRoleHierarchy();
        const index = hierarchy.indexOf(role);
        return hierarchy.slice(index + 1);
    }
    canAssignRole(assigner, targetRole) {
        if (!this.hasPermission(assigner, Permission.USER_ROLE_ASSIGN)) {
            return false;
        }
        const assignerIndex = this.getRoleHierarchy().indexOf(assigner.role);
        const targetIndex = this.getRoleHierarchy().indexOf(targetRole);
        return targetIndex > assignerIndex;
    }
    createPermissionChecker(user) {
        return {
            can: (permission) => this.hasPermission(user, permission),
            canAny: (permissions) => this.hasAnyPermission(user, permissions),
            canAll: (permissions) => this.hasAllPermissions(user, permissions),
        };
    }
}
//# sourceMappingURL=RBACManager.js.map