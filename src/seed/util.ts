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
