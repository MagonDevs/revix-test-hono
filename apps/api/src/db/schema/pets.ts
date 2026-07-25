import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { petSizeEnum, petStatusEnum, sexEnum, speciesEnum } from "./enums.js";

// tsvector has no first-class Drizzle column type; a minimal custom type
// is the standard approach (data model §3, §4).
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const pets = pgTable(
  "pets",
  {
    id: uuid("id").primaryKey(), // uuid v7, generated in app
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    species: speciesEnum("species").notNull(),
    breed: varchar("breed", { length: 60 }),
    sex: sexEnum("sex").notNull(),
    ageMonths: smallint("age_months").notNull(),
    size: petSizeEnum("size").notNull(),
    weightGrams: integer("weight_grams"), // §4: integer, not numeric — pg returns numeric as string
    description: text("description").notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    status: petStatusEnum("status").notNull().default("available"),
    isVaccinated: boolean("is_vaccinated").notNull().default(false),
    isNeutered: boolean("is_neutered").notNull().default(false),
    isGoodWithKids: boolean("is_good_with_kids").notNull().default(false),
    isGoodWithPets: boolean("is_good_with_pets").notNull().default(false),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(breed, '') || ' ' || coalesce(description, ''))`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("pets_browse_idx").on(t.status, t.createdAt.desc(), t.id.desc()),
    index("pets_owner_idx").on(t.ownerId, t.status),
    index("pets_city_trgm_idx").using("gin", sql`lower(${t.city}) gin_trgm_ops`),
    index("pets_search_idx").using("gin", t.searchVector),
    check("pets_age_months_check", sql`${t.ageMonths} between 0 and 360`),
    check(
      "pets_weight_check",
      sql`${t.weightGrams} is null or ${t.weightGrams} between 100 and 120000`,
    ),
  ],
);
