// Maps AI errors to user-facing toast text. Proxy quota/unavailable errors
// carry friendly, actionable messages worth surfacing verbatim; anything else
// falls back to a generic message. Kept provider-agnostic (matches by name) so
// UI components don't import the AI modules.
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof Error &&
    (error.name === "AiUnavailableError" || error.name === "AiProxyError") &&
    error.message
  ) {
    return error.message;
  }
  return fallback;
}
