package com.iigrain

import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "iiGrain"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Must run before super.onCreate() — it is what swaps the launch theme
    // (Theme.App.SplashScreen) for AppTheme.
    val splashScreen = installSplashScreen()
    super.onCreate(null)

    // Without this the OS drops the splash as soon as the activity window is
    // ready, which on a cold start is well before React Native has laid out
    // anything — that gap is the white flash. The condition is re-evaluated on
    // every pre-draw, so we simply hold until the RN root view has content.
    val holdUntil = SystemClock.uptimeMillis() + MAX_SPLASH_HOLD_MS
    splashScreen.setKeepOnScreenCondition {
      SystemClock.uptimeMillis() < holdUntil && !reactContentRendered()
    }
  }

  /**
   * True once the React root view has laid out at least one child, i.e. the
   * first JS frame is on screen and can take over from the native splash.
   */
  private fun reactContentRendered(): Boolean {
    val content = findViewById<ViewGroup>(android.R.id.content) ?: return true
    val reactRoot = content.getChildAt(0) as? ViewGroup ?: return false
    if (reactRoot.width == 0 || reactRoot.height == 0) return false
    for (i in 0 until reactRoot.childCount) {
      val child: View = reactRoot.getChildAt(i)
      if (child.width > 0 && child.height > 0) return true
    }
    return false
  }

  private companion object {
    /** Safety valve: never let a stalled JS bundle wedge the splash forever. */
    const val MAX_SPLASH_HOLD_MS = 8_000L
  }
}
