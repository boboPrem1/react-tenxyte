import { Tokens } from './types';

export interface TokenStorage {
    getTokens(): Tokens | null;
    setTokens(tokens: Tokens): void;
    clearTokens(): void;

    // Storage for just the access token if needed for memory-only implementations
    getAccessToken(): string | null;
    setAccessToken(token: string): void;
    clearAccessToken(): void;
}

export class LocalTokenStorage implements TokenStorage {
    private readonly STORAGE_KEY = 'tenxyte_auth_tokens';
    // Security best practice: try to keep access_token in memory
    private memoryAccessToken: string | null = null;

    getTokens(): Tokens | null {
        if (typeof window === 'undefined') return null; // SSR safety
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return null;
            const tokens = JSON.parse(stored) as Tokens;
            // Overwrite with memory if available (more secure)
            if (this.memoryAccessToken) {
                tokens.access_token = this.memoryAccessToken;
            }
            return tokens;
        } catch {
            return null;
        }
    }

    setTokens(tokens: Tokens): void {
        if (typeof window === 'undefined') return;
        this.memoryAccessToken = tokens.access_token;
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                // Often you don't want to store the access token in localStorage due to XSS
                // But for a simple default, we might. 
                // Realistically, users should provide an HttpOnly cookie approach for SSR.
                ...tokens,
                // Let's store both by default for this simple implementation
                access_token: tokens.access_token,
            }));
        } catch {
            // Ignore
        }
    }

    clearTokens(): void {
        this.memoryAccessToken = null;
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch {
            // Ignore
        }
    }

    getAccessToken(): string | null {
        if (this.memoryAccessToken) return this.memoryAccessToken;
        const tokens = this.getTokens();
        return tokens ? tokens.access_token : null;
    }

    setAccessToken(token: string): void {
        this.memoryAccessToken = token;
        const current = this.getTokens();
        if (current) {
            current.access_token = token;
            this.setTokens(current);
        }
    }

    clearAccessToken(): void {
        this.memoryAccessToken = null;
        const current = this.getTokens();
        if (current) {
            current.access_token = '';
            this.setTokens(current);
        }
    }
}
