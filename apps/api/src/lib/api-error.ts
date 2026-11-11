/**
 * The ApiError class, isolated in a dependency-free module so infrastructure
 * (lib/db) can depend on it without pulling in the error handlers — which import
 * business logic (services/errors). This breaks the lib → services → lib import
 * cycle flagged by the architecture audit (G-0101). It is re-exported from
 * ./errors so the ~68 existing `import { ApiError } from "../lib/errors"` sites
 * keep working unchanged.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503 = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
