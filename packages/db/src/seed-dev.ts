import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { closeDatabaseClient, getDatabaseClient } from "./index.js";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const db = getDatabaseClient();

type RoleCode =
  | "SUPER_ADMIN"
  | "MANAGER"
  | "ACCOUNTANT"
  | "SALES_EXECUTIVE"
  | "LOGISTICS";

interface DemoUser {
  name: string;
  email: string;
  phone: string;
  loginId: string;
  role: RoleCode;
}

interface DemoExecutiveActivity {
  userId: string;
  customerId: string;
  customerCode: string;
  visitCode: string;
  orderCode: string;
  collectionCode: string;
  invoiceNumber: string;
  completedVisits: number;
  productiveVisits: number;
  salesValue: number;
  litres: number;
  collection: number;
  km: number;
  gpsStatus: "active" | "completed";
  pendingCollection: boolean;
  ageingBucket: string;
  outstanding: number;
  invoiceAgeDays: number;
}

const demoUsers: DemoUser[] = [
  {
    name: "Demo Super Admin",
    email: "demo.super.admin@example.com",
    phone: "+910000000010",
    loginId: "demo-super-admin",
    role: "SUPER_ADMIN",
  },
  {
    name: "Demo Manager",
    email: "demo.manager@example.com",
    phone: "+910000000011",
    loginId: "demo-manager",
    role: "MANAGER",
  },
  {
    name: "Demo Accountant",
    email: "demo.accountant@example.com",
    phone: "+910000000012",
    loginId: "demo-accountant",
    role: "ACCOUNTANT",
  },
  {
    name: "Anika Sharma",
    email: "anika.executive@example.com",
    phone: "+910000000101",
    loginId: "demo-executive-anika",
    role: "SALES_EXECUTIVE",
  },
  {
    name: "Ravi Kumar",
    email: "ravi.executive@example.com",
    phone: "+910000000102",
    loginId: "demo-executive-ravi",
    role: "SALES_EXECUTIVE",
  },
  {
    name: "Meera Iyer",
    email: "meera.executive@example.com",
    phone: "+910000000103",
    loginId: "demo-executive-meera",
    role: "SALES_EXECUTIVE",
  },
];

const roleNames: Record<RoleCode, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  SALES_EXECUTIVE: "Sales Executive",
  LOGISTICS: "Logistics",
};

try {
  const roles = await upsertRoles();
  const users = new Map<string, string>();

  for (const demoUser of demoUsers) {
    const userId = await upsertUser(demoUser);
    users.set(demoUser.loginId, userId);

    await db`
      insert into user_roles (user_id, role_id)
      values (${userId}, ${requiredRole(roles, demoUser.role)})
      on conflict (user_id, role_id) do nothing
    `;
  }


  const activities: DemoExecutiveActivity[] = [
    {
      userId: requiredUser(users, "demo-executive-anika"),
      customerId: await upsertCustomer(
        requiredUser(users, "demo-executive-anika"),
        "DEMO-CUST-001",
        "Demo Retail Store",
      ),
      customerCode: "DEMO-CUST-001",
      visitCode: "DEMO-VISIT-001",
      orderCode: "DEMO-ORDER-001",
      collectionCode: "DEMO-COLLECTION-001",
      invoiceNumber: "DEMO-INV-001",
      completedVisits: 8,
      productiveVisits: 6,
      salesValue: 92000,
      litres: 340,
      collection: 36000,
      km: 42,
      gpsStatus: "active",
      pendingCollection: true,
      ageingBucket: "31-60",
      outstanding: 42000,
      invoiceAgeDays: 45,
    },
    {
      userId: requiredUser(users, "demo-executive-ravi"),
      customerId: await upsertCustomer(
        requiredUser(users, "demo-executive-ravi"),
        "DEMO-CUST-002",
        "Metro Lubes Center",
      ),
      customerCode: "DEMO-CUST-002",
      visitCode: "DEMO-VISIT-002",
      orderCode: "DEMO-ORDER-002",
      collectionCode: "DEMO-COLLECTION-002",
      invoiceNumber: "DEMO-INV-002",
      completedVisits: 6,
      productiveVisits: 4,
      salesValue: 61000,
      litres: 220,
      collection: 25000,
      km: 35,
      gpsStatus: "completed",
      pendingCollection: false,
      ageingBucket: "0-30",
      outstanding: 18000,
      invoiceAgeDays: 20,
    },
    {
      userId: requiredUser(users, "demo-executive-meera"),
      customerId: await upsertCustomer(
        requiredUser(users, "demo-executive-meera"),
        "DEMO-CUST-003",
        "Highway Auto Needs",
      ),
      customerCode: "DEMO-CUST-003",
      visitCode: "DEMO-VISIT-003",
      orderCode: "DEMO-ORDER-003",
      collectionCode: "DEMO-COLLECTION-003",
      invoiceNumber: "DEMO-INV-003",
      completedVisits: 4,
      productiveVisits: 2,
      salesValue: 32000,
      litres: 130,
      collection: 13000,
      km: 24,
      gpsStatus: "completed",
      pendingCollection: true,
      ageingBucket: "61-90",
      outstanding: 85000,
      invoiceAgeDays: 75,
    },
  ];

  for (const activity of activities) {
    await seedExecutiveActivity(activity);
  }

  console.log("Demo seed ready");
  console.log(`superAdminUserId=${requiredUser(users, "demo-super-admin")}`);
  console.log(`managerUserId=${requiredUser(users, "demo-manager")}`);
  console.log(`accountantUserId=${requiredUser(users, "demo-accountant")}`);
  console.log(`salesExecutiveUserId=${requiredUser(users, "demo-executive-anika")}`);
  console.log(`customerId=${activities[0].customerId}`);
} finally {
  await closeDatabaseClient();
}

