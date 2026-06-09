/**
 * Normalize Supabase/Prisma URLs for serverless (Vercel).
 * Session pooler (:5432) allows ~15 connections total — exhausts fast with Prisma.
 * Transaction pooler (:6543) + connection_limit=1 is required for production.
 */
export function resolveDatabaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  // Supabase session pooler → transaction pooler for Prisma serverless
  if (url.hostname.includes("pooler.supabase.com") && url.port === "5432") {
    url.port = "6543";
    url.searchParams.set("pgbouncer", "true");
  }

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }

  return url.toString();
}
