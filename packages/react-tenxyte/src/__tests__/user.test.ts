import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TenxyteClient } from '../client';
import { UserAPI } from '../user';

const MOCK_API = 'https://api.example.com';

const handlers = [
    http.get(`${MOCK_API}/me/`, async () => {
        return HttpResponse.json({ id: 1, email: 'test@example.com' }, { status: 200 });
    }),

    http.patch(`${MOCK_API}/me/`, async ({ request }) => {
        const data = await request.json() as any;
        return HttpResponse.json({ id: 1, email: 'test@example.com', ...data }, { status: 200 });
    }),

    http.post(`${MOCK_API}/me/disable/`, async () => {
        return HttpResponse.json({ message: 'Account disabled' }, { status: 200 });
    }),

    http.delete(`${MOCK_API}/me/delete/`, async () => {
        return HttpResponse.json({ message: 'Account deleted' }, { status: 200 });
    }),

    http.get(`${MOCK_API}/rbac/permissions/`, async () => {
        return HttpResponse.json([{ id: 1, name: 'read:users' }, { id: 2, name: 'write:users' }], { status: 200 });
    }),

    http.get(`${MOCK_API}/rbac/roles/`, async () => {
        return HttpResponse.json([{ id: 1, name: 'Admin' }, { id: 2, name: 'Editor' }], { status: 200 });
    }),

    http.post(`${MOCK_API}/rbac/users/:userId/roles/`, async ({ params, request }) => {
        const { userId } = params;
        const data = await request.json() as any;
        return HttpResponse.json({ message: `Role ${data.role} assigned to ${userId}` }, { status: 200 });
    }),

    http.delete(`${MOCK_API}/rbac/users/:userId/roles/:roleId/`, async ({ params }) => {
        const { userId, roleId } = params;
        return HttpResponse.json({ message: `Role ${roleId} removed from ${userId}` }, { status: 200 });
    })
];

const server = setupServer(...handlers);

describe('UserAPI', () => {
    let client: TenxyteClient;
    let userAPI: UserAPI;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterAll(() => server.close());

    beforeEach(() => {
        client = new TenxyteClient({
            apiUrl: MOCK_API,
            accessKey: 'key',
            accessSecret: 'secret'
        });
        userAPI = new UserAPI(client);
    });

    afterEach(() => {
        server.resetHandlers();
    });

    it('fetches current user profile', async () => {
        const res = await userAPI.getProfile();
        expect(res.email).toBe('test@example.com');
    });

    it('updates user profile', async () => {
        const res = await userAPI.updateProfile({ first_name: 'Jane' });
        expect(res.first_name).toBe('Jane');
        expect(res.email).toBe('test@example.com');
    });

    it('disables user account', async () => {
        const res = await userAPI.disableAccount();
        expect(res.message).toBe('Account disabled');
    });

    it('deletes user account', async () => {
        const res = await userAPI.deleteAccount();
        expect(res.message).toBe('Account deleted');
    });

    it('fetches permissions', async () => {
        const res = await userAPI.getPermissions();
        expect(res.length).toBe(2);
        expect(res[0].name).toBe('read:users');
    });

    it('fetches roles', async () => {
        const res = await userAPI.getRoles();
        expect(res.length).toBe(2);
    });

    it('assigns a role to user', async () => {
        const res = await userAPI.assignRole('user_123', 'role_456');
        expect(res.message).toBe('Role role_456 assigned to user_123');
    });

    it('removes a role from user', async () => {
        const res = await userAPI.removeRole('user_123', 'role_456');
        expect(res.message).toBe('Role role_456 removed from user_123');
    });
});