async function upsertRoles(): Promise<Map<RoleCode, string>> {
  const roles = new Map<RoleCode, string>();

  for (const roleCode of Object.keys(roleNames) as RoleCode[]) {
    const [role] = await db`
      insert into roles (code, name, description)
      values (
        ${roleCode},
        ${roleNames[roleCode]},
        ${`${roleNames[roleCode]} demo role`}
      )
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description
      returning id
    `;

    roles.set(roleCode, role.id as string);
  }

  return roles;
}

async function upsertUser(demoUser: DemoUser): Promise<string> {
  const [user] = await db`
    insert into users (
      name,
      phone,
      email,
      app_login_id,
      status
    )
    values (
      ${demoUser.name},
      ${demoUser.phone},
      ${demoUser.email},
      ${demoUser.loginId},
      'active'
    )
    on conflict (email) do update
      set name = excluded.name,
          phone = excluded.phone,
          app_login_id = excluded.app_login_id,
          status = excluded.status
    returning id
  `;

  return user.id as string;
}

async function upsertCustomer(
  executiveId: string,
  customerCode: string,
  tradeName: string,
): Promise<string> {
  const [customer] = await db`
    insert into customers (
      customer_code,
      legal_name,
      trade_name,
      customer_type,
      segment,
      payment_status,
      latitude,
      longitude,
      approval_status,
      status,
      created_by
    )
    values (
      ${customerCode},
      ${tradeName},
      ${tradeName},
      'retailer',
      'demo',
      'good',
      17.385044,
      78.486671,
      'approved',
      'active',
      ${executiveId}
    )
    on conflict (customer_code) do update
      set legal_name = excluded.legal_name,
          trade_name = excluded.trade_name,
          customer_type = excluded.customer_type,
          segment = excluded.segment,
          payment_status = excluded.payment_status,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          approval_status = excluded.approval_status,
          status = excluded.status
    returning id
  `;

  await db`
    insert into customer_assignments (
      customer_id,
      user_id,
      assignment_type,
      is_active
    )
    select ${customer.id}, ${executiveId}, 'primary', true
    where not exists (
      select 1
      from customer_assignments
      where customer_id = ${customer.id}
        and user_id = ${executiveId}
        and is_active = true
    )
  `;

  return customer.id as string;
}

