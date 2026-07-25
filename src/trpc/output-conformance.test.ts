import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { AdoptionRequest, OwnedPet, Pet, SessionUser, UserProfile } from "#contracts";
import type { Context } from "./context.js";

// B8 DoD (build-plan §B8) — "every procedure in the contract §8 exists, is
// tested, conforms to declared .output()". This is the single test meant
// to catch a procedure's mapper/service output silently drifting from its
// contract shape: every service function is mocked to resolve with a
// hand-built, contract-shaped fixture, then each procedure is invoked
// through `appRouter.createCaller`. tRPC's own `.output(schema)` parses
// the return value before it reaches the caller (architecture §3.1/§6) —
// so a real drift (a service returning a shape its router's `.output()`
// doesn't accept) makes the call itself throw, which these assertions
// would catch. No live DB needed: this test's job is the *shape*, not
// business logic (that's covered by each module's own unit/integration
// tests).

vi.mock("../modules/users/users.service.js", () => ({
  getUserProfile: vi.fn(() => okAsync(userProfileFixture)),
  updateMe: vi.fn(() => okAsync(sessionUserFixture)),
}));

vi.mock("../modules/pets/pets.service.js", () => ({
  list: vi.fn(() => okAsync({ items: [petFixture], meta: metaFixture })),
  byId: vi.fn(() => okAsync(petFixture)),
  listByOwner: vi.fn(() => okAsync({ items: [petFixture], meta: metaFixture })),
  listMine: vi.fn(() => okAsync({ items: [ownedPetFixture], meta: metaFixture })),
  create: vi.fn(() => okAsync(petFixture)),
  update: vi.fn(() => okAsync(petFixture)),
  setStatus: vi.fn(() => okAsync(petFixture)),
  remove: vi.fn(() => okAsync({ id: petFixture.id })),
}));

vi.mock("../modules/adoption-requests/adoption-requests.service.js", () => ({
  create: vi.fn(() => okAsync(adoptionRequestFixture)),
  list: vi.fn(() => okAsync({ items: [adoptionRequestFixture], meta: metaFixture })),
  byId: vi.fn(() => okAsync(adoptionRequestFixture)),
  respond: vi.fn(() => okAsync(adoptionRequestFixture)),
  withdraw: vi.fn(() => okAsync(adoptionRequestFixture)),
}));

vi.mock("../modules/favourites/favourites.service.js", () => ({
  list: vi.fn(() => okAsync({ items: [petFixture], meta: metaFixture })),
  set: vi.fn(() => okAsync({ petId: petFixture.id, favourited: true })),
}));

const metaFixture = { page: 1, perPage: 20, total: 1, totalPages: 1 };

