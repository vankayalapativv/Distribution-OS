import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

// End-to-end coverage of the LOGISTICS delivery-run lifecycle
// (start → stops → photos → end → resume), driven through the real Hono app
// with a stateful in-memory DB so the flow behaves like production: server ids
// are minted on create, ownership is enforced, and reads reflect prior writes.

const LOGISTICS_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_LOGISTICS_ID = "00000000-0000-4000-8000-000000000102";
const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";
const UNKNOWN_CUSTOMER_ID = "00000000-0000-4000-8000-000000000599";
const UNKNOWN_RUN_ID = "00000000-0000-4000-8000-000000000f99";

const ROLE_BY_SUBJECT: Record<string, string> = {
  "neon-logistics": "LOGISTICS",
  "neon-logistics-2": "LOGISTICS",
  "neon-super-admin": "SUPER_ADMIN",
  "neon-se": "SALES_EXECUTIVE",
};
const USERID_BY_SUBJECT: Record<string, string> = {
  "neon-logistics": LOGISTICS_ID,
  "neon-logistics-2": OTHER_LOGISTICS_ID,
  "neon-super-admin": SUPER_ADMIN_ID,
  "neon-se": SE_ID,
};

const PHOTO_KINDS = new Set(["start_odometer", "end_odometer", "delivery"]);

interface RunRow {
  id: string;
  logisticsUserId: string;
  // Neon returns `date` columns as JS Date objects (see the service's str()
  // helper) — model that faithfully so the Date-handling path is exercised.
  runDate: string | Date;
  vehicleNumber: string;
  startOdometer: number | null;
  endOdometer: number | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  clientUuid: string | null;
}
interface StopRow {
  id: string;
  runId: string;
  customerId: string;
  clientUuid: string | null;
  createdAt: string;
}

// Mutable per-test state (module-level so the hoisted vi.mock factory sees it).
const queryLog: string[] = [];
let runs: RunRow[] = [];
let stops: StopRow[] = [];
const photoCountByStop = new Map<string, number>();
let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  const n = String(idSeq).padStart(12, "0");
  return `00000000-0000-4000-8000-${prefix}${n.slice(prefix.length)}`;
}

function runView(r: RunRow) {
  return { ...r };
}

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    // ── auth ────────────────────────────────────────────────────────────────
    if (query.includes("auth_app_profile")) {
      const subject = values[0] as string;
      const role = ROLE_BY_SUBJECT[subject];
      if (!role) return [];
      return [{ role, userId: USERID_BY_SUBJECT[subject] , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
    }

    // ── start-run idempotency + resume ────────────────────────────────────────
    if (query.includes("get_run_by_client_uuid")) {
      const uuid = values[0];
      const found = runs.find((r) => r.clientUuid === uuid);
      return found ? [runView(found)] : [];
    }
    if (query.includes("get_active_run_today")) {
      const userId = values[0];
      const found = runs.find((r) => r.logisticsUserId === userId && r.status === "active");
      return found ? [runView(found)] : [];
    }
    if (query.includes("create_delivery_run")) {
      const [userId, vehicleNumber, startOdometer, clientUuid] = values as [
        string,
        string,
        number | null,
        string | null,
      ];
      const row: RunRow = {
        id: nextId("aaaa"),
        logisticsUserId: userId,
        runDate: new Date("2026-07-15T00:00:00.000Z"),
        vehicleNumber,
        startOdometer: startOdometer ?? null,
        endOdometer: null,
        status: "active",
        startedAt: "2026-07-15T04:30:00.000Z",
        endedAt: null,
        clientUuid: clientUuid ?? null,
      };
      runs.push(row);
      return [runView(row)];
    }

    // ── ownership / load ──────────────────────────────────────────────────────
    if (query.includes("get_run_for_owner")) {
      const runId = values[0];
      const found = runs.find((r) => r.id === runId);
      return found ? [runView(found)] : [];
    }
    if (query.includes("end_delivery_run")) {
      const [endOdometer, runId] = values as [number | null, string];
      const found = runs.find((r) => r.id === runId);
      if (!found) return [];
      found.status = "ended";
      found.endOdometer = endOdometer ?? null;
      found.endedAt = "2026-07-15T09:00:00.000Z";
      return [runView(found)];
    }

    // ── stops ─────────────────────────────────────────────────────────────────
    if (query.includes("get_stop_by_client_uuid")) {
      const uuid = values[0];
      const found = stops.find((s) => s.clientUuid === uuid);
      return found
        ? [{ id: found.id, runId: found.runId, customerId: found.customerId, createdAt: found.createdAt }]
        : [];
    }
    if (query.includes("check_stop_customer")) {
      return values.includes(CUSTOMER_ID) ? [{ id: CUSTOMER_ID }] : [];
    }
    if (query.includes("create_delivery_stop")) {
      const [runId, customerId, , , clientUuid] = values as [
        string,
        string,
        number | null,
        number | null,
        string | null,
      ];
      const row: StopRow = {
        id: nextId("bbbb"),
        runId,
        customerId,
        clientUuid: clientUuid ?? null,
        createdAt: "2026-07-15T06:00:00.000Z",
      };
      stops.push(row);
      return [{ id: row.id, runId: row.runId, customerId: row.customerId, createdAt: row.createdAt }];
    }

    // ── photos ────────────────────────────────────────────────────────────────
    if (query.includes("create_delivery_photo")) {
      // Binds: [runId, <stopId fragment>, kind, fileKey, contentType, size, userId].
      // The stopId is a nested sql`` fragment (not a plain bind), so a delivery
      // photo is attributed to the run's most-recent stop, matching the real
      // per-stop photo-count subquery in list_run_stops.
      const runId = values[0];
      const kind = (values.find((v) => typeof v === "string" && PHOTO_KINDS.has(v)) as string) ?? "delivery";
      if (kind === "delivery") {
        const runStops = stops.filter((s) => s.runId === runId);
        const target = runStops[runStops.length - 1];
        if (target) photoCountByStop.set(target.id, (photoCountByStop.get(target.id) ?? 0) + 1);
      }
      return [
        { id: nextId("cccc"), kind, contentType: "image/jpeg", createdAt: "2026-07-15T06:01:00.000Z" },
      ];
    }

    // ── active-run resume view ────────────────────────────────────────────────
    if (query.includes("get_active_run")) {
      const userId = values[0];
      const found = runs.find((r) => r.logisticsUserId === userId && r.status === "active");
      return found ? [runView(found)] : [];
    }
    if (query.includes("list_run_stops")) {
      const runId = values[0];
      return stops
        .filter((s) => s.runId === runId)
        .map((s) => ({
          id: s.id,
          customerId: s.customerId,
          customerName: s.customerId === CUSTOMER_ID ? "E2E Test Motors" : null,
          createdAt: s.createdAt,
          photoCount: photoCountByStop.get(s.id) ?? 0,
        }));
    }

    return [];
  },
}));

