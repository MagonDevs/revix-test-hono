import { v7 as uuidv7 } from "uuid";
import type { MiddlewareHandler } from "hono";

const REQUEST_ID_HEADER = "x-request-id";

export function requestId(): MiddlewareHandler<{ Variables: { requestId: string } }> {
  return async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    const id = incoming && incoming.length > 0 ? incoming : uuidv7();
    c.set("requestId", id);
    c.header(REQUEST_ID_HEADER, id);
    await next();
  };
}
