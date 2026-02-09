import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { supabase } from '../_lib/supabase.js';

const DEFAULT_PRICES: Record<number, number> = {
  1: 1000,
  3: 2000,
  5: 3500,
  7: 5000,
  10: 6500,
  14: 8500,
  30: 10000
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let pricing = DEFAULT_PRICES;

    try {
      const { data: config } = await supabase
        .from('system_configs')
        .select('config_value')
        .eq('config_key', 'ghostpass_pricing')
        .single();

      if (config?.config_value) {
        pricing = Object.fromEntries(
          Object.entries(config.config_value).map(([k, v]) => [parseInt(k), parseInt(v as string)])
        );
      }
    } catch (error) {
      console.warn('Failed to fetch pricing config, using defaults');
    }

    res.status(200).json({
      pricing,
      currency: 'USD'
    });
  } catch (error) {
    console.error('Pricing fetch error:', error);
    res.status(500).json({ detail: 'Failed to fetch pricing' });
  }
};
