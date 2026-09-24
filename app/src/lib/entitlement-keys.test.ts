import { describe, it, expect } from "vitest";
import {
  BACKEND_BASE_URL,
  DEV_BACKEND_PROXY_PATH,
  resolveBackendBaseUrl,
} from "@/lib/entitlement-keys";

const STAGING = "https://optia-backend-staging.paul-130.workers.dev";
const PRODUCTION = "https://api.optia-api.com";

// window.location shapes for the three places the app's modules load.
const harnessPage = { protocol: "http:", origin: "http://localhost:5173" };
const extensionPage = {
  protocol: "chrome-extension:",
  origin: "chrome-extension://gnlidlpidaoalbbmekofjednjkhhmehn",
};

describe("resolveBackendBaseUrl", () => {
  it("routes the dev preview harness through the vite /api/backend proxy (#67)", () => {
    expect(resolveBackendBaseUrl("development", harnessPage)).toBe(
      `http://localhost:5173${DEV_BACKEND_PROXY_PATH}`,
    );
  });

  it("keeps the proxy on the page origin when the harness is served elsewhere", () => {
    expect(
      resolveBackendBaseUrl("development", { protocol: "http:", origin: "http://192.168.1.20:4173" }),
    ).toBe("http://192.168.1.20:4173/api/backend");
  });

  it("sends the unpacked dev extension (chrome-extension:// pages) to staging", () => {
    expect(resolveBackendBaseUrl("development", extensionPage)).toBe(STAGING);
  });

  it("sends the service worker (no document location) to staging in development", () => {
    expect(resolveBackendBaseUrl("development", undefined)).toBe(STAGING);
  });

  it("sends production builds to the production API regardless of location", () => {
    expect(resolveBackendBaseUrl("production", harnessPage)).toBe(PRODUCTION);
    expect(resolveBackendBaseUrl("production", extensionPage)).toBe(PRODUCTION);
    expect(resolveBackendBaseUrl("production", undefined)).toBe(PRODUCTION);
  });

  it("sends every other mode (test, staging) to staging even on localhost", () => {
    expect(resolveBackendBaseUrl("test", harnessPage)).toBe(STAGING);
    expect(resolveBackendBaseUrl("staging", harnessPage)).toBe(STAGING);
  });
});

describe("BACKEND_BASE_URL under vitest", () => {
  it("is the staging URL, so unit tests never resolve to the harness proxy", () => {
    expect(BACKEND_BASE_URL).toBe(STAGING);
  });
});
