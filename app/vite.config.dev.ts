import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Vite plugin that proxies /api/fetch-page?url=... requests,
 * fetching the target URL server-side to avoid CORS issues.
 */
function fetchPageProxy(): Plugin {
  return {
    name: "fetch-page-proxy",
    configureServer(server) {
      server.middlewares.use("/api/fetch-page", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost").searchParams.get(
          "url",
        );
        if (!url) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ?url= parameter" }));
          return;
        }
        // Normalize URL — prepend https:// if no protocol
        let targetUrl = url;
        if (!/^https?:\/\//i.test(targetUrl)) {
          targetUrl = `https://${targetUrl}`;
        }
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const response = await fetch(targetUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            console.warn(
              `[fetch-page-proxy] Upstream returned ${response.status} for ${targetUrl}`,
            );
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: `Target page returned HTTP ${response.status} (${response.statusText})`,
                status: response.status,
              }),
            );
            return;
          }

          const contentType = response.headers.get("content-type") ?? "";
          if (
            !contentType.includes("text/html") &&
            !contentType.includes("application/xhtml")
          ) {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: `Target URL returned non-HTML content (${contentType})`,
              }),
            );
            return;
          }

          const html = await response.text();
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(html);
        } catch (err: unknown) {
          const message =
            err instanceof Error && err.name === "AbortError"
              ? "Request timed out after 15 seconds"
              : `Failed to fetch: ${err}`;
          console.error(`[fetch-page-proxy] ${message} — ${targetUrl}`);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

/**
 * Vite plugin that proxies /api/anthropic/* requests to api.anthropic.com,
 * avoiding CORS issues when calling Anthropic from the browser in dev mode.
 */
function anthropicProxy(): Plugin {
  const forwarded = [
    "content-type",
    "x-api-key",
    "anthropic-version",
    "anthropic-beta",
    "anthropic-dangerous-direct-browser-access",
  ];
  return {
    name: "anthropic-proxy",
    configureServer(server) {
      server.middlewares.use("/api/anthropic", async (req, res) => {
        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": forwarded.join(", "),
          });
          res.end();
          return;
        }

        // The Anthropic SDK's request path already includes /v1 (e.g. /v1/messages),
        // so forward it verbatim — do NOT re-prefix /v1 (that yields /v1/v1/...).
        const targetPath = (req.url ?? "").replace(/^\//, "");
        const targetUrl = `https://api.anthropic.com/${targetPath}`;

        try {
          // Read request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          const body = Buffer.concat(chunks).toString();

          const headers: Record<string, string> = {};
          for (const name of forwarded) {
            const value = req.headers[name];
            if (typeof value === "string") headers[name] = value;
          }
          console.log("[Anthropic Proxy] Request to:", targetUrl);

          const response = await fetch(targetUrl, {
            method: req.method ?? "POST",
            headers,
            body,
          });

          const responseBody = await response.text();
          console.log("[Anthropic Proxy] Response status:", response.status);
          if (response.status !== 200) {
            console.log("[Anthropic Proxy] Error response:", responseBody.slice(0, 500));
          }
          res.writeHead(response.status, {
            "Content-Type": response.headers.get("content-type") ?? "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(responseBody);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(`Anthropic proxy error: ${err}`);
        }
      });
    },
  };
}

/** The backend the dev preview harness reaches through /api/backend. */
export const DEV_BACKEND_TARGET = "https://optia-backend-staging.paul-130.workers.dev";

/**
 * Vite plugin that proxies /api/backend/* to the staging Optia backend.
 *
 * The harness page is served from http://localhost, which staging's CORS
 * allowlist rejects (it admits only the extension origin and the staging
 * site), so hosted-AI, license and billing calls made straight from the page
 * never get past the browser (#67). Routing them through the dev server
 * sidesteps CORS the same way /api/anthropic does for BYOK calls. The app opts
 * in via BACKEND_BASE_URL (src/lib/entitlement-keys.ts), which resolves to
 * this path only in the harness — the extension itself never uses it.
 */
export function backendProxy(): Plugin {
  // Only the request headers the backend's CORS policy accepts. Browser-added
  // headers (Origin, Host, cookies, Sec-Fetch-*) stay on this side.
  const forwarded = [
    "content-type",
    "authorization",
    "x-optia-entitlement",
    "x-optia-install-id",
  ];
  return {
    name: "backend-proxy",
    configureServer(server) {
      server.middlewares.use("/api/backend", async (req, res) => {
        // Handle CORS preflight (same-origin callers never send one; kept for parity)
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": forwarded.join(", "),
          });
          res.end();
          return;
        }

        // connect strips the mount path, so req.url is the backend route with
        // its query string intact (e.g. /ai/generate, /billing/session/cs_1?installId=...).
        const method = req.method ?? "GET";
        const targetUrl = `${DEV_BACKEND_TARGET}${req.url ?? ""}`;

        try {
          const headers: Record<string, string> = {};
          for (const name of forwarded) {
            const value = req.headers[name];
            if (typeof value === "string") headers[name] = value;
          }

          let body: string | undefined;
          if (method !== "GET" && method !== "HEAD") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks).toString();
          }

          const response = await fetch(targetUrl, { method, headers, body });
          const responseBody = await response.text();
          console.log(`[Backend Proxy] ${method} ${req.url} -> ${response.status}`);
          if (!response.ok) {
            console.log("[Backend Proxy] Error response:", responseBody.slice(0, 500));
          }
          // Status and body pass through untouched so ai-proxy.ts / backend.ts
          // map errors exactly as they would against staging directly.
          res.writeHead(response.status, {
            "Content-Type": response.headers.get("content-type") ?? "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(responseBody);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(`Backend proxy error: ${err}`);
        }
      });
    },
  };
}

// Dev preview config — no CRXJS, just serves the side panel UI in a browser tab
export default defineConfig({
  plugins: [react(), fetchPageProxy(), anthropicProxy(), backendProxy()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  root: ".",
  server: {},
});
