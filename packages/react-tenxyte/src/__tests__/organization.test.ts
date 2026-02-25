import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TenxyteClient } from '../client';
import { OrganizationAPI } from '../organization';

const MOCK_API = 'https://api.example.com';

const handlers = [
    http.get(`${MOCK_API}/organizations/`, async () => {
        return HttpResponse.json([{ id: '1', name: 'Org 1', slug: 'org-1' }], { status: 200 });
    }),

    http.post(`${MOCK_API}/organizations/`, async ({ request }) => {
        const data = await request.json() as any;
        return HttpResponse.json({ id: '2', name: data.name, slug: data.name.toLowerCase() }, { status: 201 });
    }),

    http.get(`${MOCK_API}/organizations/:slug/`, async ({ params }) => {
        return HttpResponse.json({ id: '1', name: 'Org 1', slug: params.slug }, { status: 200 });
    }),

    http.patch(`${MOCK_API}/organizations/:slug/`, async ({ params, request }) => {
        const data = await request.json() as any;
        return HttpResponse.json({ id: '1', name: data.name || 'Org 1', slug: params.slug }, { status: 200 });
    }),

    http.delete(`${MOCK_API}/organizations/:slug/`, async () => {
        return HttpResponse.json({ message: 'Deleted' }, { status: 200 });
    }),

    http.get(`${MOCK_API}/organizations/:slug/members/`, async () => {
        return HttpResponse.json([{ user_id: '1', role: 'admin' }], { status: 200 });
    }),

    http.post(`${MOCK_API}/organizations/:slug/members/`, async ({ request }) => {
        const data = await request.json() as any;
        return HttpResponse.json({ message: `Invited ${data.email}` }, { status: 201 });
    }),

    http.delete(`${MOCK_API}/organizations/:slug/members/:memberId/`, async ({ params }) => {
        return HttpResponse.json({ message: `Removed member ${params.memberId}` }, { status: 200 });
    })
];

const server = setupServer(...handlers);

describe('OrganizationAPI', () => {
    let client: TenxyteClient;
    let orgAPI: OrganizationAPI;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterAll(() => server.close());

    beforeEach(() => {
        client = new TenxyteClient({
            apiUrl: MOCK_API,
            accessKey: 'key',
            accessSecret: 'secret'
        });
        orgAPI = new OrganizationAPI(client);
    });

    afterEach(() => {
        server.resetHandlers();
    });

    it('lists organizations', async () => {
        const res = await orgAPI.list();
        expect(res.length).toBe(1);
        expect(res[0].slug).toBe('org-1');
    });

    it('creates an organization', async () => {
        const res = await orgAPI.create({ name: 'Org 2' });
        expect(res.name).toBe('Org 2');
        expect(res.slug).toBe('org 2');
    });

    it('gets an organization by slug', async () => {
        const res = await orgAPI.get('my-org');
        expect(res.slug).toBe('my-org');
    });

    it('updates an organization', async () => {
        const res = await orgAPI.update('my-org', { name: 'Updated' });
        expect(res.name).toBe('Updated');
    });

    it('deletes an organization', async () => {
        const res = await orgAPI.delete('my-org');
        expect(res.message).toBe('Deleted');
    });

    it('lists members of an organization', async () => {
        const res = await orgAPI.listMembers('my-org');
        expect(res.length).toBe(1);
        expect(res[0].role).toBe('admin');
    });

    it('invites a member', async () => {
        const res = await orgAPI.inviteMember('my-org', 'test@example.com', 'editor');
        expect(res.message).toContain('test@example.com');
    });

    it('removes a member', async () => {
        const res = await orgAPI.removeMember('my-org', 'member_1');
        expect(res.message).toContain('member_1');
    });
});
