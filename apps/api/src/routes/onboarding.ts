import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireNeonIdentity } from "../lib/authz";
import { getOwnerSqlClient } from "../lib/db";
import { readJsonObject, optionalNumber } from "../lib/request-body";
import {
  bootstrapAccount,
  getDraft,
  getOnboardingState,
  requireOnboardingUser,
  saveDraft,
  submitOnboarding,
  type OnboardingPayload,
} from "../services/onboarding";
import type { ApiEnv } from "../types";

/**
 * Self-serve onboarding — used by a signed-in user who has NO enterprise yet, so
 * every handler runs on the OWNER client (getOwnerSqlClient) and scopes by the
 * user's id. Mounted outside the billing gate.
 */
export const onboardingRoutes = new Hono<ApiEnv>()
  // Current onboarding status (no_account / draft / pending / active / rejected).
  .get("/me", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    return c.json(success(c, await getOnboardingState(sql, externalUserId)));
  })
  // Bootstrap the app users row for a verified Neon identity (idempotent).
  .post("/account", async (c) => {
    const { externalUserId, email } = requireNeonIdentity(c);
    const body = await readJsonObject(c);
    const name = typeof body.name === "string" ? body.name : null;
    const phone = typeof body.phone === "string" ? body.phone : null;
    const sql = getOwnerSqlClient(c);
    const { userId } = await bootstrapAccount(sql, { externalUserId, email, name, phone });
    return c.json(success(c, { userId }));
  })
  // Resume the saved wizard draft.
  .get("/draft", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const userId = await requireOnboardingUser(sql, externalUserId);
    return c.json(success(c, { draft: await getDraft(sql, userId) }));
  })
  // Autosave the wizard draft.
  .put("/draft", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const body = await readJsonObject(c);
    const sql = getOwnerSqlClient(c);
    const userId = await requireOnboardingUser(sql, externalUserId);
    const currentStep = optionalNumber(body, "currentStep") ?? 0;
    await saveDraft(sql, userId, body.payload ?? {}, currentStep);
    return c.json(success(c, { saved: true }));
  })
  // Submit → create the pending enterprise + config + make the user SUPER_ADMIN.
  .post("/submit", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const body = await readJsonObject(c);
    const sql = getOwnerSqlClient(c);
    const userId = await requireOnboardingUser(sql, externalUserId);
    const result = await submitOnboarding(sql, userId, body.payload as OnboardingPayload);
    return c.json(success(c, result), 201);
  });
