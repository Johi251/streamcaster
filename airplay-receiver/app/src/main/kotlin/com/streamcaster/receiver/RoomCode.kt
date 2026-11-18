package com.streamcaster.receiver

import java.security.SecureRandom

/**
 * Room codes use exactly the same alphabet as the StreamCaster web app:
 * no 0/O and no 1/I/L, so a code read from a TV can be typed reliably.
 */
object RoomCode {
    private const val ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    const val LENGTH = 6

    fun generate(length: Int = LENGTH): String {
        val bytes = ByteArray(length)
        SecureRandom().nextBytes(bytes)
        return buildString(length) {
            for (b in bytes) append(ALPHABET[(b.toInt() and 0xFF) % ALPHABET.length])
        }
    }
}
