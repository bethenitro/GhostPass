create table brightness_logs (
  id uuid default uuid_generate_v4() primary key,
  wallet_binding_id text not null,
  brightness_level integer not null,
  timestamp timestamp default now(),
  trigger text not null,
  metadata jsonb
);

create table fee_configs (
  id uuid default uuid_generate_v4() primary key,
  venue_id text not null,
  valid_pct numeric,
  vendor_pct numeric,
  pool_pct numeric,
  promoter_pct numeric
);

create table ghost_pass_interactions (
  id uuid default uuid_generate_v4() primary key,
  interaction_id uuid default uuid_generate_v4(),
  wallet_binding_id text not null,
  ghost_pass_token text not null,
  interaction_method text not null,
  gateway_id text not null,
  item_amount_cents integer not null,
  platform_fee_cents integer not null,
  vendor_payout_cents integer not null,
  total_charged_cents integer not null,
  context text not null,
  device_fingerprint text not null,
  proofs_verified integer,
  status text not null,
  created_at timestamp default now(),
  metadata jsonb
);

create table ghost_pass_revocations (
  id uuid default uuid_generate_v4() primary key,
  revocation_id uuid default uuid_generate_v4(),
  ghost_pass_token text not null,
  revocation_type text not null,
  reason text not null,
  revoked_by uuid default uuid_generate_v4(),
  revoked_at timestamp default now(),
  metadata jsonb
);

create table sensory_signals (
  signal_id text not null primary key,
  payload_type text not null,
  source_id text not null,
  timestamp timestamp default now() not null,
  received_at timestamp default now() not null,
  sensory_type text,
  signal_data jsonb,
  metadata jsonb,
  capsule_id text,
  scu_count integer,
  sensory_types text[],
  scus jsonb,
  status text not null,
  ghost_pass_approved boolean not null,
  validation_result jsonb,
  created_at timestamp default now() not null
);

create table users (
  id uuid default uuid_generate_v4() primary key,
  email text,
  created_at timestamp default now(),
  role public.user_role not null
);

create table cryptographic_proofs (
  id uuid default uuid_generate_v4() primary key,
  proof_id uuid default uuid_generate_v4(),
  wallet_binding_id text not null,
  proof_type text not null,
  proof_value jsonb not null,
  signature text not null,
  device_fingerprint text not null,
  created_at timestamp default now(),
  expires_at timestamp default now(),
  verified boolean
);

create table wallet_persistence (
  id uuid default uuid_generate_v4() primary key,
  wallet_binding_id text not null,
  venue_id text not null,
  force_pwa_install boolean not null,
  session_duration_hours integer not null,
  auto_brightness_control boolean not null,
  brightness_override_level integer not null,
  created_at timestamp default now(),
  expires_at timestamp default now() not null,
  status text not null,
  updated_at timestamp default now()
);

create table wallets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users (id),
  balance_cents bigint,
  updated_at timestamp default now(),
  is_refund_eligible boolean,
  device_fingerprint text,
  biometric_hash text,
  wallet_binding_id text,
  ghost_pass_token text,
  device_bound boolean,
  last_entry_at timestamp default now(),
  entry_count integer,
  wallet_surfaced boolean,
  pwa_installed boolean
);

create table entry_configurations (
  id uuid default uuid_generate_v4() primary key,
  venue_id text not null,
  initial_entry_fee_cents integer not null,
  re_entry_allowed boolean not null,
  venue_re_entry_fee_cents integer not null,
  valid_re_entry_fee_cents integer not null,
  pass_purchase_required boolean not null,
  max_entries_per_day integer,
  updated_at timestamp default now(),
  updated_by uuid references users (id),
  created_at timestamp default now()
);

create table transactions (
  id uuid default uuid_generate_v4() primary key,
  wallet_id uuid references wallets (id),
  type text,
  amount_cents bigint not null,
  gateway_id text,
  venue_id text,
  metadata jsonb,
  timestamp timestamp default now(),
  balance_before_cents integer,
  balance_after_cents integer,
  vendor_name text,
  gateway_name text,
  gateway_type public.gateway_type,
  refund_status public.refund_status,
  refund_reference_id text,
  provider_tx_id text,
  refund_requested_at timestamp default now(),
  refund_completed_at timestamp default now(),
  interaction_method public.interaction_method,
  platform_fee_cents integer,
  vendor_payout_cents integer,
  context text,
  device_fingerprint text,
  vendor_id text,
  entry_number integer,
  entry_type text,
  venue_reentry_fee_cents integer,
  valid_reentry_scan_fee_cents integer
);

create table sensory_audit_trail (
  audit_id serial not null primary key,
  event_type text not null,
  signal_id text,
  evaluation_id text,
  decision_id text,
  actor text,
  action text not null,
  details jsonb,
  timestamp timestamp default now() not null
);

