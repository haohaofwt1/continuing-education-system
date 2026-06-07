export function isDemoFallbackEnabled() {
  if (process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_FALLBACK === "false") return false;
  return process.env.NODE_ENV !== "production";
}
