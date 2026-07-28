import { headers } from "next/headers";

// Server Actions don't receive a Request object, so IP has to come from
// headers() instead of request.headers like the Route Handlers use.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
