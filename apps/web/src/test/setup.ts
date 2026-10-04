import "@testing-library/jest-dom/vitest";

// Node 26 exposes an experimental global `localStorage` that is unavailable
// without `--localstorage-file`; it shadows the one provided by the jsdom
// environment, leaving `window.localStorage` undefined. Install a minimal
// in-memory storage so tests (and hooks) share working semantics.
if (typeof window.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) =>
        store.has(key) ? (store.get(key) as string) : null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    } satisfies Storage,
    configurable: true,
  });
}
