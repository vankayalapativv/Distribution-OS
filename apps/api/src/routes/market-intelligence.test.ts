import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const NOTE_ID = "00000000-0000-4000-8000-000000000e01";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";

const queryLog: string[] = [];
let lastValues: unknown[] = [];

const sampleNote = {
  id: NOTE_ID,
  meetingDate: "2026-07-12",
  seUserId: SE_ID,
  seName: "Test_sales",
  customerId: CUSTOMER_ID,
  customerName: "FullFields Auto Spares",
  note: "Competitor pushing synthetic oils hard in Khammam market.",
  createdBy: MANAGER_ID,
  createdByName: "Test Manager",
  createdAt: "2026-07-12T10:00:00.000Z",
};

const sampleItem = {
  id: "00000000-0000-4000-8000-000000000e11",
  noteId: NOTE_ID,
  category: "pricing",
  competitorBrand: "Castrol",
  product: "Activ 4T",
  price: "315.00",
  details: "Selling at 315 vs our 340",
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("auth_app_profile")) {
      const map: Record<string, { role: string; userId: string , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}> = {
        "neon-super-admin": { role: "SUPER_ADMIN", userId: SUPER_ADMIN_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
        "neon-manager": { role: "MANAGER", userId: MANAGER_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
        "neon-se": { role: "SALES_EXECUTIVE", userId: SE_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"},
      };
      return [map[values[0] as string] ?? map["neon-super-admin"]];
    }

    if (query.includes("list_market_notes")) {
      lastValues = values;
      return [sampleNote];
    }
    if (query.includes("list_market_note_items")) {
      return [sampleItem];
    }
    if (query.includes("create_market_note")) {
      lastValues = values;
      return [sampleNote];
    }
    if (query.includes("create_market_note_item")) {
      return [sampleItem];
    }
    if (query.includes("get_market_note")) {
      return values.includes(NOTE_ID) ? [sampleNote] : [];
    }
    if (query.includes("update_market_note")) {
      return values.includes(NOTE_ID) ? [sampleNote] : [];
    }
    if (query.includes("delete_market_note_items")) {
      return [];
    }
    if (query.includes("delete_market_note")) {
      return values.includes(NOTE_ID) ? [{ id: NOTE_ID }] : [];
    }
    if (query.includes("list_mi_photos")) {
      lastValues = values;
      return [
        {
          id: "00000000-0000-4000-8000-000000000f01",
          customerId: CUSTOMER_ID,
          customerName: "FullFields Auto Spares",
          customerCode: "CUST-0012",
          uploadedByName: "Test_sales",
          createdAt: "2026-07-11T10:00:00.000Z",
        },
      ];
    }
    return [];
    };
    // createMarketNote / updateMarketNote write the note + items in one
    // sql.transaction([...]); resolve each statement to its mocked rows.
    (sql as unknown as { transaction: (s: unknown[]) => Promise<unknown[]> }).transaction = (stmts) =>
      Promise.all(stmts as Promise<unknown>[]);
    return sql;
  },
}));

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("market intelligence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
    queryLog.length = 0;
    lastValues = [];
  });

  test("SA and Manager can list notes; SE cannot", async () => {
    const { default: app } = await import("../index");

    for (const subject of ["neon-super-admin", "neon-manager"]) {
      const res = await app.request(
        "/api/v1/market-intelligence/notes",
        { headers: headers(subject) },
        env,
      );
      expect(res.status).toBe(200);
    }
    const res = await app.request(
      "/api/v1/market-intelligence/notes",
      { headers: headers("neon-se") },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("notes list includes items and honours filters", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/market-intelligence/notes?seUserId=${SE_ID}&from=2026-07-01&to=2026-07-31`,
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(queryLog).toContain("list_market_notes");
    expect(lastValues).toContain(SE_ID);
    expect(lastValues).toContain("2026-07-01");
    expect(body.data.notes).toHaveLength(1);
    expect(body.data.notes[0].seName).toBe("Test_sales");
    expect(body.data.notes[0].items).toHaveLength(1);
    expect(body.data.notes[0].items[0].competitorBrand).toBe("Castrol");
  });

  test("create a note with items", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/market-intelligence/notes",
      {
        method: "POST",
        headers: headers("neon-manager"),
        body: JSON.stringify({
          meetingDate: "2026-07-12",
          seUserId: SE_ID,
          customerId: CUSTOMER_ID,
          note: "Competitor pushing synthetic oils hard.",
          items: [
            {
              category: "pricing",
              competitorBrand: "Castrol",
              product: "Activ 4T",
              price: 315,
              details: "Selling at 315 vs our 340",
            },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(queryLog).toContain("create_market_note");
    expect(queryLog).toContain("create_market_note_items");
    const body = await res.json();
    expect(body.data.note.id).toBe(NOTE_ID);
    expect(body.data.note.items).toHaveLength(1);
  });

  test("create without seUserId → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/market-intelligence/notes",
      {
        method: "POST",
        headers: headers("neon-manager"),
        body: JSON.stringify({ note: "no se" }),
      },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("create with a bogus item category → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/market-intelligence/notes",
      {
        method: "POST",
        headers: headers("neon-manager"),
        body: JSON.stringify({
          seUserId: SE_ID,
          note: "x",
          items: [{ category: "gossip", details: "y" }],
        }),
      },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("update a note replaces items", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/market-intelligence/notes/${NOTE_ID}`,
      {
        method: "PATCH",
        headers: headers("neon-super-admin"),
        body: JSON.stringify({
          note: "Updated summary",
          items: [{ category: "promotion", details: "Buy 4 get 1" }],
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(queryLog).toContain("update_market_note");
    expect(queryLog).toContain("delete_market_note_items");
    expect(queryLog).toContain("create_market_note_items");
  });

  test("delete note → 200; unknown note → 404", async () => {
    const { default: app } = await import("../index");

    const ok = await app.request(
      `/api/v1/market-intelligence/notes/${NOTE_ID}`,
      { method: "DELETE", headers: headers("neon-manager") },
      env,
    );
    expect(ok.status).toBe(200);

    const missing = await app.request(
      "/api/v1/market-intelligence/notes/00000000-0000-4000-8000-000000000e99",
      { method: "DELETE", headers: headers("neon-manager") },
      env,
    );
    expect(missing.status).toBe(404);
  });

  test("photos gallery lists MI photos with customer info", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/market-intelligence/photos?customerId=" + CUSTOMER_ID,
      { headers: headers("neon-super-admin") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(queryLog).toContain("list_mi_photos");
    expect(lastValues).toContain(CUSTOMER_ID);
    expect(body.data.photos).toHaveLength(1);
    expect(body.data.photos[0].customerCode).toBe("CUST-0012");
    expect(body.data.photos[0].uploadedByName).toBe("Test_sales");
  });
});
