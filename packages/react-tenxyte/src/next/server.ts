import { cookies } from 'next/headers';
import { TenxyteClient } from '../client';
import { Tokens } from '../types';

export function createNextServerClient(apiUrl: string, accessKey: string, accessSecret: string): TenxyteClient {
    return new TenxyteClient(
        { apiUrl, accessKey, accessSecret },
        {
            getTokens: (): Tokens | null => {
                const cookieStore = cookies();
                const access_token = cookieStore.get('tenxyte_access_token')?.value;
                const refresh_token = cookieStore.get('tenxyte_refresh_token')?.value;

                if (!access_token && !refresh_token) return null;

                return {
                    access_token: access_token || '',
                    refresh_token: refresh_token || ''
                };
            },
            setTokens: (tokens: Tokens): void => {
                // In a server component, you can theoretically only SET cookies via Server Actions or Middleware.
                // However, returning setting here is useful if used within a Server Action where `cookies().set` is allowed.
                const cookieStore = cookies();
                try {
                    if (tokens.access_token) {
                        cookieStore.set('tenxyte_access_token', tokens.access_token, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'lax',
                            path: '/'
                        });
                    }
                    if (tokens.refresh_token) {
                        cookieStore.set('tenxyte_refresh_token', tokens.refresh_token, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'lax',
                            path: '/'
                        });
                    }
                } catch (e) {
                    console.warn('Cannot set cookies from a Server Component. Ensure this is called in a Server Action or Middleware if setting tokens.', e);
                }
            },
            clearTokens: (): void => {
                const cookieStore = cookies();
                try {
                    cookieStore.delete('tenxyte_access_token');
                    cookieStore.delete('tenxyte_refresh_token');
                } catch (e) {
                    console.warn('Cannot delete cookies from a Server Component. Ensure this is called in a Server Action or Middleware.', e);
                }
            }
        }
    );
}

export async function getUserSession(client: TenxyteClient) {
    try {
        const tokens = client.getTokenStorage().getTokens();
        if (!tokens?.access_token && !tokens?.refresh_token) return null;

        return await client.fetch('/me/');
    } catch (error) {
        return null;
    }
}
