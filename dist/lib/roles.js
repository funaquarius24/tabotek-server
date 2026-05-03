/**
 * Role hierarchy and permission utilities
 */
export const ROLES = ['user', 'author', 'editor', 'admin', 'superuser'];
export const ROLE_LEVELS = {
    user: 0,
    author: 1,
    editor: 2,
    admin: 3,
    superuser: 4,
};
/**
 * Check if a user has at least the required role level
 */
export function hasRole(userRole, requiredRole) {
    return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}
/**
 * Get roles that are at or above the given role
 */
export function getRolesAtOrAbove(role) {
    const level = ROLE_LEVELS[role];
    return ROLES.filter(r => ROLE_LEVELS[r] >= level);
}
/**
 * Get roles that are below the given role
 */
export function getRolesBelow(role) {
    const level = ROLE_LEVELS[role];
    return ROLES.filter(r => ROLE_LEVELS[r] < level);
}
/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role) {
    switch (role) {
        case 'superuser': return 'Superuser';
        case 'admin': return 'Administrator';
        case 'editor': return 'Editor';
        case 'author': return 'Author';
        case 'user': return 'User';
        default: return role;
    }
}
/**
 * Get the color class for a role badge
 */
export function getRoleColorClass(role) {
    switch (role) {
        case 'superuser': return 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800';
        case 'admin': return 'bg-red-100 text-red-800';
        case 'editor': return 'bg-green-100 text-green-800';
        case 'author': return 'bg-purple-100 text-purple-800';
        case 'user': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}
/**
 * Check if a role can perform administrative actions
 */
export function canAccessAdmin(role) {
    return hasRole(role, 'admin');
}
/**
 * Check if a role can manage users
 */
export function canManageUsers(role) {
    return hasRole(role, 'admin');
}
/**
 * Check if a role can manage system settings
 */
export function canManageSettings(role) {
    return hasRole(role, 'superuser');
}
