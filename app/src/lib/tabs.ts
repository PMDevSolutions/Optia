// Single place tab-opening goes through. Dev-mode detection elsewhere relies
// on `chrome.tabs === undefined`, so tests must mock this module rather than
// add a `chrome.tabs` mock to the global test setup.

/** Opens a URL in a new tab: chrome.tabs in the extension, window.open in the dev preview. */
export async function openInNewTab(url: string): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    await chrome.tabs.create({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Opens the extension's options page, falling back to a no-op in dev preview. */
export function openOptionsPage(): void {
  if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}
