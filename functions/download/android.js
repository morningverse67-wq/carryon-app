import { PLAY, sendOn } from "../../lib/stats.js";

// /download/android: CarryOn on Google Play, counted like the other buttons; its row says os = "play@<device>". The APK is /download/android-apk.
export const onRequest = c => sendOn(c, PLAY, "play");
