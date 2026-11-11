# API Conventions (`apps/api`)

## Runtime: Cloudflare Workers

This runs on Cloudflare Workers (V8 isolates), **not Node.js**. Rules:
- Use only Web-standard APIs (`fetch`, `crypto`, `Request`, `Response`, `URL`, etc.)
- Never import Node.js built-ins (`fs`, `path`, `net`, `child_process`, etc.)
- No global mutable state — each request gets a fresh isolate context
- Use `ctx.waitUntil()` for post-response async work; never leave floating promises
- Secrets come from `c.env.*` (Cloudflare bindings), never hardcoded

Run `pnpm dev` from `apps/api` to start the Workers dev server on port 8787.

Before writing or reviewing Workers code, load the `/workers-best-practices` skill.

## Framework: Hono

```typescript
// Route file pattern:
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { myServiceFn } from "../services/my-service";
import type { ApiEnv } from "../types";

export const myRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    const data = await myServiceFn(sql, { userId: auth.userId! });
    return c.json(success(c, { data }));
  });
```

Register routes in `src/index.ts` via `v1.route("/path", myRoutes)`.

## Key Utilities

| Utility | Import | Purpose |
|---------|--------|---------|
| `requireRole(c, roles)` | `../lib/authz` | Throws 401/403 if not authenticated or wrong role |
| `requireAuth(c)` | `../lib/authz` | Throws 401 if not authenticated (any role) |
| `getSqlClient(c)` | `../lib/db` | Returns Neon SQL tagged-template client |
| `success(c, data)` | `../lib/api-response` | Wraps response in `{ success: true, data, meta }` |
| `ApiError` | `../lib/errors` | Throw for known errors: `new ApiError("CODE", "message", status)` |
| `readJsonObject(c)` | `../lib/request-body` | Safely parse JSON body |
| `requiredString(body, key)` | `../lib/request-body` | Extract required string field |
| `optionalString(body, key)` | `../lib/request-body` | Extract optional string field |
| `optionalNumber(body, key)` | `../lib/request-body` | Extract optional number field |

## Service Layer Pattern

Services live in `src/services/<name>.ts`. They receive `sql: SqlClient` and a context object. This is a **single-client deployment** — there is no `organization_id` column (removed in migrations `0034`/`0035`); never filter by or insert one.

```typescript
interface MyContext {
  userId: string;
}

export async function listThings(sql: SqlClient, context: MyContext) {
  const rows = await sql`
    /* list_things */
    select id, name
    from things
    order by name
  `;
  return rows.map(mapRow);
}

// INSERT pattern:
// insert into things (name, created_by)
// values (${name}, ${context.userId})
```

Always include a SQL comment (`/* comment */`) for query identification in logs.

## Error Handling

```typescript
import { ApiError } from "../lib/errors";

// Known errors:
throw new ApiError("NOT_FOUND", "Thing not found.", 404);
throw new ApiError("CONFLICT", "Thing is in use.", 409);
throw new ApiError("UNAUTHORIZED", "Login required.", 401);
throw new ApiError("FORBIDDEN", "Insufficient role.", 403);

// DB constraint violations from Neon arrive as thrown errors — catch them:
try {
  await sql`delete from products where id = ${id}::uuid ...`;
} catch {
  throw new ApiError("CONFLICT", "Product is used in existing orders.", 409);
}
```

Unknown errors bubble up to `errorHandler` in `src/lib/errors.ts` which returns 500.

## Neon SQL Client

```typescript
const sql = getSqlClient(c); // NeonQueryFunction — tagged template

// Column aliases must use quoted camelCase:
const rows = await sql`
  select p.id, p.product_name as "productName"
  from products p
  where p.status = 'active'
`;
// rows[0].productName works; rows[0].product_name does not

// UUID params need explicit cast:
await sql`select * from products where id = ${id}::uuid`;
```

Neon returns PostgreSQL `date` as JS `Date` objects — use `v instanceof Date` check before treating as string.

## Role Codes

Valid role codes (from `roles` table): `SUPER_ADMIN`, `MANAGER`, `ACCOUNTANT`, `SALES_EXECUTIVE`, `LOGISTICS`.

Web API endpoints are typically scoped to `["SUPER_ADMIN", "MANAGER"]` or `["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]`. Sales Executive and Logistics access the API from the Flutter app.

## Workers Best Practices Checklist

When editing `apps/api`, verify:
- [ ] No module-level mutable variables used for request state
- [ ] All Promises are awaited, returned, or passed to `ctx.waitUntil()`
- [ ] No `Math.random()` for security-sensitive values — use `crypto.randomUUID()`
- [ ] No hardcoded secrets — use `c.env.*`
- [ ] No `ctx.passThroughOnException()` — use explicit try/catch
- [ ] `wrangler.jsonc` uses current `compatibility_date`

Or just run `/workers-best-practices` for a full automated check.
