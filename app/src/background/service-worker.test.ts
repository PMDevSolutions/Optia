// Service worker registers listeners as side effects on import.
// We must set up chrome mocks BEFORE importing, then capture the callbacks.

let onActivatedCallback: (info: { tabId: number }) => void;
let onRemovedCallback: (tabId: number) => void;
let onMessageCallback: (
  message: Record<string, unknown>,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

const setOptionsMock = vi.fn().mockResolvedValue(undefined);
const setPanelBehaviorMock = vi.fn();
const openPanelMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  // Build fresh chrome mock with listener capture
  const chromeMock = {
    action: {
      onClicked: {
        addListener: vi.fn(),
      },
    },
    sidePanel: {
      setPanelBehavior: setPanelBehaviorMock,
      setOptions: setOptionsMock,
      open: openPanelMock,
    },
    tabs: {
      onActivated: {
        addListener: vi.fn((cb: (info: { tabId: number }) => void) => {
          onActivatedCallback = cb;
        }),
      },
      onRemoved: {
        addListener: vi.fn((cb: (tabId: number) => void) => {
          onRemovedCallback = cb;
        }),
      },
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn(),
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(
          (
            cb: (
              message: Record<string, unknown>,
              sender: unknown,
              sendResponse: (response: unknown) => void,
            ) => boolean | void,
          ) => {
            onMessageCallback = cb;
          },
        ),
      },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      lastError: null,
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(undefined),
      onAlarm: { addListener: vi.fn() },
    },
    scripting: {
      executeScript: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
  };

  // setup.ts defines chrome as writable, so assign directly
   
  (globalThis as any).chrome = chromeMock;
});

async function loadServiceWorker() {
  await import("./service-worker");
}

describe("service-worker", () => {
  describe("initialization", () => {
    it("sets openPanelOnActionClick to false for manual handling", async () => {
      await loadServiceWorker();
      expect(setPanelBehaviorMock).toHaveBeenCalledWith({
        openPanelOnActionClick: false,
      });
    });

    it("disables the panel globally by default", async () => {
      await loadServiceWorker();
      expect(setOptionsMock).toHaveBeenCalledWith({ enabled: false });
    });

    it("registers action.onClicked listener", async () => {
      await loadServiceWorker();
      expect(chrome.action.onClicked.addListener).toHaveBeenCalledOnce();
    });

    it("registers onActivated listener", async () => {
      await loadServiceWorker();
      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalledOnce();
    });

    it("registers onRemoved listener", async () => {
      await loadServiceWorker();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalledOnce();
    });

    it("registers onMessage listener", async () => {
      await loadServiceWorker();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    });
  });

  describe("onActivated — first click (panelTabs empty)", () => {
    it("does NOT disable specific tabs when panelTabs is empty", async () => {
      await loadServiceWorker();
      setOptionsMock.mockClear(); // Clear the startup global disable call

      // Simulate tab activation before any panel has been opened
      onActivatedCallback({ tabId: 1 });

      // Should NOT call setOptions with tabId (per-tab disable)
      expect(setOptionsMock).not.toHaveBeenCalled();
    });

    it("allows the panel to open on first icon click after install", async () => {
      await loadServiceWorker();
      setOptionsMock.mockClear(); // Clear the startup global disable call

      // Tab activates (service worker startup fires this)
      onActivatedCallback({ tabId: 1 });

      // Panel should NOT be disabled per-tab — setOptions should not have been called
      expect(setOptionsMock).not.toHaveBeenCalled();
    });
  });

  describe("onActivated — per-tab scoping (panelTabs has entries)", () => {
    it("disables panel for tabs NOT in panelTabs after panel has opened", async () => {
      await loadServiceWorker();

      // Simulate panel opened on tab 1
      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED", tabId: 1 }, {}, sendResponse);

      // Switch to tab 2 (panel was never opened there)
      onActivatedCallback({ tabId: 2 });

      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 2,
        enabled: false,
      });
    });

    it("enables panel for tabs that ARE in panelTabs", async () => {
      await loadServiceWorker();

      // Panel opened on tab 1
      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED", tabId: 1 }, {}, sendResponse);

      // Switch away then back to tab 1
      onActivatedCallback({ tabId: 2 }); // away
      setOptionsMock.mockClear();
      onActivatedCallback({ tabId: 1 }); // back

      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 1,
        path: "src/sidepanel/index.html",
        enabled: true,
      });
    });

    it("disables for new tabs but enables for known tabs", async () => {
      await loadServiceWorker();

      // Open panel on tabs 1 and 3
      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED", tabId: 1 }, {}, sendResponse);
      onMessageCallback({ type: "PANEL_OPENED", tabId: 3 }, {}, sendResponse);

      // Switch to tab 2 (unknown) → disabled
      setOptionsMock.mockClear();
      onActivatedCallback({ tabId: 2 });
      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 2,
        enabled: false,
      });

      // Switch to tab 3 (known) → enabled
      setOptionsMock.mockClear();
      onActivatedCallback({ tabId: 3 });
      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 3,
        path: "src/sidepanel/index.html",
        enabled: true,
      });
    });
  });

  describe("PANEL_OPENED message", () => {
    it("adds tab to panelTabs", async () => {
      await loadServiceWorker();

      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED", tabId: 5 }, {}, sendResponse);

      // Wait for async persistence to complete
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ ok: true });
      });

      // Now switching to tab 5 should enable (not disable)
      setOptionsMock.mockClear();
      onActivatedCallback({ tabId: 5 });
      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 5,
        path: "src/sidepanel/index.html",
        enabled: true,
      });
    });

    it("ignores PANEL_OPENED without tabId", async () => {
      await loadServiceWorker();
      setOptionsMock.mockClear(); // Clear the startup global disable call

      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED" }, {}, sendResponse);
      // Synchronous path - no tabId means immediate response
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });

      // panelTabs should still be empty — no disable on activate
      onActivatedCallback({ tabId: 1 });
      expect(setOptionsMock).not.toHaveBeenCalled();
    });
  });

  describe("tab cleanup", () => {
    it("removes tab from panelTabs when tab closes", async () => {
      await loadServiceWorker();

      // Open panel on tab 1
      const sendResponse = vi.fn();
      onMessageCallback({ type: "PANEL_OPENED", tabId: 1 }, {}, sendResponse);

      // Close tab 1
      onRemovedCallback(1);

      // Open panel on tab 2 so panelTabs.size > 0
      onMessageCallback({ type: "PANEL_OPENED", tabId: 2 }, {}, sendResponse);

      // Now switch to tab 1 — it should be disabled (removed from set)
      setOptionsMock.mockClear();
      onActivatedCallback({ tabId: 1 });
      expect(setOptionsMock).toHaveBeenCalledWith({
        tabId: 1,
        enabled: false,
      });
    });
  });
});
