--
-- PostgreSQL database dump
--

\restrict 7BUJdBnm25GwnbZYKT7z9utoZXLBhfKvuFdgO8Xnr5dTBQ6msGYgXKAuE8cyfB8

-- Dumped from database version 18.6 (fd34222)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone,
    alg text,
    crv text
);


--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb,
    auth_logs_export_enabled boolean DEFAULT false
);


--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_code text,
    alert_date date DEFAULT CURRENT_DATE NOT NULL,
    alert_type text NOT NULL,
    severity text NOT NULL,
    customer_id uuid,
    executive_id uuid,
    invoice_id uuid,
    alert_message text NOT NULL,
    recommended_action text,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_to uuid,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    attendance_date date NOT NULL,
    status text NOT NULL,
    note text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'half_day'::text, 'leave'::text, 'week_off'::text, 'holiday'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    actor_name text NOT NULL,
    actor_role text,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    entity_label text,
    summary text NOT NULL,
    metadata jsonb
);


--
-- Name: beat_customer_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beat_customer_days (
    customer_id uuid NOT NULL,
    executive_id uuid NOT NULL,
    weekday smallint NOT NULL,
    sequence_no integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beat_customer_days_weekday_check CHECK (((weekday >= 1) AND (weekday <= 6)))
);


--
-- Name: beat_plan_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beat_plan_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beat_plan_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    planned_time time without time zone,
    stop_status text DEFAULT 'pending'::text NOT NULL,
    visit_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: beat_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beat_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_date date NOT NULL,
    executive_id uuid NOT NULL,
    manager_id uuid,
    plan_status text DEFAULT 'planned'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    seats integer NOT NULL,
    amount_paisa integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    razorpay_order_id text,
    razorpay_payment_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT billing_charges_amount_paisa_check CHECK ((amount_paisa >= 0)),
    CONSTRAINT billing_charges_seats_check CHECK ((seats >= 0)),
    CONSTRAINT billing_charges_status_check CHECK ((status = ANY (ARRAY['free'::text, 'pending'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: billing_payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_payment_events (
    event_id text NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brands_category_check CHECK ((category = 'oils'::text))
);


--
-- Name: collection_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    invoice_id uuid,
    allocated_amount numeric(14,2) NOT NULL,
    allocated_by uuid,
    allocated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_balance_id uuid,
    CONSTRAINT collection_allocations_one_target CHECK ((((invoice_id IS NOT NULL) AND (opening_balance_id IS NULL)) OR ((invoice_id IS NULL) AND (opening_balance_id IS NOT NULL))))
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_code text NOT NULL,
    collection_date date NOT NULL,
    customer_id uuid NOT NULL,
    collected_by_user_id uuid NOT NULL,
    payment_mode text NOT NULL,
    payment_reference_number text,
    collection_amount numeric(14,2) NOT NULL,
    cheque_date date,
    cheque_status text,
    bank_name text,
    matched_status text DEFAULT 'unmatched'::text NOT NULL,
    accountant_approval_status text DEFAULT 'pending'::text NOT NULL,
    approved_by_accountant_id uuid,
    approved_at timestamp with time zone,
    incentive_eligible boolean DEFAULT false NOT NULL,
    remarks text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_uuid uuid,
    collection_type text DEFAULT 'general'::text NOT NULL,
    CONSTRAINT collections_collection_type_check CHECK ((collection_type = ANY (ARRAY['general'::text, 'advance'::text])))
);


--
-- Name: customer_dues_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_dues_state (
    customer_id uuid NOT NULL,
    bucket smallint NOT NULL,
    oldest_invoice_date date NOT NULL,
    outstanding numeric(14,2) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_dues_state_bucket_check CHECK (((bucket >= 0) AND (bucket <= 3)))
);


--
-- Name: customer_followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    created_by uuid NOT NULL,
    visit_id uuid NOT NULL,
    reason text NOT NULL,
    follow_up_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    resolution text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_followups_resolution_check CHECK ((resolution = ANY (ARRAY['manual'::text, 'superseded'::text]))),
    CONSTRAINT customer_followups_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text])))
);


--
-- Name: customer_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    body text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    edited_by uuid
);


--
-- Name: customer_opening_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_opening_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    as_of_date date NOT NULL,
    opening_amount numeric(14,2) NOT NULL,
    amount_collected numeric(14,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(14,2) NOT NULL,
    remarks text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_opening_balances_amount_collected_check CHECK ((amount_collected >= (0)::numeric)),
    CONSTRAINT customer_opening_balances_opening_amount_check CHECK ((opening_amount >= (0)::numeric)),
    CONSTRAINT customer_opening_balances_outstanding_amount_check CHECK ((outstanding_amount >= (0)::numeric))
);


--
-- Name: customer_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    uploaded_by uuid,
    file_key text NOT NULL,
    content_type text DEFAULT 'image/jpeg'::text NOT NULL,
    size_bytes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'market_intelligence'::text NOT NULL,
    latitude numeric,
    longitude numeric,
    geocoded_address text
);


--
-- Name: customer_reassignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_reassignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    from_user_id uuid,
    to_user_id uuid,
    assigned_by uuid,
    moved jsonb DEFAULT '{}'::jsonb NOT NULL,
    moved_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    undone_at timestamp with time zone,
    undone_by uuid
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_code text NOT NULL,
    legal_name text NOT NULL,
    trade_name text,
    customer_type text NOT NULL,
    segment text,
    gst_number text,
    pan_number text,
    email text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    onboarding_date date,
    association_type text,
    customer_grade text,
    monthly_litre_potential numeric(12,2),
    credit_limit numeric(14,2) DEFAULT 0 NOT NULL,
    credit_days integer DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'good'::text NOT NULL,
    competitor_risk_level text,
    customer_score numeric(5,2),
    kyc_status text DEFAULT 'pending'::text NOT NULL,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_name text,
    phone text,
    alternative_phone text,
    aadhar_number text,
    address_street text,
    address_city text,
    address_state text,
    address_pincode text,
    address_landmark text,
    default_discount_pct numeric DEFAULT 0 NOT NULL,
    statement_token uuid,
    client_uuid uuid
);


--
-- Name: delivery_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    stop_id uuid,
    kind text NOT NULL,
    file_key text NOT NULL,
    content_type text,
    size_bytes integer,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude numeric,
    longitude numeric,
    geocoded_address text
);


--
-- Name: delivery_run_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_run_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    client_uuid uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid
);


