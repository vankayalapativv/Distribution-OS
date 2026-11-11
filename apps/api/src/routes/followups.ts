import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { assertCustomerVisible } from "../services/customers-shared";
import {
  getLatestOpenFollowup,
  resolveLatestOpenForCustomer,
} from "../services/followups";
import type { ApiEnv } from "../types";

export const followupsRoutes = new Hono<ApiEnv>()
  // Latest OPEN follow-up for a customer — the mobile check-in popup + card.
  // SE (own customers) + office, via assertCustomerVisible.
  .get("/customers/:id", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    const followup = await getLatestOpenFollowup(sql, customerId);
    return c.json(success(c, { followup }));
  })

  // Mark the latest open follow-up for a customer done (SE or office). Resolve
  // BY CUSTOMER so the offline mobile client — which never learns the server id —
  // can still resolve it; there is at most one open per customer.
  .post("/customers/:id/resolve", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const customerId = c.req.param("id");
    await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    const followup = await resolveLatestOpenForCustomer(sql, { customerId, userId: auth.userId! });
    return c.json(success(c, { followup }));
  });
