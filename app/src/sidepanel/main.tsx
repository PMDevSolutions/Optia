import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadTheme } from "@/lib/theme";
import { initEntitlementSync } from "@/lib/entitlement-store";
import "@/styles/globals.css";

// Apply persisted theme (light default) before first paint settles.
void loadTheme();

// Keep entitlement flags in sync with the options page and background refresh.
initEntitlementSync();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
