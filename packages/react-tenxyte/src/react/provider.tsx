import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TenxyteClient } from '../client';
import { AuthAPI } from '../auth';
import { UserAPI } from '../user';
import { OrganizationAPI, Organization } from '../organization';
import { Tokens } from '../types';

export interface TenxyteUser {
    id: string | number;
    email: string;
    first_name?: string;
    last_name?: string;
    roles?: { id: string | number; name: string }[];
    permissions?: { id: string | number; name: string }[];
    [key: string]: any;
}

export interface TenxyteContextState {
    user: TenxyteUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: Error | null;
    tokens: Tokens | null;
    currentOrg: Organization | null;
}

export interface TenxyteContextValue extends TenxyteContextState {
    client: TenxyteClient;
    auth: AuthAPI;
    userApi: UserAPI;
    orgApi: OrganizationAPI;
    checkSession: () => Promise<void>;
    logout: (allDevices?: boolean) => Promise<void>;
    switchOrganization: (orgSlug: string) => Promise<void>;
}

export const TenxyteContext = createContext<TenxyteContextValue | null>(null);

export interface TenxyteProviderProps {
    client: TenxyteClient;
    children: React.ReactNode;
}

export const TenxyteProvider: React.FC<TenxyteProviderProps> = ({ client, children }) => {
    const [state, setState] = useState<TenxyteContextState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        tokens: client.getTokenStorage().getTokens(),
        currentOrg: null,
    });

    const auth = React.useMemo(() => new AuthAPI(client), [client]);
    const userApi = React.useMemo(() => new UserAPI(client), [client]);
    const orgApi = React.useMemo(() => new OrganizationAPI(client), [client]);

    const switchOrganization = async (orgSlug: string) => {
        client.setOrgSlug(orgSlug);
        try {
            const orgData = await orgApi.get(orgSlug);
            setState(prev => ({ ...prev, currentOrg: orgData }));
        } catch (error) {
            console.error('Failed to switch organization', error);
            setState(prev => ({ ...prev, currentOrg: null }));
        }
    };

    const checkSession = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const tokens = client.getTokenStorage().getTokens();
            if (!tokens?.access_token) {
                // Try to refresh implicitly via fetch or simply return unauthenticated if no refresh_token
                if (!tokens?.refresh_token) {
                    setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false, tokens: null, currentOrg: null }));
                    return;
                }
                // If we have a refresh token but no access token, a fetch will trigger a refresh.
            }
            const userProfile = await userApi.getProfile();
            setState(prev => ({
                user: userProfile,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                tokens: client.getTokenStorage().getTokens(),
                currentOrg: prev.currentOrg,
            }));
        } catch (error: any) {
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error,
                tokens: null,
                currentOrg: null,
            });
        }
    }, [client, userApi]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const logout = async (allDevices: boolean = false) => {
        await auth.logout(allDevices);
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            tokens: null,
            currentOrg: null,
        });
    };

    const value: TenxyteContextValue = {
        ...state,
        client,
        auth,
        userApi,
        orgApi,
        checkSession,
        logout,
        switchOrganization,
    };

    return <TenxyteContext.Provider value={value}>{children}</TenxyteContext.Provider>;
};

export const useTenxyteAuth = () => {
    const context = useContext(TenxyteContext);
    if (!context) {
        throw new Error('useTenxyteAuth must be used within a TenxyteProvider');
    }
    return context;
};
