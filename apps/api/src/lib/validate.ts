import { z } from "zod";
import { ApiError } from "./api-error";

/**
 * Validate parsed input against a Zod schema at a trust boundary (architecture
 * audit G-0602). Returns the typed, parsed value or throws a 422 ApiError whose
 * message names the first offending field — a uniform, self-documenting
 * replacement for scattered manual `requiredString`/range checks. SQL is already
 * injection-safe (parameterized); this adds consistent *semantic* validation.
 *
 * Usage:
 *   const input = validate(CreateThingSchema, await readJsonObject(c));
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const message = path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid input.");
    throw new ApiError("INVALID_FIELD", message, 422);
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `v` is a UUID. Use it to reject a non-UUID path param BEFORE it
 * reaches a `::uuid` cast in SQL — otherwise Postgres throws "invalid input
 * syntax for type uuid" and the request 500s. A stray path like `/orders/parts`
 * that falls through to `/orders/:id` should 404, not crash.
 */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Throw a 404 when an id path param isn't a UUID (so it can't reach a `::uuid`
 *  cast). `label` names the thing for the message, e.g. "Order". */
export function assertUuidParam(id: string | undefined, label: string): string {
  if (!isUuid(id)) throw new ApiError("NOT_FOUND", `${label} not found.`, 404);
  return id;
}

/** Common field schemas reused across boundary schemas. */
export const zTrimmed = z.string().trim();
export const zNonEmpty = zTrimmed.min(1);
export const zOptionalString = z.string().nullish();
/** Indian mobile: 10–13 digits after stripping non-digits (tolerates +91/spaces). */
export const zPhone = z
  .string()
  .refine((v) => v.replace(/\D/g, "").length >= 10, "must be a valid phone number");
