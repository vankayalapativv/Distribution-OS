import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { sectionGuard } from "./lib/authz";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { apiInfo } from "./lib/api-response";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { attachAuthContext } from "./middleware/auth";
import { attachRequestContext } from "./middleware/request-context";
import { billingGate } from "./middleware/billing-gate";
import { rateLimit } from "./middleware/rate-limit";
import { runBillingMaintenance } from "./services/billing-maintenance";
import { billingV2Routes } from "./routes/billing-v2";
import { onboardingRoutes } from "./routes/onboarding";
import { platformAdminRoutes } from "./routes/platform-admin";
import { razorpayWebhookRoutes } from "./routes/razorpay-webhook";
import { publicStatementRoutes } from "./routes/public-statement";
import { authRoutes } from "./routes/auth";
import { alertsRoutes } from "./routes/alerts";
import { auditLogRoutes } from "./routes/audit-logs";
import { beatsRoutes } from "./routes/beats";
import { beatPlanRoutes } from "./routes/beat-plans";
import { collectionsRoutes } from "./routes/collections";
import { customersRoutes } from "./routes/customers";
import { deliveriesRoutes } from "./routes/deliveries";
import { logisticsRoutes } from "./routes/logistics";
import { customerPhotosRoutes, photoFileRoutes } from "./routes/photos";
import { customerNotesRoutes } from "./routes/customer-notes";
import { tasksRoutes, taskFilesRoutes } from "./routes/tasks";
import { attendanceRoutes } from "./routes/attendance";
import { trackingRoutes } from "./routes/tracking";
import { trackingSessionsRoutes } from "./routes/tracking-sessions";
import { marketIntelligenceRoutes } from "./routes/market-intelligence";
import { brandsRoutes } from "./routes/brands";
import { targetsRoutes } from "./routes/targets";
import { incentivesRoutes } from "./routes/incentives";
import { leaderboardRoutes } from "./routes/leaderboard";
import { reportsRoutes } from "./routes/reports";
import { invoiceFilesRoutes, invoicesRoutes } from "./routes/invoices";
import { stockRoutes } from "./routes/stock";
import { salesReturnsRoutes } from "./routes/sales-returns";
import { duesRoutes } from "./routes/dues";
import { followupsRoutes } from "./routes/followups";
import { expendituresRoutes } from "./routes/expenditures";
import { geocodeRoutes } from "./routes/geocode";
import { ordersRoutes } from "./routes/orders";
import { productsRoutes } from "./routes/products";
import { marginRoutes } from "./routes/margin";
import { dashboardRoutes } from "./routes/dashboard";
import { healthRoutes } from "./routes/health";
import { statusRoutes } from "./routes/status";
import { meRoutes } from "./routes/me";
import { superAdminRoutes } from "./routes/super-admin";
import { systemSettingsRoutes } from "./routes/system-settings";
import { mcpRoutes } from "./routes/mcp";
import { visitsRoutes } from "./routes/visits";
import { webPushRoutes } from "./routes/web-push";
import { errorsRoutes } from "./routes/errors";
import { permissionsRoutes } from "./routes/permissions";
import { cleanupOldErrors } from "./services/errors";
import { capExpiredSeSessions, runTrackingMaintenance } from "./services/tracking-maintenance";
import { autoCloseStaleVisits } from "./services/visits";
import { markMissedBeatStops } from "./services/beat-missed";
import { runLocationNag } from "./services/location-nag";
import { runDuesMaintenance } from "./services/dues";
import { runFollowupReminders } from "./services/followups";
import { cleanupOldNotifications, sendExpoPush } from "./services/invoices";
import { inStatusWindow, runHealthMonitor } from "./services/health-monitor";
import type { ApiEnv } from "./types";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";

const app = new Hono<ApiEnv>();
const v1 = new Hono<ApiEnv>();

app.use("*", secureHeaders());
app.use("*", timing());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // Expo web dev server (mobile app preview)
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      // Deployed web dashboard (client-side browser calls)
      "https://distribution-os-web.vardhansystems.workers.dev",
      // Custom domain for the Distribution OS web dashboard
      "https://distributionos.vardhansystems.in",
    ],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-Id", "X-Response-Time"],
  }),
);
app.use("*", attachRequestContext);
app.use("*", attachAuthContext);

app.get("/", (c) => c.json(apiInfo(c)));

// Razorpay webhook + billing routes — mounted before the billing gate and
// outside it (webhook verifies its own HMAC; billing must stay reachable so a
// blocked admin can still pay).
v1.route("/webhooks", razorpayWebhookRoutes);
v1.route("/billing", billingV2Routes);

// Public, no-login customer account-statement — mounted BEFORE the billing gate
// and section guards so it is genuinely auth-free. The route itself calls no
// requireAuth/requireRole; the opaque per-customer token is the only gate.
// Per-IP rate limit (native Workers binding) blunts enumeration/scraping of the
// opaque statement tokens; a no-op when the binding is absent (dev/tests).
v1.use("/public/*", rateLimit("RL_PUBLIC", "public"));
v1.route("/public", publicStatementRoutes);

