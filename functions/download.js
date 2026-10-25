import { DMG, isBot, osClass, refHost } from "../lib/stats.js";

// /download: count one download (UTC day and time, country, the referrer's host, mac or other), then send the
// browser on to the newest GitHub release. Bots and HEAD requests are sent on too, without a row.
export function onRequest({ request, env, waitUntil }) {
  const ua = request.headers.get("User-Agent");
  if (request.method === "GET" && !isBot(ua))
    waitUntil(env.DB.prepare("INSERT INTO downloads (country, ref, os) VALUES (?, ?, ?)")
      .bind(request.cf?.country || null, refHost(request.headers.get("Referer")), osClass(ua)).run().catch(() => {}));
  return new Response(null, { status: 302, headers: { Location: DMG, "Cache-Control": "no-store" } });
}
