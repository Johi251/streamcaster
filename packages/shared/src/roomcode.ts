/**
 * Room code generation: 6 chars from a no-confusable alphabet
 * (no 0/O, no 1/I/L) so codes can be typed from a TV screen reliably.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((c) => ALPHABET.includes(c))
  );
}

/**
 * Uppercases and strips separators. Excluded lookalikes (0/O, 1/I/L) are NOT
 * remapped: codes never contain them, so a typed lookalike means a misread
 * character that cannot be safely guessed — leave it for validation to reject.
 */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