--
-- Name: delivery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logistics_user_id uuid NOT NULL,
    run_date date DEFAULT CURRENT_DATE NOT NULL,
    vehicle_number text NOT NULL,
    start_odometer numeric(12,1),
    end_odometer numeric(12,1),
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    client_uuid uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: error_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    source text NOT NULL,
    message text NOT NULL,
    stack text,
    route text,
    method text,
    status_code integer,
    request_id text,
    user_id uuid,
    role text,
    environment text DEFAULT 'production'::text NOT NULL,
    app_version text,
    context jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: error_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fingerprint text NOT NULL,
    source text NOT NULL,
    title text NOT NULL,
    kind text,
    level text DEFAULT 'error'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    occurrence_count integer DEFAULT 0 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    sample_stack text,
    sample_route text,
    assigned_to uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: error_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: executive_latest_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_latest_locations (
    user_id uuid NOT NULL,
    tracking_session_id uuid,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy numeric(10,2),
    recorded_at timestamp with time zone,
    received_at timestamp with time zone,
    battery_percentage integer,
    last_heartbeat_at timestamp with time zone,
    is_location_enabled boolean,
    foreground_permission text,
    background_permission text,
    notification_permission text,
    battery_optimization_status text,
    network_type text,
    is_connected boolean,
    queued_point_count integer DEFAULT 0 NOT NULL,
    last_successful_sync_at timestamp with time zone,
    tracking_status text,
    device_health_status text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_signed_out_at timestamp with time zone,
    CONSTRAINT executive_latest_locations_battery_percentage_check CHECK (((battery_percentage IS NULL) OR ((battery_percentage >= 0) AND (battery_percentage <= 100)))),
    CONSTRAINT executive_latest_locations_queued_point_count_check CHECK ((queued_point_count >= 0))
);


--
-- Name: expenditure_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenditure_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenditure_categories_type_check CHECK ((type = ANY (ARRAY['compulsory'::text, 'variable'::text])))
);


--
-- Name: expenditures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenditures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expenditure_code text NOT NULL,
    expenditure_date date NOT NULL,
    category_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_mode text,
    paid_to text,
    user_id uuid,
    remarks text,
    bill_file_key text,
    bill_content_type text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_uuid uuid,
    CONSTRAINT expenditures_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grn_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    rate numeric(14,4),
    amount numeric(14,2),
    batch_number text,
    expiry_date date,
    rack_no text,
    shelf_no text,
    bin_no text
);


--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grn_number text NOT NULL,
    location_id uuid NOT NULL,
    supplier_name text NOT NULL,
    supplier_invoice_no text,
    supplier_invoice_date date,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    reference text,
    total_value numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'posted'::text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goods_receipts_status_check CHECK ((status = ANY (ARRAY['posted'::text, 'cancelled'::text])))
);


--
-- Name: gps_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gps_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    user_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    accuracy_meters numeric(10,2),
    battery_percentage integer,
    recorded_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location_point_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    quality_status text DEFAULT 'raw'::text NOT NULL,
    quality_reason text,
    is_accepted_for_distance boolean DEFAULT false NOT NULL
);


--
-- Name: gps_tracking_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gps_tracking_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_date date NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    gps_enabled boolean,
    battery_start_percentage integer,
    battery_end_percentage integer,
    total_distance_km numeric(10,2),
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_session_id uuid,
    device_id text,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    ended_reason text,
    distance_algorithm_version text,
    accepted_distance_point_count integer DEFAULT 0 NOT NULL,
    rejected_distance_point_count integer DEFAULT 0 NOT NULL,
    start_odometer integer,
    end_odometer integer
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid,
    description text,
    pack_size_litres numeric(12,4),
    brand text,
    segment text,
    hsn_code text DEFAULT '27101980'::text NOT NULL,
    qty_units numeric(14,2) NOT NULL,
    rate numeric(14,4) NOT NULL,
    taxable_amount numeric(14,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 18 NOT NULL,
    cgst numeric(14,2) DEFAULT 0 NOT NULL,
    sgst numeric(14,2) DEFAULT 0 NOT NULL,
    igst numeric(14,2) DEFAULT 0 NOT NULL,
    line_total numeric(14,2) NOT NULL,
    order_item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mrp numeric(12,2),
    discount_pct numeric(5,2) DEFAULT 0 NOT NULL,
    cogs_amount numeric(14,2)
);


--
-- Name: invoice_line_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    quantity_units numeric NOT NULL,
    litres numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prefix text DEFAULT 'SA/'::text NOT NULL,
    fin_year text NOT NULL,
    next_seq integer DEFAULT 1 NOT NULL,
    pad_width integer DEFAULT 5 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    customer_id uuid NOT NULL,
    sales_executive_id uuid,
    gst_number text,
    billing_address text,
    invoice_gross_value numeric(14,2) DEFAULT 0 NOT NULL,
    total_discount numeric(14,2) DEFAULT 0 NOT NULL,
    taxable_value numeric(14,2) DEFAULT 0 NOT NULL,
    gst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    invoice_net_value numeric(14,2) DEFAULT 0 NOT NULL,
    total_litres numeric(14,2) DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    credit_days integer DEFAULT 0 NOT NULL,
    amount_collected numeric(14,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(14,2) DEFAULT 0 NOT NULL,
    invoice_age_days integer,
    ageing_bucket text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    invoice_source text,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    station text,
    party_phone text,
    line_items jsonb,
    order_id uuid,
    transport_name text,
    vehicle_no text,
    eway_bill_no text,
    irn text,
    irn_qr text,
    reverse_charge boolean DEFAULT false NOT NULL,
    place_of_supply text,
    location_id uuid,
    series_id uuid,
    supply_type text,
    buyer_state_code text,
    cgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    doc_status text DEFAULT 'final'::text NOT NULL,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text,
    transport text,
    gr_rr_no text,
    transport_charge numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT invoices_doc_status_check CHECK ((doc_status = ANY (ARRAY['draft'::text, 'final'::text, 'cancelled'::text]))),
    CONSTRAINT invoices_supply_type_check CHECK (((supply_type IS NULL) OR (supply_type = ANY (ARRAY['intra'::text, 'inter'::text]))))
);


