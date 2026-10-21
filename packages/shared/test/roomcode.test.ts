import { describe, expect, it } from "vitest";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "../src/roomcode.js";

describe("generateRoomCode", () => {
  it("generates codes with correct length from the no-confusable alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it("never contains confusable characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).not.toMatch(/[0O1IL]/);
    }
  });

  it("is reasonably random (collision sanity over 500 draws)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) set.add(generateRoomCode());
    // 30^6 = 729M space; collisions should be vanishingly rare
    expect(set.size).toBeGreaterThan(495);
  });
});

describe("normalizeRoomCode", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeRoomCode("ab3-9xq")).toBe("AB39XQ");
  });

  it("uppercases and strips separators, leaves lookalikes for validation", () => {
    expect(normalizeRoomCode("ab3-9xq")).toBe("AB39XQ");
    expect(normalizeRoomCode("a0b1co")).toBe("A0B1CO"); // invalid chars preserved -> isValidRoomCode rejects
    expect(isValidRoomCode(normalizeRoomCode("a0b1co"))).toBe(false);
  });
});
