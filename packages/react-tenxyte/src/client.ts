import { TenxyteConfig } from './config';
import { TokenStorage, LocalTokenStorage } from './storage';
import { Tokens } from './types';

export class TenxyteClient {
    private config: TenxyteConfig;
    private tokenStorage: TokenStorage;
    private isRefreshing = false;
    private refreshSubscribers: ((error: Error | null, token: string | null) => void)[] = [];

    constructor(config: TenxyteConfig, storage?: TokenStorage) {
        if (!config.apiUrl || !config.accessKey || !config.accessSecret) {
            throw new Error("Missing required config parameters: apiUrl, accessKey, accessSecret");
        }
        this.config = { ...config };
        this.tokenStorage = storage || new LocalTokenStorage();
    }

    public getConfig(): TenxyteConfig {
        return this.config;
    }

    public setOrgSlug(orgSlug: string) {
        this.config.orgSlug = orgSlug;
    }

    public getTokenStorage(): TokenStorage {
        return this.tokenStorage;
    }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'X-Access-Key': this.config.accessKey,
            'X-Access-Secret': this.config.accessSecret,
            'Content-Type': 'application/json',
        };
        if (this.config.orgSlug) {
            headers['X-Org-Slug'] = this.config.orgSlug;
        }

        const accessToken = this.tokenStorage.getAccessToken();
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        return headers;
    }

    private onRefreshed(error: Error | null, token: string | null) {
        this.refreshSubscribers.forEach(cb => cb(error, token));
        this.refreshSubscribers = [];
    }

    private addRefreshSubscriber(cb: (error: Error | null, token: string | null) => void) {
        this.refreshSubscribers.push(cb);
    }

    private async refreshTokens(): Promise<Tokens> {
        const tokens = this.tokenStorage.getTokens();
        if (!tokens || !tokens.refresh_token) {
            throw new Error("No refresh token available");
        }

        const url = `${this.config.apiUrl.replace(/\/$/, '')}/refresh/`;
        // Using a plain fetch here to avoid interceptor loop
        const headers: Record<string, string> = {
            'X-Access-Key': this.config.accessKey,
            'X-Access-Secret': this.config.accessSecret,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ refresh_token: tokens.refresh_token }),
        });

        if (!response.ok) {
            this.tokenStorage.clearTokens();
            throw new Error("Session expired");
        }

        const data = await response.json();
        this.tokenStorage.setTokens(data);
        return data;
    }

    public async fetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.config.apiUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
        const headers = {
            ...this.getAuthHeaders(),
            ...options.headers,
        } as Record<string, string>;

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (response.status === 401 && !endpoint.includes('/refresh/')) {
            return this.handle401Error<T>(endpoint, options, response);
        }

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: response.statusText };
            }
            throw new Error(errorData?.error || errorData?.message || 'Request failed with status ' + response.status);
        }

        if (response.status === 204) {
            return {} as T;
        }

        try {
            return await response.json();
        } catch {
            return {} as T;
        }
    }

    private async handle401Error<T>(endpoint: string, options: RequestInit, originalResponse: Response): Promise<T> {
        // If we are already refreshing, we queue up the request
        if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
                this.addRefreshSubscriber(async (error, token) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    // Retrying the original request
                    try {
                        const res = await this.fetch<T>(endpoint, options);
                        resolve(res);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }

        this.isRefreshing = true;
        try {
            const newTokens = await this.refreshTokens();
            this.isRefreshing = false;
            this.onRefreshed(null, newTokens.access_token);

            // Retry the original request implicitly via a new fetch call
            return this.fetch<T>(endpoint, options);
        } catch (error: any) {
            this.isRefreshing = false;
            this.onRefreshed(error, null);

            // Re-throw the original 401 or the refresh error
            let errorData;
            try {
                errorData = await originalResponse.clone().json();
            } catch (e) {
                errorData = { message: originalResponse.statusText };
            }
            throw new Error(errorData?.error || errorData?.message || 'Session Expired');
        }
    }
}
