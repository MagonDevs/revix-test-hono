// Architecture §2 — injected rather than called globally, so ids are
// deterministic in tests.
export interface IdPort {
  next(): string;
}
