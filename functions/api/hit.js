import { cleanHit, isBot } from "../../lib/stats.js";

// POST /api/hit, the page's beacon: one row per visit (UTC day, path, the referrer's host, country, page language).
// ponytail: no rate limit, so anyone can inflate the count; add one keyed on a hashed IP if that ever happens.
export async function onRequestPost({ request, env }) {
  if (!isBot(request.headers.get("User-Agent")) && Number(request.headers.get("Content-Length") || 0) <= 1000) {
    const hit = cleanHit(await request.text(), new URL(request.url).hostname);
    if (hit) await env.DB.prepare("INSERT INTO hits (path, ref, country, lang) VALUES (?, ?, ?, ?)")
      .bind(hit.path, hit.ref, request.cf?.country || null, hit.lang).run().catch(() => {});
  }
  return new Response(null, { status: 204 });
}