--
-- Name: margin_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.margin_simulations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    pack_size_litres numeric NOT NULL,
    mrp numeric,
    dlp numeric NOT NULL,
    expense_per_liter numeric NOT NULL,
    scheme_per_liter numeric NOT NULL,
    coupon numeric,
    mop numeric NOT NULL,
    margin_per_pack numeric NOT NULL,
    margin_per_liter numeric NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: market_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    competitor_brand text,
    product text,
    price numeric(12,2),
    details text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: market_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_date date DEFAULT CURRENT_DATE NOT NULL,
    se_user_id uuid NOT NULL,
    customer_id uuid,
    note text DEFAULT ''::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opening_stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opening_stock_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    batch_number text,
    expiry_date date,
    rack_no text,
    shelf_no text,
    bin_no text,
    opening_date date NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rate numeric(12,4),
    amount numeric(14,2)
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    quantity_units numeric(14,2) NOT NULL,
    pack_size_litres numeric(10,2),
    total_litres numeric(14,2),
    estimated_unit_price numeric(14,2),
    estimated_line_value numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hsn_code text,
    gst_percentage numeric(5,2),
    gst_amount numeric(14,2),
    line_total numeric(14,2),
    segment text,
    brand text,
    cancelled_units numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT order_items_line_kind CHECK (((product_id IS NOT NULL) AND (((pack_size_litres IS NOT NULL) AND (total_litres IS NOT NULL)) OR ((pack_size_litres IS NULL) AND (total_litres IS NULL)))))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_code text NOT NULL,
    order_date date NOT NULL,
    customer_id uuid NOT NULL,
    sales_executive_id uuid,
    expected_invoice_value numeric(14,2),
    total_litres numeric(14,2),
    order_status text DEFAULT 'pending'::text NOT NULL,
    owner_approval_required boolean DEFAULT false NOT NULL,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    invoice_id uuid,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_amount numeric(14,2),
    total_taxable_amount numeric(14,2),
    total_gst_amount numeric(14,2),
    total_invoice_value numeric(14,2),
    delivery_address text,
    delivery_notes text,
    created_by uuid,
    client_uuid uuid,
    cancellation_note text,
    fulfillment_status text,
    origin text DEFAULT 'standard'::text NOT NULL,
    CONSTRAINT orders_fulfillment_status_check CHECK (((fulfillment_status IS NULL) OR (fulfillment_status = ANY (ARRAY['ordered'::text, 'partially_invoiced'::text, 'invoiced'::text, 'partially_delivered'::text, 'delivered'::text, 'partially_returned'::text, 'returned'::text, 'partially_cancelled'::text, 'cancelled'::text])))),
    CONSTRAINT orders_origin_check CHECK ((origin = ANY (ARRAY['standard'::text, 'invoice'::text])))
);


--
-- Name: payment_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    file_url text NOT NULL,
    proof_type text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content_type text,
    size_bytes integer,
    latitude numeric,
    longitude numeric,
    geocoded_address text
);


--
-- Name: product_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_packs (
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    scheme_per_litre numeric,
    coupon numeric,
    invoice_description text,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_segments (
    product_id uuid NOT NULL,
    segment text NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brand text,
    hsn_code text NOT NULL,
    unit text DEFAULT 'litres'::text NOT NULL,
    CONSTRAINT products_unit_check CHECK ((unit = ANY (ARRAY['litres'::text, 'quantity'::text])))
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    manufacturer text,
    model text
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_code text NOT NULL,
    permission_key text NOT NULL,
    allowed boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_return_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    kind text NOT NULL,
    segment text,
    description text DEFAULT ''::text NOT NULL,
    unit_price numeric(14,4) DEFAULT 0 NOT NULL,
    quantity_units numeric(14,2) NOT NULL,
    litres numeric(14,2),
    taxable_amount numeric(14,2) DEFAULT 0 NOT NULL,
    gross_amount numeric(14,2) DEFAULT 0 NOT NULL
);


--
-- Name: sales_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    return_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    reason text,
    proof_url text,
    taxable_amount numeric(14,2) DEFAULT 0 NOT NULL,
    gross_amount numeric(14,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: se_incentives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.se_incentives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_month date NOT NULL,
    collection_pct numeric,
    per_litre_rate numeric,
    target_litres numeric,
    target_reward numeric,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: se_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.se_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    invoice_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    task_id uuid,
    customer_id uuid
);


--
-- Name: se_segment_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.se_segment_targets (
    se_target_id uuid NOT NULL,
    segment text NOT NULL,
    target_litres numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: se_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.se_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_type text NOT NULL,
    period_start date NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT se_targets_period_type_check CHECK ((period_type = ANY (ARRAY['week'::text, 'month'::text])))
);


--
-- Name: section_seen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_seen (
    user_id uuid NOT NULL,
    section text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_adjustment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    delta_units numeric(14,2) NOT NULL,
    batch_id uuid
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_number text NOT NULL,
    location_id uuid NOT NULL,
    reason text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    adjustment_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    CONSTRAINT stock_adjustments_reason_check CHECK ((reason = ANY (ARRAY['damage'::text, 'count_correction'::text, 'write_off'::text, 'expiry'::text, 'other'::text])))
);


--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    qty_units numeric(14,2) DEFAULT 0 NOT NULL,
    reorder_level numeric(14,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_balances_nonneg CHECK ((qty_units >= (0)::numeric))
);


--
-- Name: stock_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    address_line text,
    city text,
    state text DEFAULT 'Telangana'::text NOT NULL,
    state_code text DEFAULT '36'::text NOT NULL,
    pincode text,
    is_default boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_locations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: stock_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric NOT NULL,
    brand text,
    location_id uuid NOT NULL,
    batch_number text,
    expiry_date date,
    rack_no text,
    shelf_no text,
    bin_no text,
    received_date date,
    qty_units numeric DEFAULT 0 NOT NULL,
    source_type text,
    source_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rate numeric(12,4),
    CONSTRAINT stock_lots_qty_units_check CHECK ((qty_units >= (0)::numeric))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    litres numeric(14,2),
    kind text NOT NULL,
    ref_type text,
    ref_id uuid,
    note text,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_id uuid,
    CONSTRAINT stock_movements_kind_check CHECK ((kind = ANY (ARRAY['opening'::text, 'grn'::text, 'sale'::text, 'sale_reversal'::text, 'transfer_in'::text, 'transfer_out'::text, 'adjustment'::text, 'return'::text])))
);


--
-- Name: stock_reorder_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reorder_state (
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    open_alert_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    from_batch_id uuid,
    to_batch_id uuid
);


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_number text NOT NULL,
    from_location_id uuid NOT NULL,
    to_location_id uuid NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    status text DEFAULT 'posted'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_transfers_distinct_loc CHECK ((from_location_id <> to_location_id)),
    CONSTRAINT stock_transfers_status_check CHECK ((status = ANY (ARRAY['posted'::text, 'cancelled'::text])))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    uploaded_by uuid,
    file_name text NOT NULL,
    file_key text NOT NULL,
    content_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    size_bytes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_date date,
    assigned_to uuid,
    customer_id uuid,
    created_by uuid NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remind_at timestamp with time zone
);


