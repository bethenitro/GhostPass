import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { adminSupabase } from '../_lib/supabase.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    if (handleCors(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const { action, resource_type, resource_id, metadata, old_value, new_value } = req.body;

        if (!action || !resource_type) {
            return res.status(400).json({ error: 'Action and resource_type are required' });
        }

        // Insert into the general audit_logs table using admin client to bypass RLS if needed
        // (Audit logs should generally be writable by the system/admin)
        const { data: log, error } = await adminSupabase
            .from('audit_logs')
            .insert({
                admin_user_id: user.id,
                action: action.toUpperCase(),
                resource_type,
                resource_id: resource_id || null,
                old_value: old_value || null,
                new_value: new_value || null,
                metadata: metadata || {},
                timestamp: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to save audit log:', error);
            throw error;
        }

        res.status(201).json({
            status: 'success',
            id: log.id,
            message: 'Audit log recorded'
        });
    } catch (error: any) {
        console.error('Audit log error:', error);
        res.status(500).json({
            error: 'Failed to record audit log',
            detail: error.message
        });
    }
};
