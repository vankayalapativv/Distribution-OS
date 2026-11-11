import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { isUniqueViolation, retryOnUniqueViolation } from "../lib/pg-errors";
import { resolvePage, resolveSort } from "../lib/pagination";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** A category is permanently compulsory or variable; entries inherit it. */
export const EXPENDITURE_TYPES = ["compulsory", "variable"] as const;
export type ExpenditureType = (typeof EXPENDITURE_TYPES)[number];

export const VALID_EXPENDITURE_PAYMENT_MODES = [
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "card",
] as const;

function mapCategory(row: Row) {
  return {
    id: str(row.id),
    name: str(row.name),
    type: str(row.type) as ExpenditureType,
    isSystem: row.isSystem === true,
    isActive: row.isActive !== false,
  };
}

function mapExpenditure(row: Row) {
  return {
    id: str(row.id),
    expenditureCode: str(row.expenditureCode),
    expenditureDate: str(row.expenditureDate).slice(0, 10),
    categoryId: str(row.categoryId),
    categoryName: str(row.categoryName),
    type: str(row.type) as ExpenditureType,
    amount: num(row.amount),
    paymentMode: strOrNull(row.paymentMode),
    paidTo: strOrNull(row.paidTo),
    userId: strOrNull(row.userId),
    userName: strOrNull(row.userName),
    remarks: strOrNull(row.remarks),
    hasBill: strOrNull(row.billFileKey) !== null,
    createdAt: str(row.createdAt),
  };
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function listExpenditureCategories(sql: SqlClient) {
  const rows = await sql`
    /* list_expenditure_categories */
    select id, name, type, is_system as "isSystem", is_active as "isActive"
    from expenditure_categories
    where is_active
    order by type, name
  ` as Row[];
  return rows.map(mapCategory);
}

export async function createExpenditureCategory(
  sql: SqlClient,
  context: { userId: string },
  input: { name: string; type: ExpenditureType },
) {
  const name = input.name.trim();
  if (!name) throw new ApiError("VALIDATION", "Category name is required.", 422);
  if (!EXPENDITURE_TYPES.includes(input.type)) {
    throw new ApiError("VALIDATION", "Type must be compulsory or variable.", 422);
  }

  const [existing] = await sql`
    /* expenditure_category_exists */
    select id from expenditure_categories where lower(name) = lower(${name}) limit 1
  ` as Row[];
  if (existing) throw new ApiError("CONFLICT", `Category "${name}" already exists.`, 409);

  const [row] = await sql`
    /* create_expenditure_category */
    insert into expenditure_categories (name, type, is_system, created_by)
    values (${name}, ${input.type}, false, ${context.userId}::uuid)
    returning id, name, type, is_system as "isSystem", is_active as "isActive"
  ` as Row[];
  return mapCategory(row);
}

/**
 * People an expenditure can be attributed to — field staff whose fuel/food is
 * paid for (SEs and Logistics drivers).
 */
export async function listExpenditurePeople(sql: SqlClient) {
  const rows = await sql`
    /* list_expenditure_people */
    select distinct u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code in ('SALES_EXECUTIVE', 'LOGISTICS')
      and coalesce(u.status, 'active') = 'active'
    order by u.name
  ` as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name) }));
}

// ── Entries ─────────────────────────────────────────────────────────────────

const EXPENDITURE_COLUMNS = `
  e.id,
  e.expenditure_code as "expenditureCode",
  e.expenditure_date as "expenditureDate",
  e.category_id as "categoryId",
  c.name as "categoryName",
  c.type,
  e.amount,
  e.payment_mode as "paymentMode",
  e.paid_to as "paidTo",
  e.user_id as "userId",
  u.name as "userName",
  e.remarks,
  e.bill_file_key as "billFileKey",
  e.created_at as "createdAt"
`;

