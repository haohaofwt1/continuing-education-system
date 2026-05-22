type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(request: Request, scope: string, limit = 60, windowMs = 60_000) {
  const key = `${scope}:${clientKey(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count <= limit) return;

  throw new Response(JSON.stringify({ error: "RATE_LIMITED", retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }), {
    status: 429,
    headers: { "Content-Type": "application/json" }
  });
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
