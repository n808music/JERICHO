type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

function normalize(value: any): JSONValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((entry) => normalize(entry));
  if (typeof value === 'object') {
    const out: { [key: string]: JSONValue } = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const normalized = normalize(value[key]);
        out[key] = normalized;
      });
    return out;
  }
  return String(value);
}

export function stableStringify(value: any, space = 0): string {
  return JSON.stringify(normalize(value), null, space);
}

export function stableParse(value: any): any {
  return JSON.parse(stableStringify(value));
}
