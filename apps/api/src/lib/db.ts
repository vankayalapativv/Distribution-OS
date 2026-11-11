import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Context } from "hono";
import { ApiError } from "./api-error";
import type { ApiEnv } from "../types";

export type SqlClient = NeonQueryFunction<false, false>;

export function getSqlClient(c: Context<ApiEnv>): SqlClient {
  const databaseUrl = c.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ApiError(
      "DATABASE_NOT_CONFIGURED",
      "DATABASE_URL is not configured for the API runtime.",
      500,
    );
  }

  return neon(databaseUrl);
}