--
-- Name: tracking_customer_dwell_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_customer_dwell_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tracking_session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    source text DEFAULT 'gps_observed'::text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    point_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tracking_device_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_device_heartbeats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tracking_session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    device_id text,
    captured_at timestamp with time zone NOT NULL,
    battery_percentage integer,
    is_charging boolean,
    is_low_power_mode_enabled boolean,
    is_location_enabled boolean,
    foreground_permission text,
    background_permission text,
    notification_permission text,
    battery_optimization_status text,
    network_type text,
    is_connected boolean,
    queued_point_count integer DEFAULT 0 NOT NULL,
    last_location_at timestamp with time zone,
    last_successful_sync_at timestamp with time zone,
    app_version text,
    android_version text,
    manufacturer text,
    model text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tracking_device_heartbeats_battery_percentage_check CHECK (((battery_percentage IS NULL) OR ((battery_percentage >= 0) AND (battery_percentage <= 100)))),
    CONSTRAINT tracking_device_heartbeats_queued_point_count_check CHECK ((queued_point_count >= 0))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    app_login_id text,
    whatsapp_enabled boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_code text NOT NULL,
    visit_date date NOT NULL,
    executive_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    beat_plan_id uuid,
    planned_or_unplanned text NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    visit_duration_minutes integer,
    check_in_latitude numeric(10,7),
    check_in_longitude numeric(10,7),
    check_out_latitude numeric(10,7),
    check_out_longitude numeric(10,7),
    gps_validated boolean DEFAULT false NOT NULL,
    owner_met boolean DEFAULT false NOT NULL,
    order_taken boolean DEFAULT false NOT NULL,
    order_value numeric(14,2),
    order_litres numeric(14,2),
    collection_done boolean DEFAULT false NOT NULL,
    collection_amount numeric(14,2),
    competitor_info_collected boolean DEFAULT false NOT NULL,
    product_push_completed boolean DEFAULT false NOT NULL,
    visit_notes text,
    next_followup_date date,
    visit_quality_score numeric(5,2),
    productive_visit boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_uuid uuid,
    no_outcome_reason text
);


--
-- Name: web_push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_user_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_attendance_date_key UNIQUE (user_id, attendance_date);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: beat_customer_days beat_customer_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_customer_days
    ADD CONSTRAINT beat_customer_days_pkey PRIMARY KEY (customer_id);


--
-- Name: beat_plan_stops beat_plan_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plan_stops
    ADD CONSTRAINT beat_plan_stops_pkey PRIMARY KEY (id);


--
-- Name: beat_plans beat_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plans
    ADD CONSTRAINT beat_plans_pkey PRIMARY KEY (id);


--
-- Name: billing_charges billing_charges_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charges
    ADD CONSTRAINT billing_charges_period_start_key UNIQUE (period_start);


--
-- Name: billing_charges billing_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charges
    ADD CONSTRAINT billing_charges_pkey PRIMARY KEY (id);


--
-- Name: billing_payment_events billing_payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_payment_events
    ADD CONSTRAINT billing_payment_events_pkey PRIMARY KEY (event_id);


--
-- Name: brands brands_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_category_name_key UNIQUE (category, name);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: collection_allocations collection_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_pkey PRIMARY KEY (id);


--
-- Name: collections collections_collection_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_collection_code_key UNIQUE (collection_code);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: customer_dues_state customer_dues_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_dues_state
    ADD CONSTRAINT customer_dues_state_pkey PRIMARY KEY (customer_id);


--
-- Name: customer_followups customer_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_followups
    ADD CONSTRAINT customer_followups_pkey PRIMARY KEY (id);


--
-- Name: customer_notes customer_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_opening_balances customer_opening_balances_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balances
    ADD CONSTRAINT customer_opening_balances_customer_id_key UNIQUE (customer_id);


--
-- Name: customer_opening_balances customer_opening_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balances
    ADD CONSTRAINT customer_opening_balances_pkey PRIMARY KEY (id);


--
-- Name: customer_photos customer_photos_file_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_photos
    ADD CONSTRAINT customer_photos_file_key_key UNIQUE (file_key);


--
-- Name: customer_photos customer_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_photos
    ADD CONSTRAINT customer_photos_pkey PRIMARY KEY (id);


--
-- Name: customer_reassignments customer_reassignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: delivery_photos delivery_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_pkey PRIMARY KEY (id);


--
-- Name: delivery_run_stops delivery_run_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_stops
    ADD CONSTRAINT delivery_run_stops_pkey PRIMARY KEY (id);


--
-- Name: delivery_runs delivery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_pkey PRIMARY KEY (id);


--
-- Name: error_events error_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_events
    ADD CONSTRAINT error_events_pkey PRIMARY KEY (id);


--
-- Name: error_groups error_groups_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_groups
    ADD CONSTRAINT error_groups_fingerprint_key UNIQUE (fingerprint);


--
-- Name: error_groups error_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_groups
    ADD CONSTRAINT error_groups_pkey PRIMARY KEY (id);


--
-- Name: error_notes error_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_notes
    ADD CONSTRAINT error_notes_pkey PRIMARY KEY (id);


--
-- Name: executive_latest_locations executive_latest_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_latest_locations
    ADD CONSTRAINT executive_latest_locations_pkey PRIMARY KEY (user_id);


--
-- Name: expenditure_categories expenditure_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditure_categories
    ADD CONSTRAINT expenditure_categories_name_key UNIQUE (name);


--
-- Name: expenditure_categories expenditure_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditure_categories
    ADD CONSTRAINT expenditure_categories_pkey PRIMARY KEY (id);


--
-- Name: expenditures expenditures_expenditure_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_expenditure_code_key UNIQUE (expenditure_code);


--
-- Name: expenditures expenditures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_grn_number_key UNIQUE (grn_number);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: gps_points gps_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_points
    ADD CONSTRAINT gps_points_pkey PRIMARY KEY (id);


--
-- Name: gps_tracking_sessions gps_tracking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_tracking_sessions
    ADD CONSTRAINT gps_tracking_sessions_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_allocations invoice_line_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_allocations
    ADD CONSTRAINT invoice_line_allocations_pkey PRIMARY KEY (id);


--
-- Name: invoice_series invoice_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_series
    ADD CONSTRAINT invoice_series_pkey PRIMARY KEY (id);


--
-- Name: invoice_series invoice_series_prefix_fin_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_series
    ADD CONSTRAINT invoice_series_prefix_fin_year_key UNIQUE (prefix, fin_year);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: margin_simulations margin_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.margin_simulations
    ADD CONSTRAINT margin_simulations_pkey PRIMARY KEY (id);


--
-- Name: market_note_items market_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_note_items
    ADD CONSTRAINT market_note_items_pkey PRIMARY KEY (id);


--
-- Name: market_notes market_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_notes
    ADD CONSTRAINT market_notes_pkey PRIMARY KEY (id);


--
-- Name: opening_stock_items opening_stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_stock_items
    ADD CONSTRAINT opening_stock_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_proofs payment_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_pkey PRIMARY KEY (id);


--
-- Name: product_packs product_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_packs
    ADD CONSTRAINT product_packs_pkey PRIMARY KEY (product_id, pack_size_litres);


--
-- Name: product_segments product_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_segments
    ADD CONSTRAINT product_segments_pkey PRIMARY KEY (product_id, segment);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_product_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_product_name_key UNIQUE (product_name);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_code, permission_key);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_return_items sales_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: se_incentives se_incentives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_incentives
    ADD CONSTRAINT se_incentives_pkey PRIMARY KEY (id);


