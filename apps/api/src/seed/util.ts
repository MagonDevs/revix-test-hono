// Seed code leans on array indices that are provably in range by
// construction (cyclic `i % list.length` lookups, etc.), but the repo's
// eslint config forbids `!` (no-non-null-assertion) everywhere. These
// two helpers are the sanctioned way to assert that here: they throw
// with a useful message instead of silently trusting a bang.

export function req<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) {
    throw new Error(`seed: expected ${what} to be defined`);
  }
  return value;
}

export function at<T>(arr: readonly T[], index: number, what = "array"): T {
  const value = arr[index];
  return req(value, `${what}[${index}]`);
}
