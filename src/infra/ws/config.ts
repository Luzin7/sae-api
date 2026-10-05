/**
 * Transport-level limits shared by the WS plugin (server `maxPayload`) and the
 * gateway (pre-parse frame check + per-socket rate limit). Kept out of the chat
 * slice so the plugin stays generic and the numbers are declared once.
 */
export const WS_MAX_FRAME_BYTES = 4096;
export const WS_RATE_WINDOW_MS = 10_000;
export const WS_RATE_MAX_FRAMES = 20;
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
