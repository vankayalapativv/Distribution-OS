import { createMiddleware } from "hono/factory";
import type { ApiEnv } from "../types";

export const attachRequestContext = createMiddleware<ApiEnv>(
  async (c, next) => {
    const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();

    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);

    await next();
  },
);
