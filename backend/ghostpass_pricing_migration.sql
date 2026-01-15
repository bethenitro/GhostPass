-- Migration: Initialize GhostPass Pricing Configuration
-- This sets up the default pricing for all 7 duration tiers

-- Insert or update the ghostpass_pricing configuration
INSERT INTO system_configs (config_key, config_value, updated_by)
VALUES (
    'ghostpass_pricing',
    '{
        "1": 1000,
        "3": 2000,
        "5": 3500,
        "7": 5000,
        "10": 6500,
        "14": 8500,
        "30": 10000
    }'::jsonb,
    NULL
)
ON CONFLICT (config_key) 
DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW()
WHERE system_configs.config_key = 'ghostpass_pricing'
  AND system_configs.config_value IS NULL; -- Only update if not already set

-- Verify the configuration
SELECT 
    config_key,
    config_value,
    updated_at
FROM system_configs
WHERE config_key = 'ghostpass_pricing';
