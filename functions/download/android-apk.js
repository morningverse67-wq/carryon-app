import { APK, sendOn } from "../../lib/stats.js";

// /download/android-apk: the same as /download, for the Android APK (the install details' #apk card); its row says os = "android".
export const onRequest = c => sendOn(c, APK, "android");
