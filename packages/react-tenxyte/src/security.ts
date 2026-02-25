import { TenxyteClient } from './client';

// Helper to convert base64url string to ArrayBuffer for WebAuthn API
export function base64URLStringToBuffer(base64URLString: string): ArrayBuffer {
    const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLength, '=');
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
}

// Helper to convert ArrayBuffer to base64url string for sending back to server
export function bufferToBase64URLString(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    const base64String = btoa(str);
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class SecurityAPI {
    constructor(private client: TenxyteClient) { }

    // Passkeys / WebAuthn
    public async registerWebAuthnStart(): Promise<any> {
        return this.client.fetch('/webauthn/register/start/', { method: 'POST' });
    }

    public async registerWebAuthnFinish(data: any): Promise<{ message: string }> {
        return this.client.fetch('/webauthn/register/finish/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    public async authenticateWebAuthnStart(email: string): Promise<any> {
        return this.client.fetch('/webauthn/authenticate/start/', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    public async authenticateWebAuthnFinish(data: any): Promise<any> {
        const tokens = await this.client.fetch('/webauthn/authenticate/finish/', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // If the finish step returns tokens natively
        if (tokens.access_token) {
            this.client.getTokenStorage().setTokens(tokens);
        }
        return tokens;
    }

    // 2FA / TOTP Setup
    public async setupTOTP(): Promise<{ uri: string; secret: string }> {
        return this.client.fetch('/2fa/setup/', { method: 'POST' });
    }

    public async confirmTOTP(code: string): Promise<{ message: string; backup_codes: string[] }> {
        return this.client.fetch('/2fa/confirm/', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }

    public async disableTOTP(code: string): Promise<{ message: string }> {
        return this.client.fetch('/2fa/disable/', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }
}
