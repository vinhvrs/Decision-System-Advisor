import axios from "axios";

/** User-facing message for failed API calls (network down, timeout, HTTP errors). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return "Cannot reach the API server. Start the backend (port 1111) and try again.";
    }
    const body = err.response.data as { message?: string; error?: string } | undefined;
    if (typeof body?.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error === "Unauthorized"
        ? "Invalid email or password."
        : body.error;
    }
    if (err.response.status === 401) {
      return "Invalid email or password.";
    }
    if (err.response.status >= 500) {
      return "Server error. Please try again shortly.";
    }
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
