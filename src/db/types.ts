import type { db } from "./client.js";

export type Database = typeof db;

// Drizzle's transaction callback type, derived from the db instance
// itself so it always matches the configured schema/driver.
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Repositories accept an Executor rather than importing `db` directly, so
 * the same method works inside or outside a transaction (architecture
 * §6). Services own the transaction boundary.
 */
export type Executor = Database | Transaction;
