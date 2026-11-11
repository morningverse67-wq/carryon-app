import { WINSTORE, sendOn } from "../../lib/stats.js";

// /download/windows: the Microsoft Store page (11-11 게시); its row says os = "winstore@<device>". The beta zip is /download/windows-zip.
export const onRequest = c => sendOn(c, WINSTORE, "winstore");
