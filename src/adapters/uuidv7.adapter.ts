import { v7 as uuidv7 } from "uuid";
import type { IdPort } from "../ports/id.port.js";

export class Uuidv7IdAdapter implements IdPort {
  next(): string {
    return uuidv7();
  }
}
