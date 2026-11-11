import { cleanReport, who } from "../../lib/stats.js";

// POST /api/report, the site's bug form: one row in `reports`. 204 when stored (or quietly dropped for the form's trap),
// 400 for a bad body, 429 after 5 reports from one place in a UTC day.
export async function onRequestPost({ request, env }) {
  if (!request.headers.get("User-Agent") || Number(request.headers.get("Content-Length") || 0) > 10000) return new Response(null, { status: 400 });
  const r = cleanReport(await request.text());
  if (r === "trap") return new Response(null, { status: 204 });
  if (!r) return new Response(null, { status: 400 });
  const day = new Date().toISOString().slice(0, 10);
  const w = await who(request.headers.get("CF-Connecting-IP"), day);
  const seen = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE day = ? AND who = ?").bind(day, w).first();
  if ((seen?.n || 0) >= 5) return new Response(null, { status: 429 });
  await env.DB.prepare("INSERT INTO reports (day, country, os, ver, body, email, who) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(day, request.cf?.country || null, r.os, r.ver, r.what, r.email, w).run();
  return new Response(null, { status: 204 });
}
