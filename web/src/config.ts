/**
 * Backend origin for API calls.
 * - Dev default: same origin (Vite proxies `/api` → localhost:8080)
 * - Override with VITE_API_BASE_URL when needed
 */
export const apiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "" : "http://localhost:8080"),
)

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "")
}
