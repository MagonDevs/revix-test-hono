import type { db } from "./client.js";

export type Database = typeof db;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Executor = Database | Transaction;
