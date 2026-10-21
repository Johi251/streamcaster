export * from "./protocol.js";
export * from "./roomcode.js";
export * from "./capabilities.js";
export * from "./client.js";

/** Message chunk size for datachannel file transfer. */
export const FILE_CHUNK_SIZE = 16 * 1024;
/** Backpressure threshold on datachannel bufferedAmount. */
export const FILE_BUFFER_LOW = 512 * 1024;
