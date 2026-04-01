export const calculateDiff = (
  before: Record<string, any>,
  after: Record<string, any>,
  meaningfulFields: string[]
): {
  changedFields: string[];
  before: Record<string, any>;
  after: Record<string, any>;
} | null => {
  const changedFields: string[] = [];
  const beforeValues: Record<string, any> = {};
  const afterValues: Record<string, any> = {};

  for (const field of meaningfulFields) {
    const valBefore = before[field];
    const valAfter = after[field];

    if (!isEqual(valBefore, valAfter)) {
      changedFields.push(field);
      beforeValues[field] = valBefore;
      afterValues[field] = valAfter;
    }
  }

  if (changedFields.length === 0) {
    return null;
  }

  return {
    changedFields,
    before: beforeValues,
    after: afterValues,
  };
};

function isEqual(v1: unknown, v2: unknown): boolean {
  if (v1 === v2) return true;

  if (v1 instanceof Date && v2 instanceof Date) {
    return v1.getTime() === v2.getTime();
  }

  // Handle Date comparison when one might be a string (e.g. from a payload)
  if (v1 instanceof Date && typeof v2 === "string") {
    return v1.toISOString() === new Date(v2).toISOString();
  }
  if (typeof v1 === "string" && v2 instanceof Date) {
    return new Date(v1).toISOString() === v2.toISOString();
  }

  // Normalize null vs undefined
  if (v1 == null && v2 == null) return true;

  if (typeof v1 !== typeof v2) return false;

  if (Array.isArray(v1) && Array.isArray(v2)) {
    if (v1.length !== v2.length) return false;
    return v1.every((item, i) => isEqual(item, v2[i]));
  }

  if (v1 !== null && typeof v1 === "object" && v2 !== null && typeof v2 === "object") {
    const keys1 = Object.keys(v1 as object);
    const keys2 = Object.keys(v2 as object);
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) => isEqual((v1 as any)[key], (v2 as any)[key]));
  }

  return false;
}
