import { integer, pgTable, smallint, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey(),
  uploaderId: text("uploader_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: varchar("mime_type", { length: 40 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  width: smallint("width").notNull(),
  height: smallint("height").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
