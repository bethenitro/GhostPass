import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabase } from '../_lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (user.role !== 'ADMIN' && user.role !== 'VENUE_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      asset_type,
      venue_id,
      event_id,
      station_id,
      revenue_profile_id,
      tax_profile_id,
      fee_logic,
      re_entry_rules,
      id_verification_level
    } = req.body;

    if (!asset_type || !venue_id) {
      return res.status(400).json({ error: 'asset_type and venue_id are required' });
    }

    const asset_code = `${asset_type}_${uuidv4()}`;

    const { data, error } = await supabase
      .from('qr_nfc_assets')
      .insert({
        asset_code,
        asset_type,
        venue_id,
        event_id,
        station_id,
        revenue_profile_id,
        tax_profile_id,
        fee_logic: fee_logic || {},
        re_entry_rules: re_entry_rules || {},
        id_verification_level: id_verification_level || 1
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Provision QR/NFC asset error:', error);
    res.status(500).json({ error: 'Failed to provision asset', detail: error.message });
  }
};
