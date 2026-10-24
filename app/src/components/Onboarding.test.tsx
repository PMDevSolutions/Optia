import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Onboarding } from "./Onboarding";
import { FIRST_RUN_AI_TRY_KEY } from "@/lib/first-run-ai-try";
import { getStorageItem } from "@/lib/storage";

describe("Onboarding", () => {
  it("shows on a fresh install and, once dismissed, queues the first-run AI try", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.click(await screen.findByRole("button", { name: /get started/i }));

    expect(screen.queryByRole("button", { name: /get started/i })).not.toBeInTheDocument();
    await waitFor(async () => expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("pending"));
    expect(await getStorageItem("onboarding_dismissed")).toBe(true);
  });

  it("queues the try when closed with the X as well", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.click(await screen.findByRole("button", { name: /close/i }));

    await waitFor(async () => expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBe("pending"));
  });

  it("stays hidden, and queues nothing, once onboarding was dismissed before", async () => {
    await chrome.storage.local.set({ onboarding_dismissed: true });
    render(<Onboarding />);

    await waitFor(() => expect(chrome.storage.local.get).toHaveBeenCalledWith("onboarding_dismissed"));
    expect(screen.queryByRole("button", { name: /get started/i })).not.toBeInTheDocument();
    expect(await getStorageItem(FIRST_RUN_AI_TRY_KEY)).toBeNull();
  });
});
