const SENSITIVE_KEY = /password|token|cookie|secret/i;

export function scrubInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubInput);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[scrubbed]" : scrubInput(v),
      ]),
    );
  }
  return value;
}