--
-- Name: se_incentives se_incentives_user_id_period_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_incentives
    ADD CONSTRAINT se_incentives_user_id_period_month_key UNIQUE (user_id, period_month);


--
-- Name: se_notifications se_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_notifications
    ADD CONSTRAINT se_notifications_pkey PRIMARY KEY (id);


--
-- Name: se_segment_targets se_segment_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_segment_targets
    ADD CONSTRAINT se_segment_targets_pkey PRIMARY KEY (se_target_id, segment);


--
-- Name: se_targets se_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_targets
    ADD CONSTRAINT se_targets_pkey PRIMARY KEY (id);


--
-- Name: se_targets se_targets_user_id_period_type_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_targets
    ADD CONSTRAINT se_targets_user_id_period_type_period_start_key UNIQUE (user_id, period_type, period_start);


--
-- Name: section_seen section_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_seen
    ADD CONSTRAINT section_seen_pkey PRIMARY KEY (user_id, section);


--
-- Name: stock_adjustment_items stock_adjustment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_adjustment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_adjustment_number_key UNIQUE (adjustment_number);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_pkey PRIMARY KEY (location_id, product_id, pack_size_litres);


--
-- Name: stock_locations stock_locations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_code_key UNIQUE (code);


--
-- Name: stock_locations stock_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_pkey PRIMARY KEY (id);


--
-- Name: stock_lots stock_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_reorder_state stock_reorder_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reorder_state
    ADD CONSTRAINT stock_reorder_state_pkey PRIMARY KEY (location_id, product_id, pack_size_litres);


--
-- Name: stock_transfer_items stock_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_transfer_number_key UNIQUE (transfer_number);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: task_attachments task_attachments_file_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_file_key_key UNIQUE (file_key);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tracking_customer_dwell_events tracking_customer_dwell_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_customer_dwell_events
    ADD CONSTRAINT tracking_customer_dwell_events_pkey PRIMARY KEY (id);


--
-- Name: tracking_device_heartbeats tracking_device_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_device_heartbeats
    ADD CONSTRAINT tracking_device_heartbeats_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: visits visits_visit_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_visit_code_key UNIQUE (visit_code);


--
-- Name: web_push_subscriptions web_push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_push_subscriptions
    ADD CONSTRAINT web_push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: web_push_subscriptions web_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_push_subscriptions
    ADD CONSTRAINT web_push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: alerts_alert_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX alerts_alert_code_key ON public.alerts USING btree (alert_code);


--
-- Name: attendance_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_date_idx ON public.attendance USING btree (attendance_date);


--
-- Name: attendance_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_user_date_idx ON public.attendance USING btree (user_id, attendance_date);


--
-- Name: beat_plan_stops_plan_customer_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX beat_plan_stops_plan_customer_unique ON public.beat_plan_stops USING btree (beat_plan_id, customer_id);


--
-- Name: beat_plans_exec_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX beat_plans_exec_date_unique ON public.beat_plans USING btree (executive_id, plan_date);


--
-- Name: collection_allocations_opening_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_allocations_opening_idx ON public.collection_allocations USING btree (opening_balance_id) WHERE (opening_balance_id IS NOT NULL);


--
-- Name: collections_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collections_approval_status ON public.collections USING btree (accountant_approval_status);


--
-- Name: collections_client_uuid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX collections_client_uuid_unique ON public.collections USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: collections_collection_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collections_collection_date ON public.collections USING btree (collection_date);


--
-- Name: collections_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collections_customer ON public.collections USING btree (customer_id);


--
-- Name: customer_followups_customer_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_followups_customer_open_idx ON public.customer_followups USING btree (customer_id, status, created_at DESC);


--
-- Name: customer_followups_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_followups_due_idx ON public.customer_followups USING btree (follow_up_at) WHERE ((status = 'open'::text) AND (follow_up_at IS NOT NULL));


--
-- Name: customer_followups_feed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_followups_feed_idx ON public.customer_followups USING btree (created_at DESC);


--
-- Name: customer_notes_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_notes_customer_idx ON public.customer_notes USING btree (customer_id, created_at DESC);


--
-- Name: customer_opening_balances_outstanding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_opening_balances_outstanding_idx ON public.customer_opening_balances USING btree (customer_id) WHERE (outstanding_amount > (0)::numeric);


--
-- Name: customer_photos_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_photos_customer ON public.customer_photos USING btree (customer_id, created_at DESC);


--
-- Name: customer_reassignments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_reassignments_customer ON public.customer_reassignments USING btree (customer_id, created_at DESC);


--
-- Name: customers_active_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_active_phone_unique ON public.customers USING btree ("right"(regexp_replace(COALESCE(phone, ''::text), '\D'::text, ''::text, 'g'::text), 10)) WHERE ((status = 'active'::text) AND (length("right"(regexp_replace(COALESCE(phone, ''::text), '\D'::text, ''::text, 'g'::text), 10)) = 10));


--
-- Name: customers_client_uuid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_client_uuid_unique ON public.customers USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: customers_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_created_at ON public.customers USING btree (created_at);


--
-- Name: customers_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_created_by ON public.customers USING btree (created_by);


--
-- Name: customers_legal_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_legal_name ON public.customers USING btree (legal_name);


--
-- Name: customers_statement_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_statement_token_key ON public.customers USING btree (statement_token) WHERE (statement_token IS NOT NULL);


--
-- Name: customers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_status ON public.customers USING btree (status);


--
-- Name: delivery_photos_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_photos_run ON public.delivery_photos USING btree (run_id);


--
-- Name: delivery_photos_stop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_photos_stop ON public.delivery_photos USING btree (stop_id);


--
-- Name: delivery_photos_stop_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_photos_stop_kind ON public.delivery_photos USING btree (stop_id, kind);


--
-- Name: delivery_run_stops_client_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_run_stops_client_uuid ON public.delivery_run_stops USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: delivery_run_stops_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_run_stops_customer ON public.delivery_run_stops USING btree (customer_id);


--
-- Name: delivery_run_stops_invoice_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_run_stops_invoice_id_key ON public.delivery_run_stops USING btree (invoice_id) WHERE (invoice_id IS NOT NULL);


--
-- Name: delivery_run_stops_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_run_stops_run ON public.delivery_run_stops USING btree (run_id, created_at);


--
-- Name: delivery_runs_client_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_runs_client_uuid ON public.delivery_runs USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: delivery_runs_run_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_runs_run_date ON public.delivery_runs USING btree (run_date);


--
-- Name: delivery_runs_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_runs_user_active ON public.delivery_runs USING btree (logistics_user_id, run_date) WHERE (status = 'active'::text);


--
-- Name: error_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX error_events_created ON public.error_events USING btree (created_at);


--
-- Name: error_events_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX error_events_group ON public.error_events USING btree (group_id, created_at DESC);


--
-- Name: error_groups_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX error_groups_source ON public.error_groups USING btree (source, last_seen_at DESC);