// ── R2 mock ──────────────────────────────────────────────────────────────────
const r2Store = new Map<string, ArrayBuffer>();
const PHOTOS = {
  put: vi.fn(async (key: string, value: ArrayBuffer) => {
    r2Store.set(key, value);
    return {};
  }),
  get: vi.fn(async (key: string) => {
    const body = r2Store.get(key);
    return body ? { body: new Blob([body]).stream(), httpMetadata: {} } : null;
  }),
  delete: vi.fn(async (key: string) => {
    r2Store.delete(key);
  }),
};

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  PHOTOS,
  ...authTestEnv,
};

function jpeg(name = "odo.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type: "image/jpeg" });
}
function jsonHeaders(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("deliveries routes (logistics)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
    queryLog.length = 0;
    runs = [];
    stops = [];
    photoCountByStop.clear();
    idSeq = 0;
    r2Store.clear();
    PHOTOS.put.mockClear();
    PHOTOS.get.mockClear();
    PHOTOS.delete.mockClear();
  });

  // ── Auth / roles ─────────────────────────────────────────────────────────────
  describe("access control", () => {
    test("unauthenticated → 401", async () => {
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/deliveries/runs/active", {}, env);
      expect(res.status).toBe(401);
    });

    test("LOGISTICS can access", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/deliveries/runs/active",
        { headers: authHeaders("neon-logistics") },
        env,
      );
      expect(res.status).toBe(200);
    });

    test("SUPER_ADMIN can access", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/deliveries/runs/active",
        { headers: authHeaders("neon-super-admin") },
        env,
      );
      expect(res.status).toBe(200);
    });

    test("SALES_EXECUTIVE is forbidden → 403", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/deliveries/runs/active",
        { headers: authHeaders("neon-se") },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Full lifecycle ───────────────────────────────────────────────────────────
  test("full run lifecycle: start → stop → photos → end → resume view", async () => {
    const { default: app } = await import("../index");

    // 0. no active run yet
    let res = await app.request(
      "/api/v1/deliveries/runs/active",
      { headers: authHeaders("neon-logistics") },
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ activeRun: null, stops: [] });

    // 1. start the run
    res = await app.request(
      "/api/v1/deliveries/runs/start",
      {
        method: "POST",
        headers: jsonHeaders("neon-logistics"),
        body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 50000, clientUuid: "run-uuid-1" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const run = (await res.json()).data;
    expect(run).toMatchObject({
      vehicleNumber: "TS09AB1234",
      startOdometer: 50000,
      status: "active",
      existing: false,
    });
    const runId: string = run.id;

    // 2. start-odometer photo
    let form = new FormData();
    form.append("photo", jpeg("start.jpg"));
    form.append("kind", "start_odometer");
    res = await app.request(
      `/api/v1/deliveries/runs/${runId}/photos`,
      { method: "POST", headers: authHeaders("neon-logistics"), body: form },
      env,
    );
    expect(res.status).toBe(201);
    expect((await res.json()).data.kind).toBe("start_odometer");
    expect(PHOTOS.put).toHaveBeenCalledTimes(1);

    // 3. add a delivery stop
    res = await app.request(
      `/api/v1/deliveries/runs/${runId}/stops`,
      {
        method: "POST",
        headers: jsonHeaders("neon-logistics"),
        body: JSON.stringify({ customerId: CUSTOMER_ID, latitude: 17.2, longitude: 80.1, clientUuid: "stop-uuid-1" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const stop = (await res.json()).data;
    expect(stop).toMatchObject({ customerId: CUSTOMER_ID, runId, existing: false });
    const stopId: string = stop.id;

    // 4. delivery proof photo tied to the stop
    form = new FormData();
    form.append("photo", jpeg("proof.jpg"));
    form.append("kind", "delivery");
    form.append("stopId", stopId);
    res = await app.request(
      `/api/v1/deliveries/runs/${runId}/photos`,
      { method: "POST", headers: authHeaders("neon-logistics"), body: form },
      env,
    );
    expect(res.status).toBe(201);
    expect(PHOTOS.put).toHaveBeenCalledTimes(2);

    // 5. resume view reflects the run + stop + photo count
    res = await app.request(
      "/api/v1/deliveries/runs/active",
      { headers: authHeaders("neon-logistics") },
      env,
    );
    const active = (await res.json()).data;
    expect(active.activeRun).toMatchObject({ id: runId, vehicleNumber: "TS09AB1234" });
    expect(active.stops).toHaveLength(1);
    expect(active.stops[0]).toMatchObject({ customerName: "E2E Test Motors", photoCount: 1 });

    // 6. end-odometer photo + end the run
    form = new FormData();
    form.append("photo", jpeg("end.jpg"));
    form.append("kind", "end_odometer");
    res = await app.request(
      `/api/v1/deliveries/runs/${runId}/photos`,
      { method: "POST", headers: authHeaders("neon-logistics"), body: form },
      env,
    );
    expect(res.status).toBe(201);

    res = await app.request(
      `/api/v1/deliveries/runs/${runId}/end`,
      { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({ endOdometer: 50075 }) },
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ status: "ended", endOdometer: 50075, startOdometer: 50000 });

    // 7. run is no longer active
    res = await app.request(
      "/api/v1/deliveries/runs/active",
      { headers: authHeaders("neon-logistics") },
      env,
    );
    expect((await res.json()).data.activeRun).toBeNull();
  });

  // ── Idempotency (offline retry safety) ───────────────────────────────────────
  describe("idempotency", () => {
    test("replaying start with the same clientUuid returns the existing run (200)", async () => {
      const { default: app } = await import("../index");
      const body = JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 50000, clientUuid: "run-uuid-1" });

      const first = await app.request(
        "/api/v1/deliveries/runs/start",
        { method: "POST", headers: jsonHeaders("neon-logistics"), body },
        env,
      );
      expect(first.status).toBe(201);
      const firstId = (await first.json()).data.id;

      const replay = await app.request(
        "/api/v1/deliveries/runs/start",
        { method: "POST", headers: jsonHeaders("neon-logistics"), body },
        env,
      );
      expect(replay.status).toBe(200);
      const replayed = (await replay.json()).data;
      expect(replayed).toMatchObject({ id: firstId, existing: true });
      expect(runs).toHaveLength(1); // no duplicate created
    });

    test("replaying a stop with the same clientUuid returns the existing stop (200)", async () => {
      const { default: app } = await import("../index");
      const start = await app.request(
        "/api/v1/deliveries/runs/start",
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 1, clientUuid: "run-x" }),
        },
        env,
      );
      const runId = (await start.json()).data.id;
      const stopBody = JSON.stringify({ customerId: CUSTOMER_ID, clientUuid: "stop-x" });

      const first = await app.request(
        `/api/v1/deliveries/runs/${runId}/stops`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: stopBody },
        env,
      );
      expect(first.status).toBe(201);

      const replay = await app.request(
        `/api/v1/deliveries/runs/${runId}/stops`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: stopBody },
        env,
      );
      expect(replay.status).toBe(200);
      expect((await replay.json()).data.existing).toBe(true);
      expect(stops).toHaveLength(1);
    });

    test("ending an already-ended run is idempotent", async () => {
      const { default: app } = await import("../index");
      const start = await app.request(
        "/api/v1/deliveries/runs/start",
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 100, clientUuid: "run-e" }),
        },
        env,
      );
      const runId = (await start.json()).data.id;
      const endBody = JSON.stringify({ endOdometer: 200 });

      const first = await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: endBody },
        env,
      );
      expect(first.status).toBe(200);

      const second = await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: endBody },
        env,
      );
      expect(second.status).toBe(200);
      expect((await second.json()).data.status).toBe("ended");
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────────
  describe("validation", () => {
    async function startRun(subject = "neon-logistics", clientUuid = "run-v") {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/deliveries/runs/start",
        {
          method: "POST",
          headers: jsonHeaders(subject),
          body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 50000, clientUuid }),
        },
        env,
      );
      return { app, runId: (await res.json()).data.id as string };
    }

    test("start without vehicleNumber → 422", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/deliveries/runs/start",
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({ startOdometer: 1 }) },
        env,
      );
      expect(res.status).toBe(422);
    });

    test("end with end odometer < start → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-lt");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({ endOdometer: 49000 }) },
        env,
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error?.message ?? JSON.stringify(body)).toMatch(/at least the start/i);
    });

    test("stop with an unknown customer → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-badcust");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/stops`,
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ customerId: UNKNOWN_CUSTOMER_ID, clientUuid: "stop-bad" }),
        },
        env,
      );
      expect(res.status).toBe(422);
    });

    test("photo with an invalid kind → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-badkind");
      const form = new FormData();
      form.append("photo", jpeg());
      form.append("kind", "selfie");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        env,
      );
      expect(res.status).toBe(422);
      expect(PHOTOS.put).not.toHaveBeenCalled();
    });

    test("photo with a non-image file → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-txt");
      const form = new FormData();
      form.append("photo", new File([new Uint8Array([1, 2, 3])], "note.txt", { type: "text/plain" }));
      form.append("kind", "delivery");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        env,
      );
      expect(res.status).toBe(422);
    });

    test("photo upload with no file → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-nofile");
      const form = new FormData();
      form.append("kind", "delivery");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        env,
      );
      expect(res.status).toBe(422);
    });

    test("empty (0-byte) photo file → 422", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-empty");
      const form = new FormData();
      form.append("photo", new File([], "empty.jpg", { type: "image/jpeg" }));
      form.append("kind", "delivery");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        env,
      );
      expect(res.status).toBe(422);
      expect(PHOTOS.put).not.toHaveBeenCalled();
    });

    test("photo with no kind field defaults to 'delivery' → 201", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-defkind");
      const form = new FormData();
      form.append("photo", jpeg()); // no kind field
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        env,
      );
      expect(res.status).toBe(201);
      expect((await res.json()).data.kind).toBe("delivery");
    });

    test("photos route returns 500 when the R2 bucket is not configured", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-nobucket");
      const envNoBucket = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };
      const form = new FormData();
      form.append("photo", jpeg());
      form.append("kind", "delivery");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/photos`,
        { method: "POST", headers: authHeaders("neon-logistics"), body: form },
        envNoBucket,
      );
      expect(res.status).toBe(500);
    });

    test("ending with no endOdometer skips the min-distance check → 200", async () => {
      const { app, runId } = await startRun("neon-logistics", "run-noodo");
      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({}) },
        env,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data).toMatchObject({ status: "ended", endOdometer: null });
    });
  });

  // ── Ownership / not-found ────────────────────────────────────────────────────
  describe("ownership", () => {
    test("ending an unknown run → 404", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        `/api/v1/deliveries/runs/${UNKNOWN_RUN_ID}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({ endOdometer: 1 }) },
        env,
      );
      expect(res.status).toBe(404);
    });

    test("another logistics user cannot end someone else's run → 404", async () => {
      const { default: app } = await import("../index");
      const start = await app.request(
        "/api/v1/deliveries/runs/start",
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 1, clientUuid: "run-own" }),
        },
        env,
      );
      const runId = (await start.json()).data.id;

      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics-2"), body: JSON.stringify({ endOdometer: 2 }) },
        env,
      );
      expect(res.status).toBe(404);
    });

    test("adding a stop to an already-ended run → 409", async () => {
      const { default: app } = await import("../index");
      const start = await app.request(
        "/api/v1/deliveries/runs/start",
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ vehicleNumber: "TS09AB1234", startOdometer: 10, clientUuid: "run-ended" }),
        },
        env,
      );
      const runId = (await start.json()).data.id;
      await app.request(
        `/api/v1/deliveries/runs/${runId}/end`,
        { method: "POST", headers: jsonHeaders("neon-logistics"), body: JSON.stringify({ endOdometer: 20 }) },
        env,
      );

      const res = await app.request(
        `/api/v1/deliveries/runs/${runId}/stops`,
        {
          method: "POST",
          headers: jsonHeaders("neon-logistics"),
          body: JSON.stringify({ customerId: CUSTOMER_ID, clientUuid: "stop-late" }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });
  });
});