const userSummaryFixture = {
  id: "user-1",
  name: "Ana",
  city: "Madrid",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const userProfileFixture: UserProfile = {
  ...userSummaryFixture,
  bio: null,
  availablePetCount: 1,
};

const sessionUserFixture: SessionUser = {
  ...userProfileFixture,
  email: "ana@example.com",
  phone: null,
};

const petFixture: Pet = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Rex",
  species: "dog",
  breed: null,
  sex: "male",
  ageMonths: 12,
  size: "medium",
  weightKg: 10,
  description: "A very good boy who loves long walks and belly rubs every single day.",
  photos: [],
  city: "Madrid",
  status: "available",
  isVaccinated: true,
  isNeutered: true,
  isGoodWithKids: true,
  isGoodWithPets: true,
  isFavourited: false,
  viewerRequestStatus: null,
  guardian: userSummaryFixture,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const ownedPetFixture: OwnedPet = { ...petFixture, pendingRequestCount: 0 };

const adoptionRequestFixture: AdoptionRequest = {
  id: "33333333-3333-4333-8333-333333333333",
  status: "pending",
  message: "Hello, we'd love to meet Rex this week if possible, please let us know.",
  pet: { id: petFixture.id, name: petFixture.name, status: petFixture.status, coverPhoto: null },
  adopter: userSummaryFixture,
  guardian: userSummaryFixture,
  contact: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  respondedAt: null,
};

function makeContext(user: Context["user"] = null): Context {
  return {
    db: {} as Context["db"],
    user,
    sessionId: user ? "session-1" : null,
    requestId: "req-conformance-test",
    logger: { info() {}, error() {}, warn() {}, debug() {} } as unknown as Context["logger"],
    now: () => new Date("2026-07-25T00:00:00Z"),
    ip: null,
  };
}

const authedUser: NonNullable<Context["user"]> = sessionUserFixture;

describe("output conformance — every appRouter procedure vs its declared .output()", () => {
  it("meta.breeds", async () => {
    const { appRouter } = await import("./router.js");
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.meta.breeds({ species: "dog" })).resolves.toBeDefined();
  });

  it("auth.session", async () => {
    const { appRouter } = await import("./router.js");
    const anon = appRouter.createCaller(makeContext());
    await expect(anon.auth.session()).resolves.toBeNull();
    const authed = appRouter.createCaller(makeContext(authedUser));
    await expect(authed.auth.session()).resolves.toEqual(authedUser);
  });

  it("users.byId, users.updateMe", async () => {
    const { appRouter } = await import("./router.js");
    const caller = appRouter.createCaller(makeContext(authedUser));
    await expect(caller.users.byId({ userId: "user-1" })).resolves.toBeDefined();
    await expect(caller.users.updateMe({ city: "Barcelona" })).resolves.toBeDefined();
  });

  it("pets.list, pets.byId, pets.listByOwner, pets.listMine, pets.create, pets.update, pets.setStatus, pets.remove", async () => {
    const { appRouter } = await import("./router.js");
    const caller = appRouter.createCaller(makeContext(authedUser));
    await expect(caller.pets.list({})).resolves.toBeDefined();
    await expect(caller.pets.byId({ petId: petFixture.id })).resolves.toBeDefined();
    await expect(caller.pets.listByOwner({ ownerId: "user-1" })).resolves.toBeDefined();
    await expect(caller.pets.listMine({})).resolves.toBeDefined();
    await expect(
      caller.pets.create({
        name: "Rex",
        species: "dog",
        sex: "male",
        ageMonths: 12,
        size: "medium",
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        photos: [{ uploadId: "44444444-4444-4444-8444-444444444444" }],
      }),
    ).resolves.toBeDefined();
    await expect(
      caller.pets.update({ petId: petFixture.id, name: "Rex II" }),
    ).resolves.toBeDefined();
    await expect(
      caller.pets.setStatus({ petId: petFixture.id, status: "reserved" }),
    ).resolves.toBeDefined();
    await expect(caller.pets.remove({ petId: petFixture.id })).resolves.toBeDefined();
  });

  it("adoptionRequests.create, .list, .byId, .respond, .withdraw", async () => {
    const { appRouter } = await import("./router.js");
    const caller = appRouter.createCaller(makeContext(authedUser));
    await expect(
      caller.adoptionRequests.create({
        petId: petFixture.id,
        message: "Hello, we'd love to meet Rex this week if possible, please let us know.",
      }),
    ).resolves.toBeDefined();
    await expect(caller.adoptionRequests.list({ role: "adopter" })).resolves.toBeDefined();
    await expect(
      caller.adoptionRequests.byId({ requestId: adoptionRequestFixture.id }),
    ).resolves.toBeDefined();
    await expect(
      caller.adoptionRequests.respond({ requestId: adoptionRequestFixture.id, status: "accepted" }),
    ).resolves.toBeDefined();
    await expect(
      caller.adoptionRequests.withdraw({ requestId: adoptionRequestFixture.id }),
    ).resolves.toBeDefined();
  });

  it("favourites.list, favourites.set", async () => {
    const { appRouter } = await import("./router.js");
    const caller = appRouter.createCaller(makeContext(authedUser));
    await expect(caller.favourites.list({})).resolves.toBeDefined();
    await expect(
      caller.favourites.set({ petId: petFixture.id, favourited: true }),
    ).resolves.toBeDefined();
  });
});