create table payout_requests (
  id uuid default uuid_generate_v4() primary key,
  vendor_id text not null,
  amount_cents integer not null,
  transaction_id uuid default uuid_generate_v4(),
  status text not null,
  payout_method text,
  created_at timestamp default now(),
  processed_at timestamp default now(),
  processed_by uuid,
  metadata jsonb
);

create table entry_point_audit_logs (
  id uuid default uuid_generate_v4() primary key,
  action_type text not null,
  entry_point_id uuid default uuid_generate_v4(),
  entry_point_type text not null,
  entry_point_name text not null,
  employee_name text not null,
  employee_id text not null,
  admin_user_id uuid references users (id),
  admin_email text,
  scanner_token text,
  source_location text not null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamp default now()
);

create table sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users (id),
  session_type text not null,
  status text not null,
  created_at timestamp default now(),
  vaporizes_at timestamp default now() not null,
  venue_id text,
  qr_code text
);

create table gateway_points (
  id uuid default uuid_generate_v4() primary key,
  venue_id text not null,
  name text not null,
  status public.gateway_status not null,
  type public.gateway_type not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  created_by uuid references users (id),
  number integer,
  accepts_ghostpass boolean,
  linked_area_id uuid references gateway_points (id),
  employee_name text not null,
  employee_id text not null,
  visual_identifier text
);

create table venue_entry_configs (
  id uuid default uuid_generate_v4() primary key,
  venue_id text not null,
  event_id text,
  re_entry_allowed boolean not null,
  initial_entry_fee_cents integer not null,
  venue_reentry_fee_cents integer not null,
  valid_reentry_scan_fee_cents integer not null,
  max_reentries integer,
  reentry_time_limit_hours integer,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  created_by uuid references users (id)
);

create table system_configs (
  id uuid default uuid_generate_v4() primary key,
  config_key text not null,
  config_value jsonb not null,
  updated_by uuid references users (id),
  updated_at timestamp default now()
);

create table entry_events (
  id text not null primary key,
  wallet_id uuid references wallets (id),
  wallet_binding_id text not null,
  event_id text,
  venue_id text not null,
  entry_number integer not null,
  entry_type text not null,
  timestamp timestamp default now(),
  gateway_id uuid references gateway_points (id),
  gateway_name text,
  initial_entry_fee_cents integer not null,
  venue_reentry_fee_cents integer not null,
  valid_reentry_scan_fee_cents integer not null,
  total_fees_cents integer not null,
  device_fingerprint text,
  interaction_method text not null,
  metadata jsonb
);

create table entry_logs (
  id uuid default uuid_generate_v4() primary key,
  wallet_id uuid references wallets (id),
  venue_id text not null,
  gateway_id text,
  entry_number integer not null,
  entry_type text not null,
  interaction_method text not null,
  fees_charged jsonb not null,
  total_fee_cents integer not null,
  wallet_balance_before integer not null,
  wallet_balance_after integer not null,
  device_fingerprint text,
  ghost_pass_token text,
  brightness_level integer,
  timestamp timestamp default now(),
  status text not null,
  metadata jsonb
);

create table wallet_sessions (
  id text not null primary key,
  wallet_binding_id text not null,
  device_fingerprint text not null,
  created_at timestamp default now(),
  last_accessed timestamp default now(),
  expires_at timestamp default now() not null,
  event_id text,
  venue_id text,
  is_active boolean not null,
  force_surface boolean not null,
  session_data jsonb
);

create table senate_evaluations (
  evaluation_id text not null primary key,
  signal_id text references sensory_signals (signal_id),
  status text not null,
  priority text not null,
  signal_data jsonb not null,
  context jsonb not null,
  received_at timestamp default now() not null,
  completed_at timestamp default now(),
  created_at timestamp default now() not null
);

create table gateway_metrics (
  id uuid default uuid_generate_v4() primary key,
  gateway_point_id uuid references gateway_points (id),
  metric_type text not null,
  metric_value numeric,
  amount_cents integer,
  timestamp timestamp default now(),
  metadata jsonb
);

create table senate_decisions (
  decision_id text not null primary key,
  evaluation_id text references senate_evaluations (evaluation_id),
  signal_id text references sensory_signals (signal_id),
  decision text not null,
  reason text not null,
  reviewer_id text not null,
  trust_score numeric,
  signal_data jsonb,
  context jsonb,
  timestamp timestamp default now() not null,
  created_at timestamp default now() not null
);

create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  admin_user_id uuid references users (id),
  action text not null,
  resource_type text not null,
  resource_id text,
  old_value jsonb,
  new_value jsonb,
  timestamp timestamp default now(),
  metadata jsonb
);

create table ghost_passes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users (id),
  status text,
  expires_at timestamp default now() not null,
  created_at timestamp default now()
);