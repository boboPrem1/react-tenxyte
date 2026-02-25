import { TenxyteClient } from './client';

export class UserAPI {
    constructor(private client: TenxyteClient) { }

    public async getProfile(): Promise<any> {
        return this.client.fetch('/me/');
    }

    public async updateProfile(data: Record<string, any>): Promise<any> {
        return this.client.fetch('/me/', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    public async disableAccount(): Promise<{ message: string }> {
        return this.client.fetch('/me/disable/', {
            method: 'POST',
        });
    }

    public async deleteAccount(): Promise<{ message: string }> {
        return this.client.fetch('/me/delete/', {
            method: 'DELETE',
        });
    }

    // Role-Based Access Control (RBAC) 
    public async getPermissions(): Promise<any[]> {
        return this.client.fetch('/rbac/permissions/');
    }

    public async getRoles(): Promise<any[]> {
        return this.client.fetch('/rbac/roles/');
    }

    public async assignRole(userId: string, roleId: string): Promise<any> {
        return this.client.fetch(`/rbac/users/${userId}/roles/`, {
            method: 'POST',
            body: JSON.stringify({ role: roleId })
        });
    }

    public async removeRole(userId: string, roleId: string): Promise<{ message: string }> {
        return this.client.fetch(`/rbac/users/${userId}/roles/${roleId}/`, {
            method: 'DELETE'
        });
    }
}
