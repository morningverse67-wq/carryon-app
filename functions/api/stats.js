import { keyOk } from "../../lib/stats.js";

// GET /api/stats with "Authorization: Bearer <ADMIN_KEY>": the site's numbers as JSON, for the app-stats dashboard (the one place to look).
// Without the right key it is a plain 404. Days are UTC.
const D30 = "date('now', '-29 days')";

export async function onRequestGet({ request, env }) {
  if (!keyOk(request.headers.get("Authorization")?.replace(/^Bearer /, ""), env.ADMIN_KEY)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const q = sql => env.DB.prepare(sql);
  const totals = t => q(`SELECT COUNT(*) AS total, COALESCE(SUM(day = date('now')), 0) AS today, COALESCE(SUM(day >= date('now', '-6 days')), 0) AS d7, COALESCE(SUM(day >= ${D30}), 0) AS d30 FROM ${t}`);
  const perDay = t => q(`SELECT day, COUNT(*) AS n FROM ${t} WHERE day >= ${D30} GROUP BY day`);
  const top = (t, col) => q(`SELECT ${col} AS k, COUNT(*) AS n FROM ${t} WHERE day >= ${D30} GROUP BY k ORDER BY n DESC LIMIT 10`);
  const [visits, downloads, visitDays, downloadDays, visitRefs, downloadRefs, downloadOs, reports] = (await env.DB.batch([
    totals("hits"), totals("downloads"), perDay("hits"), perDay("downloads"), top("hits", "ref"), top("downloads", "ref"), top("downloads", "os"),
    q("SELECT day, time, country, os, ver, body, email FROM reports ORDER BY rowid DESC LIMIT 10"),
  ])).map(r => r.results);
  return Response.json({ visits: visits[0], downloads: downloads[0], visitDays, downloadDays, visitRefs, downloadRefs, downloadOs, reports },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
