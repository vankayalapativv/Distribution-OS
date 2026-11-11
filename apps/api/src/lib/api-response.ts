import type { Context } from "hono";
import { BRAND } from "@distribution-os/shared";
import type { ApiEnv, ApiFailure, ApiSuccess } from "../types";

export function success<T>(c: Context<ApiEnv>, data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: c.var.requestId,
    },
  };
}

export function failure(
  c: Context<ApiEnv>,
  code: string,
  message: string,
  details?: unknown,
): ApiFailure {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    meta: {
      requestId: c.var.requestId,
    },
  };
}

export function apiInfo(c: Context<ApiEnv>) {
  return success(c, {
    name: `${BRAND.systemName} API`,
    version: c.env.API_VERSION ?? "v1",
    environment: c.env.ENVIRONMENT ?? "development",
    routes: {
      health: "/health",
      me: "/me",
      versionedBase: "/api/v1",
    },
  });
}

export function placeholderResource(
  c: Context<ApiEnv>,
  resource: string,
  details: Record<string, unknown> = {},
) {
  return success(c, {
    resource,
    implemented: false,
    message: `${resource} API structure is ready. Business logic will be added in the next implementation slice.`,
    ...details,
  });
}