const EXPENDITURE_FROM = `
  from expenditures e
  join expenditure_categories c on c.id = e.category_id
  left join users u on u.id = e.user_id
`;

const EXPENDITURE_SORTS: Record<string, string> = {
  expenditureDate: "e.expenditure_date",
  amount: "e.amount",
  categoryName: "c.name",
  createdAt: "e.created_at",
};

export interface ListExpendituresParams {
  from?: string | null;
  to?: string | null;
  categoryId?: string | null;
  type?: string | null;
  userId?: string | null;
  search?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export async function listExpenditures(sql: SqlClient, opts: ListExpendituresParams) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: (p: string) => string, value: unknown) => {
    params.push(value);
    conds.push(cond(`$${params.length}`));
  };

  const from = (opts.from ?? "").trim();
  if (from) add((p) => `e.expenditure_date >= ${p}::date`, from);
  const to = (opts.to ?? "").trim();
  if (to) add((p) => `e.expenditure_date <= ${p}::date`, to);
  const categoryId = (opts.categoryId ?? "").trim();
  if (categoryId) add((p) => `e.category_id = ${p}::uuid`, categoryId);
  const type = (opts.type ?? "").trim();
  if (type && EXPENDITURE_TYPES.includes(type as ExpenditureType)) {
    add((p) => `c.type = ${p}`, type);
  }
  const userId = (opts.userId ?? "").trim();
  if (userId) add((p) => `e.user_id = ${p}::uuid`, userId);
  const search = (opts.search ?? "").trim();
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conds.push(`(e.expenditure_code ilike ${p} or c.name ilike ${p} or e.paid_to ilike ${p} or e.remarks ilike ${p})`);
  }

  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";
  const sort = resolveSort(opts.sort, opts.dir, EXPENDITURE_SORTS, "expenditureDate");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_expenditures_count */ select count(*)::int as total, coalesce(sum(e.amount), 0) as total_amount ${EXPENDITURE_FROM} ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_expenditures */
     select ${EXPENDITURE_COLUMNS} ${EXPENDITURE_FROM} ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, e.created_at desc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map(mapExpenditure),
    total: Number(countRow?.total ?? 0),
    totalAmount: num(countRow?.total_amount),
    page,
    pageSize,
  };
}

export async function getExpenditureById(sql: SqlClient, id: string) {
  const [row] = (await sql.query(
    `/* get_expenditure_by_id */ select ${EXPENDITURE_COLUMNS} ${EXPENDITURE_FROM} where e.id = $1::uuid limit 1`,
    [id],
  )) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Expenditure not found.", 404);
  return mapExpenditure(row);
}

export interface ExpenditureInput {
  expenditureDate: string;
  categoryId: string;
  amount: number;
  paymentMode: string | null;
  paidTo: string | null;
  userId: string | null;
  remarks: string | null;
  /** Client-generated idempotency key — a retried/double-submitted save with the
   *  same value returns the already-created expenditure instead of duplicating. */
  clientUuid?: string | null;
}

/** Return an already-created expenditure by clientUuid, or null. */
async function existingExpenditureByClientUuid(sql: SqlClient, clientUuid: string) {
  const [row] = (await sql`
    /* get_expenditure_by_client_uuid */
    select id from expenditures where client_uuid = ${clientUuid}::uuid
  `) as Row[];
  return row ? await getExpenditureById(sql, str(row.id)) : null;
}

function assertInput(input: ExpenditureInput) {
  if (!input.expenditureDate) {
    throw new ApiError("VALIDATION", "Expenditure date is required.", 422);
  }
  if (!input.categoryId) throw new ApiError("VALIDATION", "Category is required.", 422);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ApiError("VALIDATION", "Amount must be greater than zero.", 422);
  }
  if (
    input.paymentMode &&
    !(VALID_EXPENDITURE_PAYMENT_MODES as readonly string[]).includes(input.paymentMode)
  ) {
    throw new ApiError("VALIDATION", "Unknown payment mode.", 422);
  }
}

