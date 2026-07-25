import { sql } from "drizzle-orm";
import { check, index, pgTable, smallint, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { pets } from "./pets.js";
import { uploads } from "./uploads.js";

export const petPhotos = pgTable(
  "pet_photos",
  {
    id: uuid("id").primaryKey(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id")
      .notNull()
      .unique()
      .references(() => uploads.id, { onDelete: "restrict" }),
    position: smallint("position").notNull(),
    alt: varchar("alt", { length: 200 }),
  },
  (t) => [
    uniqueIndex("pet_photos_position_uq").on(t.petId, t.position),
    index("pet_photos_pet_idx").on(t.petId),
    check("pet_photos_position_check", sql`${t.position} between 0 and 5`),
  ],
);