--
-- Name: error_groups_status_lastseen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX error_groups_status_lastseen ON public.error_groups USING btree (status, last_seen_at DESC);


--
-- Name: error_notes_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX error_notes_group ON public.error_notes USING btree (group_id, created_at);


--
-- Name: executive_latest_locations_heartbeat_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_latest_locations_heartbeat_at ON public.executive_latest_locations USING btree (last_heartbeat_at DESC);


--
-- Name: executive_latest_locations_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_latest_locations_recorded_at ON public.executive_latest_locations USING btree (recorded_at DESC);


--
-- Name: expenditures_client_uuid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expenditures_client_uuid_unique ON public.expenditures USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: goods_receipt_items_expiry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goods_receipt_items_expiry_date ON public.goods_receipt_items USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: goods_receipt_items_grn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goods_receipt_items_grn_idx ON public.goods_receipt_items USING btree (grn_id);


--
-- Name: gps_points_location_point_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gps_points_location_point_id_key ON public.gps_points USING btree (location_point_id);


--
-- Name: gps_points_session_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gps_points_session_recorded_at ON public.gps_points USING btree (session_id, recorded_at);


--
-- Name: gps_points_user_recorded_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gps_points_user_recorded_at_desc ON public.gps_points USING btree (user_id, recorded_at DESC);


--
-- Name: gps_points_user_recorded_at_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gps_points_user_recorded_at_key ON public.gps_points USING btree (user_id, recorded_at);


--
-- Name: gps_tracking_sessions_active_cutoff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gps_tracking_sessions_active_cutoff ON public.gps_tracking_sessions USING btree (status, session_date) WHERE (status = 'active'::text);


--
-- Name: gps_tracking_sessions_client_session_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gps_tracking_sessions_client_session_id_key ON public.gps_tracking_sessions USING btree (client_session_id) WHERE (client_session_id IS NOT NULL);


--
-- Name: gps_tracking_sessions_one_active_per_user_device; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gps_tracking_sessions_one_active_per_user_device ON public.gps_tracking_sessions USING btree (user_id, COALESCE(device_id, ''::text)) WHERE (status = 'active'::text);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status, severity);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id, created_at DESC);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_beat_customer_days_exec_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beat_customer_days_exec_day ON public.beat_customer_days USING btree (executive_id, weekday, sequence_no);


--
-- Name: idx_billing_charges_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_charges_period ON public.billing_charges USING btree (period_start DESC);


--
-- Name: idx_collections_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_customer ON public.collections USING btree (customer_id, collection_date);


--
-- Name: idx_collections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_user ON public.collections USING btree (collected_by_user_id, collection_date);


--
-- Name: idx_expenditure_categories_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenditure_categories_type ON public.expenditure_categories USING btree (type, name);


--
-- Name: idx_expenditures_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenditures_category ON public.expenditures USING btree (category_id, expenditure_date DESC);


--
-- Name: idx_expenditures_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenditures_date ON public.expenditures USING btree (expenditure_date DESC, created_at DESC);


--
-- Name: idx_expenditures_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenditures_user ON public.expenditures USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_gps_points_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gps_points_user_time ON public.gps_points USING btree (user_id, recorded_at);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.invoices USING btree (customer_id, invoice_date);


--
-- Name: idx_invoices_due_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due_status ON public.invoices USING btree (due_date, payment_status);


--
-- Name: idx_market_note_items_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_note_items_note ON public.market_note_items USING btree (note_id);


--
-- Name: idx_market_notes_meeting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_notes_meeting_date ON public.market_notes USING btree (meeting_date DESC);


--
-- Name: idx_market_notes_se; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_notes_se ON public.market_notes USING btree (se_user_id);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id, order_date);


--
-- Name: idx_orders_executive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_executive ON public.orders USING btree (sales_executive_id, order_date);


--
-- Name: idx_orders_fulfillment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_fulfillment_status ON public.orders USING btree (fulfillment_status);


--
-- Name: idx_product_packs_pack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_packs_pack ON public.product_packs USING btree (pack_size_litres);


--
-- Name: idx_push_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_user ON public.push_tokens USING btree (user_id);


--
-- Name: idx_sales_return_items_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_return_items_order_item ON public.sales_return_items USING btree (order_item_id);


--
-- Name: idx_sales_return_items_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_return_items_return ON public.sales_return_items USING btree (sales_return_id);


--
-- Name: idx_sales_returns_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_returns_customer ON public.sales_returns USING btree (customer_id, return_date);


--
-- Name: idx_sales_returns_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_returns_invoice ON public.sales_returns USING btree (invoice_id);


--
-- Name: idx_se_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_se_notifications_user ON public.se_notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_se_targets_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_se_targets_period ON public.se_targets USING btree (period_type, period_start);


--
-- Name: idx_visits_customer_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visits_customer_date ON public.visits USING btree (customer_id, visit_date);


--
-- Name: idx_visits_executive_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visits_executive_date ON public.visits USING btree (executive_id, visit_date);


--
-- Name: invoice_items_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_invoice_idx ON public.invoice_items USING btree (invoice_id);


--
-- Name: invoice_line_allocations_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_line_allocations_invoice_id_idx ON public.invoice_line_allocations USING btree (invoice_id);


--
-- Name: invoice_line_allocations_order_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_line_allocations_order_item_id_idx ON public.invoice_line_allocations USING btree (order_item_id);


--
-- Name: margin_simulations_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX margin_simulations_created_idx ON public.margin_simulations USING btree (created_at DESC);


--
-- Name: opening_stock_items_expiry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX opening_stock_items_expiry_date ON public.opening_stock_items USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: opening_stock_items_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX opening_stock_items_location ON public.opening_stock_items USING btree (location_id);


--
-- Name: orders_client_uuid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_client_uuid_unique ON public.orders USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_created_at ON public.orders USING btree (created_at);


--
-- Name: orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_customer ON public.orders USING btree (customer_id);


--
-- Name: orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_order_date ON public.orders USING btree (order_date);


--
-- Name: orders_sales_executive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_sales_executive ON public.orders USING btree (sales_executive_id);


--
-- Name: orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status ON public.orders USING btree (order_status);


--
-- Name: products_product_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_product_name ON public.products USING btree (product_name);


--
-- Name: se_incentives_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX se_incentives_month_idx ON public.se_incentives USING btree (period_month);


--
-- Name: stock_adjustment_items_adj_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustment_items_adj_idx ON public.stock_adjustment_items USING btree (adjustment_id);


--
-- Name: stock_locations_one_default_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_locations_one_default_idx ON public.stock_locations USING btree (is_default) WHERE is_default;


--
-- Name: stock_lots_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_lots_expiry_idx ON public.stock_lots USING btree (expiry_date) WHERE (qty_units > (0)::numeric);


