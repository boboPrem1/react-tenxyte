import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TenxyteClient } from '../client';
import { SecurityAPI, base64URLStringToBuffer, bufferToBase64URLString } from '../security';
import { LocalTokenStorage } from '../storage';

const MOCK_API = 'https://api.example.com';

const handlers = [
    http.post(`${MOCK_API}/webauthn/register/start/`, async () => {
        return HttpResponse.json({ challenge: 'mock_challenge' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/webauthn/register/finish/`, async () => {
        return HttpResponse.json({ message: 'Passkey registered' }, { status: 201 });
    }),

    http.post(`${MOCK_API}/webauthn/authenticate/start/`, async () => {
        return HttpResponse.json({ challenge: 'auth_challenge' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/webauthn/authenticate/finish/`, async () => {
        return HttpResponse.json({ access_token: 'webauthn_access', refresh_token: 'webauthn_refresh' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/2fa/setup/`, async () => {
        return HttpResponse.json({ uri: 'otpauth://totp/mock', secret: 'MOCKSECRET' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/2fa/confirm/`, async () => {
        return HttpResponse.json({ message: '2FA enabled', backup_codes: ['code1', 'code2'] }, { status: 200 });
    }),

    http.post(`${MOCK_API}/2fa/disable/`, async () => {
        return HttpResponse.json({ message: '2FA disabled' }, { status: 200 });
    })
];

const server = setupServer(...handlers);

describe('SecurityAPI', () => {
    let client: TenxyteClient;
    let securityAPI: SecurityAPI;
    let storage: LocalTokenStorage;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterAll(() => server.close());

    beforeEach(() => {
        storage = new LocalTokenStorage();
        client = new TenxyteClient({
            apiUrl: MOCK_API,
            accessKey: 'key',
            accessSecret: 'secret'
        }, storage);
        securityAPI = new SecurityAPI(client);
    });

    afterEach(() => {
        server.resetHandlers();
        storage.clearTokens();
    });

    describe('WebAuthn Helpers', () => {
        it('converts base64url to ArrayBuffer and back', () => {
            const originalBase64Url = 'aGVsbG8td29ybGRfMTIz'; // "hello-world_123" safe encoding
            const buffer = base64URLStringToBuffer(originalBase64Url);

            expect(buffer).toBeInstanceOf(ArrayBuffer);
            expect(buffer.byteLength).toBeGreaterThan(0);

            const convertedBack = bufferToBase64URLString(buffer);
            expect(convertedBack).toBe(originalBase64Url);
        });
    });

    describe('WebAuthn / Passkeys', () => {
        it('starts webauthn registration', async () => {
            const res = await securityAPI.registerWebAuthnStart();
            expect(res.challenge).toBe('mock_challenge');
        });

        it('finishes webauthn registration', async () => {
            const res = await securityAPI.registerWebAuthnFinish({ response: 'data' });
            expect(res.message).toBe('Passkey registered');
        });

        it('starts webauthn authentication', async () => {
            const res = await securityAPI.authenticateWebAuthnStart('test@example.com');
            expect(res.challenge).toBe('auth_challenge');
        });

        it('finishes webauthn authentication and stores tokens', async () => {
            const res = await securityAPI.authenticateWebAuthnFinish({ response: 'data' });
            expect(res.access_token).toBe('webauthn_access');
            expect(storage.getAccessToken()).toBe('webauthn_access');
        });
    });

    describe('TOTP / 2FA', () => {
        it('sets up TOTP', async () => {
            const res = await securityAPI.setupTOTP();
            expect(res.secret).toBe('MOCKSECRET');
        });

        it('confirms TOTP', async () => {
            const res = await securityAPI.confirmTOTP('123456');
            expect(res.message).toBe('2FA enabled');
            expect(res.backup_codes).toContain('code1');
        });

        it('disables TOTP', async () => {
            const res = await securityAPI.disableTOTP('123456');
            expect(res.message).toBe('2FA disabled');
        });
    });
});
