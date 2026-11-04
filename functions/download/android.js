import { APK, sendOn } from "../../lib/stats.js";

// /download/android: the same as /download, for the Android beta's APK; its row says os = "android".
export const onRequest = c => sendOn(c, APK, "android");
