import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalTokenStorage } from '../storage';

describe('LocalTokenStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('returns null if there are no tokens', () => {
        const storage = new LocalTokenStorage();
        expect(storage.getTokens()).toBeNull();
    });

    it('saves and retrieves tokens correctly', () => {
        const storage = new LocalTokenStorage();
        const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
        storage.setTokens(tokens);

        const retrieved = storage.getTokens();
        expect(retrieved).not.toBeNull();
        expect(retrieved?.access_token).toBe('access123');
        expect(retrieved?.refresh_token).toBe('refresh456');
    });

    it('prioritizes memory-stored access token', () => {
        const storage = new LocalTokenStorage();
        const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
        storage.setTokens(tokens);

        storage.setAccessToken('new_access_token');

        const retrieved = storage.getTokens();
        expect(retrieved?.access_token).toBe('new_access_token');
    });

    it('clears tokens correctly', () => {
        const storage = new LocalTokenStorage();
        const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
        storage.setTokens(tokens);

        storage.clearTokens();
        expect(storage.getTokens()).toBeNull();
    });
});
