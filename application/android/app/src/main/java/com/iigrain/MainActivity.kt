package com.iigrain

import android.os.Bundle
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Draw the app content behind the (transparent) system bars on EVERY Android
    // version. Android 15+ enforces edge-to-edge anyway; doing it explicitly makes
    // older versions behave identically AND, crucially, makes the window insets
    // (status-bar height) reach react-native-safe-area-context - so the JS
    // StatusBarBackground strip gets a correct height and the primary-green status
    // bar shows app-wide instead of collapsing to a 0-height (invisible) strip.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    // super.onCreate(null) - react-native-screens requirement (avoids a fragment
    // state-restoration crash); RN restores its own JS state.
    super.onCreate(null)
  }

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
}
