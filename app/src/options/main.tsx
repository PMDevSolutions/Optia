import React from "react";
import ReactDOM from "react-dom/client";
import { Options } from "./Options";
import { loadTheme } from "@/lib/theme";
import "@/styles/globals.css";

// Apply persisted theme (light default) before first paint settles.
void loadTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
