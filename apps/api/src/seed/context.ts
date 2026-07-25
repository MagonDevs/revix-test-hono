import type { Executor } from "../db/types.js";
import type { auth as authInstance } from "../modules/auth/auth.config.js";
import type { StoragePort } from "../ports/storage.port.js";
import type { SeedImageMode } from "./images/attach.js";

export interface SeedContext {
  db: Executor;
  auth: typeof authInstance;
  storage: StoragePort;
  imageMode: SeedImageMode;
}

export interface ScenarioSummary {
  users: number;
  pets: number;
  photos: number;
  requests: number;
  favourites: number;
}
