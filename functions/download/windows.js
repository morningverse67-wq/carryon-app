import { WINSTORE, sendOn } from "../../lib/stats.js";

// /download/windows: Microsoft Store page (11-11 게시); its row says os = "windows". The beta zip is /download/windows-zip.
export const onRequest = c => sendOn(c, WINSTORE, "windows");