// Mobile auth proxy (/auth/login, /auth/token, /auth/sign-out) — mounted BEFORE
// the billing gate + section guards so sign-in is genuinely auth-free and stays
// reachable for a lapsed account. The device talks to this (reliable Cloudflare)
// host instead of resolving the Neon Auth host directly on weak 4G.
// Per-IP rate limit on sign-in blunts credential-stuffing / brute force.
v1.use("/auth/login", rateLimit("RL_LOGIN", "login"));
v1.route("/auth", authRoutes);

// Self-serve onboarding — used by a signed-in user who has NO enterprise yet, so
// it is mounted BEFORE the billing gate + section guards (a pending/absent
// enterprise must not be billing-gated). Runs on the owner client internally.
// Per-IP rate limit on the two write endpoints (account creation + submit);
// the frequent draft autosave (PUT /draft) is deliberately left unthrottled.
v1.use("/onboarding/account", rateLimit("RL_ONBOARD", "onboard"));
v1.use("/onboarding/submit", rateLimit("RL_ONBOARD", "onboard"));
v1.route("/onboarding", onboardingRoutes);

// Platform-owner cockpit (approve/reject enterprises, pricing). Owner-only, runs
// on the owner client across enterprises; mounted before the billing gate.
v1.route("/platform", platformAdminRoutes);

// Server-side billing enforcement (402) for lapsed subscriptions. No-op unless
// BILLING_ENFORCED === "true"; exempts webhook/billing/health/status and the
// identity reads under /me (not the /me data routes — see billing-gate.ts).
v1.use("*", billingGate);

v1.route("/", healthRoutes);
v1.route("/", statusRoutes);
v1.route("/", meRoutes);

// Configurable section access (migration 0073): block a whole nav area for a
// MANAGER / ACCOUNTANT whose section permission is off. Registered before the
// mounts below so it wraps them; only ever denies the two configurable roles
// (SUPER_ADMIN / SALES_EXECUTIVE / LOGISTICS pass through). Paths are chosen to
// match only the web section, never the mobile-only routes (e.g. /tracking/* not
// /tracking-sessions/*, /beat-plans/* not /beats/*).
v1.use("/customers/*", sectionGuard("customers"));
v1.use("/orders/*", sectionGuard("orders"));
v1.use("/products/*", sectionGuard("products"));
v1.use("/invoices/*", sectionGuard("invoices"));
v1.use("/invoice-files/*", sectionGuard("invoices"));
v1.use("/stock/*", sectionGuard("stock"));
v1.use("/collections/*", sectionGuard("collections"));
v1.use("/alerts/*", sectionGuard("alerts"));
v1.use("/tasks/*", sectionGuard("tasks"));
v1.use("/task-files/*", sectionGuard("tasks"));
v1.use("/tracking/*", sectionGuard("tracking"));
v1.use("/attendance/*", sectionGuard("attendance"));
v1.use("/logistics/*", sectionGuard("logistics"));
v1.use("/market-intelligence/*", sectionGuard("market-intelligence"));
v1.use("/reports/*", sectionGuard("reports"));
v1.use("/targets/*", sectionGuard("targets"));
v1.use("/beat-plans/*", sectionGuard("beat-plans"));
v1.use("/expenditures/*", sectionGuard("expenditures"));
v1.use("/incentives/*", sectionGuard("incentives"));
v1.route("/dashboard", dashboardRoutes);
v1.route("/super-admin", superAdminRoutes);
v1.route("/audit-logs", auditLogRoutes);
v1.route("/customers", customerPhotosRoutes); // photo routes first: /:id/photos
v1.route("/customers", customerNotesRoutes); // notes routes: /:id/notes
v1.route("/customers", customersRoutes);
v1.route("/photos", photoFileRoutes);
v1.route("/deliveries", deliveriesRoutes);
v1.route("/logistics", logisticsRoutes);
v1.route("/tasks", tasksRoutes);
v1.route("/task-files", taskFilesRoutes);
v1.route("/attendance", attendanceRoutes);
v1.route("/tracking", trackingRoutes);
v1.route("/tracking-sessions", trackingSessionsRoutes);
v1.route("/market-intelligence", marketIntelligenceRoutes);
v1.route("/orders", ordersRoutes);
v1.route("/products", productsRoutes);
v1.route("/margin-simulations", marginRoutes);
v1.route("/brands", brandsRoutes);
v1.route("/targets", targetsRoutes);
v1.route("/incentives", incentivesRoutes);
v1.route("/leaderboard", leaderboardRoutes);
v1.route("/reports", reportsRoutes);
v1.route("/invoices", invoicesRoutes);
v1.route("/invoice-files", invoiceFilesRoutes);
v1.route("/stock", stockRoutes);
v1.route("/sales-returns", salesReturnsRoutes);
v1.route("/dues", duesRoutes);
v1.route("/followups", followupsRoutes);
v1.route("/expenditures", expendituresRoutes);
v1.route("/geocode", geocodeRoutes);
v1.route("/system-settings", systemSettingsRoutes);
v1.route("/mcp", mcpRoutes);
v1.route("/visits", visitsRoutes);
v1.route("/web-push", webPushRoutes);
v1.route("/errors", errorsRoutes);
v1.route("/permissions", permissionsRoutes);
v1.route("/alerts", alertsRoutes);
v1.route("/beats", beatsRoutes);
v1.route("/beat-plans", beatPlanRoutes);
v1.route("/collections", collectionsRoutes);

