/**
 * DELETE /api/admin/users/[user_id]
 *
 * Removes a staff member from the users and staff_profiles tables.
 * Also deletes them from Supabase Auth (requires service role key).
 * Only accessible by ADMIN or VENUE_ADMIN roles.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../../_lib/cors.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { adminSupabase } from '../../../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    if (handleCors(req, res)) return;

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    if (adminUser.role !== 'ADMIN' && adminUser.role !== 'VENUE_ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const { user_id } = req.query;

        if (!user_id || typeof user_id !== 'string') {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // For VENUE_ADMIN, verify the user belongs to their venue
        if (adminUser.role === 'VENUE_ADMIN') {
            const { data: adminData } = await adminSupabase
                .from('users')
                .select('venue_id')
                .eq('id', adminUser.id)
                .single();

            const { data: targetUser } = await adminSupabase
                .from('users')
                .select('venue_id')
                .eq('id', user_id)
                .single();

            if (!targetUser || targetUser.venue_id !== adminData?.venue_id) {
                return res.status(403).json({ error: 'Cannot remove staff from a different venue' });
            }
        }

        // 1. Clean up associated wallets
        await adminSupabase.from('wallets').delete().eq('user_id', user_id);

        // 2. Null out audit logs where this user was the admin
        await adminSupabase.from('audit_logs').update({ admin_user_id: null }).eq('admin_user_id', user_id);

        // 2.5 Null out created_by in venue_entry_configs
        await adminSupabase.from('venue_entry_configs').update({ created_by: null }).eq('created_by', user_id);

        // 3. Delete from staff_profiles first (FK constraint)
        const { error: profileError } = await adminSupabase
            .from('staff_profiles')
            .delete()
            .eq('id', user_id);

        if (profileError) {
            console.error('Profile delete error:', profileError);
            throw new Error(`Profile delete failed: ${profileError.message}`);
        }

        // 4. Delete from users table
        const { error: userTableError } = await adminSupabase
            .from('users')
            .delete()
            .eq('id', user_id);

        if (userTableError) {
            console.error('User table delete error:', userTableError);
            throw new Error(`User table delete failed: ${userTableError.message}`);
        }

        // 5. Delete from Supabase Auth
        const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(user_id);
        if (authDeleteError) {
            console.warn('Could not delete auth user (may not exist):', authDeleteError.message);
        }

        // 6. Final audit log
        await adminSupabase.from('audit_logs').insert({
            action: 'DELETE_STAFF',
            resource_type: 'user',
            resource_id: user_id,
            metadata: { deleted_by: adminUser.id }
        });

        return res.status(200).json({ message: 'Staff member removed successfully' });
    } catch (error: any) {
        console.error('Delete staff error:', error);
        return res.status(500).json({ error: error.message || 'Failed to delete staff member' });
    }
};