--
-- Name: stock_lots_identity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_lots_identity_idx ON public.stock_lots USING btree (location_id, product_id, pack_size_litres, COALESCE(brand, ''::text), COALESCE(batch_number, ''::text), COALESCE(expiry_date, 'infinity'::date), COALESCE(rate, ('-1'::integer)::numeric));


--
-- Name: stock_lots_sku_loc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_lots_sku_loc_idx ON public.stock_lots USING btree (location_id, product_id, pack_size_litres);


--
-- Name: stock_movements_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_batch_idx ON public.stock_movements USING btree (batch_id);


--
-- Name: stock_movements_moved_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_moved_at_idx ON public.stock_movements USING btree (moved_at DESC);


--
-- Name: stock_movements_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_ref_idx ON public.stock_movements USING btree (ref_type, ref_id);


--
-- Name: stock_movements_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_sku_idx ON public.stock_movements USING btree (location_id, product_id, pack_size_litres);


--
-- Name: stock_transfer_items_transfer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfer_items_transfer_idx ON public.stock_transfer_items USING btree (transfer_id);


--
-- Name: task_attachments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_attachments_task ON public.task_attachments USING btree (task_id, created_at);


--
-- Name: task_comments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_comments_task ON public.task_comments USING btree (task_id, created_at);


--
-- Name: tasks_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_assigned_to ON public.tasks USING btree (assigned_to);


--
-- Name: tasks_assignee_remind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_assignee_remind ON public.tasks USING btree (assigned_to, status, remind_at);


--
-- Name: tasks_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_status_due ON public.tasks USING btree (status, due_date);


--
-- Name: tracking_customer_dwell_customer_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tracking_customer_dwell_customer_date_idx ON public.tracking_customer_dwell_events USING btree (customer_id, started_at DESC);


--
-- Name: tracking_customer_dwell_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tracking_customer_dwell_session_idx ON public.tracking_customer_dwell_events USING btree (tracking_session_id, started_at);


--
-- Name: tracking_device_heartbeats_session_captured_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tracking_device_heartbeats_session_captured_at ON public.tracking_device_heartbeats USING btree (tracking_session_id, captured_at DESC);


--
-- Name: tracking_device_heartbeats_user_captured_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tracking_device_heartbeats_user_captured_at ON public.tracking_device_heartbeats USING btree (user_id, captured_at DESC);


--
-- Name: users_app_login_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_app_login_id_idx ON public.users USING btree (app_login_id);


--
-- Name: visits_client_uuid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visits_client_uuid_unique ON public.visits USING btree (client_uuid) WHERE (client_uuid IS NOT NULL);


--
-- Name: web_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX web_push_subscriptions_user ON public.web_push_subscriptions USING btree (user_id);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: alerts alerts_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: alerts alerts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: alerts alerts_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES public.users(id);


--
-- Name: alerts alerts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: attendance attendance_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: attendance attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: beat_customer_days beat_customer_days_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_customer_days
    ADD CONSTRAINT beat_customer_days_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: beat_customer_days beat_customer_days_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_customer_days
    ADD CONSTRAINT beat_customer_days_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES public.users(id);


--
-- Name: beat_plan_stops beat_plan_stops_beat_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plan_stops
    ADD CONSTRAINT beat_plan_stops_beat_plan_id_fkey FOREIGN KEY (beat_plan_id) REFERENCES public.beat_plans(id);


--
-- Name: beat_plan_stops beat_plan_stops_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plan_stops
    ADD CONSTRAINT beat_plan_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: beat_plans beat_plans_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plans
    ADD CONSTRAINT beat_plans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: beat_plans beat_plans_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plans
    ADD CONSTRAINT beat_plans_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES public.users(id);


--
-- Name: beat_plans beat_plans_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beat_plans
    ADD CONSTRAINT beat_plans_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: collection_allocations collection_allocations_allocated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES public.users(id);


--
-- Name: collection_allocations collection_allocations_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id);


--
-- Name: collection_allocations collection_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: collection_allocations collection_allocations_opening_balance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_opening_balance_id_fkey FOREIGN KEY (opening_balance_id) REFERENCES public.customer_opening_balances(id);


--
-- Name: collections collections_approved_by_accountant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_approved_by_accountant_id_fkey FOREIGN KEY (approved_by_accountant_id) REFERENCES public.users(id);


--
-- Name: collections collections_collected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_collected_by_user_id_fkey FOREIGN KEY (collected_by_user_id) REFERENCES public.users(id);


--
-- Name: collections collections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: collections collections_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_dues_state customer_dues_state_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_dues_state
    ADD CONSTRAINT customer_dues_state_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_followups customer_followups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_followups
    ADD CONSTRAINT customer_followups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_followups customer_followups_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_followups
    ADD CONSTRAINT customer_followups_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_followups customer_followups_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_followups
    ADD CONSTRAINT customer_followups_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: customer_followups customer_followups_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_followups
    ADD CONSTRAINT customer_followups_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: customer_notes customer_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_notes customer_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_notes customer_notes_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id);


