import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { readJsonObject, requiredString } from "../lib/request-body";
import {
  bulkCreateProducts,
  createProduct,
  deleteProduct,
  listManagedProducts,
  listManagedProductsPaged,
  updateProduct,
} from "../services/products";
import type { ApiEnv } from "../types";

export const productsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    // ACCOUNTANT can read the catalogue (stock lives here) but not mutate it.
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const products = await listManagedProducts(getSqlClient(c), {
      userId: auth.userId!,
    });
    return c.json(success(c, { products }));
  })
  // Paginated/sorted/filtered oils for the web table (standard table stack).
  .get("/paged", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const num = (v: string | undefined) => (v == null || v === "" ? null : Number(v));
    const result = await listManagedProductsPaged(
      getSqlClient(c),
      { userId: auth.userId! },
      {
        search: q.search ?? null,
        status: q.status ?? null,
        brand: q.brand ?? null,
        sort: q.sort ?? null,
        dir: q.dir ?? null,
        page: num(q.page),
        pageSize: num(q.pageSize),
      },
    );
    return c.json(
      success(c, { products: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }),
    );
  })
  .post("/", async (c) => {
    const auth = await requireCapability(c, "action:products.manage", ["SUPER_ADMIN", "MANAGER"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const product = await createProduct(
      sql,
      { userId: auth.userId! },
      {
        productName: requiredString(body, "productName"),
        brand: body.brand,
        segments: body.segments,
        packs: body.packs,
        hsnCode: requiredString(body, "hsnCode"),
        unit: body.unit,
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      entityLabel: product.productName,
      summary: `Added product ${product.productName}`,
    });
    return c.json(success(c, { product }), 201);
  })
  // Bulk create from the Products Excel upload. Returns how many inserted + the
  // per-row errors (invalid / duplicate-in-file / already-in-catalogue).
  .post("/bulk", async (c) => {
    const auth = await requireCapability(c, "action:products.manage", ["SUPER_ADMIN", "MANAGER"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const result = await bulkCreateProducts(sql, { userId: auth.userId! }, body.products);
    await logAudit(sql, actorOf(auth), {
      action: "product.bulk_create",
      entityType: "product",
      entityId: null,
      entityLabel: `${result.created} products`,
      summary: `Bulk-imported ${result.created} product${result.created === 1 ? "" : "s"}`,
    });
    return c.json(success(c, result));
  })
  .patch("/:id", async (c) => {
    const auth = await requireCapability(c, "action:products.manage", ["SUPER_ADMIN", "MANAGER"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const product = await updateProduct(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      {
        productName: requiredString(body, "productName"),
        brand: body.brand,
        segments: body.segments,
        packs: body.packs,
        hsnCode: requiredString(body, "hsnCode"),
        unit: body.unit,
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "product.update",
      entityType: "product",
      entityId: product.id,
      entityLabel: product.productName,
      summary: `Updated product ${product.productName}`,
    });
    return c.json(success(c, { product }));
  })
  .delete("/:id", async (c) => {
    const auth = await requireCapability(c, "action:products.manage", ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    const deleted = await deleteProduct(sql, { userId: auth.userId! }, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "product.delete",
      entityType: "product",
      entityId: deleted.id,
      entityLabel: deleted.productName,
      summary: `Deleted product ${deleted.productName}`,
    });
    return c.json(success(c, {}));
  });
