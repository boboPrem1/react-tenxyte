export interface TenxyteConfig {
    /**
     * Base URL of the Tenxyte API (e.g., https://api.example.com/api/v1/auth)
     */
    apiUrl: string;

    /**
     * Application-specific access key
     */
    accessKey: string;

    /**
     * Application-specific access secret
     */
    accessSecret: string;

    /**
     * Optional organization slug to send globally via X-Org-Slug header
     */
    orgSlug?: string;
}

export const defaultConfig: Partial<TenxyteConfig> = {};
