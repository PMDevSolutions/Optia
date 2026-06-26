import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadTheme } from "@/lib/theme";
import "@/styles/globals.css";

// Apply persisted theme (light default) before first paint settles.
void loadTheme();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
