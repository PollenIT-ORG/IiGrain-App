import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
// Pulled in by the `react-native-maps/Google` subspec declared in ios/Podfile.
// Without that subspec this import fails to resolve — that failure is the
// intended signal that iOS fell back to Apple MapKit.
import GoogleMaps

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// Authorises the Google Maps iOS SDK for this process.
  ///
  /// This MUST run before the first `GMSMapView` is instantiated. React Native
  /// mounts `<AppMapView>` some time after `startReactNative`, but the SDK is a
  /// process-wide singleton with no retry: if it is unkeyed when the first map
  /// view is created it logs
  /// "Google Maps SDK for iOS must be initialized via [GMSServices provideAPIKey:]"
  /// and every map in the session stays blank. Hence: first statement of
  /// `didFinishLaunchingWithOptions`.
  ///
  /// The key travels: application/.env → ios/Podfile (pod install) →
  /// Config/Env.generated.xcconfig → $(MAPS_API_KEY) → Info.plist `GMSApiKey` →
  /// here. It is deliberately never hardcoded in this file, which is committed.
  private func configureGoogleMaps() {
    let apiKey = (Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    guard !apiKey.isEmpty else {
      // Do not crash: a missing key must not block non-map work (unit tests,
      // simulator runs by developers without Maps Platform access).
      NSLog(
        "[Maps] GMSApiKey is empty — maps will render blank. "
          + "Set MAPS_API_KEY in application/.env and re-run `pod install`. "
          + "See docs/maps/SETUP.md."
      )
      return
    }

    GMSServices.provideAPIKey(apiKey)
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    configureGoogleMaps()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "iiGrain",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
