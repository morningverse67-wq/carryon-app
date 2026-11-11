import { APPSTORE, sendOn } from "../../lib/stats.js";

// /download/ios: the App Store page, counted like the other buttons; its row says os = "ios@<device>".
export const onRequest = c => sendOn(c, APPSTORE, "ios");
