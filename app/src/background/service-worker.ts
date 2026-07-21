import { extractPageDataInline } from "@/lib/extract-page-data-inline";
import { registerEntitlementAlarms } from "@/background/entitlement-alarm";

console.log("[Optia] Service worker initializing...");

// Entitlement auto-refresh (alarms + install/startup + storage sync)
registerEntitlementAlarms();

// Disable automatic panel opening - we'll handle it manually for per-tab scoping
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// Disable the panel globally by default - we'll enable it only for specific tabs
// This prevents the panel from appearing on tabs where it wasn't explicitly opened
chrome.sidePanel.setOptions({ enabled: false });

// Handle action click to open panel only on the specific tab
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  // Open the panel on this specific tab (must be synchronous for user gesture)
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "src/sidepanel/index.html",
    enabled: true,
  });
  chrome.sidePanel.open({ tabId: tab.id });
});

// Track which tabs have the panel open for per-tab scoping
// Persisted to session storage to survive MV3 service worker restarts
const panelTabs = new Set<number>();
const PANEL_TABS_KEY = "panel_tabs";

// Load persisted panel tabs on startup
chrome.storage.session.get(PANEL_TABS_KEY).then((result) => {
  const saved = result[PANEL_TABS_KEY] as number[] | undefined;
  if (saved?.length) {
    saved.forEach((id) => panelTabs.add(id));
    console.log("[Optia] Restored panel tabs:", saved);
  }
}).catch(() => {
  // Ignore errors
});

async function persistPanelTabs(): Promise<void> {
  try {
    await chrome.storage.session.set({ [PANEL_TABS_KEY]: Array.from(panelTabs) });
  } catch {
    // Ignore errors
  }
}

async function addPanelTab(tabId: number): Promise<void> {
  panelTabs.add(tabId);
  await persistPanelTabs();
}

async function removePanelTab(tabId: number): Promise<void> {
  panelTabs.delete(tabId);
  await persistPanelTabs();
}

console.log("[Optia] Service worker initialized successfully");

// When the user switches tabs, hide the panel unless it was opened on that tab.
// Only start scoping after the panel has been opened at least once — otherwise
// the first click after install/reload would be blocked (chicken-and-egg bug).
chrome.tabs.onActivated.addListener(({ tabId }) => {
  console.log("[Optia] Tab activated:", tabId, "panelTabs:", Array.from(panelTabs));
  if (panelTabs.size === 0) {
    console.log("[Optia] panelTabs empty, skipping");
    return;
  }
  if (panelTabs.has(tabId)) {
    console.log("[Optia] Enabling panel for tab:", tabId);
    chrome.sidePanel.setOptions({
      tabId,
      path: "src/sidepanel/index.html",
      enabled: true,
    });
  } else {
    console.log("[Optia] Disabling panel for tab:", tabId);
    chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  removePanelTab(tabId);
  // Clean up per-tab analysis from session storage
  chrome.storage.session.remove(`tab_analysis_${tabId}`).catch(() => {
    // Ignore errors (e.g., if session storage is unavailable)
  });
});

console.log("[Optia] Registering message listener...");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Optia] Received message:", message.type);

  // Ping handler for verifying service worker is responsive
  if (message.type === "PING") {
    console.log("[Optia] Responding to PING");
    sendResponse({ pong: true, timestamp: Date.now() });
    return true;
  }

  // Side panel reports which tab it opened on
  if (message.type === "PANEL_OPENED") {
    if (message.tabId) {
      addPanelTab(message.tabId as number).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }

  if (message.type === "EXECUTE_CONTENT_SCRIPT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ error: "No active tab" });
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            return true;
          },
        });
        sendResponse({ results });
      } catch (error) {
        sendResponse({ error: String(error) });
      }
    });
    return true;
  }

  // Extract SEO data by injecting analyzer script directly
  // (Side panel already tried content script and it failed, so skip that step here)
  if (message.type === "EXTRACT_PAGE_DATA") {
    const tabId = message.tabId as number;
    console.log("[Optia] EXTRACT_PAGE_DATA for tab:", tabId);
    (async () => {
      try {
        // Inject the analyzer directly via executeScript
        console.log("[Optia] Executing analyzer script...");
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: extractPageDataInline,
        });
        console.log("[Optia] executeScript completed, results:", results?.length ?? 0);
        const data = results?.[0]?.result;
        if (data) {
          console.log("[Optia] Sending extracted data back");
          sendResponse({ data });
        } else {
          console.log("[Optia] No data from executeScript");
          sendResponse({ error: "Failed to extract page data" });
        }
      } catch (error) {
        console.error("[Optia] EXTRACT_PAGE_DATA error:", error);
        sendResponse({ error: String(error) });
      }
    })().catch((err) => {
      // Catch any unhandled promise rejections from the async IIFE
      console.error("[Optia] Unhandled error in EXTRACT_PAGE_DATA:", err);
      try {
        sendResponse({ error: String(err) });
      } catch {
        // sendResponse may have already been called
      }
    });
    return true;
  }

  if (message.type === "SEND_TO_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tabId, message.payload, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse(response);
      });
    });
    return true;
  }
});
