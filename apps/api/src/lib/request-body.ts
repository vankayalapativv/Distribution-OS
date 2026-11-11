import type { Context } from "hono";
import { ApiError } from "./errors";
import type { ApiEnv } from "../types";

type JsonObject = Record<string, unknown>;

export async function readJsonObject(c: Context<ApiEnv>): Promise<JsonObject> {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("INVALID_BODY", "Request body must be a JSON object.", 400);
  }

  return body as JsonObject;
}

export function optionalString(
  body: JsonObject,
  key: string,
): string | null {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError("INVALID_FIELD", `${key} must be a string.`, 422);
  }

  return value;
}

export function requiredString(body: JsonObject, key: string): string {
  const value = optionalString(body, key);

  if (!value) {
    throw new ApiError("MISSING_FIELD", `${key} is required.`, 422);
  }

  return value;
}

export function optionalNumber(
  body: JsonObject,
  key: string,
): number | null {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ApiError("INVALID_FIELD", `${key} must be a number.`, 422);
  }

  return value;
}

export function requiredNumber(body: JsonObject, key: string): number {
  const value = optionalNumber(body, key);

  if (value === null) {
    throw new ApiError("MISSING_FIELD", `${key} is required.`, 422);
  }

  return value;
}

export function optionalBoolean(
  body: JsonObject,
  key: string,
): boolean | null {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new ApiError("INVALID_FIELD", `${key} must be a boolean.`, 422);
  }

  return value;
}
