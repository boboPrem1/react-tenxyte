import React from 'react';
import { useTenxyteAuth } from './provider';

interface CanProps {
    role?: string | string[];
    permission?: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ role, permission, children, fallback = null }) => {
    const { user, isAuthenticated } = useTenxyteAuth();

    if (!isAuthenticated || !user) {
        return <>{fallback}</>;
    }

    const hasRequiredRole = () => {
        if (!role) return true;
        const rolesToCheck = Array.isArray(role) ? role : [role];
        const userRoles = user.roles?.map(r => r.name) || [];
        return rolesToCheck.some(r => userRoles.includes(r));
    };

    const hasRequiredPermission = () => {
        if (!permission) return true;
        const permsToCheck = Array.isArray(permission) ? permission : [permission];
        const userPerms = user.permissions?.map(p => p.name) || [];
        return permsToCheck.some(p => userPerms.includes(p));
    };

    // If both are provided, user must have BOTH (or we could make it OR based on a prop, but AND is safer default)
    // Actually, usually it's OR if we want loose, BUT let's stick to: if you specify a role, you need it. If you specify a perm, you need it.
    const isAuthorized = hasRequiredRole() && hasRequiredPermission();

    return isAuthorized ? <>{children}</> : <>{fallback}</>;
};

export const hasRole = (user: any, role: string | string[]): boolean => {
    if (!user || (!user.roles && !user.roles)) return false;
    const rolesToCheck = Array.isArray(role) ? role : [role];
    const userRoles = user.roles?.map((r: any) => r.name) || [];
    return rolesToCheck.some(r => userRoles.includes(r));
};

export const hasPermission = (user: any, permission: string | string[]): boolean => {
    if (!user || (!user.permissions && !user.permissions)) return false;
    const permsToCheck = Array.isArray(permission) ? permission : [permission];
    const userPerms = user.permissions?.map((p: any) => p.name) || [];
    return permsToCheck.some(p => userPerms.includes(p));
};
