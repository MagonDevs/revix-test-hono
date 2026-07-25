import { v7 as uuidv7 } from "uuid";
import type { MiddlewareHandler } from "hono";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Assigns a request id — from the incoming `x-request-id` header if the
 * caller supplied one (useful behind a proxy that already generates
 * one), otherwise a fresh uuidv7 — and stashes it on `c.var.requestId`
 * before anything else runs. Every downstream log line and error
 * response is correlated by this id.
 */
export function requestId(): MiddlewareHandler<{ Variables: { requestId: string } }> {
  return async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    const id = incoming && incoming.length > 0 ? incoming : uuidv7();
    c.set("requestId", id);
    c.header(REQUEST_ID_HEADER, id);
    await next();
  };
}
