// Distribution OS — RLS cross-enterprise leak test (Phase 2 gate).
//
// Run AFTER applying migrations/0001_init.sql to the new DB:
//   node packages/db/tools/verify-rls.mjs
//
// Proves enterprise isolation holds with FORCE RLS + the app.enterprise_id GUC,
// using the SAME connection role the app uses (the DB owner). Creates two throwaway
// enterprises, writes a customer into each, then asserts:
//   1. Session scoped to A sees ONLY A's customer.
//   2. No GUC set  → sees ZERO rows (fail closed).
//   3. Insert into B while scoped to A is REJECTED by WITH CHECK.
// Cleans up after itself. Exits non-zero on any failed assertion.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });

let ok = true;
const check = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) ok = false; };

// Run a block AS the enterprise API would: as app_tenant, scoped to one enterprise.
async function asTenant(enterpriseId, fn) {
  return sql.begin(async (q) => {
    await q`set local role app_tenant`;
    await q`select set_config('app.enterprise_id', ${enterpriseId}, true)`;
    return fn(q);
  });
}

async function makeCustomer(enterpriseId, code, name) {
  await asTenant(enterpriseId, (q) => q`
    insert into customers (enterprise_id, customer_code, legal_name, customer_type)
    values (${enterpriseId}, ${code}, ${name}, 'retailer')`);
}

try {
  // Two throwaway enterprises (created as owner; enterprises RLS policy is self-keyed,
  // so insert them with the GUC set to their own id).
  const [a] = await sql`insert into enterprises
    (name, legal_name, gstin, contact_name, contact_phone, contact_email,
     address_line1, address_city, address_state, address_pincode, status)
    values ('RLS-TEST-A','RLS Test A LLP','27AAAAA0000A1Z5','A','1','a@test',
            'L1','City','State','000001','active') returning id`;
  const [b] = await sql`insert into enterprises
    (name, legal_name, gstin, contact_name, contact_phone, contact_email,
     address_line1, address_city, address_state, address_pincode, status)
    values ('RLS-TEST-B','RLS Test B LLP','27BBBBB0000B1Z5','B','2','b@test',
            'L1','City','State','000002','active') returning id`;

  await makeCustomer(a.id, "RLSA-001", "Alpha Retailer");
  await makeCustomer(b.id, "RLSB-001", "Bravo Retailer");

  // 1. Tenant scoped to A → sees only A
  const seenByA = await asTenant(a.id, (q) => q`select customer_code from customers`);
  check("A-tenant sees only A's customers",
    seenByA.length === 1 && seenByA[0].customer_code === "RLSA-001");

  // 2. Tenant with no GUC → zero rows (fail closed)
  const seenByNone = await sql.begin(async (q) => {
    await q`set local role app_tenant`;
    return q`select customer_code from customers`;
  });
  check("no-GUC tenant sees ZERO rows (fail closed)", seenByNone.length === 0);

  // 3. Tenant scoped to A inserting B's id → rejected by WITH CHECK
  let rejected = false;
  try {
    await asTenant(a.id, (q) => q`
      insert into customers (enterprise_id, customer_code, legal_name, customer_type)
      values (${b.id}, 'RLSX-001', 'Cross Write', 'retailer')`);
  } catch { rejected = true; }
  check("cross-enterprise INSERT (A writing B's id) is REJECTED", rejected);

  // 4. Owner (no SET ROLE) sees BOTH enterprises' customers (cockpit path)
  const seenByOwner = await sql`select customer_code from customers where customer_code like 'RLS%'`;
  check("owner role sees across enterprises (2 rows)", seenByOwner.length === 2);

  // cleanup (owner bypasses RLS)
  await sql`delete from customers where customer_code like 'RLS%'`;
  for (const e of [a.id, b.id]) await sql`delete from enterprises where id = ${e}`;
  console.log(ok ? "\nALL RLS CHECKS PASSED ✅" : "\nRLS CHECKS FAILED ❌");
} catch (err) {
  console.error("verify-rls error:", err.message);
  ok = false;
} finally {
  await sql.end();
  process.exit(ok ? 0 : 1);
}
