import { keyOk, numbers } from "../../lib/stats.js";

// GET /api/stats with "Authorization: Bearer <ADMIN_KEY>": the numbers /admin shows, as JSON (lib/stats.js numbers()).
// Without the right key it is a plain 404. Days are Korean time; `downloads` is bursts that count, `clicks` every click.
export async function onRequestGet({ request, env }) {
  if (!keyOk(request.headers.get("Authorization")?.replace(/^Bearer /, ""), env.ADMIN_KEY)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const { ghSnaps, ...rest } = await numbers(env.DB);  // the daily GitHub copies are only /admin's working data
  return Response.json(rest, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
