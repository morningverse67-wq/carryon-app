import { DMG, sendOn } from "../lib/stats.js";

// /download: count one click (UTC day and time, country, the referrer's host, the file and the device), then send the
// browser on to the newest GitHub release. Bots and HEAD requests are sent on too, without a row.
export const onRequest = c => sendOn(c, DMG, "mac");
