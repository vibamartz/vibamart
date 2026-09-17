/**
 * Recursively cleans an object or array by removing all keys with `undefined` values.
 * This prevents Firestore from throwing "Unsupported field value: undefined" errors during write operations.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    Object.keys(data as object).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    });
    return cleaned as T;
  }
  return data;
}