--
-- Name: customer_opening_balances customer_opening_balances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balances
    ADD CONSTRAINT customer_opening_balances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_opening_balances customer_opening_balances_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balances
    ADD CONSTRAINT customer_opening_balances_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_opening_balances customer_opening_balances_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balances
    ADD CONSTRAINT customer_opening_balances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: customer_photos customer_photos_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_photos
    ADD CONSTRAINT customer_photos_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_photos customer_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_photos
    ADD CONSTRAINT customer_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: customer_reassignments customer_reassignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_reassignments customer_reassignments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_reassignments customer_reassignments_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_reassignments customer_reassignments_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_reassignments customer_reassignments_undone_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reassignments
    ADD CONSTRAINT customer_reassignments_undone_by_fkey FOREIGN KEY (undone_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customers customers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: customers customers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: delivery_photos delivery_photos_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.delivery_runs(id);


--
-- Name: delivery_photos delivery_photos_stop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES public.delivery_run_stops(id);


--
-- Name: delivery_photos delivery_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: delivery_run_stops delivery_run_stops_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_stops
    ADD CONSTRAINT delivery_run_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: delivery_run_stops delivery_run_stops_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_stops
    ADD CONSTRAINT delivery_run_stops_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: delivery_run_stops delivery_run_stops_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_stops
    ADD CONSTRAINT delivery_run_stops_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.delivery_runs(id);


--
-- Name: delivery_runs delivery_runs_logistics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_logistics_user_id_fkey FOREIGN KEY (logistics_user_id) REFERENCES public.users(id);


--
-- Name: error_events error_events_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_events
    ADD CONSTRAINT error_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.error_groups(id) ON DELETE CASCADE;


--
-- Name: error_events error_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_events
    ADD CONSTRAINT error_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: error_groups error_groups_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_groups
    ADD CONSTRAINT error_groups_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: error_groups error_groups_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_groups
    ADD CONSTRAINT error_groups_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: error_notes error_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_notes
    ADD CONSTRAINT error_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: error_notes error_notes_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_notes
    ADD CONSTRAINT error_notes_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.error_groups(id) ON DELETE CASCADE;


--
-- Name: executive_latest_locations executive_latest_locations_tracking_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_latest_locations
    ADD CONSTRAINT executive_latest_locations_tracking_session_id_fkey FOREIGN KEY (tracking_session_id) REFERENCES public.gps_tracking_sessions(id);


--
-- Name: executive_latest_locations executive_latest_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_latest_locations
    ADD CONSTRAINT executive_latest_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: expenditure_categories expenditure_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditure_categories
    ADD CONSTRAINT expenditure_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: expenditures expenditures_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expenditure_categories(id);


--
-- Name: expenditures expenditures_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: expenditures expenditures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_items goods_receipt_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: goods_receipts goods_receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: gps_points gps_points_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_points
    ADD CONSTRAINT gps_points_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.gps_tracking_sessions(id);


--
-- Name: gps_points gps_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_points
    ADD CONSTRAINT gps_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gps_tracking_sessions gps_tracking_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gps_tracking_sessions
    ADD CONSTRAINT gps_tracking_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoice_line_allocations invoice_line_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_allocations
    ADD CONSTRAINT invoice_line_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_line_allocations invoice_line_allocations_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_allocations
    ADD CONSTRAINT invoice_line_allocations_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: invoices invoices_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: invoices invoices_sales_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_sales_executive_id_fkey FOREIGN KEY (sales_executive_id) REFERENCES public.users(id);


--
-- Name: invoices invoices_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.invoice_series(id);


--
-- Name: margin_simulations margin_simulations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.margin_simulations
    ADD CONSTRAINT margin_simulations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: margin_simulations margin_simulations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.margin_simulations
    ADD CONSTRAINT margin_simulations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: market_note_items market_note_items_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_note_items
    ADD CONSTRAINT market_note_items_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.market_notes(id) ON DELETE CASCADE;


--
-- Name: market_notes market_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_notes
    ADD CONSTRAINT market_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: market_notes market_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_notes
    ADD CONSTRAINT market_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: market_notes market_notes_se_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_notes
    ADD CONSTRAINT market_notes_se_user_id_fkey FOREIGN KEY (se_user_id) REFERENCES public.users(id);


--
-- Name: opening_stock_items opening_stock_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_stock_items
    ADD CONSTRAINT opening_stock_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: opening_stock_items opening_stock_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_stock_items
    ADD CONSTRAINT opening_stock_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: opening_stock_items opening_stock_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_stock_items
    ADD CONSTRAINT opening_stock_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_sales_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_sales_executive_id_fkey FOREIGN KEY (sales_executive_id) REFERENCES public.users(id);


--
-- Name: payment_proofs payment_proofs_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id);


--
-- Name: payment_proofs payment_proofs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: product_packs product_packs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_packs
    ADD CONSTRAINT product_packs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_segments product_segments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_segments
    ADD CONSTRAINT product_segments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_return_items sales_return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: sales_return_items sales_return_items_sales_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_sales_return_id_fkey FOREIGN KEY (sales_return_id) REFERENCES public.sales_returns(id) ON DELETE CASCADE;


--
-- Name: sales_returns sales_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_returns sales_returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_returns sales_returns_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: se_incentives se_incentives_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_incentives
    ADD CONSTRAINT se_incentives_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: se_incentives se_incentives_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_incentives
    ADD CONSTRAINT se_incentives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: se_notifications se_notifications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_notifications
    ADD CONSTRAINT se_notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: se_notifications se_notifications_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_notifications
    ADD CONSTRAINT se_notifications_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: se_notifications se_notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_notifications
    ADD CONSTRAINT se_notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: se_notifications se_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_notifications
    ADD CONSTRAINT se_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: se_segment_targets se_segment_targets_se_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_segment_targets
    ADD CONSTRAINT se_segment_targets_se_target_id_fkey FOREIGN KEY (se_target_id) REFERENCES public.se_targets(id) ON DELETE CASCADE;


--
-- Name: se_targets se_targets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_targets
    ADD CONSTRAINT se_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: se_targets se_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.se_targets
    ADD CONSTRAINT se_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: section_seen section_seen_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_seen
    ADD CONSTRAINT section_seen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment_items stock_adjustment_items_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.stock_adjustments(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment_items stock_adjustment_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.stock_lots(id);


--
-- Name: stock_adjustment_items stock_adjustment_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_adjustments stock_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_adjustments stock_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_balances stock_balances_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_balances stock_balances_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_locations stock_locations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_lots stock_lots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_lots stock_lots_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_lots stock_lots_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.stock_lots(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_transfer_items stock_transfer_items_from_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_from_batch_id_fkey FOREIGN KEY (from_batch_id) REFERENCES public.stock_lots(id);


--
-- Name: stock_transfer_items stock_transfer_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_transfer_items stock_transfer_items_to_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_to_batch_id_fkey FOREIGN KEY (to_batch_id) REFERENCES public.stock_lots(id);


--
-- Name: stock_transfer_items stock_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.stock_transfers(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_transfers stock_transfers_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_transfers stock_transfers_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.stock_locations(id);


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: task_comments task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tasks tasks_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: tracking_customer_dwell_events tracking_customer_dwell_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_customer_dwell_events
    ADD CONSTRAINT tracking_customer_dwell_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: tracking_customer_dwell_events tracking_customer_dwell_events_tracking_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_customer_dwell_events
    ADD CONSTRAINT tracking_customer_dwell_events_tracking_session_id_fkey FOREIGN KEY (tracking_session_id) REFERENCES public.gps_tracking_sessions(id) ON DELETE CASCADE;


--
-- Name: tracking_customer_dwell_events tracking_customer_dwell_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_customer_dwell_events
    ADD CONSTRAINT tracking_customer_dwell_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tracking_device_heartbeats tracking_device_heartbeats_tracking_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_device_heartbeats
    ADD CONSTRAINT tracking_device_heartbeats_tracking_session_id_fkey FOREIGN KEY (tracking_session_id) REFERENCES public.gps_tracking_sessions(id);


--
-- Name: tracking_device_heartbeats tracking_device_heartbeats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_device_heartbeats
    ADD CONSTRAINT tracking_device_heartbeats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: visits visits_beat_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_beat_plan_id_fkey FOREIGN KEY (beat_plan_id) REFERENCES public.beat_plans(id);


--
-- Name: visits visits_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: visits visits_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES public.users(id);


--
-- Name: web_push_subscriptions web_push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_push_subscriptions
    ADD CONSTRAINT web_push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 7BUJdBnm25GwnbZYKT7z9utoZXLBhfKvuFdgO8Xnr5dTBQ6msGYgXKAuE8cyfB8

