/**
 * Role hierarchy and permission utilities
 */
export type UserRole = 'superuser' | 'admin' | 'editor' | 'author' | 'user';
export declare const ROLES: UserRole[];
export declare const ROLE_LEVELS: Record<UserRole, number>;
/**
 * Check if a user has at least the required role level
 */
export declare function hasRole(userRole: UserRole, requiredRole: UserRole): boolean;
/**
 * Get roles that are at or above the given role
 */
export declare function getRolesAtOrAbove(role: UserRole): UserRole[];
/**
 * Get roles that are below the given role
 */
export declare function getRolesBelow(role: UserRole): UserRole[];
/**
 * Get the display name for a role
 */
export declare function getRoleDisplayName(role: UserRole): string;
/**
 * Get the color class for a role badge
 */
export declare function getRoleColorClass(role: UserRole): string;
/**
 * Check if a role can perform administrative actions
 */
export declare function canAccessAdmin(role: UserRole): boolean;
/**
 * Check if a role can manage users
 */
export declare function canManageUsers(role: UserRole): boolean;
/**
 * Check if a role can manage system settings
 */
export declare function canManageSettings(role: UserRole): boolean;
