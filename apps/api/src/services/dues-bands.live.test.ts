import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createScopedSqlClient } from "../lib/db";
import { bandKeyFromAge, getMyDuesSummary, loadDuesBands } from "./dues";

/**
 * Server-driven dues bands (Phase 5, live): an enterprise with CUSTOM bands must
 * have the SE dues summary bucket by THOSE bands, not the legacy fixed 4. Seeds a
 * throwaway enterprise with 3 bands (0–15 / 16–45 / 46+), runs the real scoped
 * getMyDuesSummary, and asserts its bands come back. Skipped without
 * LIVE_DATABASE_URL; cleans up.
 */
const URL = process.env.LIVE_DATABASE_URL;
const d = URL ? describe : describe.skip;

let entId = "";

d("server-driven dues bands (live)", () => {
  afterAll(async () => {
    if (!entId) return;
    const sql = neon(URL!);
    await sql`delete from dues_bands where enterprise_id = ${entId}`;
    await sql`delete from enterprises where id = ${entId}`;
  });

  it("the SE summary buckets by the enterprise's own 3 custom bands", async () => {
    const owner = neon(URL!);
    const [e] = (await owner`
      insert into enterprises (name, legal_name, gstin, contact_name, contact_phone, contact_email,
        address_line1, address_city, address_state, address_pincode, status)
      values ('Dues Bands Co', 'Dues Bands Pvt', '00CCCCC0000C0Z0', 'C', '+910000000002', 'c@x.test',
        '3 St', 'City', 'Telangana', '500003', 'active')
      returning id`) as Array<{ id: string }>;
    entId = e.id;
    await owner`
      insert into dues_bands (enterprise_id, ordinal, from_days, to_days, label) values
        (${entId}, 0, 0, 15, 'Fresh (0–15)'),
        (${entId}, 1, 16, 45, 'Watch (16–45)'),
        (${entId}, 2, 46, null, 'Overdue (46+)')`;

    const sql = createScopedSqlClient(owner, entId, null);

    // loadDuesBands reads the enterprise's own bands.
    const bands = await loadDuesBands(sql);
    expect(bands.map((b) => b.label)).toEqual(["Fresh (0–15)", "Watch (16–45)", "Overdue (46+)"]);

    // JS bucketing mirrors them.
    expect(bandKeyFromAge(10, bands)).toBe("0");
    expect(bandKeyFromAge(20, bands)).toBe("1");
    expect(bandKeyFromAge(500, bands)).toBe("2");

    // The real scoped summary query runs and returns the 3 bands (0 customers).
    const summary = await getMyDuesSummary(sql, { userId: "00000000-0000-4000-8000-000000000abc" });
    expect(summary.buckets).toHaveLength(3);
    expect(summary.buckets.map((b) => b.label)).toEqual(["Fresh (0–15)", "Watch (16–45)", "Overdue (46+)"]);
    expect(summary.buckets.every((b) => b.customers === 0)).toBe(true);
  });
});
