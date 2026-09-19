interface ValidationIssue {
  msg?: string;
}

/**
 * Turn a FastAPI error `detail` into a message fit for the UI.
 *
 * HTTPException details are strings, but request-validation failures (422)
 * arrive as a list of issues, which must be flattened into readable text.
 */
export function formatApiErrorDetail(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue: ValidationIssue) => (issue?.msg ?? "").replace(/^Value error, /, "").trim())
      .filter(Boolean);
    if (messages.length > 0) return messages.join(". ");
  }

  return `Request failed (HTTP ${status})`;
}
