import { keyOk } from "../../lib/stats.js";

// POST /api/gh-traffic from tools/gh-traffic.sh: {k, views, clones, referrers}, the last three as `gh api` returns them.
// GitHub keeps 14 days of repo traffic; here a day keeps its row (a later copy of the same day replaces it).
// Anything without the INGEST_KEY secret gets the same 404 as a page that is not there.
const DAY = /^\d{4}-\d{2}-\d{2}T/;
export async function onRequestPost({ request, env }) {
  let b = null;
  try { b = await request.json(); } catch {}
  if (!keyOk(b?.k, env.INGEST_KEY)) return new Response("Not found", { status: 404 });
  const rows = [];
  for (const kind of ["views", "clones"])
    for (const d of Array.isArray(b[kind]?.[kind]) ? b[kind][kind].slice(0, 31) : [])
      if (DAY.test(d?.timestamp)) rows.push(env.DB.prepare("INSERT OR REPLACE INTO gh_daily (day, kind, count, uniques) VALUES (?, ?, ?, ?)")
        .bind(d.timestamp.slice(0, 10), kind, d.count >>> 0, d.uniques >>> 0));
  if (Array.isArray(b.referrers)) {
    rows.push(env.DB.prepare("DELETE FROM gh_referrers WHERE day = date('now')"));
    for (const r of b.referrers.slice(0, 20))
      if (typeof r?.referrer === "string") rows.push(env.DB.prepare("INSERT OR REPLACE INTO gh_referrers (day, referrer, count, uniques) VALUES (date('now'), ?, ?, ?)")
        .bind(r.referrer.slice(0, 80), r.count >>> 0, r.uniques >>> 0));
  }
  if (rows.length) await env.DB.batch(rows);
  return Response.json({ ok: true, statements: rows.length });
}
