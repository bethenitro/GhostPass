-- Event Tickets Schema
-- Single-event ticket purchase system (simpler than Ghost Pass duration logic)

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, completed
    service_fee_percent DECIMAL(5,2) DEFAULT 5.00, -- VALID service fee (adjustable)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket types for events
CREATE TABLE IF NOT EXISTS ticket_types (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    max_quantity INTEGER NOT NULL,
    sold_count INTEGER DEFAULT 0,
    allows_reentry BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event tickets (purchased by users)
CREATE TABLE IF NOT EXISTS event_tickets (
    id TEXT PRIMARY KEY,
    ticket_code TEXT UNIQUE NOT NULL, -- QR code / barcode
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    wallet_binding_id TEXT NOT NULL,
    device_fingerprint TEXT,
    
    -- Pricing
    ticket_price_cents INTEGER NOT NULL,
    service_fee_cents INTEGER NOT NULL,
    total_paid_cents INTEGER NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- active, used, cancelled, refunded
    
    -- Entry tracking
    entry_granted BOOLEAN DEFAULT false,
    entry_count INTEGER DEFAULT 0,
    last_entry_at TIMESTAMPTZ,
    last_entry_gateway_id TEXT,
    
    -- Validity
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket entry log
CREATE TABLE IF NOT EXISTS ticket_entries (
    id SERIAL PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
    gateway_id TEXT NOT NULL,
    venue_id TEXT,
    entry_number INTEGER NOT NULL,
    entry_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);

CREATE INDEX IF NOT EXISTS idx_event_tickets_wallet ON event_tickets(wallet_binding_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_code ON event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_event_tickets_status ON event_tickets(status);
CREATE INDEX IF NOT EXISTS idx_event_tickets_validity ON event_tickets(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_ticket_entries_ticket ON ticket_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_gateway ON ticket_entries(gateway_id);

-- Sample data for testing
INSERT INTO events (id, name, description, venue_id, venue_name, start_date, end_date, service_fee_percent, status)
VALUES 
    ('event_001', 'Summer Music Festival', 'Annual summer music festival with multiple stages', 'venue_001', 'Central Park', NOW() + INTERVAL '7 days', NOW() + INTERVAL '10 days', 5.00, 'active'),
    ('event_002', 'Tech Conference 2024', 'Annual technology conference', 'venue_002', 'Convention Center', NOW() + INTERVAL '30 days', NOW() + INTERVAL '32 days', 7.50, 'active'),
    ('event_003', 'Comedy Night', 'Stand-up comedy show', 'venue_003', 'Comedy Club', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days', 10.00, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_types (id, event_id, name, description, price_cents, max_quantity, allows_reentry)
VALUES 
    -- Summer Music Festival
    ('ticket_type_001', 'event_001', 'General Admission', 'Access to all stages', 7500, 1000, true),
    ('ticket_type_002', 'event_001', 'VIP Pass', 'VIP area access + backstage', 15000, 100, true),
    ('ticket_type_003', 'event_001', 'Single Day', 'One day access', 3500, 500, false),
    
    -- Tech Conference
    ('ticket_type_004', 'event_002', 'Full Conference', 'All 3 days access', 50000, 500, true),
    ('ticket_type_005', 'event_002', 'Single Day', 'One day access', 20000, 200, false),
    ('ticket_type_006', 'event_002', 'Student Pass', 'Discounted student rate', 25000, 100, true),
    
    -- Comedy Night
    ('ticket_type_007', 'event_003', 'Standard Seat', 'General seating', 2500, 200, false),
    ('ticket_type_008', 'event_003', 'Premium Seat', 'Front row seating', 5000, 50, false)
ON CONFLICT (id) DO NOTHING;

-- Comments
COMMENT ON TABLE events IS 'Events that can have tickets purchased';
COMMENT ON TABLE ticket_types IS 'Different ticket types/tiers for events';
COMMENT ON TABLE event_tickets IS 'Individual tickets purchased by users';
COMMENT ON TABLE ticket_entries IS 'Log of ticket scans/entries';

COMMENT ON COLUMN events.service_fee_percent IS 'VALID service fee percentage (adjustable per event)';
COMMENT ON COLUMN event_tickets.ticket_code IS 'Unique code for QR/barcode scanning';
COMMENT ON COLUMN event_tickets.entry_granted IS 'Whether ticket has been used for entry';
COMMENT ON COLUMN event_tickets.entry_count IS 'Number of times ticket was scanned';
COMMENT ON COLUMN ticket_types.allows_reentry IS 'Whether ticket allows multiple entries';
