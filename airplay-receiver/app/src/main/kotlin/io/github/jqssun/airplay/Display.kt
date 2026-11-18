package io.github.jqssun.airplay

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display

// physical panel resolution
fun Context.realDisplaySize(): Pair<Int, Int> {
    // The Class-based getSystemService() overload and Display.getMode() are
    // API 23+. Older platforms fall back to the current display metrics.
    val manager = getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
    val display = manager?.getDisplay(Display.DEFAULT_DISPLAY)
    if (Build.VERSION.SDK_INT >= 23 && display != null) {
        val mode = display.mode
        return mode.physicalWidth to mode.physicalHeight
    }
    return resources.displayMetrics.let { it.widthPixels to it.heightPixels }
}
