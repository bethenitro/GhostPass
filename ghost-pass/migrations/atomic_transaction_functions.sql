-- ============================================================================
-- ATOMIC TRANSACTION FUNCTIONS
-- Database-level functions for atomic operations with tax and split logic
-- ============================================================================

-- Function: Process Purchase with Tax and Split
CREATE OR REPLACE FUNCTION process_purchase_atomic(
  p_wallet_binding_id TEXT,
  p_venue_id TEXT,
  p_event_id TEXT,
  p_station_id TEXT,
  p_employee_id TEXT,
  p_item_amount_cents INTEGER,
  p_revenue_profile_id UUID,
  p_tax_profile_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_revenue_profile RECORD;
  v_tax_profile RECORD;
  v_tax_cents INTEGER := 0;
  v_tax_breakdown JSONB := '{}'::jsonb;
  v_platform_fee_cents INTEGER := 25;
  v_split_breakdown JSONB;
  v_total_charge INTEGER;
  v_pre_balance INTEGER;
  v_post_balance INTEGER;
  v_transaction_hash TEXT;
  v_transaction_id UUID;
BEGIN
  -- Get wallet with lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE wallet_binding_id = p_wallet_binding_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found'
    );
  END IF;

  -- Get revenue profile
  IF p_revenue_profile_id IS NOT NULL THEN
    SELECT * INTO v_revenue_profile
    FROM revenue_profiles
    WHERE id = p_revenue_profile_id;
  END IF;

  -- Get tax profile and calculate tax BEFORE split
  IF p_tax_profile_id IS NOT NULL THEN
    SELECT * INTO v_tax_profile
    FROM tax_profiles
    WHERE id = p_tax_profile_id;

    IF FOUND THEN
      v_tax_cents := FLOOR(p_item_amount_cents * (v_tax_profile.state_tax_percentage / 100)) +
                     FLOOR(p_item_amount_cents * (v_tax_profile.local_tax_percentage / 100));
      
      v_tax_breakdown := jsonb_build_object(
        'state_tax_cents', FLOOR(p_item_amount_cents * (v_tax_profile.state_tax_percentage / 100)),
        'local_tax_cents', FLOOR(p_item_amount_cents * (v_tax_profile.local_tax_percentage / 100))
      );
    END IF;
  END IF;

  v_total_charge := p_item_amount_cents + v_tax_cents + v_platform_fee_cents;

  -- Check balance
  IF v_wallet.balance_cents < v_total_charge THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'required_cents', v_total_charge,
      'current_balance_cents', v_wallet.balance_cents
    );
  END IF;

  -- Calculate revenue split
  IF v_revenue_profile IS NOT NULL THEN
    v_split_breakdown := jsonb_build_object(
      'valid_cents', FLOOR(v_platform_fee_cents * (v_revenue_profile.valid_percentage / 100)),
      'vendor_cents', FLOOR(v_platform_fee_cents * (v_revenue_profile.vendor_percentage / 100)),
      'pool_cents', FLOOR(v_platform_fee_cents * (v_revenue_profile.pool_percentage / 100)),
      'promoter_cents', FLOOR(v_platform_fee_cents * (v_revenue_profile.promoter_percentage / 100)),
      'executive_cents', FLOOR(v_platform_fee_cents * (v_revenue_profile.executive_percentage / 100))
    );
  ELSE
    v_split_breakdown := '{}'::jsonb;
  END IF;

  -- Update wallet balance
  v_pre_balance := v_wallet.balance_cents;
  v_post_balance := v_pre_balance - v_total_charge;

  UPDATE wallets
  SET balance_cents = v_post_balance,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Generate transaction hash
  v_transaction_hash := encode(digest(
    p_wallet_binding_id || '-' || p_event_id || '-' || NOW()::text || '-' || random()::text,
    'sha256'
  ), 'hex');

  -- Insert into transaction ledger
  INSERT INTO transaction_ledger (
    transaction_hash,
    venue_id,
    event_id,
    station_id,
    employee_id,
    wallet_binding_id,
    transaction_type,
    item_amount_cents,
    tax_cents,
    tax_breakdown,
    platform_fee_cents,
    revenue_profile_id,
    split_breakdown,
    pre_balance_cents,
    post_balance_cents,
    status
  ) VALUES (
    v_transaction_hash,
    p_venue_id,
    p_event_id,
    p_station_id,
    p_employee_id,
    p_wallet_binding_id,
    'PURCHASE',
    p_item_amount_cents,
    v_tax_cents,
    v_tax_breakdown,
    v_platform_fee_cents,
    p_revenue_profile_id,
    v_split_breakdown,
    v_pre_balance,
    v_post_balance,
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_hash', v_transaction_hash,
    'new_balance_cents', v_post_balance,
    'tax_cents', v_tax_cents,
    'platform_fee_cents', v_platform_fee_cents,
    'split_breakdown', v_split_breakdown
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Process Entry with Verification
CREATE OR REPLACE FUNCTION process_entry_atomic(
  p_wallet_binding_id TEXT,
  p_venue_id TEXT,
  p_event_id TEXT,
  p_station_id TEXT,
  p_employee_id TEXT,
  p_verification_tier INTEGER,
  p_age_verified BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_event RECORD;
  v_entry_count INTEGER;
  v_is_initial_entry BOOLEAN;
  v_entry_number INTEGER;
  v_entry_fee_cents INTEGER := 0;
  v_re_entry_fee_cents INTEGER := 0;
  v_platform_fee_cents INTEGER;
  v_tax_cents INTEGER := 0;
  v_tax_breakdown JSONB := '{}'::jsonb;
  v_split_breakdown JSONB := '{}'::jsonb;
  v_total_charge INTEGER;
  v_pre_balance INTEGER;
  v_post_balance INTEGER;
  v_transaction_hash TEXT;
  v_transaction_id UUID;
  v_entry_id UUID;
BEGIN
  -- Get wallet with lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE wallet_binding_id = p_wallet_binding_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Get event with profiles
  SELECT e.*, rp.*, tp.*
  INTO v_event
  FROM events e
  LEFT JOIN revenue_profiles rp ON e.revenue_profile_id = rp.id
  LEFT JOIN tax_profiles tp ON e.tax_profile_id = tp.id
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Check previous entries
  SELECT COUNT(*) INTO v_entry_count
  FROM entry_tracking
  WHERE wallet_binding_id = p_wallet_binding_id
    AND event_id = p_event_id;

  v_is_initial_entry := (v_entry_count = 0);
  v_entry_number := v_entry_count + 1;

  -- Calculate fees
  IF v_is_initial_entry THEN
    v_entry_fee_cents := v_event.entry_fee_cents;
  ELSE
    v_re_entry_fee_cents := v_event.re_entry_fee_cents;
  END IF;

  v_platform_fee_cents := v_event.platform_fee_cents;
  v_total_charge := v_entry_fee_cents + v_re_entry_fee_cents + v_platform_fee_cents;

  -- Calculate tax
  IF v_event.state_tax_percentage IS NOT NULL THEN
    v_tax_cents := FLOOR(v_total_charge * (v_event.state_tax_percentage / 100)) +
                   FLOOR(v_total_charge * (v_event.local_tax_percentage / 100));
    v_tax_breakdown := jsonb_build_object(
      'state_tax_cents', FLOOR(v_total_charge * (v_event.state_tax_percentage / 100)),
      'local_tax_cents', FLOOR(v_total_charge * (v_event.local_tax_percentage / 100))
    );
  END IF;

  v_total_charge := v_total_charge + v_tax_cents;

  -- Check balance
  IF v_wallet.balance_cents < v_total_charge THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'required_cents', v_total_charge
    );
  END IF;

  -- Calculate split
  IF v_event.valid_percentage IS NOT NULL THEN
    v_split_breakdown := jsonb_build_object(
      'valid_cents', FLOOR(v_platform_fee_cents * (v_event.valid_percentage / 100)),
      'vendor_cents', FLOOR(v_platform_fee_cents * (v_event.vendor_percentage / 100)),
      'pool_cents', FLOOR(v_platform_fee_cents * (v_event.pool_percentage / 100)),
      'promoter_cents', FLOOR(v_platform_fee_cents * (v_event.promoter_percentage / 100)),
      'executive_cents', FLOOR(v_platform_fee_cents * (v_event.executive_percentage / 100))
    );
  END IF;

  -- Update wallet
  v_pre_balance := v_wallet.balance_cents;
  v_post_balance := v_pre_balance - v_total_charge;

  UPDATE wallets
  SET balance_cents = v_post_balance,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Generate hash
  v_transaction_hash := encode(digest(
    p_wallet_binding_id || '-' || p_event_id || '-' || NOW()::text || '-' || random()::text,
    'sha256'
  ), 'hex');

  -- Insert transaction
  INSERT INTO transaction_ledger (
    transaction_hash, venue_id, event_id, station_id, employee_id, wallet_binding_id,
    transaction_type, item_amount_cents, tax_cents, tax_breakdown, platform_fee_cents,
    revenue_profile_id, split_breakdown, pre_balance_cents, post_balance_cents, status
  ) VALUES (
    v_transaction_hash, p_venue_id, p_event_id, p_station_id, p_employee_id, p_wallet_binding_id,
    CASE WHEN v_is_initial_entry THEN 'ENTRY' ELSE 'RE_ENTRY' END,
    v_entry_fee_cents + v_re_entry_fee_cents, v_tax_cents, v_tax_breakdown, v_platform_fee_cents,
    v_event.revenue_profile_id, v_split_breakdown, v_pre_balance, v_post_balance, 'completed'
  )
  RETURNING id INTO v_transaction_id;

  -- Insert entry tracking
  INSERT INTO entry_tracking (
    wallet_binding_id, venue_id, event_id, station_id, employee_id, entry_number,
    entry_type, entry_fee_cents, re_entry_fee_cents, platform_fee_cents,
    verification_tier, age_verified, transaction_id
  ) VALUES (
    p_wallet_binding_id, p_venue_id, p_event_id, p_station_id, p_employee_id, v_entry_number,
    CASE WHEN v_is_initial_entry THEN 'INITIAL' ELSE 'RE_ENTRY' END,
    v_entry_fee_cents, v_re_entry_fee_cents, v_platform_fee_cents,
    p_verification_tier, p_age_verified, v_transaction_id
  )
  RETURNING id INTO v_entry_id;

  -- Log ID verification
  IF p_verification_tier IS NOT NULL THEN
    INSERT INTO id_verification_logs (
      entry_id, station_id, employee_id, verification_tier, age_flag_verified
    ) VALUES (
      v_entry_id, p_station_id, COALESCE(p_employee_id, 'SYSTEM'), p_verification_tier, p_age_verified
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entry_type', CASE WHEN v_is_initial_entry THEN 'INITIAL' ELSE 'RE_ENTRY' END,
    'entry_number', v_entry_number,
    'transaction_id', v_transaction_id,
    'new_balance_cents', v_post_balance
  );
END;
$$ LANGUAGE plpgsql;
