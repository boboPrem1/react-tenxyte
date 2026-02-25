import React from 'react';
import { useTenxyteAuth } from './provider';

interface WithAuthProps {
    fallback?: React.ReactNode;
}

export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback: React.ReactNode = null
): React.FC<P & WithAuthProps> {
    const WithAuthComponent: React.FC<P & WithAuthProps> = (props) => {
        const { isAuthenticated, isLoading } = useTenxyteAuth();

        if (isLoading) {
            // Let the provider handle initial loading state, or return a spinner here
            return null;
        }

        if (!isAuthenticated) {
            return <>{props.fallback || fallback}</>;
        }

        return <WrappedComponent {...props} />;
    };

    WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return WithAuthComponent;
}
