import { WINZIP, sendOn } from "../../lib/stats.js";

// /download/windows: the same as /download, for the Windows beta's zip; its row says os = "windows".
export const onRequest = c => sendOn(c, WINZIP, "windows");
