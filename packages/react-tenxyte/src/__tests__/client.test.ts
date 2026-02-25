import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenxyteClient } from '../client';
import { TokenStorage } from '../storage';
import { Tokens } from '../types';

global.fetch = vi.fn();

// Dummy storage for tests
class MockTokenStorage implements TokenStorage {
    private tokens: Tokens | null = null;
    getTokens() { return this.tokens; }
    setTokens(t: Tokens) { this.tokens = t; }
    clearTokens() { this.tokens = null; }
    getAccessToken() { return this.tokens?.access_token || null; }
    setAccessToken(a: string) { if (this.tokens) this.tokens.access_token = a; }
    clearAccessToken() { if (this.tokens) this.tokens.access_token = ''; }
}

describe('TenxyteClient', () => {
    const mockConfig = {
        apiUrl: 'https://api.example.com',
        accessKey: 'test_key',
        accessSecret: 'test_secret'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws if config is missing required fields', () => {
        expect(() => new TenxyteClient({} as any)).toThrow();
    });

    it('injects access key and secret headers', async () => {
        const client = new TenxyteClient(mockConfig);

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
        } as any);

        await client.fetch('/test');

        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
            headers: expect.objectContaining({
                'X-Access-Key': 'test_key',
                'X-Access-Secret': 'test_secret'
            })
        }));
    });

    it('injects X-Org-Slug if configured', async () => {
        const client = new TenxyteClient({
            ...mockConfig,
            orgSlug: 'my-org'
        });

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
        } as any);

        await client.fetch('/test');

        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
            headers: expect.objectContaining({
                'X-Org-Slug': 'my-org'
            })
        }));
    });

    it('strips trailing slashes from API URL and handles leading slash in endpoint', async () => {
        const client = new TenxyteClient(mockConfig);

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
        } as any);

        await client.fetch('test');

        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.any(Object));
    });

    it('throws an error if response is not ok', async () => {
        const client = new TenxyteClient(mockConfig);

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: () => Promise.resolve({ error: 'Invalid config' })
        } as any);

        await expect(client.fetch('/test')).rejects.toThrow('Invalid config');
    });

    it('injects Authorization Bearer if access token is present', async () => {
        const storage = new MockTokenStorage();
        storage.setTokens({ access_token: 'dummy_access', refresh_token: 'dummy_refresh' });
        const client = new TenxyteClient(mockConfig, storage);

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true, status: 200, json: () => Promise.resolve({ success: true })
        } as any);

        await client.fetch('/test');

        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
            headers: expect.objectContaining({
                'Authorization': 'Bearer dummy_access'
            })
        }));
    });

    it('automatically intercepts 401, calls refresh, then retries original request', async () => {
        const storage = new MockTokenStorage();
        storage.setTokens({ access_token: 'old_access', refresh_token: 'valid_refresh' });
        const client = new TenxyteClient(mockConfig, storage);

        // 1st request FAILS with 401
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false, status: 401, json: () => Promise.resolve({ error: 'Expired' })
        } as any);

        // 2nd request (the refresh) SUCCEEDS
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true, status: 200, json: () => Promise.resolve({ access_token: 'new_access', refresh_token: 'new_refresh' })
        } as any);

        // 3rd request (the retry) SUCCEEDS
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true, status: 200, json: () => Promise.resolve({ payload: 'success!' })
        } as any);

        const result = await client.fetch('/protected');
        expect(result).toEqual({ payload: 'success!' });
        expect(storage.getAccessToken()).toBe('new_access');
        expect(global.fetch).toHaveBeenCalledTimes(3);

        // Check the final call uses the new token
        expect(global.fetch).toHaveBeenNthCalledWith(3, 'https://api.example.com/protected', expect.objectContaining({
            headers: expect.objectContaining({ 'Authorization': 'Bearer new_access' })
        }));
    });

    it('fails completely if refresh token is rejected', async () => {
        const storage = new MockTokenStorage();
        storage.setTokens({ access_token: 'old_access', refresh_token: 'bad_refresh' });
        const client = new TenxyteClient(mockConfig, storage);

        // 1st request FAILS with 401
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false, status: 401, json: () => Promise.resolve({ error: 'Expired' }),
            clone: function () { return this; },
            statusText: 'Unauthorized'
        } as any);

        // 2nd request (the refresh) FAILS
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false, status: 401, json: () => Promise.resolve({ error: 'Invalid refresh token' }),
            statusText: 'Unauthorized'
        } as any);

        await expect(client.fetch('/protected')).rejects.toThrow('Expired');
        expect(storage.getTokens()).toBeNull(); // Storage should be cleared on session expiration
    });

    it('queues concurrent requests during a refresh', async () => {
        const storage = new MockTokenStorage();
        storage.setTokens({ access_token: 'old_access', refresh_token: 'valid_refresh' });
        const client = new TenxyteClient(mockConfig, storage);

        // Set up fetch mock
        (global.fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ // Request A: 401
                ok: false, status: 401, json: () => Promise.resolve({ error: 'Expired' })
            } as any)
            .mockResolvedValueOnce({ // Request B: 401 (happens concurrently)
                ok: false, status: 401, json: () => Promise.resolve({ error: 'Expired' })
            } as any)
            .mockResolvedValueOnce({ // Refresh request
                ok: true, status: 200, json: () => Promise.resolve({ access_token: 'new_access', refresh_token: 'new_refresh' })
            } as any)
            .mockResolvedValueOnce({ // Retry A
                ok: true, status: 200, json: () => Promise.resolve({ result: 'A' })
            } as any)
            .mockResolvedValueOnce({ // Retry B
                ok: true, status: 200, json: () => Promise.resolve({ result: 'B' })
            } as any);

        // Fire A and B concurrently
        const [resA, resB] = await Promise.all([
            client.fetch('/reqA'),
            client.fetch('/reqB')
        ]);

        const results = [resA.result, resB.result];
        expect(results).toContain('A');
        expect(results).toContain('B');
    });
});