async function seedExecutiveActivity(activity: DemoExecutiveActivity) {
  await db`
    insert into daily_executive_performance (
      metric_date,
      executive_id,
      completed_visits,
      productive_visits,
      total_km_travelled,
      total_litres_sold,
      total_sales_value,
      total_collection,
      sales_per_km,
      collection_per_km
    )
    values (
      current_date,
      ${activity.userId},
      ${activity.completedVisits},
      ${activity.productiveVisits},
      ${activity.km},
      ${activity.litres},
      ${activity.salesValue},
      ${activity.collection},
      ${activity.salesValue / activity.km},
      ${activity.collection / activity.km}
    )
    on conflict (metric_date, executive_id)
    do update set
      completed_visits = excluded.completed_visits,
      productive_visits = excluded.productive_visits,
      total_km_travelled = excluded.total_km_travelled,
      total_litres_sold = excluded.total_litres_sold,
      total_sales_value = excluded.total_sales_value,
      total_collection = excluded.total_collection,
      sales_per_km = excluded.sales_per_km,
      collection_per_km = excluded.collection_per_km
  `;

  await db`
    insert into gps_tracking_sessions (
      user_id,
      session_date,
      started_at,
      ended_at,
      gps_enabled,
      total_distance_km,
      status
    )
    select
      ${activity.userId},
      current_date,
      now() - interval '4 hours',
      case when ${activity.gpsStatus} = 'active' then null else now() end,
      true,
      ${activity.km},
      ${activity.gpsStatus}
    where not exists (
      select 1
      from gps_tracking_sessions
      where user_id = ${activity.userId}
        and session_date = current_date
        and status = ${activity.gpsStatus}
    )
  `;

  await db`
    insert into visits (
      visit_code,
      visit_date,
      executive_id,
      customer_id,
      planned_or_unplanned,
      check_in_time,
      check_out_time,
      visit_duration_minutes,
      gps_validated,
      order_taken,
      order_value,
      order_litres,
      collection_done,
      collection_amount,
      productive_visit
    )
    values (
      ${activity.visitCode},
      current_date,
      ${activity.userId},
      ${activity.customerId},
      'planned',
      now() - interval '2 hours',
      now() - interval '90 minutes',
      30,
      true,
      true,
      ${activity.salesValue},
      ${activity.litres},
      true,
      ${activity.collection},
      true
    )
    on conflict (visit_code) do update
      set order_value = excluded.order_value,
          order_litres = excluded.order_litres,
          collection_amount = excluded.collection_amount,
          productive_visit = excluded.productive_visit,
          updated_at = now()
  `;

  await db`
    insert into orders (
      order_code,
      order_date,
      customer_id,
      sales_executive_id,
      expected_invoice_value,
      total_litres,
      order_status,
      approval_status,
      remarks
    )
    values (
      ${activity.orderCode},
      current_date,
      ${activity.customerId},
      ${activity.userId},
      ${activity.salesValue},
      ${activity.litres},
      'submitted',
      'pending',
      'Seeded dashboard demo order'
    )
    on conflict (order_code) do update
      set expected_invoice_value = excluded.expected_invoice_value,
          total_litres = excluded.total_litres,
          updated_at = now()
  `;

  const [invoice] = await db`
    insert into invoices (
      invoice_number,
      invoice_date,
      customer_id,
      sales_executive_id,
      invoice_net_value,
      total_litres,
      due_date,
      outstanding_amount,
      invoice_age_days,
      ageing_bucket,
      payment_status,
      invoice_source,
      approval_status,
      created_by
    )
    values (
      ${activity.invoiceNumber},
      current_date - ${activity.invoiceAgeDays}::int,
      ${activity.customerId},
      ${activity.userId},
      ${activity.salesValue},
      ${activity.litres},
      current_date - 1,
      ${activity.outstanding},
      ${activity.invoiceAgeDays},
      ${activity.ageingBucket},
      'unpaid',
      'seed',
      'approved',
      ${activity.userId}
    )
    on conflict (invoice_number) do update
      set invoice_net_value = excluded.invoice_net_value,
          total_litres = excluded.total_litres,
          outstanding_amount = excluded.outstanding_amount,
          invoice_age_days = excluded.invoice_age_days,
          ageing_bucket = excluded.ageing_bucket,
          updated_at = now()
    returning id
  `;

  await db`
    insert into collections (
      collection_code,
      collection_date,
      customer_id,
      collected_by_user_id,
      payment_mode,
      payment_reference_number,
      collection_amount,
      matched_status,
      accountant_approval_status,
      incentive_eligible,
      remarks,
      created_by
    )
    values (
      ${activity.collectionCode},
      current_date,
      ${activity.customerId},
      ${activity.userId},
      'upi',
      ${`${activity.collectionCode}-REF`},
      ${activity.collection},
      'unmatched',
      ${activity.pendingCollection ? "pending" : "approved"},
      ${!activity.pendingCollection},
      'Seeded dashboard demo collection',
      ${activity.userId}
    )
    on conflict (collection_code) do update
      set collection_amount = excluded.collection_amount,
          accountant_approval_status = excluded.accountant_approval_status,
          incentive_eligible = excluded.incentive_eligible,
          updated_at = now()
  `;

  await db`
    insert into aging_snapshots (
      snapshot_date,
      customer_id,
      invoice_id,
      outstanding_amount,
      invoice_age_days,
      ageing_bucket
    )
    values (
      current_date,
      ${activity.customerId},
      ${invoice.id},
      ${activity.outstanding},
      ${activity.invoiceAgeDays},
      ${activity.ageingBucket}
    )
    on conflict (snapshot_date, invoice_id) do update
      set outstanding_amount = excluded.outstanding_amount,
          invoice_age_days = excluded.invoice_age_days,
          ageing_bucket = excluded.ageing_bucket
  `;
}

function requiredUser(users: Map<string, string>, loginId: string): string {
  const userId = users.get(loginId);

  if (!userId) {
    throw new Error(`Missing seeded user: ${loginId}`);
  }

  return userId;
}

function requiredRole(roles: Map<RoleCode, string>, role: RoleCode): string {
  const roleId = roles.get(role);

  if (!roleId) {
    throw new Error(`Missing seeded role: ${role}`);
  }

  return roleId;
}
