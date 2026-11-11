import { cleanHit, counted } from "../../lib/stats.js";

// POST /api/hit, the page's beacon: one row per visit (Korean day, path, the referrer's host, country, page language, the link's ?s= tag).
// Bots, preview hosts and the browser that opened /admin are not counted (lib/stats.js counted()).
// ponytail: no rate limit, so anyone can inflate the count; add one keyed on a hashed IP if that ever happens.
export async function onRequestPost({ request, env }) {
  if (counted(request) && Number(request.headers.get("Content-Length") || 0) <= 1000) {
    const hit = cleanHit(await request.text(), new URL(request.url).hostname);
    if (hit) await env.DB.prepare("INSERT INTO hits (day, path, ref, country, lang, src) VALUES (date('now', '+9 hours'), ?, ?, ?, ?, ?)")
      .bind(hit.path, hit.ref, request.cf?.country || null, hit.lang, hit.src).run().catch(() => {});
  }
  return new Response(null, { status: 204 });
}
