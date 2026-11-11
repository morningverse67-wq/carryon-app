import { WINZIP, sendOn } from "../../lib/stats.js";

// /download/windows-zip: the Windows beta's zip (PowerShell line and the ZIP row), os = "windows".
export const onRequest = c => sendOn(c, WINZIP, "windows");
