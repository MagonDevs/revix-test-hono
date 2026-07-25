import { createSeedUser } from "../factories/user.factory.js";
import { faker, resetRng } from "../rng.js";
import { at } from "../util.js";
import { DEMO_PASSWORD, DEMO_USERS } from "./demo.js";
import type { ScenarioSummary, SeedContext } from "../context.js";

export async function seedEmpty(ctx: SeedContext): Promise<ScenarioSummary> {
  resetRng();
  const marta = at(DEMO_USERS, 0, "DEMO_USERS");
  await createSeedUser(ctx.auth, ctx.db, {
    name: marta.name,
    email: marta.email,
    password: DEMO_PASSWORD,
    city: marta.city,
    phone: `+34 6${faker.string.numeric(8)}`,
    bio: "Loves fostering animals in Madrid.",
  });

  return { users: 1, pets: 0, photos: 0, requests: 0, favourites: 0 };
}
