import { TenxyteClient } from './client';
import { Tokens } from './types';

export class AuthAPI {
    constructor(private client: TenxyteClient) { }

    public async register(data: Record<string, any>): Promise<{ message: string; user: any; verification_required: any }> {
        return this.client.fetch('/register/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    public async loginWithEmail(data: { email: string; password: string; totp_code?: string }): Promise<Tokens> {
        const tokens = await this.client.fetch<Tokens>('/login/email/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (tokens.access_token) {
            this.client.getTokenStorage().setTokens(tokens);
        }
        return tokens;
    }

    public async loginWithPhone(data: { phone_country_code: string; phone_number: string; password: string; totp_code?: string }): Promise<Tokens> {
        const tokens = await this.client.fetch<Tokens>('/login/phone/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (tokens.access_token) {
            this.client.getTokenStorage().setTokens(tokens);
        }
        return tokens;
    }

    public async logout(allDevices: boolean = false): Promise<{ message: string }> {
        const tokens = this.client.getTokenStorage().getTokens();

        const endpoint = allDevices ? '/logout/all/' : '/logout/';
        const body = tokens?.refresh_token ? JSON.stringify({ refresh_token: tokens.refresh_token }) : undefined;

        try {
            const res = await this.client.fetch(endpoint, {
                method: 'POST',
                body,
            });
            return res;
        } finally {
            this.client.getTokenStorage().clearTokens();
        }
    }

    public async requestMagicLink(email: string): Promise<{ message: string }> {
        return this.client.fetch('/magic-link/request/', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    public async verifyMagicLink(token: string): Promise<Tokens> {
        const tokens = await this.client.fetch<Tokens>('/magic-link/verify/', {
            method: 'POST',
            body: JSON.stringify({ token }),
        });
        if (tokens.access_token) {
            this.client.getTokenStorage().setTokens(tokens);
        }
        return tokens;
    }

    public async requestOTP(type: 'email' | 'phone'): Promise<{ message: string }> {
        return this.client.fetch('/otp/request/', {
            method: 'POST',
            body: JSON.stringify({ type }),
        });
    }

    public async verifyEmailOTP(code: string): Promise<{ message: string }> {
        return this.client.fetch('/otp/verify/email/', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    }

    public async verifyPhoneOTP(code: string): Promise<{ message: string }> {
        return this.client.fetch('/otp/verify/phone/', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    }
}
