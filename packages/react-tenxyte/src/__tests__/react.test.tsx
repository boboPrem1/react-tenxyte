import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenxyteProvider, useTenxyteAuth, Can, withAuth } from '../react';
import { TenxyteClient } from '../client';

// Mock the client and APIs
vi.mock('../client');

const TestComponent = () => {
    const { isAuthenticated, user, isLoading } = useTenxyteAuth();
    if (isLoading) return <div>Loading...</div>;
    return isAuthenticated ? <div>Logged in as {user?.email}</div> : <div>Not logged in</div>;
};

const ProtectedComponent = () => <div>Protected Content</div>;
const FallbackComponent = () => <div>Access Denied</div>;

describe('React Integrations', () => {
    let mockClient: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock client
        mockClient = {
            getTokenStorage: vi.fn().mockReturnValue({
                getTokens: vi.fn().mockReturnValue({ access_token: 'token' }),
                setTokens: vi.fn(),
                clearTokens: vi.fn(),
            }),
            fetch: vi.fn()
        };

        // Mock UserAPI directly via the prototype if needed, or we can just mock fetch
        // In our provider, UserAPI uses client.fetch('/me/')
        mockClient.fetch.mockImplementation((endpoint: string) => {
            if (endpoint === '/me/') {
                return Promise.resolve({
                    id: 1,
                    email: 'test@example.com',
                    roles: [{ name: 'Admin' }],
                    permissions: [{ name: 'read:users' }]
                });
            }
            return Promise.resolve({});
        });
    });

    describe('TenxyteProvider', () => {
        it('provides authentication state to children', async () => {
            render(
                <TenxyteProvider client={mockClient}>
                    <TestComponent />
                </TenxyteProvider>
            );

            // Initially loading
            expect(screen.getByText('Loading...')).toBeInTheDocument();

            // After async checkSession resolves
            await waitFor(() => {
                expect(screen.getByText('Logged in as test@example.com')).toBeInTheDocument();
            });
        });

        it('handles unauthenticated state gracefully', async () => {
            mockClient.getTokenStorage().getTokens.mockReturnValue(null);

            render(
                <TenxyteProvider client={mockClient}>
                    <TestComponent />
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Not logged in')).toBeInTheDocument();
            });
        });
    });

    describe('<Can /> Component', () => {
        it('renders children if user has required role', async () => {
            render(
                <TenxyteProvider client={mockClient}>
                    <Can role="Admin" fallback={<FallbackComponent />}>
                        <ProtectedComponent />
                    </Can>
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });
        });

        it('renders fallback if user lacks required role', async () => {
            render(
                <TenxyteProvider client={mockClient}>
                    <Can role="SuperAdmin" fallback={<FallbackComponent />}>
                        <ProtectedComponent />
                    </Can>
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
            });
        });

        it('renders children if user has required permission', async () => {
            render(
                <TenxyteProvider client={mockClient}>
                    <Can permission="read:users" fallback={<FallbackComponent />}>
                        <ProtectedComponent />
                    </Can>
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });
        });

        it('renders fallback if user lacks required permission', async () => {
            render(
                <TenxyteProvider client={mockClient}>
                    <Can permission="write:users" fallback={<FallbackComponent />}>
                        <ProtectedComponent />
                    </Can>
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
            });
        });
    });

    describe('withAuth HOC', () => {
        it('renders component if authenticated', async () => {
            const ProtectedWithAuth = withAuth(ProtectedComponent, <FallbackComponent />);

            render(
                <TenxyteProvider client={mockClient}>
                    <ProtectedWithAuth />
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });
        });

        it('renders fallback if not authenticated', async () => {
            mockClient.getTokenStorage().getTokens.mockReturnValue(null);
            const ProtectedWithAuth = withAuth(ProtectedComponent, <FallbackComponent />);

            render(
                <TenxyteProvider client={mockClient}>
                    <ProtectedWithAuth />
                </TenxyteProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
            });
        });
    });
});
