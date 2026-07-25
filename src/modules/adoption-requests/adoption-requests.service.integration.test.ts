import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user } from "../../db/schema/auth.js";
import { pets } from "../../db/schema/pets.js";
import { startTestDb, withRollback, type TestDb } from "../../db/test/testcontainers-setup.js";
import * as service from "./adoption-requests.service.js";
import type { Database, Transaction } from "../../db/types.js";

// Architecture §9 — every rule in contract §9 gets a test that cites its
// number. Docker required (Testcontainers Postgres).
//
// STATUS: not run in this sandbox — `docker ps` fails ("... no such file
// or directory"). Written to be correct and to run unmodified via
// `pnpm test:integration` once Docker is available. R-12 and R-13 are the
// two rules whose real value can ONLY be proven against a live Postgres
// (SELECT ... FOR UPDATE semantics and transaction rollback can't be
// faithfully unit-tested) — they are unverified pending Docker.

let testDb: TestDb;

async function insertUser(
  tx: Transaction,
  input: { id: string; name: string; email: string; city: string },
) {
  await tx
    .insert(user)
    .values({ id: input.id, name: input.name, email: input.email, city: input.city });
}

async function insertPet(
  tx: Transaction,
  input: {
    id: string;
    ownerId: string;
    status?: "available" | "reserved" | "adopted" | "withdrawn";
  },
) {
  const now = new Date();
  await tx.insert(pets).values({
    id: input.id,
    ownerId: input.ownerId,
    name: "Rex",
    species: "dog",
    sex: "male",
    ageMonths: 12,
    size: "medium",
    description: "A very good boy who loves long walks and belly rubs every single day.",
    city: "Madrid",
    status: input.status ?? "available",
    createdAt: now,
    updatedAt: now,
  });
}

const MESSAGE = "Hello, we'd love to meet Rex this week if possible, please let us know.";

