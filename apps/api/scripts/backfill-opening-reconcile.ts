/**
 * One-off backfill: re-reconcile every customer that currently has an opening
 * balance so their verified collections re-apply oldest-first WITH the opening
 * included (opening = oldest debt, paid first). Idempotent — safe to re-run.
 *
 *   DATABASE_URL="$(grep ^DATABASE_URL apps/api/.dev.vars | sed 's/^DATABASE_URL=//' | tr -d '"')" \
 *     npx tsx apps/api/scripts/backfill-opening-reconcile.ts
 */
import { neon } from "@neondatabase/serverless";
import type { SqlClient } from "../src/lib/db";
import { reReconcileCustomer } from "../src/services/collections";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url) as unknown as SqlClient;

  const [admin] = (await sql`
    select u.id
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SUPER_ADMIN' and u.status = 'active'
    limit 1
  `) as { id: string }[];
  if (!admin) throw new Error("No active SUPER_ADMIN user found for allocated_by.");

  const customers = (await sql`
    select customer_id as "customerId" from customer_opening_balances order by customer_id
  `) as { customerId: string }[];

  console.log(`Re-reconciling ${customers.length} customer(s) with an opening balance…`);
  for (const c of customers) {
    await reReconcileCustomer(sql, { userId: admin.id }, c.customerId);
    console.log(`  ✓ ${c.customerId}`);
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
