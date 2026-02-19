-- ============================================================================
-- ADD ALCOHOL AND FOOD TAX COLUMNS TO TAX PROFILES
-- Ensures tax_profiles table has separate alcohol_tax_percentage and food_tax_percentage
-- ============================================================================

-- Add columns if they don't exist (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tax_profiles' AND column_name = 'alcohol_tax_percentage'
  ) THEN
    ALTER TABLE tax_profiles ADD COLUMN alcohol_tax_percentage DECIMAL(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tax_profiles' AND column_name = 'food_tax_percentage'
  ) THEN
    ALTER TABLE tax_profiles ADD COLUMN food_tax_percentage DECIMAL(5,2) DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN tax_profiles.alcohol_tax_percentage IS 'Additional tax percentage applied to alcohol items';
COMMENT ON COLUMN tax_profiles.food_tax_percentage IS 'Additional tax percentage applied to food items';
