import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { requestStatusEnum } from "./enums.js";
import { pets } from "./pets.js";

export const adoptionRequests = pgTable(
  "adoption_requests",
  {
    id: uuid("id").primaryKey(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    adopterId: text("adopter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    guardianId: text("guardian_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: varchar("message", { length: 1000 }).notNull(),
    status: requestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("adoption_requests_active_uq")
      .on(t.petId, t.adopterId)
      .where(sql`status in ('pending', 'accepted')`),
    index("adoption_requests_guardian_idx").on(t.guardianId, t.status, t.createdAt.desc()),
    index("adoption_requests_adopter_idx").on(t.adopterId, t.createdAt.desc()),
    check("adoption_requests_no_self", sql`${t.adopterId} <> ${t.guardianId}`),
  ],
);
