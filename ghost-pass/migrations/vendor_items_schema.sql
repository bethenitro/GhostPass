-- Vendor Items Table
-- Stores items available for sale at venues/events

CREATE TABLE IF NOT EXISTS vendor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  event_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category TEXT NOT NULL CHECK (category IN ('FOOD', 'BEVERAGE', 'MERCHANDISE', 'SERVICE', 'OTHER')),
  available BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_items_venue ON vendor_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_vendor_items_event ON vendor_items(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_items_category ON vendor_items(category);
CREATE INDEX IF NOT EXISTS idx_vendor_items_available ON vendor_items(available);

-- RLS Policies
ALTER TABLE vendor_items ENABLE ROW LEVEL SECURITY;

-- Allow venue admins to manage their venue's items
CREATE POLICY "Venue admins can manage their venue items"
  ON vendor_items
  FOR ALL
  USING (
    venue_id IN (
      SELECT venue_id FROM users WHERE id = auth.uid() AND role IN ('VENUE_ADMIN', 'ADMIN')
    )
  );

-- Allow authenticated users to view available items
CREATE POLICY "Users can view available items"
  ON vendor_items
  FOR SELECT
  USING (available = true);

-- Comments
COMMENT ON TABLE vendor_items IS 'Items available for sale at venues and events';
COMMENT ON COLUMN vendor_items.venue_id IS 'Venue where item is available';
COMMENT ON COLUMN vendor_items.event_id IS 'Optional event-specific item';
COMMENT ON COLUMN vendor_items.price_cents IS 'Price in cents';
COMMENT ON COLUMN vendor_items.category IS 'Item category for organization';
COMMENT ON COLUMN vendor_items.available IS 'Whether item is currently available for sale';
