export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Partial<Pick<T, K>> => {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
};
