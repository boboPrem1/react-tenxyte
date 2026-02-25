import { TenxyteClient } from './client';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    [key: string]: any;
}

export class OrganizationAPI {
    constructor(private client: TenxyteClient) { }

    public async list(): Promise<Organization[]> {
        return this.client.fetch<Organization[]>('/organizations/');
    }

    public async create(data: { name: string; slug?: string }): Promise<Organization> {
        return this.client.fetch<Organization>('/organizations/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    public async get(slug: string): Promise<Organization> {
        return this.client.fetch<Organization>(`/organizations/${slug}/`);
    }

    public async update(slug: string, data: Record<string, any>): Promise<Organization> {
        return this.client.fetch<Organization>(`/organizations/${slug}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    public async delete(slug: string): Promise<{ message: string }> {
        return this.client.fetch(`/organizations/${slug}/`, {
            method: 'DELETE',
        });
    }

    public async listMembers(slug: string): Promise<any[]> {
        return this.client.fetch(`/organizations/${slug}/members/`);
    }

    public async inviteMember(slug: string, email: string, role?: string): Promise<{ message: string }> {
        return this.client.fetch(`/organizations/${slug}/members/`, {
            method: 'POST',
            body: JSON.stringify({ email, role })
        });
    }

    public async removeMember(slug: string, memberId: string): Promise<{ message: string }> {
        return this.client.fetch(`/organizations/${slug}/members/${memberId}/`, {
            method: 'DELETE'
        });
    }
}
