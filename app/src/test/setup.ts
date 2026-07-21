import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// jsdom has no SubtleCrypto; jose needs WebCrypto (incl. Ed25519) for JWS verification
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

// Mock chrome.storage API for tests
const storage: Record<string, unknown> = {};
const sessionStorage: Record<string, unknown> = {};

function createStorageMock(store: Record<string, unknown>) {
  return {
    get: vi.fn((keys: string | string[]) => {
      if (typeof keys === "string") {
        return Promise.resolve({ [keys]: store[keys] ?? undefined });
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        result[key] = store[key] ?? undefined;
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const toRemove = typeof keys === "string" ? [keys] : keys;
      for (const key of toRemove) {
        delete store[key];
      }
      return Promise.resolve();
    }),
  };
}

const chromeStorageMock = {
  local: createStorageMock(storage),
  session: createStorageMock(sessionStorage),
  onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
};

Object.defineProperty(globalThis, "chrome", {
  value: {
    storage: chromeStorageMock,
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(undefined),
      onAlarm: { addListener: vi.fn() },
    },
  },
  writable: true,
});

// Reset storage between tests
beforeEach(() => {
  Object.keys(storage).forEach((key) => delete storage[key]);
  Object.keys(sessionStorage).forEach((key) => delete sessionStorage[key]);
  vi.clearAllMocks();
});