export async function createExpenditure(
  sql: SqlClient,
  context: { userId: string },
  input: ExpenditureInput,
) {
  assertInput(input);

  // Idempotent replay: a double-submit / network retry with the same clientUuid
  // returns the already-created expenditure instead of duplicating.
  if (input.clientUuid) {
    const existing = await existingExpenditureByClientUuid(sql, input.clientUuid);
    if (existing) return existing;
  }

  const [category] = await sql`
    /* expenditure_category_for_entry */
    select id from expenditure_categories where id = ${input.categoryId}::uuid and is_active limit 1
  ` as Row[];
  if (!category) throw new ApiError("NOT_FOUND", "Category not found.", 404);

  // The EXP-#### code is max(seq)+1 — race-prone under concurrent creates — so
  // code generation + the insert are retried on an expenditure_code collision.
  const runInsert = async (): Promise<Row[]> => {
    const [codeRow] = (await sql`
      /* next_expenditure_code */
      select coalesce(max(substring(expenditure_code from 5)::int), 0) + 1 as next_seq
      from expenditures
      where expenditure_code ~ '^EXP-[0-9]+$'
    `) as Row[];
    const code = `EXP-${String(num(codeRow?.next_seq) || 1).padStart(4, "0")}`;
    return (await sql`
      /* create_expenditure */
      insert into expenditures (
        expenditure_code, expenditure_date, category_id, amount,
        payment_mode, paid_to, user_id, remarks, created_by, client_uuid
      ) values (
        ${code},
        ${input.expenditureDate}::date,
        ${input.categoryId}::uuid,
        ${input.amount},
        ${input.paymentMode},
        ${input.paidTo},
        ${input.userId ? sql`${input.userId}::uuid` : sql`null`},
        ${input.remarks},
        ${context.userId}::uuid,
        ${input.clientUuid ?? null}::uuid
      )
      returning id
    `) as Row[];
  };

  let inserted: Row[];
  try {
    inserted = await retryOnUniqueViolation(runInsert, {
      constraint: "expenditures_expenditure_code_key",
    });
  } catch (err) {
    // Concurrent double-submit raced past the SELECT; return the winner.
    if (input.clientUuid && isUniqueViolation(err, "expenditures_client_uuid_unique")) {
      const existing = await existingExpenditureByClientUuid(sql, input.clientUuid);
      if (existing) return existing;
    }
    throw err;
  }

  return getExpenditureById(sql, str(inserted[0].id));
}

export async function updateExpenditure(
  sql: SqlClient,
  id: string,
  input: ExpenditureInput,
) {
  assertInput(input);

  const [row] = await sql`
    /* update_expenditure */
    update expenditures set
      expenditure_date = ${input.expenditureDate}::date,
      category_id = ${input.categoryId}::uuid,
      amount = ${input.amount},
      payment_mode = ${input.paymentMode},
      paid_to = ${input.paidTo},
      user_id = ${input.userId ? sql`${input.userId}::uuid` : sql`null`},
      remarks = ${input.remarks},
      updated_at = now()
    where id = ${id}::uuid
    returning id
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Expenditure not found.", 404);
  return getExpenditureById(sql, id);
}

/** Deletes the entry; its bill object in R2 is removed alongside. */
export async function deleteExpenditure(
  sql: SqlClient,
  bucket: R2Bucket | undefined,
  id: string,
) {
  const [row] = await sql`
    /* delete_expenditure */
    delete from expenditures where id = ${id}::uuid
    returning bill_file_key as "billFileKey"
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Expenditure not found.", 404);
  const key = strOrNull(row.billFileKey);
  if (key && bucket) await bucket.delete(key).catch(() => undefined);
  return { deleted: true };
}

// ── Summary (period totals + type split + per-category breakdown) ────────────

