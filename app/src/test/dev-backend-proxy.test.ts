// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import type { Connect, ViteDevServer } from "vite";
import { backendProxy, DEV_BACKEND_TARGET } from "../../vite.config.dev";

// Drives the /api/backend middleware the dev preview harness relies on (#67)
// with hand-built request/response objects and a stubbed global fetch, so the
// proxy's forwarding rules are pinned without starting a vite server.

type Handler = Connect.NextHandleFunction;

async function mountBackendProxy(): Promise<Handler> {
  const plugin = backendProxy();
  const mounted = new Map<string, Handler>();
  const server = {
    middlewares: {
      use: (path: string, handler: Handler) => {
        mounted.set(path, handler);
      },
    },
  } as unknown as ViteDevServer;

  const hook = plugin.configureServer;
  if (!hook) throw new Error("backendProxy has no configureServer hook");
  await (typeof hook === "function" ? hook : hook.handler)(server);

  const handler = mounted.get("/api/backend");
  if (!handler) throw new Error("backendProxy did not mount /api/backend");
  return handler;
}

interface FakeRequestInit {
  method: string;
  /** The path as connect hands it to a mounted middleware: mount prefix already stripped. */
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeRequest({ method, url, headers = {}, body }: FakeRequestInit) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  return Object.assign(stream, { method, url, headers }) as unknown as Connect.IncomingMessage;
}

function fakeResponse() {
  const res = { writeHead: vi.fn(), end: vi.fn() };
  res.writeHead.mockReturnValue(res);
  return res as unknown as ServerResponse & typeof res;
}

function upstream(status: number, body: string, contentType = "application/json") {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

async function proxy(req: Connect.IncomingMessage) {
  const handler = await mountBackendProxy();
  const res = fakeResponse();
  await handler(req, res, vi.fn());
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backendProxy (dev harness → staging backend)", () => {
  it("forwards a GET to the staging backend and relays status, content type and body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(upstream(200, '{"models":["claude-x"]}', "application/json; charset=utf-8"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxy(fakeRequest({ method: "GET", url: "/ai/models?installId=abc" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${DEV_BACKEND_TARGET}/ai/models?installId=abc`, {
      method: "GET",
      headers: {},
      body: undefined,
    });
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    expect(res.end).toHaveBeenCalledWith('{"models":["claude-x"]}');
  });

  it("forwards a POST body with only the headers the backend accepts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, '{"recommendation":"ok"}'));
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ checkId: "title-keyword", keyword: "seo", installId: "install-1" });

    await proxy(
      fakeRequest({
        method: "POST",
        url: "/ai/generate",
        body,
        headers: {
          "content-type": "application/json",
          "x-optia-entitlement": "tok-123",
          "x-optia-install-id": "install-1",
          authorization: "Bearer abc",
          // Browser-supplied headers that must not reach staging.
          origin: "http://localhost:5173",
          host: "localhost:5173",
          referer: "http://localhost:5173/dev.html",
          cookie: "session=secret",
          "sec-fetch-mode": "cors",
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(`${DEV_BACKEND_TARGET}/ai/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-optia-entitlement": "tok-123",
        "x-optia-install-id": "install-1",
        authorization: "Bearer abc",
      },
      body,
    });
  });

  it("relays upstream error statuses and bodies unchanged so the app's error mapping still applies", async () => {
    const errorBody = '{"error":{"code":"QUOTA_EXCEEDED","message":"AI quota reached."}}';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream(429, errorBody)));

    const res = await proxy(fakeRequest({ method: "POST", url: "/ai/generate", body: "{}" }));

    expect(res.writeHead).toHaveBeenCalledWith(429, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    expect(res.end).toHaveBeenCalledWith(errorBody);
  });

  it("answers CORS preflight itself without contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxy(fakeRequest({ method: "OPTIONS", url: "/ai/generate" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(
      204,
      expect.objectContaining({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": expect.stringContaining("POST"),
      }),
    );
    expect(res.end).toHaveBeenCalledWith();
  });

  it("responds 502 when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const res = await proxy(fakeRequest({ method: "GET", url: "/health" }));

    expect(res.writeHead).toHaveBeenCalledWith(502, { "Content-Type": "text/plain" });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Backend proxy error"));
  });
});
