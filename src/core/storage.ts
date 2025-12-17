export type storage_like = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function get_json<T>({
  storage,
  key,
  fallback
}: {
  storage: storage_like;
  key: string;
  fallback: T;
}): T {
  const raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function set_json({
  storage,
  key,
  value
}: {
  storage: storage_like;
  key: string;
  value: unknown;
}) {
  storage.setItem(key, JSON.stringify(value));
}