export async function getExpenditureSummary(
  sql: SqlClient,
  opts: { from?: string | null; to?: string | null },
) {
  const from = (opts.from ?? "").trim() || null;
  const to = (opts.to ?? "").trim() || null;

  const rows = await sql`
    /* expenditure_summary_by_category */
    select
      c.id as "categoryId",
      c.name as "categoryName",
      c.type,
      count(e.id)::int as "entries",
      coalesce(sum(e.amount), 0) as "amount"
    from expenditures e
    join expenditure_categories c on c.id = e.category_id
    where (${from}::date is null or e.expenditure_date >= ${from}::date)
      and (${to}::date is null or e.expenditure_date <= ${to}::date)
    group by c.id, c.name, c.type
    order by sum(e.amount) desc
  ` as Row[];

  const categories = rows.map((r) => ({
    categoryId: str(r.categoryId),
    categoryName: str(r.categoryName),
    type: str(r.type) as ExpenditureType,
    entries: num(r.entries),
    amount: num(r.amount),
  }));

  const compulsory = categories
    .filter((c) => c.type === "compulsory")
    .reduce((acc, c) => acc + c.amount, 0);
  const variable = categories
    .filter((c) => c.type === "variable")
    .reduce((acc, c) => acc + c.amount, 0);

  return {
    total: compulsory + variable,
    compulsory,
    variable,
    entries: categories.reduce((acc, c) => acc + c.entries, 0),
    categories,
  };
}

// ── Bill attachment ─────────────────────────────────────────────────────────

const MAX_BILL_BYTES = 10 * 1024 * 1024;
const ALLOWED_BILL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function uploadExpenditureBill(
  sql: SqlClient,
  bucket: R2Bucket,
  id: string,
  file: File,
) {
  if (!ALLOWED_BILL_TYPES.has(file.type)) {
    throw new ApiError("VALIDATION", "Bill must be a JPEG, PNG, WebP or PDF.", 422);
  }
  if (file.size === 0) throw new ApiError("VALIDATION", "Attach the bill as 'file'.", 422);
  if (file.size > MAX_BILL_BYTES) {
    throw new ApiError("VALIDATION", "Bill must be under 10 MB.", 422);
  }

  const [existing] = await sql`
    /* expenditure_for_bill */
    select id, bill_file_key as "billFileKey" from expenditures where id = ${id}::uuid limit 1
  ` as Row[];
  if (!existing) throw new ApiError("NOT_FOUND", "Expenditure not found.", 404);

  const extByMime: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/webp": "webp" };
  const extension = extByMime[file.type] ?? "jpg";
  const fileKey = `expenditures/${id}/${crypto.randomUUID()}.${extension}`;
  await bucket.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    storageClass: R2_STORAGE_CLASS,
  });

  // Replacing a bill: drop the old object so R2 doesn't accumulate orphans.
  const previous = strOrNull(existing.billFileKey);
  if (previous) await bucket.delete(previous).catch(() => undefined);

  await sql`
    /* set_expenditure_bill */
    update expenditures
    set bill_file_key = ${fileKey}, bill_content_type = ${file.type}, updated_at = now()
    where id = ${id}::uuid
  `;

  return { uploaded: true, contentType: file.type };
}

export async function getExpenditureBill(sql: SqlClient, bucket: R2Bucket, id: string) {
  const [row] = await sql`
    /* get_expenditure_bill */
    select bill_file_key as "fileKey", bill_content_type as "contentType"
    from expenditures
    where id = ${id}::uuid
    limit 1
  ` as Row[];
  if (!row || !strOrNull(row.fileKey)) {
    throw new ApiError("NOT_FOUND", "Bill not found.", 404);
  }

  const object = await bucket.get(str(row.fileKey));
  if (!object) throw new ApiError("NOT_FOUND", "Bill not found.", 404);
  return {
    body: object.body as unknown as ReadableStream,
    contentType: str(row.contentType) || "application/octet-stream",
  };
}