describe("adoptionRequests.service (requires Docker)", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("R-7: a guardian cannot request their own pet", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana1@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const result = await service.create(tx as unknown as Database, guardianId, {
        petId,
        message: MESSAGE,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("conflict");
        if (result.error.code === "conflict") expect(result.error.reason).toBe("self_request");
      }
    });
  });

  it("R-8: a pending request blocks a second one for the same (pet, adopter)", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana2@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea1@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const first = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(first.isOk()).toBe(true);

      const second = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(second.isErr()).toBe(true);
      if (second.isErr()) {
        expect(second.error.code).toBe("conflict");
        if (second.error.code === "conflict") expect(second.error.reason).toBe("duplicate_request");
      }
    });
  });

  it("R-8: an accepted request also blocks a second one", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana3@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea2@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const first = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(first.isOk()).toBe(true);
      if (!first.isOk()) return;

      const responded = await service.respond(tx as unknown as Database, guardianId, {
        requestId: first.value.id,
        status: "accepted",
        reservePet: false,
      });
      expect(responded.isOk()).toBe(true);

      const second = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(second.isErr()).toBe(true);
      if (second.isErr()) {
        expect(second.error.code).toBe("conflict");
        if (second.error.code === "conflict") expect(second.error.reason).toBe("duplicate_request");
      }
    });
  });

  it("R-8: a previously declined or withdrawn request does NOT block a new one", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana4@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea3@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const first = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(first.isOk()).toBe(true);
      if (!first.isOk()) return;

      const declined = await service.respond(tx as unknown as Database, guardianId, {
        requestId: first.value.id,
        status: "declined",
        reservePet: false,
      });
      expect(declined.isOk()).toBe(true);

      const second = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(second.isOk()).toBe(true);
    });
  });

  it("R-9: cannot request an adopted or withdrawn pet", async () => {
    // Contract defect (see CHANGELOG.md and docs/notes/architecture-divergences.md):
    // §8.4/R-9 says adopted/withdrawn -> conflict/pet_unavailable, but
    // §5.4/R-2's 404-over-403 rule makes an adopted/withdrawn pet invisible
    // to a non-owner stranger, so `not_found` fires first in `create()`.
    // The only caller who *can* see the pet in that state is the owner,
    // who is already rejected earlier by R-7 (self_request). That makes
    // `pet_unavailable` unreachable through this path, and the security
    // rule (don't leak existence of records the caller can't see) wins:
    // the still-correct, still-desired behavior is `not_found`.
    for (const status of ["adopted", "withdrawn"] as const) {
      await withRollback(testDb.db, async (tx) => {
        const guardianId = uuidv7();
        const adopterId = uuidv7();
        const petId = uuidv7();
        await insertUser(tx, {
          id: guardianId,
          name: "Ana",
          email: `ana-${petId}@example.com`,
          city: "Madrid",
        });
        await insertUser(tx, {
          id: adopterId,
          name: "Bea",
          email: `bea-${petId}@example.com`,
          city: "Madrid",
        });
        await insertPet(tx, { id: petId, ownerId: guardianId, status });

        const result = await service.create(tx as unknown as Database, adopterId, {
          petId,
          message: MESSAGE,
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.code).toBe("not_found");
        }
      });
    }
  });

  it("not_found: a pet not visible to the caller (e.g. someone else's withdrawn pet) cannot be requested", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana5@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea4@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId, status: "withdrawn" });

      const result = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      // R-9's pet_unavailable only fires once the pet is visible; a
      // withdrawn pet is invisible to a non-owner, so this is not_found,
      // never conflict — contract §5.4's 404-over-403 rule.
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("not_found");
    });
  });

  it("R-10: list orders pending first, then createdAt DESC, id DESC", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petAId = uuidv7();
      const petBId = uuidv7();
      const petCId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana6@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea5@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petAId, ownerId: guardianId });
      await insertPet(tx, { id: petBId, ownerId: guardianId });
      await insertPet(tx, { id: petCId, ownerId: guardianId });

      const reqA = await service.create(tx as unknown as Database, adopterId, {
        petId: petAId,
        message: MESSAGE,
      });
      const reqB = await service.create(tx as unknown as Database, adopterId, {
        petId: petBId,
        message: MESSAGE,
      });
      const reqC = await service.create(tx as unknown as Database, adopterId, {
        petId: petCId,
        message: MESSAGE,
      });
      expect(reqA.isOk() && reqB.isOk() && reqC.isOk()).toBe(true);
      if (!reqA.isOk() || !reqB.isOk() || !reqC.isOk()) return;

      // Decline B — it should sort after the still-pending A and C,
      // despite being created in between them.
      await service.respond(tx as unknown as Database, guardianId, {
        requestId: reqB.value.id,
        status: "declined",
        reservePet: false,
      });

      const list = await service.list(tx, guardianId, {
        role: "guardian",
        page: 1,
        perPage: 10,
      });
      expect(list.isOk()).toBe(true);
      if (!list.isOk()) return;

      const ids = list.value.items.map((r) => r.id);
      // pending first (C then A, newest createdAt first), declined last.
      expect(ids).toEqual([reqC.value.id, reqA.value.id, reqB.value.id]);
    });
  });

  it("pagination: out-of-range page returns [] with correct total/totalPages, not an error", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana-pagination@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea-pagination@example.com",
        city: "Madrid",
      });

      // Three requests, so with perPage 10 there is exactly one real page.
      for (let i = 0; i < 3; i += 1) {
        const petId = uuidv7();
        await insertPet(tx, { id: petId, ownerId: guardianId });
        const created = await service.create(tx as unknown as Database, adopterId, {
          petId,
          message: MESSAGE,
        });
        expect(created.isOk()).toBe(true);
      }

      const page = await service.list(tx, guardianId, {
        role: "guardian",
        page: 5,
        perPage: 10,
      });
      expect(page.isOk()).toBe(true);
      if (!page.isOk()) return;

      expect(page.value.items).toEqual([]);
      expect(page.value.meta.total).toBe(3);
      expect(page.value.meta.totalPages).toBe(1);
    });
  });

  it("R-11: byId returns not_found for a caller who is neither the adopter nor the guardian", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const strangerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana7@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea6@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: strangerId,
        name: "Cid",
        email: "cid1@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const created = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(created.isOk()).toBe(true);
      if (!created.isOk()) return;

      const strangerView = await service.byId(tx, strangerId, created.value.id);
      expect(strangerView.isErr()).toBe(true);
      if (strangerView.isErr()) expect(strangerView.error.code).toBe("not_found");

      const adopterView = await service.byId(tx, adopterId, created.value.id);
      expect(adopterView.isOk()).toBe(true);
      const guardianView = await service.byId(tx, guardianId, created.value.id);
      expect(guardianView.isOk()).toBe(true);
    });
  });

  it("R-12: only the guardian can respond; a non-pending request cannot be answered again", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana8@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea7@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const created = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(created.isOk()).toBe(true);
      if (!created.isOk()) return;

      const adopterAttempt = await service.respond(tx as unknown as Database, adopterId, {
        requestId: created.value.id,
        status: "accepted",
        reservePet: false,
      });
      expect(adopterAttempt.isErr()).toBe(true);
      if (adopterAttempt.isErr()) expect(adopterAttempt.error.code).toBe("not_found");

      const first = await service.respond(tx as unknown as Database, guardianId, {
        requestId: created.value.id,
        status: "accepted",
        reservePet: false,
      });
      expect(first.isOk()).toBe(true);

      const second = await service.respond(tx as unknown as Database, guardianId, {
        requestId: created.value.id,
        status: "declined",
        reservePet: false,
      });
      expect(second.isErr()).toBe(true);
      if (second.isErr()) {
        expect(second.error.code).toBe("conflict");
        if (second.error.code === "conflict")
          expect(second.error.reason).toBe("request_already_answered");
      }
    });
  });

  it("R-12 (concurrency): two simultaneous respond() calls on the same pending request — exactly one succeeds", async () => {
    const guardianId = uuidv7();
    const adopterId = uuidv7();
    const petId = uuidv7();
    let requestId = "";

    try {
      await testDb.db.transaction(async (tx) => {
        await insertUser(tx, {
          id: guardianId,
          name: "Ana",
          email: `ana-conc-${petId}@example.com`,
          city: "Madrid",
        });
        await insertUser(tx, {
          id: adopterId,
          name: "Bea",
          email: `bea-conc-${petId}@example.com`,
          city: "Madrid",
        });
        await insertPet(tx, { id: petId, ownerId: guardianId });
        const created = await service.create(tx as unknown as Database, adopterId, {
          petId,
          message: MESSAGE,
        });
        if (created.isOk()) requestId = created.value.id;
      });

      // Two genuinely concurrent transactions racing on the SAME row —
      // this is the one place `withRollback`'s single outer transaction
      // wouldn't do (it would serialize both calls onto one connection).
      const [a, b] = await Promise.all([
        service.respond(testDb.db, guardianId, {
          requestId,
          status: "accepted",
          reservePet: false,
        }),
        service.respond(testDb.db, guardianId, {
          requestId,
          status: "declined",
          reservePet: false,
        }),
      ]);

      const outcomes = [a, b];
      const successes = outcomes.filter((r) => r.isOk());
      const failures = outcomes.filter((r) => r.isErr());
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      const failure = failures[0];
      if (failure?.isErr()) {
        expect(failure.error.code).toBe("conflict");
        if (failure.error.code === "conflict") {
          expect(failure.error.reason).toBe("request_already_answered");
        }
      }
    } finally {
      await testDb.db.delete(pets).where(eq(pets.id, petId));
      await testDb.db.delete(user).where(eq(user.id, guardianId));
      await testDb.db.delete(user).where(eq(user.id, adopterId));
    }
  });

  it("R-13: accept + reservePet rolls back entirely if the pet cannot legally reserve", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana9@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea8@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const created = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(created.isOk()).toBe(true);
      if (!created.isOk()) return;

      // Move the pet to `adopted` out from under the request — `adopted`
      // cannot legally transition to `reserved` (pets.domain.ts).
      await tx.update(pets).set({ status: "adopted" }).where(eq(pets.id, petId));

      const result = await service.respond(tx as unknown as Database, guardianId, {
        requestId: created.value.id,
        status: "accepted",
        reservePet: true,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("conflict");
        if (result.error.code === "conflict")
          expect(result.error.reason).toBe("invalid_transition");
      }

      // Nothing changed: request still pending, pet still adopted.
      const [petRow] = await tx.select().from(pets).where(eq(pets.id, petId));
      expect(petRow?.status).toBe("adopted");

      const stillPending = await service.byId(tx, guardianId, created.value.id);
      expect(stillPending.isOk()).toBe(true);
      if (stillPending.isOk()) expect(stillPending.value.status).toBe("pending");
    });
  });

  it("R-13: accept + reservePet succeeds and moves the pet to reserved, atomically", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana10@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea9@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const created = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(created.isOk()).toBe(true);
      if (!created.isOk()) return;

      const result = await service.respond(tx as unknown as Database, guardianId, {
        requestId: created.value.id,
        status: "accepted",
        reservePet: true,
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.status).toBe("accepted");

      const [petRow] = await tx.select().from(pets).where(eq(pets.id, petId));
      expect(petRow?.status).toBe("reserved");
    });
  });

  it("withdraw: caller must be the adopter, only from pending", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "ana11@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "bea10@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId: guardianId });

      const created = await service.create(tx as unknown as Database, adopterId, {
        petId,
        message: MESSAGE,
      });
      expect(created.isOk()).toBe(true);
      if (!created.isOk()) return;

      const guardianAttempt = await service.withdraw(
        tx as unknown as Database,
        guardianId,
        created.value.id,
      );
      expect(guardianAttempt.isErr()).toBe(true);
      if (guardianAttempt.isErr()) expect(guardianAttempt.error.code).toBe("not_found");

      const result = await service.withdraw(tx as unknown as Database, adopterId, created.value.id);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.status).toBe("withdrawn");

      const again = await service.withdraw(tx as unknown as Database, adopterId, created.value.id);
      expect(again.isErr()).toBe(true);
      if (again.isErr()) {
        expect(again.error.code).toBe("conflict");
        if (again.error.code === "conflict")
          expect(again.error.reason).toBe("request_already_answered");
      }
    });
  });
});