app.route("/", v1);
app.route("/api/v1", v1);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof app;

type ScheduledHonoApp = typeof app & {
  scheduled: (
    controller: ScheduledController,
    env: ApiEnv["Bindings"],
    ctx: ExecutionContext,
  ) => void | Promise<void>;
};

/**
 * The 3-minute maintenance touches the DB only during office hours — IST Mon–Sat,
 * 08:55–21:05 — so outside that window (nights + all Sunday, a full office
 * holiday) NO query is issued and Neon's compute can scale to zero. This does
 * NOT affect GPS pings (they land 24/7 via their own POST endpoints) or the SE
 * 8 PM auto-close (inside the window).
 */
function inMaintenanceWindow(nowMs = Date.now()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (part("weekday") === "Sun") return false; // Sunday: office holiday
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return minutes >= 8 * 60 + 55 && minutes <= 21 * 60 + 5; // 08:55–21:05 IST
}

(app as ScheduledHonoApp).scheduled = (_controller, env, ctx) => {
  if (!env.DATABASE_URL) return;
  const sql = neon(env.DATABASE_URL);

  // Self-hosted uptime monitor (#7): 9AM–9PM IST Mon–Sat, probe DB health and
  // email on Down/Degraded/Recovered. Runs on its own window (not the slightly
  // wider maintenance window) and BEFORE the maintenance return, so it still
  // fires when the DB is down. Dedup state lives in R2, not the DB.
  if (inStatusWindow()) {
    ctx.waitUntil(
      runHealthMonitor(env, sql)
        .then((r) => console.log("[health] monitor:", JSON.stringify(r)))
        .catch((e) => console.error("[health] monitor crashed:", e instanceof Error ? e.stack : e)),
    );
  }

  // Midnight safety cap for SE tracking sessions runs on EVERY tick — IST
  // midnight is outside the office-hours maintenance window, and a forgotten
  // "End day" must still be force-closed at the day rollover. Cheap targeted
  // UPDATE (active SE sessions whose IST day has passed); idempotent.
  ctx.waitUntil(capExpiredSeSessions(sql).then(() => undefined));

  // Skip all remaining maintenance outside office hours (nights + Sunday) so the
  // DB sleeps.
  if (!inMaintenanceWindow()) return;

  ctx.waitUntil(runTrackingMaintenance(sql));
  // Close any visit left open past its IST day (checkout pinned to that midnight,
  // NULL duration since there's no GPS fix). Idempotent.
  ctx.waitUntil(autoCloseStaleVisits(sql).then(() => undefined));
  // After 8 PM IST, flag today's unvisited beat stops as 'missed' (idempotent).
  ctx.waitUntil(markMissedBeatStops(sql).then(() => undefined));
  // Nag on-duty SEs whose app is alive but location is off (reaches a pocketed
  // phone that the in-app blocker can't). Throttled per SE; before 8 PM IST.
  ctx.waitUntil(
    runLocationNag(sql).then((result) =>
      Promise.all(
        result.pushes.map((push) =>
          sendExpoPush(push.tokens, push.title, push.body, { type: "location_off" }),
        ),
      ),
    ),
  );
  // Daily collection-dues bucket check (self-gates to once per IST day).
  ctx.waitUntil(
    runDuesMaintenance(sql).then((result) =>
      Promise.all(
        result.pushes.map((push) =>
          sendExpoPush(push.tokens, push.title, push.body, { type: "dues_bucket" }),
        ),
      ),
    ),
  );
  // Customer follow-up reminders: open follow-ups whose SE-picked date+time has
  // arrived get one push to the owning SE (notified_at guards against re-push).
  ctx.waitUntil(
    runFollowupReminders(sql).then((result) =>
      Promise.all(
        result.pushes.map((push) =>
          sendExpoPush(push.tokens, push.title, push.body, { type: "followup_due" }),
        ),
      ),
    ),
  );
  // Notification retention: delete se_notifications older than 6 days
  // (self-gates to run about once every 6 days).
  ctx.waitUntil(cleanupOldNotifications(sql).then(() => undefined));
  // Error-monitor retention: prune error events/groups older than 90 days
  // (self-gates to once per IST day).
  ctx.waitUntil(cleanupOldErrors(sql).then(() => undefined));
  // Billing v2 (multi-enterprise): for EACH active enterprise, under a scoped
  // client, ensure the current month's charge at its own price + seats, and send
  // the due/grace email reminders to its own admins. Idempotent; one enterprise
  // failing never stops the rest. Replaces the single-org charge+reminder calls.
  ctx.waitUntil(
    runBillingMaintenance(sql, env)
      .then((r) => console.log("[billing] maintenance:", JSON.stringify(r)))
      .catch((e) => console.error("[billing] maintenance crashed:", e instanceof Error ? e.stack : e)),
  );
};

export default app;
