// Architecture §3.1 — injected clock, makes time-dependent behaviour
// (createdAt ordering, respondedAt) testable without mocking globals.
export interface ClockPort {
  now(): Date;
}
