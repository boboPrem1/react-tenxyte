import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TenxyteClient } from '../client';
import { AuthAPI } from '../auth';
import { LocalTokenStorage } from '../storage';

const MOCK_API = 'https://api.example.com';

const handlers = [
    http.post(`${MOCK_API}/register/`, async ({ request }) => {
        const data = await request.json() as any;
        if (data.email === 'error@example.com') {
            return HttpResponse.json({ error: 'Email exists' }, { status: 400 });
        }
        return HttpResponse.json({
            message: 'Registration successful',
            user: { id: 1, email: data.email },
            verification_required: { email: true }
        }, { status: 201 });
    }),

    http.post(`${MOCK_API}/login/email/`, async ({ request }) => {
        const data = await request.json() as any;
        if (data.password === 'wrong') {
            return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        return HttpResponse.json({
            access_token: 'access_mock',
            refresh_token: 'refresh_mock'
        }, { status: 200 });
    }),

    http.post(`${MOCK_API}/login/phone/`, async ({ request }) => {
        return HttpResponse.json({
            access_token: 'phone_access_mock',
            refresh_token: 'phone_refresh_mock'
        }, { status: 200 });
    }),

    http.post(`${MOCK_API}/logout/`, async () => {
        return HttpResponse.json({ message: 'Logged out' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/logout/all/`, async () => {
        return HttpResponse.json({ message: 'Logged out from all devices' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/magic-link/request/`, async () => {
        return HttpResponse.json({ message: 'Magic link sent' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/magic-link/verify/`, async ({ request }) => {
        const data = await request.json() as any;
        if (data.token === 'invalid') {
            return HttpResponse.json({ error: 'Invalid token' }, { status: 400 });
        }
        return HttpResponse.json({
            access_token: 'magic_access',
            refresh_token: 'magic_refresh'
        }, { status: 200 });
    }),

    http.post(`${MOCK_API}/otp/request/`, async () => {
        return HttpResponse.json({ message: 'OTP sent' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/otp/verify/email/`, async () => {
        return HttpResponse.json({ message: 'Email verified' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/otp/verify/phone/`, async () => {
        return HttpResponse.json({ message: 'Phone verified' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/password/reset/request/`, async () => {
        return HttpResponse.json({ message: 'Password reset email sent' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/password/reset/confirm/`, async () => {
        return HttpResponse.json({ message: 'Password reset successful' }, { status: 200 });
    }),

    http.post(`${MOCK_API}/password/change/`, async () => {
        return HttpResponse.json({ message: 'Password changed successfully' }, { status: 200 });
    })
];

const server = setupServer(...handlers);

describe('AuthAPI', () => {
    let client: TenxyteClient;
    let auth: AuthAPI;
    let storage: LocalTokenStorage;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterAll(() => server.close());

    beforeEach(() => {
        localStorage.clear();
        storage = new LocalTokenStorage();
        client = new TenxyteClient({
            apiUrl: MOCK_API,
            accessKey: 'key',
            accessSecret: 'secret'
        }, storage);
        auth = new AuthAPI(client);
    });

    afterEach(() => {
        server.resetHandlers();
    });

    it('registers a user successfully', async () => {
        const res = await auth.register({ email: 'test@example.com', password: 'pass', first_name: 'John' });
        expect(res.message).toBe('Registration successful');
        expect(res.user.email).toBe('test@example.com');
    });

    it('handles register error', async () => {
        await expect(auth.register({ email: 'error@example.com' })).rejects.toThrow('Email exists');
    });

    it('logs in with email and saves tokens', async () => {
        const res = await auth.loginWithEmail({ email: 'test@example.com', password: 'pass' });
        expect(res.access_token).toBe('access_mock');
        expect(storage.getAccessToken()).toBe('access_mock');
    });

    it('logs in with phone and saves tokens', async () => {
        const res = await auth.loginWithPhone({ phone_country_code: '+1', phone_number: '5551234', password: 'pass' });
        expect(res.access_token).toBe('phone_access_mock');
        expect(storage.getAccessToken()).toBe('phone_access_mock');
    });

    it('logs out and clears tokens (single device)', async () => {
        storage.setTokens({ access_token: 'a', refresh_token: 'r' });
        const res = await auth.logout(false);
        expect(res.message).toBe('Logged out');
        expect(storage.getTokens()).toBeNull();
    });

    it('logs out and clears tokens (all devices)', async () => {
        storage.setTokens({ access_token: 'a', refresh_token: 'r' });
        const res = await auth.logout(true);
        expect(res.message).toBe('Logged out from all devices');
        expect(storage.getTokens()).toBeNull();
    });

    it('requests magic link', async () => {
        const res = await auth.requestMagicLink('test@example.com');
        expect(res.message).toBe('Magic link sent');
    });

    it('verifies magic link and saves tokens', async () => {
        const res = await auth.verifyMagicLink('valid_token');
        expect(res.access_token).toBe('magic_access');
        expect(storage.getAccessToken()).toBe('magic_access');
    });

    it('handles invalid magic link', async () => {
        await expect(auth.verifyMagicLink('invalid')).rejects.toThrow('Invalid token');
    });

    it('requests OTP', async () => {
        const res = await auth.requestOTP('email');
        expect(res.message).toBe('OTP sent');
    });

    it('verifies email OTP', async () => {
        const res = await auth.verifyEmailOTP('123456');
        expect(res.message).toBe('Email verified');
    });

    it('requests password reset', async () => {
        const res = await auth.requestPasswordReset('test@example.com');
        expect(res.message).toBe('Password reset email sent');
    });

    it('confirms password reset', async () => {
        const res = await auth.confirmPasswordReset({ email: 'test@example.com', code: '123456', new_password: 'pass' });
        expect(res.message).toBe('Password reset successful');
    });

    it('changes password', async () => {
        const res = await auth.changePassword({ old_password: 'old', new_password: 'new' });
        expect(res.message).toBe('Password changed successfully');
    });
});
